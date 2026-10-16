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
  lavados: ["unidad", 1], lav: ["unidad", 1], dosis: ["unidad", 1], capsulas: ["unidad", 1], "cápsulas": ["unidad", 1],
};

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const UNI = String.raw`(kg|kilos?|grs?|gramos|g|mg|litros?|lt|l|cl|dl|ml|uds?|unidad(?:es)?|u|lavados|lav|dosis|c[aá]psulas)(?![\p{L}])\.?`;

const ENVASES = String.raw`(?:latas?|botell(?:as?|ines?)|bri[ck]ks?|tarrinas?|envases?|sobres?|bolsas?|tetrabri[ck]ks?)`;

const aNumero = (s: string) => Number(s.replace(",", "."));

export function parsearFormato(texto: string | null | undefined): Formato | null {
  if (!texto) return null;
  const t = texto.toLowerCase().replace(/\s+/g, " ");
  const aproximado = /\baprox/.test(t) || /\bpeso variable\b/.test(t);

  // "6x125 g", "pack 12 x 33 cl", "2 x 1 l"
  // "pack 24 latas 33cl", "6 botellas de 1,5 l"
  const pack = t.match(new RegExp(String.raw`(\d+)\s*x\s*${NUM}\s*${UNI}`, "u"))
    ?? t.match(new RegExp(String.raw`(\d+)\s*${ENVASES}\s*(?:de\s+)?${NUM}\s*${UNI}`, "u"));
  if (pack && Number(pack[1]) >= 1) {   // "00 botella 75 cl" (sin alcohol 0,0) no es un pack
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

  // "1 docena", "media docena", "2 docenas"
  const docena = t.match(/(\d+|media)\s*docenas?\b/);
  if (docena) return { cantidad: docena[1] === "media" ? 6 : Number(docena[1]) * 12, unidad: "unidad", pack: 1, aproximado };

  // Sin cantidad pero vendido por pieza: "Coliflor, unidad", "Zanahoria, manojo"
  if (/(^|[\s,])(unidad|pieza|manojo)\b\.?\s*$/.test(t)) return { cantidad: 1, unidad: "unidad", pack: 1, aproximado };
  return null;
}

// Precio por kg / l / unidad a partir del precio y el formato normalizado
export function precioPorUnidad(precio: number, f: Formato): { valor: number; unidad: "kg" | "l" | "unidad" } {
  if (f.unidad === "g") return { valor: redondear((precio / f.cantidad) * 1000, 4), unidad: "kg" };
  if (f.unidad === "ml") return { valor: redondear((precio / f.cantidad) * 1000, 4), unidad: "l" };
  return { valor: redondear(precio / f.cantidad, 4), unidad: "unidad" };
}

// Cantidad total deducida del precio y el precio por kg / l / unidad que publica la tienda.
// Es aproximada (los dos precios vienen redondeados a centimos), por eso se redondea
// a entero y solo se usa cuando el nombre no trae formato o contradice a la tienda.
export function formatoDesdePrecioUnidad(precio: number | null, ppu: number | null, unidad: "kg" | "l" | "unidad" | null): Formato | null {
  if (!precio || !ppu || !unidad) return null;
  const base = precio / ppu;
  if (unidad === "unidad") return { cantidad: Math.max(1, Math.round(base)), unidad: "unidad", pack: 1, aproximado: false };
  return { cantidad: Math.round(base * 1000), unidad: unidad === "kg" ? "g" : "ml", pack: 1, aproximado: false };
}

// El formato del nombre manda si cuadra (±10 %) con el que sale del precio por unidad
export function elegirFormato(delNombre: Formato | null, delPrecio: Formato | null): Formato | null {
  if (!delNombre || !delPrecio) return delNombre ?? delPrecio;
  if (delNombre.unidad !== delPrecio.unidad) return delNombre; // "12 huevos" a precio por kg: no son comparables
  return Math.abs(delNombre.cantidad - delPrecio.cantidad) / delPrecio.cantidad <= 0.1
    ? delNombre
    : { ...delPrecio, pack: delNombre.pack, aproximado: delNombre.aproximado };
}

function redondear(n: number, dec = 2) {
  const m = 10 ** dec;
  return Math.round(n * m) / m;
}
