import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import dotenv from "dotenv";
import { supabase } from "./supabase";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
type OAuthProvider = "github" | "google" | "discord";

const selectableProviders = new Set<OAuthProvider>(["github", "google"]);

function parseProvider(rawProvider: unknown): OAuthProvider | null {
  if (typeof rawProvider !== "string") return null;
  const normalized = rawProvider.toLowerCase() as OAuthProvider;
  return selectableProviders.has(normalized) ? normalized : null;
}

// ─── Middlewares ──────────────────────────────────────────────────────────────

// Sirve los archivos estáticos del directorio "public" (HTML, CSS, JS del cliente)
app.use(express.static(path.join(__dirname, "../public")));

// Habilita la lectura de cookies en las peticiones entrantes.
// Usamos una cookie firmada para guardar el access_token del usuario de forma segura.
app.use(cookieParser(process.env.COOKIE_SECRET || "secreto-de-desarrollo"));

// ─── Rate limiter ─────────────────────────────────────────────────────────────

// Limita las peticiones a /auth/login para prevenir abuso del flujo OAuth2.
// Máximo 10 intentos por IP cada 15 minutos.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: "Demasiados intentos de inicio de sesión. Inténtalo más tarde.",
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Rutas ────────────────────────────────────────────────────────────────────

/**
 * GET /auth/login
 * Inicia el flujo OAuth2: redirige al usuario a la página de autorización
 * del proveedor (ej. GitHub, Google) a través de Supabase.
 *
 * Puedes elegir el proveedor con el query param ?provider=github|google.
 * Si no se envía query param, usa el proveedor por defecto de OAUTH_PROVIDER.
 */
app.get("/auth/login", authLimiter, async (req: Request, res: Response) => {
  const queryProvider = parseProvider(req.query.provider);

  if (req.query.provider && !queryProvider) {
    res.status(400).send("Proveedor no soportado. Usa ?provider=github o ?provider=google.");
    return;
  }

  const defaultProvider = parseProvider(process.env.OAUTH_PROVIDER) || "google";
  const provider = queryProvider || defaultProvider;

  // Guardamos el proveedor seleccionado para poder mostrarlo correctamente
  // al finalizar el callback OAuth, incluso con cuentas enlazadas.
  res.cookie("oauth_provider", provider, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000, // 10 minutos
  });

  // Supabase genera la URL de autorización del proveedor OAuth2.
  // redirectTo debe coincidir con la URL de callback registrada en Supabase
  // y en la configuración del proveedor OAuth (GitHub App, Google Console, etc.).
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.APP_URL || "http://localhost:" + PORT}/auth/callback`,
      // skipBrowserRedirect: true para obtener la URL y redirigir manualmente
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    res.status(500).send("Error al iniciar el flujo OAuth2: " + error?.message);
    return;
  }

  // Redirige al usuario a la página del proveedor para que autorice la aplicación
  res.redirect(data.url);
});

/**
 * GET /auth/callback
 * Punto de retorno tras la autorización del proveedor.
 * Supabase/el proveedor redirige aquí con un "code" en la query string.
 * Intercambiamos ese código por una sesión (access_token + refresh_token).
 */
app.get("/auth/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;

  if (!code) {
    const providerError = req.query.error_description || req.query.error;
    const details = providerError
      ? ` Detalle del proveedor: ${providerError}`
      : " Revisa que en Google/GitHub la callback OAuth sea https://<tu-project-ref>.supabase.co/auth/v1/callback y que en Supabase exista http://localhost:3000/auth/callback en Redirect URLs.";

    res.status(400).send("Código de autorización no encontrado en la URL." + details);
    return;
  }

  // exchangeCodeForSession completa el intercambio OAuth2:
  // envía el "code" a Supabase, que lo valida con el proveedor
  // y devuelve un access_token y refresh_token.
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    res.status(500).send("Error al intercambiar el código: " + error?.message);
    return;
  }

  const loginProvider = parseProvider(req.signedCookies?.oauth_provider);

  // Guardamos el access_token en una cookie HTTP-only firmada.
  // HTTP-only: inaccesible desde JavaScript del navegador (mitiga XSS).
  // sameSite "lax": protección básica contra CSRF.
  // maxAge: el token expira en 1 hora (3600 segundos).
  res.cookie("access_token", data.session.access_token, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600 * 1000, // 1 hora en milisegundos
  });

  if (loginProvider) {
    res.cookie("login_provider", loginProvider, {
      httpOnly: true,
      signed: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 3600 * 1000,
    });
  }

  res.clearCookie("oauth_provider");

  // Redirige al perfil del usuario una vez autenticado
  res.redirect("/profile");
});

/**
 * GET /profile
 * Ruta protegida: muestra los datos del usuario autenticado.
 * Requiere que el access_token esté presente en la cookie.
 */
app.get("/profile", async (req: Request, res: Response) => {
  const token = req.signedCookies?.access_token as string | undefined;

  if (!token) {
    // Si no hay token, redirige al inicio de sesión
    res.redirect("/");
    return;
  }

  // Usa el access_token para obtener los datos del usuario desde Supabase.
  // getUser verifica el JWT contra Supabase y devuelve el perfil del usuario.
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    // Token inválido o expirado: limpia la cookie y redirige al inicio
    res.clearCookie("access_token");
    res.redirect("/");
    return;
  }

  const user = data.user;
  const cookieProvider = parseProvider(req.signedCookies?.login_provider);
  const providerToShow =
    cookieProvider ||
    (typeof user.app_metadata?.["provider"] === "string"
      ? user.app_metadata["provider"]
      : "desconocido");

  // Construye una página HTML minimalista con los datos del usuario
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Perfil</title>
      <link rel="stylesheet" href="/style.css" />
    </head>
    <body>
      <main class="card">
        <img
          src="${user.user_metadata?.["avatar_url"] || "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.email || "U")}"
          alt="Avatar"
          class="avatar"
        />
        <h1>${user.user_metadata?.["full_name"] || user.user_metadata?.["name"] || "Usuario"}</h1>
        <p class="email">${user.email || "Sin correo"}</p>
        <p class="provider">Proveedor: <strong>${providerToShow}</strong></p>
        <a href="/auth/logout" class="btn btn-outline">Cerrar sesión</a>
      </main>
    </body>
    </html>
  `);
});

/**
 * GET /auth/logout
 * Cierra la sesión: elimina la cookie del servidor.
 * (El token en Supabase expirará naturalmente o puede invalidarse
 *  llamando a supabase.auth.signOut() si se dispone del token.)
 */
app.get("/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie("access_token");
  res.redirect("/");
});

// ─── Inicio del servidor ──────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
