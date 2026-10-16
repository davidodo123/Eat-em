// Normalizacion de formatos de producto a unidad base (g, ml, unidad).
// Ejemplos: "1 l." -> 1000 ml | "pack 6x125 g" -> 750 g, 6 uds | "75 cl" -> 750 ml
//           "12 ud" -> 12 unidad | "1 kg aprox" -> 1000 g (peso variable)

export type UnidadBase = "g" | "ml" | "unidad";

export interface Formato {
  cantidad: number;        // total en unidad base
  unidad: UnidadBase;
  pack: number;            // numero de envases (1 si no es pack)
  aproximado: boolean;     // peso variable ("aprox")
}

const FACTORES: Record<string, [UnidadBase, number]> = {
  kg: ["g", 1000], kilo: ["g", 1000], kilos: ["g", 1000], g: ["g", 1], gr: ["g", 1], grs: ["g", 1], gramos: ["g", 1],
  mg: ["g", 0.001],
  l: ["ml", 1000], lt: ["ml", 1000], litro: ["ml", 1000], litros: ["ml", 1000],
  cl: ["ml", 10], dl: ["ml", 100], ml: ["ml", 1],
  ud: ["unidad", 1], uds: ["unidad", 1], u: ["unidad", 1], unidad: ["unidad", 1], unidades: ["unidad", 1],
  lavados: ["unidad", 1], dosis: ["unidad", 1], capsulas: ["unidad", 1], "cápsulas": ["unidad", 1],
};

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const UNI = String.raw`(kg|kilos?|grs?|gramos|g|mg|litros?|lt|l|cl|dl|ml|uds?|unidad(?:es)?|u|lavados|dosis|c[aá]psulas)(?![\p{L}])\.?`;

const aNumero = (s: string) => Number(s.replace(",", "."));

export function parsearFormato(texto: string | null | undefined): Formato | null {
  if (!texto) return null;
  const t = texto.toLowerCase().replace(/\s+/g, " ");
  const aproximado = /\baprox/.test(t) || /\bpeso variable\b/.test(t);

  // "6x125 g", "pack 12 x 33 cl", "2 x 1 l"
  const pack = t.match(new RegExp(String.raw`(\d+)\s*x\s*${NUM}\s*${UNI}`, "u"));
  if (pack) {
    const [, n, num, uni] = pack;
    const [unidad, factor] = FACTORES[uni.replace(/\.$/, "")];
    const envases = Number(n);
    return { cantidad: redondear(envases * aNumero(num) * factor), unidad, pack: envases, aproximado };
  }

  // Ultima medida simple del texto ("Leche entera 1 l." -> 1 l)
  const simples = [...t.matchAll(new RegExp(String.raw`${NUM}\s*${UNI}`, "gu"))];
  if (simples.length) {
    const [, num, uni] = simples[simples.length - 1];
    const [unidad, factor] = FACTORES[uni.replace(/\.$/, "")];
    return { cantidad: redondear(aNumero(num) * factor), unidad, pack: 1, aproximado };
  }
  return null;
}

// Precio por kg / l / unidad a partir del precio y el formato normalizado
export function precioPorUnidad(precio: number, f: Formato): { valor: number; unidad: "kg" | "l" | "unidad" } {
  if (f.unidad === "g") return { valor: redondear((precio / f.cantidad) * 1000, 4), unidad: "kg" };
  if (f.unidad === "ml") return { valor: redondear((precio / f.cantidad) * 1000, 4), unidad: "l" };
  return { valor: redondear(precio / f.cantidad, 4), unidad: "unidad" };
}

function redondear(n: number, dec = 2) {
  const m = 10 ** dec;
  return Math.round(n * m) / m;
}
