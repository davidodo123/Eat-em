"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { avisar, otrosMiembros } from "@/lib/push";
import { calcularFaltas, paquetesPara } from "@/lib/dominio/necesidades";
import { cantidadComprada, type FormatoProducto } from "@/lib/dominio/inventario";
import { DIAS } from "@/lib/ia/prompt";
import { diaDe, lunesDe } from "@/lib/ia/semana";

export interface EstadoLista { error?: string; ok?: number }

export async function anadirItem(_previo: EstadoLista, datos: FormData): Promise<EstadoLista> {
  const ingredienteId = String(datos.get("ingrediente_id") ?? "") || null;
  const texto = String(datos.get("texto") ?? "").trim().slice(0, 120) || null;
  const urgente = datos.get("urgente") === "on";
  if (!ingredienteId && !texto) return { error: "Elige un ingrediente o escribe qué falta." };

  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Tu sesión ha caducado." };
  const hogar = await hogarActual(supabase);
  if (!hogar) return { error: "No tienes hogar." };

  const { error } = await supabase.from("lista_items").insert({
    grupo_id: hogar.id, ingrediente_id: ingredienteId, texto_libre: ingredienteId ? null : texto,
    urgente, origen: "manual", anadido_por: u.user.id,
  });
  if (error) return { error: error.code === "23505" ? "Ya está en la lista." : "No se pudo añadir." };
  revalidatePath("/lista");

  // Aviso a los demas del hogar (si lo tienen activado)
  const [{ data: yo }, { data: ing }] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", u.user.id).single(),
    ingredienteId ? supabase.from("ingredientes").select("nombre").eq("id", ingredienteId).single() : Promise.resolve({ data: null }),
  ]);
  const que = (ing?.nombre ?? texto ?? "algo").toLowerCase();
  await avisar(await otrosMiembros(hogar.id, u.user.id), {
    tipo: "item_anadido", grupoId: hogar.id, url: "/lista",
    titulo: urgente ? "❗ Urgente en la lista" : "Lista de la compra",
    cuerpo: `${yo?.nombre || "Alguien"} ha añadido ${que}`,
  });
  return { ok: Date.now() };
}

// Comprado: si es un ingrediente, marcar_comprado() lo mete tambien en el inventario
export async function marcarComprado(itemId: number): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("marcar_comprado", { p_item_id: itemId });
  if (error) return { error: "No se pudo marcar." };
  revalidatePath("/lista");
  revalidatePath("/inventario");
  return {};
}

export async function quitarItem(itemId: number): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("lista_items").delete().eq("id", itemId).eq("comprado", false);
  if (error) return { error: "No se pudo quitar." };
  revalidatePath("/lista");
  return {};
}

// Lista automatica: lo que piden las dietas activas de TODOS los miembros del hogar en los
// proximos dias_planificacion dias (sin las comidas de hoy ya registradas), menos el stock.
// Solo toca las lineas automaticas: las anadidas a mano se respetan.
export async function recalcularLista(): Promise<{ error?: string; resumen?: string }> {
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Tu sesión ha caducado." };
  const hogar = await hogarActual(supabase);
  if (!hogar) return { error: "No tienes hogar." };

  const { data: g } = await supabase.from("grupos").select("dias_planificacion").eq("id", hogar.id).single();
  const horizonte = g?.dias_planificacion ?? 7;
  const ahora = new Date();
  const semanas = [lunesDe(ahora), lunesDe(new Date(ahora.getTime() + 7 * 864e5)), lunesDe(new Date(ahora.getTime() + 14 * 864e5))];
  const hoy = ahora.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const hoyIndice = DIAS.indexOf(diaDe(ahora));

  const { data: dietas } = await supabase.from("dietas").select("id, semana_inicio")
    .eq("grupo_id", hogar.id).eq("estado", "activa").in("semana_inicio", semanas);
  if (!dietas?.length) return { error: "Nadie del hogar tiene dieta activa para estos días: genera la semana en «Mi semana»." };
  const [{ data: comidas }, { data: hechas }, { data: stock }, { data: ings }] = await Promise.all([
    supabase.from("dieta_comidas").select("id, dieta_id, dia, dieta_comida_ingredientes (ingrediente_id, cantidad)").in("dieta_id", dietas.map((d) => d.id)),
    supabase.from("consumos").select("dieta_comida_id").eq("grupo_id", hogar.id).eq("fecha", hoy).not("dieta_comida_id", "is", null),
    supabase.from("inventario").select("ingrediente_id, cantidad, productos:producto_preferido_id (cantidad_neta, unidad, unidades_pack)").eq("grupo_id", hogar.id),
    supabase.from("ingredientes").select("id, unidad, gramos_por_unidad"),
  ]);
  const yaHechas = new Set((hechas ?? []).map((h) => h.dieta_comida_id));
  const semanaDe = new Map(dietas.map((d) => [d.id, semanas.indexOf(d.semana_inicio)]));
  const consumos = (comidas ?? []).filter((c) => !yaHechas.has(c.id)).flatMap((c) =>
    (c.dieta_comida_ingredientes as { ingrediente_id: string; cantidad: number }[]).map((x) => ({
      ingrediente_id: x.ingrediente_id, cantidad: Number(x.cantidad),
      diasDesdeHoy: (semanaDe.get(c.dieta_id) ?? 0) * 7 + DIAS.indexOf(c.dia) - hoyIndice,
    })));
  const faltas = calcularFaltas(consumos, new Map((stock ?? []).map((s) => [s.ingrediente_id, Number(s.cantidad)])), horizonte);

  // Paquetes segun el formato del producto preferido (si lo hay)
  const ing = new Map((ings ?? []).map((i) => [i.id, i]));
  const pref = new Map((stock ?? []).map((s) => [s.ingrediente_id, s.productos as unknown as FormatoProducto | null]));
  const filas = faltas.map((f) => {
    const p = pref.get(f.ingrediente_id);
    const i = ing.get(f.ingrediente_id);
    const porPaquete = p && i ? cantidadComprada({ ...p, cantidad_neta: p.cantidad_neta && Number(p.cantidad_neta) }, { unidad: i.unidad, gramos_por_unidad: i.gramos_por_unidad && Number(i.gramos_por_unidad) }) : null;
    return { ...f, paquetes: paquetesPara(f.falta, porPaquete) };
  });

  // Sincronizar las lineas automaticas pendientes
  const { data: pendientes } = await supabase.from("lista_items").select("id, ingrediente_id, origen")
    .eq("grupo_id", hogar.id).eq("comprado", false).not("ingrediente_id", "is", null);
  const porIngrediente = new Map((pendientes ?? []).map((p) => [p.ingrediente_id, p]));
  const necesarios = new Set(filas.map((f) => f.ingrediente_id));
  const sobran = (pendientes ?? []).filter((p) => p.origen === "auto" && !necesarios.has(p.ingrediente_id)).map((p) => p.id);
  if (sobran.length) await supabase.from("lista_items").delete().in("id", sobran);
  let nuevos = 0;
  for (const f of filas) {
    const previo = porIngrediente.get(f.ingrediente_id);
    if (previo && previo.origen !== "auto") continue; // la puso alguien a mano
    const datos = { cantidad: f.falta, paquetes: f.paquetes, urgente: f.urgente };
    if (previo) await supabase.from("lista_items").update(datos).eq("id", previo.id);
    else {
      await supabase.from("lista_items").insert({ grupo_id: hogar.id, ingrediente_id: f.ingrediente_id, origen: "auto", anadido_por: u.user.id, ...datos });
      nuevos++;
    }
  }
  revalidatePath("/lista");
  return { resumen: filas.length
    ? `${filas.length} ${filas.length === 1 ? "cosa" : "cosas"} para los próximos ${horizonte} días (${nuevos} nuevas${filas.some((f) => f.urgente) ? ", alguna urgente" : ""}).`
    : `Con lo que hay en casa llegáis a los próximos ${horizonte} días.` };
}
