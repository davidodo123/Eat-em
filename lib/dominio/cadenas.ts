// Supermercados cercanos: de las etiquetas de OpenStreetMap (brand / name) a nuestras cadenas.
// Sin red ni base de datos, para poder probarlo.

export interface TiendaOSM { lat: number; lon: number; tags: Record<string, string> }
export interface TiendaCerca { cadena: string | null; nombre: string; km: number }

// Orden importa: "Carrefour Market" antes que cualquier regla generica.
const REGLAS: [RegExp, string][] = [
  [/\bmercadona\b/, "mercadona"],
  [/\bcarrefour\b/, "carrefour"],
  [/\bahorramas\b/, "ahorramas"],
  [/\bgadis\b|\bgadisa\b/, "gadis"],
  [/\bcaprabo\b/, "caprabo"],
  [/\bconsum\b|\bcharter\b/, "consum"],
  [/\balcampo\b/, "alcampo"],
  [/\beroski\b/, "eroski"],
  [/\blidl\b/, "lidl"],
  [/\baldi\b/, "aldi"],
  [/^dia\b|\bdia\s*(%|market|maxi)|\bsupermercados? dia\b|\bla plaza de dia\b/, "dia"],
];

const plano = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function cadenaDe(tags: Record<string, string>): string | null {
  for (const campo of [tags.brand, tags.name, tags.operator]) {
    if (!campo) continue;
    const t = plano(campo);
    for (const [re, id] of REGLAS) if (re.test(t)) return id;
  }
  return null;
}

// Distancia en km (haversine)
export function distanciaKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Tiendas ordenadas por distancia y cadenas distintas (de la mas cercana a la mas lejana)
export function resumirTiendas(origen: { lat: number; lon: number }, tiendas: TiendaOSM[], maximo = 40): { tiendas: TiendaCerca[]; cadenas: string[] } {
  const lista = tiendas
    .map((t) => ({
      cadena: cadenaDe(t.tags),
      nombre: (t.tags.name || t.tags.brand || "Supermercado").slice(0, 80),
      km: Math.round(distanciaKm(origen, t) * 10) / 10,
    }))
    .sort((a, b) => a.km - b.km)
    .slice(0, maximo);
  const cadenas = [...new Set(lista.map((t) => t.cadena).filter((c): c is string => c !== null))];
  return { tiendas: lista, cadenas };
}

// Codigo postal espanol: 5 cifras, provincia 01-52
export const codigoPostalValido = (cp: string) => /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/.test(cp);
