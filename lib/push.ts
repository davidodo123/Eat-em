import "server-only";
import webpush from "web-push";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { endpointPushValido } from "@/lib/dominio/push";

export interface AvisoPush {
  tipo: "item_anadido" | "stock_bajo" | "recordatorio_comida" | "recordatorio_compra";
  titulo: string;
  cuerpo?: string;
  url?: string;
  grupoId?: string;
}

// Preferencia de notificacion_prefs que permite cada tipo de aviso
const PREFERENCIA: Record<AvisoPush["tipo"], string> = {
  item_anadido: "item_anadido", stock_bajo: "stock_bajo",
  recordatorio_comida: "recordatorio_comidas", recordatorio_compra: "recordatorio_compra",
};

export const pushConfigurado = () =>
  Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

// Envia un aviso a varios usuarios segun sus preferencias. Guarda el historial en
// `notificaciones` y borra las suscripciones caducadas (404/410). Nunca lanza: un
// aviso que falla no debe romper la accion que lo provoca.
export async function avisar(usuarios: string[], aviso: AvisoPush): Promise<number> {
  if (!usuarios.length || !pushConfigurado()) return 0;
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    const db = crearClienteAdmin();
    const { data: prefs } = await db.from("notificacion_prefs").select("*").in("usuario_id", usuarios);
    const quieren = (prefs ?? []).filter((p) => p[PREFERENCIA[aviso.tipo]]).map((p) => p.usuario_id as string);
    if (!quieren.length) return 0;

    const ahora = new Date().toISOString();
    await db.from("notificaciones").insert(quieren.map((u) => ({
      usuario_id: u, grupo_id: aviso.grupoId ?? null, tipo: aviso.tipo, titulo: aviso.titulo, cuerpo: aviso.cuerpo ?? null,
      datos: { url: aviso.url ?? "/" }, enviada_en: ahora,
    })));
    const { data: subs } = await db.from("push_suscripciones").select("id, endpoint, p256dh, auth").in("usuario_id", quieren);
    const carga = JSON.stringify({ titulo: aviso.titulo, cuerpo: aviso.cuerpo, url: aviso.url ?? "/", etiqueta: aviso.tipo });
    let enviadas = 0;
    const caducadas: number[] = [];
    // Doble control: aunque alguien inserte un endpoint raro en la tabla, no se le envia nada
    await Promise.all((subs ?? []).filter((s) => endpointPushValido(s.endpoint)).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 60 * 60 * 12 });
        enviadas++;
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) caducadas.push(s.id);
      }
    }));
    if (caducadas.length) await db.from("push_suscripciones").delete().in("id", caducadas);
    return enviadas;
  } catch {
    return 0;
  }
}

// Los demas miembros del hogar (para avisarles de lo que hace uno)
export async function otrosMiembros(grupoId: string, yo: string): Promise<string[]> {
  const { data } = await crearClienteAdmin().from("grupo_miembros").select("usuario_id").eq("grupo_id", grupoId).neq("usuario_id", yo);
  return (data ?? []).map((m) => m.usuario_id);
}
