import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import { rutaInterna } from "@/lib/rutas";

// Vuelta de Google (y de los enlaces de correo antiguos). Con PKCE llega ?code=...; con la plantilla de email
// personalizada de Supabase, ?token_hash=...&type=magiclink.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const siguiente = rutaInterna(url.searchParams.get("siguiente"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await crearClienteServidor();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && tipo
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
      : { error: new Error("sin codigo") };

  return NextResponse.redirect(new URL(error ? "/entrar?error=enlace" : siguiente, request.url));
}
