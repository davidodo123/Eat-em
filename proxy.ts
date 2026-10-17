// Proxy de Next 16 (antes "middleware"): refresca la sesion y protege las pantallas.
import { NextResponse, type NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/proxy";
import { supabaseConfigurado } from "@/lib/env";

// Rutas que no necesitan sesion
const PUBLICAS = ["/entrar", "/auth/", "/api/salud"];

export async function proxy(request: NextRequest) {
  if (!supabaseConfigurado) return NextResponse.next();
  const { respuesta, usuario } = await actualizarSesion(request);
  const ruta = request.nextUrl.pathname;
  const publica = PUBLICAS.some((p) => ruta === p || ruta.startsWith(p.endsWith("/") ? p : p + "/"));

  if (!usuario && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = ruta === "/" ? "" : `?siguiente=${encodeURIComponent(ruta + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  if (usuario && ruta === "/entrar") return NextResponse.redirect(new URL("/", request.url));
  return respuesta;
}

export const config = {
  // Todo salvo estaticos, imagenes y ficheros de la PWA
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
