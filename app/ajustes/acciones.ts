"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { avisar } from "@/lib/push";

interface SuscripcionJSON { endpoint: string; keys: { p256dh: string; auth: string } }

export async function guardarSuscripcion(sub: SuscripcionJSON): Promise<{ error?: string }> {
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Suscripción no válida." };
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
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

export async function guardarPreferencias(_previo: EstadoPrefs, d: FormData): Promise<EstadoPrefs> {
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Tu sesión ha caducado." };
  const { error } = await supabase.from("notificacion_prefs").upsert({
    usuario_id: u.user.id,
    item_anadido: d.get("item_anadido") === "on",
    stock_bajo: d.get("stock_bajo") === "on",
    recordatorio_comidas: d.get("recordatorio_comidas") === "on",
    recordatorio_compra: d.get("recordatorio_compra") === "on",
  }, { onConflict: "usuario_id" });
  revalidatePath("/ajustes");
  return error ? { error: "No se pudo guardar." } : { ok: true };
}

export async function avisoDePrueba(): Promise<{ enviadas: number }> {
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { enviadas: 0 };
  // La prueba usa el tipo item_anadido: tiene que estar activado
  return { enviadas: await avisar([u.user.id], { tipo: "item_anadido", titulo: "Eat-em", cuerpo: "Las notificaciones funcionan 👍", url: "/ajustes" }) };
}
