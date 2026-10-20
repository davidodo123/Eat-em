// Recordatorios diarios (Vercel Cron, ver vercel.json). Vercel envia
// "Authorization: Bearer <CRON_SECRET>"; sin ese secreto la ruta no hace nada.
import { NextResponse, type NextRequest } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { avisar } from "@/lib/push";
import { diaDe, lunesDe } from "@/lib/ia/semana";
import { sumarDias } from "@/lib/dominio/calendario";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const db = crearClienteAdmin();
  const hoy = diaDe();
  const { data: prefs } = await db.from("notificacion_prefs").select("usuario_id, recordatorio_compra, recordatorio_comidas, dia_compra")
    .or("recordatorio_compra.eq.true,recordatorio_comidas.eq.true");
  let compra = 0, comidas = 0;

  // Dia de la compra: cuantas cosas hay pendientes en la lista del hogar
  const deCompra = (prefs ?? []).filter((p) => p.recordatorio_compra && p.dia_compra === hoy).map((p) => p.usuario_id);
  if (deCompra.length) {
    const { data: miembros } = await db.from("grupo_miembros").select("usuario_id, grupo_id").in("usuario_id", deCompra);
    for (const m of miembros ?? []) {
      const { count } = await db.from("lista_items").select("id", { count: "exact", head: true }).eq("grupo_id", m.grupo_id).eq("comprado", false);
      compra += await avisar([m.usuario_id], {
        tipo: "recordatorio_compra", grupoId: m.grupo_id, url: "/lista", titulo: "Hoy toca compra",
        cuerpo: count ? `Hay ${count} ${count === 1 ? "cosa" : "cosas"} en la lista. Antes de salir, pulsa «¿Qué me falta?».` : "La lista está vacía: pulsa «¿Qué me falta?» antes de salir.",
      });
    }
  }

  // Comidas: lo planificado para hoy
  const deComidas = (prefs ?? []).filter((p) => p.recordatorio_comidas).map((p) => p.usuario_id);
  if (deComidas.length) {
    const { data: dietas } = await db.from("dietas").select("id, usuario_id").in("usuario_id", deComidas).eq("semana_inicio", lunesDe()).eq("estado", "activa");
    for (const d of dietas ?? []) {
      const { data: platos } = await db.from("dieta_comidas").select("nombre").eq("dieta_id", d.id).eq("dia", hoy).order("orden");
      if (!platos?.length) continue;
      comidas += await avisar([d.usuario_id], {
        tipo: "recordatorio_comida", url: "/dieta", titulo: "Tu día en Eat-em",
        cuerpo: `Hoy: ${platos.map((p) => p.nombre).slice(0, 3).join(" · ")}${platos.length > 3 ? "…" : ""}`,
      });
    }
  }
  // Despensa: lo que caduca hoy, manana o pasado, a todo el hogar (preferencia de avisos de despensa)
  let caducan = 0;
  const fecha = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const { data: proximos } = await db.from("despensa").select("grupo_id, nombre, caduca")
    .gte("caduca", fecha).lte("caduca", sumarDias(fecha, 2)).gt("unidades", 0).order("caduca");
  const porHogar = new Map<string, { nombre: string; caduca: string }[]>();
  for (const p of proximos ?? []) porHogar.set(p.grupo_id, [...(porHogar.get(p.grupo_id) ?? []), p]);
  for (const [grupoId, cosas] of porHogar) {
    const { data: miembros } = await db.from("grupo_miembros").select("usuario_id").eq("grupo_id", grupoId);
    const hoyMismo = cosas.filter((c) => c.caduca === fecha).length;
    caducan += await avisar((miembros ?? []).map((m) => m.usuario_id), {
      tipo: "caduca", grupoId, url: "/despensa", titulo: hoyMismo ? "Caduca hoy" : "Caduca pronto",
      cuerpo: `${cosas.slice(0, 3).map((c) => c.nombre).join(" · ")}${cosas.length > 3 ? ` y ${cosas.length - 3} más` : ""}`,
    });
  }
  return NextResponse.json({ ok: true, dia: hoy, avisos_compra: compra, avisos_comidas: comidas, avisos_caducidad: caducan });
}
