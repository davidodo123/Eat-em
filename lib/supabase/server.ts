import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

// Cliente con la sesion del usuario (Server Components, Route Handlers, Server Actions).
// cache(): un solo cliente por peticion, aunque lo pidan varias funciones.
export const crearClienteServidor = cache(async () => {
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
});

export interface UsuarioSesion { id: string; email: string | null }

// Usuario de la sesion. getClaims() verifica la firma del token en local con las claves
// publicas del proyecto (ES256), sin ir a Supabase en cada peticion como getUser().
// Mismo formato que getUser() ({ data: { user } }) y una sola vez por peticion.
export const usuarioActual = cache(async (): Promise<{ data: { user: UsuarioSesion | null } }> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  const c = error ? null : data?.claims;
  return { data: { user: c?.sub ? { id: c.sub, email: (c.email as string | undefined) ?? null } : null } };
});

// Cliente con service role: se salta RLS. Solo para tareas de sistema
// (notificaciones, IA, cola de revision). Nunca exponer al navegador.
export function crearClienteAdmin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  return createClient(SUPABASE_URL, clave, { auth: { persistSession: false } });
}
