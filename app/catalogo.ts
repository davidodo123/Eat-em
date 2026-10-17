"use server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { zonaDelHogar } from "@/lib/zona";
import { buscarCatalogo, type ResultadoProducto } from "@/lib/catalogo";

// Busqueda en el catalogo de los supermercados cercanos al hogar (todos si no hay ubicacion)
export async function buscar(q: string): Promise<{ resultados: ResultadoProducto[]; error?: string }> {
  const texto = String(q ?? "").trim().slice(0, 80);
  if (texto.length < 2) return { resultados: [] };
  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  const zona = hogar ? await zonaDelHogar(supabase, hogar.id) : null;
  try {
    return { resultados: await buscarCatalogo(supabase, texto, zona?.buscarEn ?? null) };
  } catch {
    return { resultados: [], error: "No se pudo buscar ahora." };
  }
}
