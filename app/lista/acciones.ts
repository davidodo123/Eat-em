"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor, usuarioActual } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { avisar, otrosMiembros } from "@/lib/push";
import { calcularFaltas, paquetesPara } from "@/lib/dominio/necesidades";
import { cantidadComprada, type FormatoProducto } from "@/lib/dominio/inventario";
import { DIAS } from "@/lib/ia/prompt";
import { diaDe, lunesDe } from "@/lib/ia/semana";

import { meterEnDespensa } from "@/lib/despensa";

async function contexto() {
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  const hogar = u.user ? await hogarActual(supabase) : null;
  return { supabase, usuario: u.user, hogar };
}

// Aviso a los demas del hogar (si lo tienen activado)
async function avisarAnadido(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, grupoId: string, usuarioId: string, que: string) {
  const { data: yo } = await supabase.from("perfiles").select("nombre").eq("id", usuarioId).single();
  await avisar(await otrosMiembros(grupoId, usuarioId), {
    tipo: "item_anadido", grupoId, url: "/lista", titulo: "Lista de la compra",
    cuerpo: `${yo?.nombre || "Alguien"} ha añadido ${que.toLowerCase()}`,
  });
}

// Un producto concreto del catalogo. Si ya estaba pendiente, suma un envase.
export async function anadirProducto(productoId: number, nombre: string): Promise<string | void> {
  if (!Number.isInteger(productoId) || productoId <= 0) return "Producto no válido.";
  const { supabase, usuario, hogar } = await contexto();
  if (!usuario || !hogar) return "Necesitas un hogar para tener lista.";
  const { data: previo } = await supabase.from("lista_items").select("id, paquetes")
    .eq("grupo_id", hogar.id).eq("producto_id", productoId).eq("comprado", false).maybeSingle();
  const { error } = previo
    ? await supabase.from("lista_items").update({ paquetes: (previo.paquetes ?? 1) + 1 }).eq("id", previo.id)
    : await supabase.from("lista_items").insert({
        grupo_id: hogar.id, producto_id: productoId, texto_libre: nombre.slice(0, 120), paquetes: 1, origen: "manual", anadido_por: usuario.id,
      });
  if (error) return "No se pudo añadir.";
  revalidatePath("/lista");
  if (!previo) await avisarAnadido(supabase, hogar.id, usuario.id, nombre);
}

// Algo escrito tal cual (papel de cocina, pilas...)
export async function anadirTexto(texto: string): Promise<string | void> {
  const t = String(texto ?? "").trim().slice(0, 120);
  if (!t) return "Escribe qué falta.";
  const { supabase, usuario, hogar } = await contexto();
  if (!usuario || !hogar) return "Necesitas un hogar para tener lista.";
  const { error } = await supabase.from("lista_items").insert({ grupo_id: hogar.id, texto_libre: t, origen: "manual", anadido_por: usuario.id });
  if (error) return "No se pudo añadir.";
  revalidatePath("/lista");
  await avisarAnadido(supabase, hogar.id, usuario.id, t);
}

export async function cambiarPaquetes(itemId: number, paquetes: number): Promise<{ error?: string }> {
  if (!Number.isInteger(paquetes) || paquetes < 1 || paquetes > 99) return { error: "Cantidad no válida." };
  const { supabase } = await contexto();
  const { error } = await supabase.from("lista_items").update({ paquetes }).eq("id", itemId).eq("comprado", false);
  if (error) return { error: "No se pudo cambiar." };
  revalidatePath("/lista");
  return {};
}

export async function marcarUrgente(itemId: number, urgente: boolean): Promise<{ error?: string }> {
  const { supabase } = await contexto();
  const { error } = await supabase.from("lista_items").update({ urgente }).eq("id", itemId);
  if (error) return { error: "No se pudo cambiar." };
  revalidatePath("/lista");
  return {};
}

// Comprado: pasa a la despensa. Si es un ingrediente, marcar_comprado() ya lo suma al inventario.
export async function marcarComprado(itemId: number): Promise<{ error?: string }> {
  const { supabase, usuario, hogar } = await contexto();
  if (!usuario || !hogar) return { error: "Tu sesión ha caducado." };
  const { data: item } = await supabase.from("lista_items")
    .select("id, ingrediente_id, producto_id, texto_libre, cantidad, paquetes, comprado, ingredientes (nombre)").eq("id", itemId).single();
  if (!item || item.comprado) return {};
  const { error } = await supabase.rpc("marcar_comprado", { p_item_id: itemId });
  if (error) return { error: "No se pudo marcar." };

  const unidades = item.paquetes ?? 1;
  const nombreIng = (item.ingredientes as unknown as { nombre: string } | null)?.nombre;
  try {
    if (item.producto_id) {
      await meterEnDespensa(supabase, hogar.id, usuario.id, {
        productoId: item.producto_id, nombre: item.texto_libre ?? nombreIng ?? "Producto", unidades,
        ingredienteId: item.ingrediente_id, apuntarInventario: !item.ingrediente_id,
      });
    } else if (item.ingrediente_id) {
      const total = item.cantidad ? Number(item.cantidad) : null;
      await meterEnDespensa(supabase, hogar.id, usuario.id, {
        ingredienteId: item.ingrediente_id, nombre: nombreIng ?? item.ingrediente_id, unidades,
        cantidadPorUnidad: total ? Math.round((total / unidades) * 100) / 100 : null, apuntarInventario: false,
      });
    }
  } catch { /* la compra ya esta marcada; la despensa se puede ajustar a mano */ }
  revalidatePath("/lista");
  revalidatePath("/despensa");
  return {};
}

export async function quitarItem(itemId: number): Promise<{ error?: string }> {
  const { supabase } = await contexto();
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
  const { data: u } = await usuarioActual();
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
  if (!dietas?.length) return { error: "Nadie del hogar tiene dieta activa para estos días: planifica comidas en «Dieta»." };
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
