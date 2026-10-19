"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { crearClienteAdmin, crearClienteServidor } from "@/lib/supabase/server";
import { rutaInterna } from "@/lib/rutas";
import { correoConfigurado, correoConfirmar, correoEnlace, correoRecuperar, enviarCorreo } from "@/lib/correo";

// Los correos (confirmar cuenta, enlace de acceso, recuperar contrasena) los manda la app con
// su SMTP: Supabase solo genera el enlace (API de administracion) y no envia nada.

export interface EstadoEntrar { estado: "inicial" | "enviado" | "error"; mensaje?: string; email?: string }
export interface EstadoAcceso { error?: string; email?: string; enviado?: boolean }

const emailValido = (e: string) => /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;

async function peticion() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocolo = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  return { origen: `${protocolo}://${host}`, ip };
}

// Limite propio de envios (por email y por IP)
async function reservar(email: string, ip: string | null, tipo: "confirmar" | "enlace" | "recuperar") {
  const { data, error } = await crearClienteAdmin().rpc("reservar_envio_correo", { p_email: email, p_ip: ip, p_tipo: tipo });
  if (error) { console.error("reservar_envio_correo:", error.message); return true; }   // si falla el limite, no se bloquea a nadie
  return data === true;
}

// Nunca se genera un enlace de acceso para un email sin cuenta: Supabase la crearia
async function existeCuenta(email: string) {
  const { data, error } = await crearClienteAdmin().rpc("existe_cuenta", { p_email: email });
  return !error && data === true;
}

// Enlace propio a /auth/confirmar con el token que genera Supabase
const enlaceConfirmar = (origen: string, token: string, tipo: string, siguiente: string) =>
  `${origen}/auth/confirmar?token_hash=${encodeURIComponent(token)}&type=${encodeURIComponent(tipo)}&siguiente=${encodeURIComponent(siguiente)}`;

async function mandar(email: string, correo: { asunto: string; html: string; texto: string }, enlace: string) {
  if (!correoConfigurado()) {
    // En local sin SMTP: el enlace sale en la consola del servidor para poder probar
    if (process.env.NODE_ENV !== "production") { console.log(`[correo sin SMTP] ${email}: ${enlace}`); return; }
    throw new Error("SMTP sin configurar");
  }
  await enviarCorreo(email, correo);
}

// --- Entrar con email y contrasena ---
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

// --- Crear cuenta: queda sin confirmar hasta que se abre el enlace del correo ---
export async function crearCuenta(_previo: EstadoAcceso, datos: FormData): Promise<EstadoAcceso> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  const contrasena = String(datos.get("contrasena") ?? "");
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 60);
  if (!emailValido(email)) return { error: "Escribe un email válido.", email };
  if (contrasena.length < 8) return { error: "La contraseña necesita al menos 8 caracteres.", email };
  if (contrasena.length > 72) return { error: "La contraseña es demasiado larga (máximo 72 caracteres).", email };

  const { origen, ip } = await peticion();
  if (!(await reservar(email, ip, "confirmar"))) return { email, error: "Espera un minuto antes de volver a intentarlo." };
  const { data, error } = await crearClienteAdmin().auth.admin.generateLink({
    type: "signup", email, password: contrasena, options: { data: nombre ? { name: nombre } : undefined },
  });
  if (error || !data.properties?.hashed_token) {
    const existe = /already|registered|exists/i.test(error?.message ?? "");
    return { email, error: existe ? "Ya hay una cuenta con ese email. Entra con tu contraseña o recupérala." : "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }
  const enlace = enlaceConfirmar(origen, data.properties.hashed_token, data.properties.verification_type, "/grupo");
  try { await mandar(email, correoConfirmar(enlace, nombre || undefined), enlace); }
  catch { return { email, error: "La cuenta está creada pero no pudimos enviar el correo. Pide un enlace de acceso en un rato." }; }
  return { email, enviado: true };
}

// --- Enlace para entrar sin contrasena ---
export async function enviarEnlace(_previo: EstadoEntrar, datos: FormData): Promise<EstadoEntrar> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  if (!emailValido(email)) return { estado: "error", mensaje: "Escribe un email válido.", email };
  const siguiente = rutaInterna(String(datos.get("siguiente") ?? ""));
  const { origen, ip } = await peticion();
  if (!(await reservar(email, ip, "enlace"))) return { estado: "error", email, mensaje: "Espera un minuto antes de pedir otro enlace." };
  if (!(await existeCuenta(email))) return { estado: "enviado", email };
  const { data, error } = await crearClienteAdmin().auth.admin.generateLink({ type: "magiclink", email });
  // Si no hay cuenta con ese email no se envia nada, pero la respuesta es la misma (no se revela quien tiene cuenta)
  if (!error && data.properties?.hashed_token) {
    const enlace = enlaceConfirmar(origen, data.properties.hashed_token, data.properties.verification_type, siguiente);
    try { await mandar(email, correoEnlace(enlace), enlace); }
    catch { return { estado: "error", email, mensaje: "No se pudo enviar el correo. Inténtalo en un rato." }; }
  }
  return { estado: "enviado", email };
}

// --- Olvide mi contrasena: enlace que entra y lleva a Ajustes para poner otra ---
export async function recuperarContrasena(_previo: EstadoEntrar, datos: FormData): Promise<EstadoEntrar> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  if (!emailValido(email)) return { estado: "error", mensaje: "Escribe un email válido.", email };
  const { origen, ip } = await peticion();
  if (!(await reservar(email, ip, "recuperar"))) return { estado: "error", email, mensaje: "Espera un minuto antes de volver a pedirlo." };
  if (!(await existeCuenta(email))) return { estado: "enviado", email };
  const { data, error } = await crearClienteAdmin().auth.admin.generateLink({ type: "recovery", email });
  if (!error && data.properties?.hashed_token) {
    const enlace = enlaceConfirmar(origen, data.properties.hashed_token, data.properties.verification_type, "/ajustes#contrasena");
    try { await mandar(email, correoRecuperar(enlace), enlace); }
    catch { return { estado: "error", email, mensaje: "No se pudo enviar el correo. Inténtalo en un rato." }; }
  }
  return { estado: "enviado", email };
}
