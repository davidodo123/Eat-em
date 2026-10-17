import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TiendaCerca } from "@/lib/dominio/cadenas";

// Cadenas de las que tenemos catalogo (las demas aparecen como "cerca, sin datos")
export const CON_CATALOGO = ["carrefour", "mercadona", "ahorramas", "gadis", "caprabo"];
export const NOMBRE_CADENA: Record<string, string> = {
  mercadona: "Mercadona", carrefour: "Carrefour", ahorramas: "Ahorramás", gadis: "Gadis", caprabo: "Caprabo",
  dia: "Dia", lidl: "Lidl", aldi: "Aldi", alcampo: "Alcampo", eroski: "Eroski", consum: "Consum",
};

export interface Zona {
  lugar: string | null;
  radioKm: number;
  cadenasCerca: string[];
  tiendas: TiendaCerca[];
  // Cadenas en las que buscar: las cercanas con catalogo; null = todas (sin ubicacion o ninguna cerca)
  buscarEn: string[] | null;
}

export const zonaDelHogar = cache(async (supabase: SupabaseClient, grupoId: string): Promise<Zona> => {
  const { data } = await supabase.from("grupos").select("lugar, radio_km, cadenas_cerca, tiendas_cerca").eq("id", grupoId).single();
  const cerca: string[] = data?.cadenas_cerca ?? [];
  const conDatos = cerca.filter((c) => CON_CATALOGO.includes(c));
  return {
    lugar: data?.lugar ?? null, radioKm: data?.radio_km ?? 5, cadenasCerca: cerca,
    tiendas: (data?.tiendas_cerca as TiendaCerca[] | null) ?? [],
    buscarEn: conDatos.length ? conDatos : null,
  };
});
