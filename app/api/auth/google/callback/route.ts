import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { COOKIE_GOOGLE, googleIdToken } from "@/lib/google";
import { rutaInterna } from "@/lib/rutas";
import { crearClienteServidor } from "@/lib/supabase/server";

// Vuelta de Google: comprueba el estado, cambia el codigo por el id_token y abre la sesion en Supabase
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const jar = await cookies();
  let guardado: { estado?: string; nonce?: string; siguiente?: string } = {};
  try { guardado = JSON.parse(jar.get(COOKIE_GOOGLE)?.value ?? "{}"); } catch { /* cookie rota */ }
  jar.delete({ name: COOKIE_GOOGLE, path: "/api/auth/google" });

  if (url.searchParams.get("error")) redirect("/entrar");   // cancelo en Google
  const codigo = url.searchParams.get("code");
  if (!codigo || !guardado.estado || !guardado.nonce || url.searchParams.get("state") !== guardado.estado) redirect("/entrar?error=google");

  let ok = false;
  try {
    const token = await googleIdToken(codigo, url.origin);
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token, nonce: guardado.nonce });
    if (error) console.error("google -> supabase:", error.message);
    ok = !error;
  } catch (e) {
    console.error("google:", e);
  }
  redirect(ok ? rutaInterna(guardado.siguiente) : "/entrar?error=google");
}
