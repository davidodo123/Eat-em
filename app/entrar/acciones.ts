"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { rutaInterna } from "@/lib/rutas";

export interface EstadoEntrar {
  estado: "inicial" | "enviado" | "error";
  mensaje?: string;
  email?: string;
}

// Envia un enlace magico al email. Sin contrasenas: el enlace abre la sesion.
export async function enviarEnlace(_previo: EstadoEntrar, datos: FormData): Promise<EstadoEntrar> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { estado: "error", mensaje: "Escribe un email válido.", email };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocolo = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const siguiente = rutaInterna(String(datos.get("siguiente") ?? ""));
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${protocolo}://${host}/auth/confirmar?siguiente=${encodeURIComponent(siguiente)}` },
  });
  if (error) {
    const limite = error.status === 429 || /rate limit/i.test(error.message);
    return {
      estado: "error",
      email,
      mensaje: limite ? "Has pedido demasiados enlaces. Espera un minuto y vuelve a intentarlo." : "No se pudo enviar el enlace. Inténtalo de nuevo.",
    };
  }
  return { estado: "enviado", email };
}

// --- Email y contrasena ---

export interface EstadoAcceso { error?: string; email?: string; enviado?: boolean }
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function entrarConContrasena(_previo: EstadoAcceso, datos: FormData): Promise<EstadoAcceso> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  const contrasena = String(datos.get("contrasena") ?? "");
  if (!emailValido(email) || !contrasena) return { error: "Escribe tu email y tu contraseña.", email };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  if (error) {
    const limite = error.status === 429 || /rate limit/i.test(error.message);
    const sinConfirmar = /not confirmed/i.test(error.message);
    return {
      email,
      error: limite ? "Demasiados intentos. Espera un minuto."
        : sinConfirmar ? "Aún no has confirmado tu correo: abre el enlace que te enviamos al crear la cuenta."
        : "Email o contraseña incorrectos.",
    };
  }
  redirect(rutaInterna(String(datos.get("siguiente") ?? "")));
}

// Crea la cuenta y envia un correo para confirmarla. Hasta que se pulsa el enlace no se puede entrar.
export async function crearCuenta(_previo: EstadoAcceso, datos: FormData): Promise<EstadoAcceso> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  const contrasena = String(datos.get("contrasena") ?? "");
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 60);
  if (!emailValido(email)) return { error: "Escribe un email válido.", email };
  if (contrasena.length < 8) return { error: "La contraseña necesita al menos 8 caracteres.", email };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocolo = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email, password: contrasena,
    options: {
      data: nombre ? { name: nombre } : undefined,
      emailRedirectTo: `${protocolo}://${host}/auth/confirmar?siguiente=${encodeURIComponent("/grupo")}`,
    },
  });
  if (error) {
    const limite = error.status === 429 || /rate limit/i.test(error.message);
    return { email, error: limite ? "Se han enviado demasiados correos. Espera un rato y vuelve a intentarlo." : "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }
  // Supabase no dice si el email ya existia (devuelve un usuario sin identidades)
  if (data.user && !data.user.identities?.length) {
    return { email, error: "Ya hay una cuenta con ese email. Entra con tu contraseña o con un enlace al correo." };
  }
  // Si en Supabase estuviera desactivada la confirmacion, ya hay sesion
  if (data.session) redirect("/grupo");
  return { email, enviado: true };
}
