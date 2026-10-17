"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor, usuarioActual } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { meterEnDespensa } from "@/lib/despensa";
import { fotoStock, revisarStockBajo } from "@/lib/stock";

async function contexto() {
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  const hogar = u.user ? await hogarActual(supabase) : null;
  return { supabase, usuario: u.user, hogar };
}

export async function anadirProducto(productoId: number, nombre: string): Promise<string | void> {
  if (!Number.isInteger(productoId) || productoId <= 0) return "Producto no válido.";
  const { supabase, usuario, hogar } = await contexto();
  if (!usuario || !hogar) return "Necesitas un hogar.";
  try { await meterEnDespensa(supabase, hogar.id, usuario.id, { productoId, nombre, unidades: 1 }); }
  catch { return "No se pudo añadir."; }
  revalidatePath("/despensa");
}

export async function anadirTexto(texto: string): Promise<string | void> {
  const t = String(texto ?? "").trim().slice(0, 120);
  if (!t) return "Escribe qué es.";
  const { supabase, usuario, hogar } = await contexto();
  if (!usuario || !hogar) return "Necesitas un hogar.";
  const { error } = await supabase.from("despensa").insert({ grupo_id: hogar.id, nombre: t, unidades: 1, anadido_por: usuario.id });
  if (error) return "No se pudo añadir.";
  revalidatePath("/despensa");
}

// +1 / -1 envase. Al acabarse, sale de la despensa y entra en la lista.
export async function ajustar(id: number, delta: number, tipo: "ajuste" | "desperdicio" = "ajuste"): Promise<{ error?: string; aviso?: string }> {
  if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 99) return { error: "Ajuste no válido." };
  const { supabase, usuario, hogar } = await contexto();
  if (!usuario || !hogar) return { error: "Tu sesión ha caducado." };
  const { data: fila } = await supabase.from("despensa")
    .select("id, producto_id, ingrediente_id, cantidad_por_unidad, nombre, unidades").eq("id", id).eq("grupo_id", hogar.id).single();
  if (!fila) return { error: "Ya no está en la despensa." };
  const antes = Number(fila.unidades);
  const despues = Math.max(0, Math.round((antes + delta) * 100) / 100);
  const real = despues - antes;
  if (real === 0) return {};

  const foto = fila.ingrediente_id && real < 0 ? await fotoStock(supabase, hogar.id, [fila.ingrediente_id]) : new Map();
  const { error } = despues === 0
    ? await supabase.from("despensa").delete().eq("id", id)
    : await supabase.from("despensa").update({ unidades: despues, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "No se pudo guardar." };

  // El inventario por ingrediente (el de la dieta) sigue a la despensa
  if (fila.ingrediente_id && fila.cantidad_por_unidad) {
    await supabase.from("inventario_movimientos").insert({
      grupo_id: hogar.id, ingrediente_id: fila.ingrediente_id, tipo, usuario_id: usuario.id, producto_id: fila.producto_id,
      delta: Math.round(real * Number(fila.cantidad_por_unidad) * 100) / 100, nota: "despensa",
    });
    if (foto.size) await revisarStockBajo(supabase, hogar.id, usuario.id, foto);
  }

  let aviso: string | undefined;
  if (despues === 0 && tipo === "ajuste") {
    const { error: e } = await supabase.from("lista_items").insert(fila.producto_id
      ? { grupo_id: hogar.id, producto_id: fila.producto_id, texto_libre: fila.nombre, paquetes: 1, origen: "auto", anadido_por: usuario.id }
      : fila.ingrediente_id
        ? { grupo_id: hogar.id, ingrediente_id: fila.ingrediente_id, origen: "auto", anadido_por: usuario.id }
        : { grupo_id: hogar.id, texto_libre: fila.nombre, origen: "auto", anadido_por: usuario.id });
    aviso = e ? "Se ha acabado." : "Se ha acabado: añadido a la lista.";
    revalidatePath("/lista");
  }
  revalidatePath("/despensa");
  return { aviso };
}

export async function editar(id: number, cambios: { lugar?: string; caduca?: string | null }): Promise<{ error?: string }> {
  const datos: Record<string, string | null> = {};
  if (cambios.lugar !== undefined) {
    if (!["despensa", "nevera", "congelador"].includes(cambios.lugar)) return { error: "Lugar no válido." };
    datos.lugar = cambios.lugar;
  }
  if (cambios.caduca !== undefined) {
    if (cambios.caduca !== null && !/^\d{4}-\d{2}-\d{2}$/.test(cambios.caduca)) return { error: "Fecha no válida." };
    datos.caduca = cambios.caduca;
  }
  const { supabase, hogar } = await contexto();
  if (!hogar) return { error: "Tu sesión ha caducado." };
  const { error } = await supabase.from("despensa").update({ ...datos, updated_at: new Date().toISOString() }).eq("id", id).eq("grupo_id", hogar.id);
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/despensa");
  return {};
}
