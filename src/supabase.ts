import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Carga las variables de entorno desde el archivo .env
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables de entorno: SUPABASE_URL y SUPABASE_ANON_KEY son requeridas."
  );
}

// Crea el cliente de Supabase con la URL del proyecto y la clave pública anónima.
// Este cliente se reutiliza en toda la aplicación.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Deshabilita la persistencia automática de la sesión en el servidor,
    // ya que el servidor no tiene acceso al localStorage del navegador.
    persistSession: false,
    // No detecta automáticamente la sesión desde la URL en el lado del servidor.
    detectSessionInUrl: false,
  },
});
