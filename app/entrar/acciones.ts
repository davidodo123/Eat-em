"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { crearClienteAdmin, crearClienteServidor } from "@/lib/supabase/server";
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

// --- Email y contrasena, sin verificar el correo ---

export interface EstadoAcceso { error?: string; email?: string }
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function entrarConContrasena(_previo: EstadoAcceso, datos: FormData): Promise<EstadoAcceso> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  const contrasena = String(datos.get("contrasena") ?? "");
  if (!emailValido(email) || !contrasena) return { error: "Escribe tu email y tu contraseña.", email };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  if (error) {
    const limite = error.status === 429 || /rate limit/i.test(error.message);
    return { email, error: limite ? "Demasiados intentos. Espera un minuto." : "Email o contraseña incorrectos." };
  }
  redirect(rutaInterna(String(datos.get("siguiente") ?? "")));
}

// Crea la cuenta ya confirmada (sin correo de verificacion) y entra directamente
export async function crearCuenta(_previo: EstadoAcceso, datos: FormData): Promise<EstadoAcceso> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  const contrasena = String(datos.get("contrasena") ?? "");
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 60);
  if (!emailValido(email)) return { error: "Escribe un email válido.", email };
  if (contrasena.length < 8) return { error: "La contraseña necesita al menos 8 caracteres.", email };

  const { error: e1 } = await crearClienteAdmin().auth.admin.createUser({
    email, password: contrasena, email_confirm: true, user_metadata: nombre ? { name: nombre } : undefined,
  });
  if (e1) {
    const existe = /already|registered|exists/i.test(e1.message);
    return {
      email,
      error: existe ? "Ya hay una cuenta con ese email. Entra con tu contraseña o, si no tienes, con un enlace al correo y ponla en Ajustes."
        : "No se pudo crear la cuenta. Inténtalo de nuevo.",
    };
  }
  const supabase = await crearClienteServidor();
  const { error: e2 } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  if (e2) return { email, error: "Cuenta creada. Entra con tu email y contraseña." };
  redirect(rutaInterna(String(datos.get("siguiente") ?? ""), "/grupo"));
}
