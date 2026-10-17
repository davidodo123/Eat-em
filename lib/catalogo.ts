import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cantidadComprada, type FormatoProducto } from "@/lib/dominio/inventario";
import type { UnidadBase } from "@/lib/dominio/formato";

export interface Oferta { id: number; cadena: string; precio: number | null; ppu: number | null; unidadPrecio: string | null }
export interface ResultadoProducto {
  clave: string;
  nombre: string;
  marca: string | null;
  formato: string | null;
  imagen: string | null;
  ofertas: Oferta[];          // la mas barata primero
}

interface Fila {
  id: number; supermercado_id: string; nombre: string; marca: string | null; formato_texto: string | null; imagen_url: string | null;
  precio: number | null; precio_por_unidad: number | null; unidad_precio: string | null; cluster_id: number | null;
}

// Busca en el catalogo de las tiendas y junta el mismo producto de distintas cadenas (mismo cluster)
export async function buscarCatalogo(supabase: SupabaseClient, q: string, tiendas: string[] | null): Promise<ResultadoProducto[]> {
  const { data, error } = await supabase.rpc("buscar_en_tiendas", { q, p_tiendas: tiendas, p_limite: 60 });
  if (error) throw error;
  const grupos = new Map<string, ResultadoProducto>();
  for (const f of (data ?? []) as Fila[]) {
    const clave = f.cluster_id ? `c${f.cluster_id}` : `p${f.id}`;
    const oferta: Oferta = {
      id: f.id, cadena: f.supermercado_id, precio: f.precio === null ? null : Number(f.precio),
      ppu: f.precio_por_unidad === null ? null : Number(f.precio_por_unidad), unidadPrecio: f.unidad_precio,
    };
    const g = grupos.get(clave);
    if (g) {
      if (!g.ofertas.some((o) => o.cadena === oferta.cadena)) g.ofertas.push(oferta);
      g.imagen ??= f.imagen_url;
    } else {
      grupos.set(clave, { clave, nombre: f.nombre, marca: f.marca, formato: f.formato_texto, imagen: f.imagen_url, ofertas: [oferta] });
    }
  }
  const precio = (o: Oferta) => o.precio ?? Infinity;
  for (const g of grupos.values()) g.ofertas.sort((a, b) => precio(a) - precio(b));
  return [...grupos.values()].slice(0, 30);
}

// Producto -> ingrediente generico (el enlace mas fiable) y cuanto de ese ingrediente es un envase
export async function equivalenciaIngrediente(supabase: SupabaseClient, productoId: number):
  Promise<{ ingredienteId: string; cantidadPorUnidad: number } | null> {
  const [{ data: p }, { data: enlace }] = await Promise.all([
    supabase.from("productos").select("cantidad_neta, unidad, unidades_pack").eq("id", productoId).single(),
    supabase.from("ingrediente_productos").select("ingrediente_id, confianza, ingredientes (unidad, gramos_por_unidad)")
      .eq("producto_id", productoId).gte("confianza", 0.8).order("confianza", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!p || !enlace) return null;
  const ing = enlace.ingredientes as unknown as { unidad: UnidadBase; gramos_por_unidad: number | null } | null;
  if (!ing) return null;
  const cantidad = cantidadComprada(
    { cantidad_neta: p.cantidad_neta && Number(p.cantidad_neta), unidad: p.unidad, unidades_pack: p.unidades_pack } as FormatoProducto,
    { unidad: ing.unidad, gramos_por_unidad: ing.gramos_por_unidad && Number(ing.gramos_por_unidad) },
  );
  return cantidad ? { ingredienteId: enlace.ingrediente_id, cantidadPorUnidad: cantidad } : null;
}
