import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

// Refresca la sesion de Supabase en cada peticion (las cookies caducan) y
// devuelve el usuario. Lo usa proxy.ts antes de renderizar.
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
      },
    },
  });
  // getClaims refresca la sesion si hace falta y verifica la firma del token en local con
  // las claves publicas del proyecto (ES256): sin ir a Supabase en cada clic, como getUser()
  const { data, error } = await supabase.auth.getClaims();
  return { respuesta, usuario: !error && data?.claims?.sub ? { id: data.claims.sub } : null };
}
