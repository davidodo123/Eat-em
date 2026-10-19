"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { googleConfig } from "@/lib/google";
import { crearClienteServidor } from "@/lib/supabase/server";
import { rutaInterna } from "@/lib/rutas";

// Acceso con Google: lo hace la app en /api/auth/google (como en StatsRun), asi Google muestra
// "Ir a eat-em.vercel.app". Google verifica el email y la persona acepta en su pantalla.
// Sin GOOGLE_CLIENT_ID/SECRET se usa el proveedor Google de Supabase (muestra su dominio).
export async function entrarConGoogle(datos: FormData) {
  const siguiente = rutaInterna(String(datos.get("siguiente") ?? ""));
  if (googleConfig().configurado) redirect(`/api/auth/google?siguiente=${encodeURIComponent(siguiente)}`);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocolo = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${protocolo}://${host}/auth/confirmar?siguiente=${encodeURIComponent(siguiente)}`, queryParams: { prompt: "select_account" } },
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
