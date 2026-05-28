import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Carga las variables de entorno desde el archivo .env
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Faltan variables de entorno: SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY son requeridas."
  );
}

// Crea el cliente de Supabase con la URL del proyecto y la publishable key.
// Este cliente se reutiliza en toda la aplicación.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // Deshabilita la persistencia automática de la sesión en el servidor,
    // ya que el servidor no tiene acceso al localStorage del navegador.
    persistSession: false,
    // No detecta automáticamente la sesión desde la URL en el lado del servidor.
    detectSessionInUrl: false,
  },
});
