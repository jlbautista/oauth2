# OAuth2 con TypeScript, Node.js y Supabase

Ejemplo mínimo de autenticación OAuth2 usando **Express**, **TypeScript** y el cliente de **Supabase**.

## Flujo OAuth2

```
Usuario → /auth/login → Supabase → Proveedor (GitHub/Google/…)
                                         ↓
Usuario ← /profile   ← /auth/callback ←─┘
```

1. El usuario hace clic en "Iniciar sesión".
2. El servidor redirige a Supabase, que a su vez redirige al proveedor OAuth2.
3. Tras autorizar, el proveedor redirige a `/auth/callback` con un `code`.
4. El servidor intercambia el `code` por una sesión (access token).
5. El token se guarda en una cookie HTTP-only segura.
6. El usuario ve su perfil con los datos devueltos por el proveedor.

## Estructura del proyecto

```
├── src/
│   ├── index.ts       # Servidor Express con las rutas OAuth2
│   └── supabase.ts    # Inicialización del cliente Supabase
├── public/
│   ├── index.html     # Página de inicio (botón de login)
│   └── style.css      # Estilos minimalistas
├── .env.example       # Plantilla de variables de entorno
├── package.json
└── tsconfig.json
```

## Configuración

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **Authentication → Providers** y habilita el proveedor deseado (ej. GitHub).
3. En la configuración del proveedor, agrega como **Redirect URL** permitida:
   ```
   http://localhost:3000/auth/callback
   ```
4. Copia tu **Project URL** y **publishable key** desde **Settings → API Keys**.

### 2. Variables de entorno

```bash
cp .env.example .env
# Edita .env con tus valores reales
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### 5. Compilar para producción

```bash
npm run build
npm start
```

## Rutas disponibles

| Ruta | Descripción |
|------|-------------|
| `GET /` | Página de inicio con el botón de login |
| `GET /auth/login` | Inicia el flujo OAuth2 |
| `GET /auth/callback` | Punto de retorno del proveedor |
| `GET /profile` | Perfil del usuario (requiere sesión) |
| `GET /auth/logout` | Cierra la sesión |

## Tecnologías

- [TypeScript](https://www.typescriptlang.org/)
- [Express](https://expressjs.com/)
- [Supabase JS](https://supabase.com/docs/reference/javascript)
- [cookie-parser](https://github.com/expressjs/cookie-parser)