import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { equivalenciaIngrediente } from "@/lib/catalogo";

export interface Entrada {
  productoId?: number | null;
  ingredienteId?: string | null;
  cantidadPorUnidad?: number | null;   // si ya se sabe (lineas de ingrediente de la lista)
  nombre: string;
  unidades: number;
  // false cuando el inventario por ingrediente ya se actualizo por otra via (marcar_comprado)
  apuntarInventario?: boolean;
}

// Suma unidades a la despensa (por producto o por ingrediente) y, si corresponde a un ingrediente,
// apunta la compra en el inventario que usa la dieta para calcular lo que falta.
export async function meterEnDespensa(supabase: SupabaseClient, grupoId: string, usuarioId: string, e: Entrada) {
  let { ingredienteId = null, cantidadPorUnidad = null } = e;
  if (e.productoId && !ingredienteId) {
    const eq = await equivalenciaIngrediente(supabase, e.productoId);
    if (eq) ({ ingredienteId, cantidadPorUnidad } = eq);
  }

  let consulta = supabase.from("despensa").select("id, unidades").eq("grupo_id", grupoId);
  consulta = e.productoId ? consulta.eq("producto_id", e.productoId) : consulta.is("producto_id", null).eq("ingrediente_id", ingredienteId ?? "");
  const { data: previa } = e.productoId || ingredienteId ? await consulta.maybeSingle() : { data: null };

  const { error } = previa
    ? await supabase.from("despensa").update({ unidades: Number(previa.unidades) + e.unidades, updated_at: new Date().toISOString() }).eq("id", previa.id)
    : await supabase.from("despensa").insert({
        grupo_id: grupoId, producto_id: e.productoId ?? null, ingrediente_id: ingredienteId, cantidad_por_unidad: cantidadPorUnidad,
        nombre: e.nombre.slice(0, 200), unidades: e.unidades, anadido_por: usuarioId,
      });
  if (error) throw error;

  if (e.apuntarInventario !== false && ingredienteId && cantidadPorUnidad) {
    await supabase.from("inventario_movimientos").insert({
      grupo_id: grupoId, ingrediente_id: ingredienteId, tipo: "compra", delta: Math.round(cantidadPorUnidad * e.unidades * 100) / 100,
      usuario_id: usuarioId, producto_id: e.productoId ?? null, nota: "despensa",
    });
  }
}
