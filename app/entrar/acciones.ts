"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { rutaInterna } from "@/lib/rutas";

// Acceso como en StatsRun: con la cuenta de Google. Google verifica el email y la persona
// acepta en su pantalla; Supabase crea la cuenta la primera vez (y, si ya habia una con el
// mismo email, la enlaza). La vuelta llega a /auth/confirmar con ?code= (PKCE).
export async function entrarConGoogle(datos: FormData) {
  const siguiente = rutaInterna(String(datos.get("siguiente") ?? ""));
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocolo = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${protocolo}://${host}/auth/confirmar?siguiente=${encodeURIComponent(siguiente)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/entrar?error=google");
  redirect(data.url);
}

// Email y contrasena: solo para cuentas que ya tienen contrasena (puesta en Ajustes)
export interface EstadoAcceso { error?: string; email?: string }

export async function entrar(_previo: EstadoAcceso, datos: FormData): Promise<EstadoAcceso> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  const contrasena = String(datos.get("contrasena") ?? "");
  if (!email || !contrasena) return { error: "Escribe tu email y tu contraseña.", email };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  if (error) {
    const limite = error.status === 429 || /rate limit/i.test(error.message);
    return { email, error: limite ? "Demasiados intentos. Espera un minuto." : "Email o contraseña incorrectos." };
  }
  redirect(rutaInterna(String(datos.get("siguiente") ?? "")));
}
