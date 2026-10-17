import "server-only";
import type { Hogar } from "@/lib/grupo";
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

// Sin consultas: sale de los datos del hogar que ya trae hogarActual()
export function zonaDelHogar(hogar: Hogar): Zona {
  const cerca = hogar.cadenas_cerca ?? [];
  const conDatos = cerca.filter((c) => CON_CATALOGO.includes(c));
  return {
    lugar: hogar.lugar ?? null, radioKm: hogar.radio_km ?? 5, cadenasCerca: cerca,
    tiendas: (hogar.tiendas_cerca as TiendaCerca[] | null) ?? [],
    buscarEn: conDatos.length ? conDatos : null,
  };
}
