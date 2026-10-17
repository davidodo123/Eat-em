import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cruzaUmbral } from "@/lib/dominio/inventario";
import { avisar, otrosMiembros } from "@/lib/push";

export type Foto = Map<string, { cantidad: number; umbral: number | null }>;

// Estado del stock de unos ingredientes (antes de un movimiento)
export async function fotoStock(supabase: SupabaseClient, grupoId: string, ingredientes: string[]): Promise<Foto> {
  if (!ingredientes.length) return new Map();
  const { data } = await supabase.from("inventario").select("ingrediente_id, cantidad, umbral_cantidad")
    .eq("grupo_id", grupoId).in("ingrediente_id", ingredientes);
  return new Map((data ?? []).map((r) => [r.ingrediente_id, {
    cantidad: Number(r.cantidad), umbral: r.umbral_cantidad === null ? null : Number(r.umbral_cantidad),
  }]));
}

// Tras un movimiento: lo que cruza su umbral entra solo en la lista y se avisa al resto del hogar
export async function revisarStockBajo(supabase: SupabaseClient, grupoId: string, usuarioId: string, antes: Foto) {
  const ids = [...antes.keys()];
  if (!ids.length) return [];
  const despues = await fotoStock(supabase, grupoId, ids);
  const bajos = ids.filter((id) => cruzaUmbral(antes.get(id)!.cantidad, despues.get(id)?.cantidad ?? 0, antes.get(id)!.umbral));
  if (!bajos.length) return [];

  // El indice unico de pendientes evita duplicados: si ya estaba en la lista, no pasa nada
  for (const id of bajos) {
    await supabase.from("lista_items").insert({ grupo_id: grupoId, ingrediente_id: id, origen: "auto", anadido_por: usuarioId });
  }
  const { data: nombres } = await supabase.from("ingredientes").select("nombre").in("id", bajos);
  await avisar(await otrosMiembros(grupoId, usuarioId), {
    tipo: "stock_bajo", grupoId, url: "/lista", titulo: "Queda poco",
    cuerpo: `${(nombres ?? []).map((n) => n.nombre).join(", ")}: añadido a la lista de la compra.`,
  });
  return bajos;
}
