import type { UnidadBase } from "./formato.ts";

export interface FormatoProducto {
  cantidad_neta: number | null;
  unidad: UnidadBase | null;
  unidades_pack: number;
}

export interface UnidadIngrediente {
  unidad: UnidadBase;
  gramos_por_unidad: number | null;
}

// Cuanto entra en el inventario (en la unidad del ingrediente) al comprar `unidades`
// envases de un producto. null si no se puede saber: la app pide la cantidad a mano.
export function cantidadComprada(p: FormatoProducto, ing: UnidadIngrediente, unidades = 1): number | null {
  if (!(unidades > 0)) return null;
  const neta = p.cantidad_neta && p.cantidad_neta > 0 ? p.cantidad_neta : null;
  if (!neta || !p.unidad) return ing.unidad === "unidad" ? unidades * Math.max(1, p.unidades_pack) : null;

  if (p.unidad === ing.unidad) return redondear(neta * unidades);
  // g <-> ml: densidad ~1 (leche, yogur liquido, aceite ~0,92). Suficiente para el stock.
  if (p.unidad !== "unidad" && ing.unidad !== "unidad") return redondear(neta * unidades);
  // Producto por piezas ("12 huevos") e ingrediente en gramos: con el peso medio de una pieza
  if (p.unidad === "unidad") return ing.gramos_por_unidad ? redondear(neta * ing.gramos_por_unidad * unidades) : null;
  // Producto en gramos e ingrediente por piezas: con el peso medio, o el numero de envases del pack
  if (ing.gramos_por_unidad) return Math.max(1, Math.round((neta * unidades) / ing.gramos_por_unidad));
  return unidades * Math.max(1, p.unidades_pack);
}

const redondear = (n: number) => Math.round(n * 100) / 100;

// ¿Este movimiento hace que el stock pase por debajo del umbral? (solo al cruzarlo, para no repetir avisos)
export function cruzaUmbral(antes: number, despues: number, umbral: number | null): boolean {
  return umbral !== null && umbral > 0 && antes >= umbral && despues < umbral;
}
