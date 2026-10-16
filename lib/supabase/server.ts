import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

// Cliente con la sesion del usuario (Server Components, Route Handlers, Server Actions)
export async function crearClienteServidor() {
  const almacen = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch {
          // En Server Components no se pueden escribir cookies; el proxy refresca la sesion.
        }
      },
    },
  });
}

// Cliente con service role: se salta RLS. Solo para tareas de sistema
// (notificaciones, IA, cola de revision). Nunca exponer al navegador.
export function crearClienteAdmin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  return createClient(SUPABASE_URL, clave, { auth: { persistSession: false } });
}
