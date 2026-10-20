"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { crearClienteServidor, usuarioActual } from "@/lib/supabase/server";
import { avisar } from "@/lib/push";
import { endpointPushValido } from "@/lib/dominio/push";

interface SuscripcionJSON { endpoint: string; keys: { p256dh: string; auth: string } }

export async function guardarSuscripcion(sub: SuscripcionJSON): Promise<{ error?: string }> {
  if (!sub?.endpoint || !endpointPushValido(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Suscripción no válida." };
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  if (!u.user) return { error: "Tu sesión ha caducado." };
  const { error } = await supabase.from("push_suscripciones").upsert({
    usuario_id: u.user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
    user_agent: ((await headers()).get("user-agent") ?? "").slice(0, 300),
  }, { onConflict: "endpoint" });
  return error ? { error: "No se pudo activar en este dispositivo." } : {};
}

export async function quitarSuscripcion(endpoint: string): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("push_suscripciones").delete().eq("endpoint", endpoint);
  return error ? { error: "No se pudo desactivar." } : {};
}

export interface EstadoPrefs { ok?: boolean; error?: string }
const DIAS_VALIDOS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

export async function guardarPreferencias(_previo: EstadoPrefs, d: FormData): Promise<EstadoPrefs> {
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  if (!u.user) return { error: "Tu sesión ha caducado." };
  const { error } = await supabase.from("notificacion_prefs").upsert({
    usuario_id: u.user.id,
    item_anadido: d.get("item_anadido") === "on",
    stock_bajo: d.get("stock_bajo") === "on",
    recordatorio_comidas: d.get("recordatorio_comidas") === "on",
    recordatorio_compra: d.get("recordatorio_compra") === "on",
    dia_compra: DIAS_VALIDOS.includes(String(d.get("dia_compra"))) ? String(d.get("dia_compra")) : null,
  }, { onConflict: "usuario_id" });
  revalidatePath("/ajustes");
  return error ? { error: "No se pudo guardar." } : { ok: true };
}

export async function avisoDePrueba(): Promise<{ enviadas: number }> {
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  if (!u.user) return { enviadas: 0 };
  // La prueba usa el tipo item_anadido: tiene que estar activado
  return { enviadas: await avisar([u.user.id], { tipo: "item_anadido", titulo: "Eat-em", cuerpo: "Las notificaciones funcionan 👍", url: "/ajustes" }) };
}

// Poner o cambiar la contrasena (opcional: las cuentas creadas con Google no tienen)
export async function ponerContrasena(_previo: { error?: string; ok?: boolean }, datos: FormData): Promise<{ error?: string; ok?: boolean }> {
  const contrasena = String(datos.get("contrasena") ?? "");
  if (contrasena.length < 8) return { error: "Al menos 8 caracteres." };
  if (contrasena !== String(datos.get("repetir") ?? "")) return { error: "Las dos contraseñas no coinciden." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: contrasena });
  if (error) return { error: /same|different/i.test(error.message) ? "Es la misma que ya tenías." : "No se pudo guardar. Vuelve a entrar e inténtalo." };
  return { ok: true };
}
