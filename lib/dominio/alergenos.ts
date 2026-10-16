// Los 14 alergenos de declaracion obligatoria en la UE (Reglamento 1169/2011),
// con los nombres que usa el proyecto en `alergenos` y `trazas`.
export const ALERGENOS = [
  "gluten", "crustaceos", "huevo", "pescado", "cacahuetes", "soja", "leche",
  "frutos_cascara", "apio", "mostaza", "sesamo", "sulfitos", "altramuces", "moluscos",
] as const;
export type Alergeno = (typeof ALERGENOS)[number];

// Etiquetas de Open Food Facts ("en:milk") -> alergeno propio
const DESDE_OFF: Record<string, Alergeno> = {
  "en:gluten": "gluten", "en:crustaceans": "crustaceos", "en:eggs": "huevo", "en:fish": "pescado",
  "en:peanuts": "cacahuetes", "en:soybeans": "soja", "en:milk": "leche", "en:nuts": "frutos_cascara",
  "en:celery": "apio", "en:mustard": "mostaza", "en:sesame-seeds": "sesamo",
  "en:sulphur-dioxide-and-sulphites": "sulfitos", "en:lupin": "altramuces", "en:molluscs": "moluscos",
};

// "en:milk,en:gluten,en:unknown" -> ["gluten", "leche"] (ordenados, sin repetir)
export function alergenosDesdeOff(etiquetas: string | null | undefined): Alergeno[] {
  if (!etiquetas) return [];
  const r = new Set<Alergeno>();
  for (const t of etiquetas.split(",")) {
    const a = DESDE_OFF[t.trim().toLowerCase()];
    if (a) r.add(a);
  }
  return ALERGENOS.filter((a) => r.has(a));
}
