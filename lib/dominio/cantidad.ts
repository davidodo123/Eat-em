import type { UnidadBase } from "./formato.ts";

// 1500 g -> "1,5 kg" | 250 ml -> "250 ml" | 3 unidad -> "3 uds" | 1 unidad -> "1 ud"
export function formatearCantidad(n: number, unidad: UnidadBase): string {
  const num = (v: number, dec: number) =>
    v.toLocaleString("es-ES", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
  if (unidad === "unidad") return `${num(n, 1)} ${n === 1 ? "ud" : "uds"}`;
  const grande = unidad === "g" ? "kg" : "l";
  return n >= 1000 ? `${num(n / 1000, 2)} ${grande}` : `${num(n, 0)} ${unidad}`;
}

// Paso razonable para los botones +/- segun la unidad y lo que hay
export function pasoAjuste(cantidad: number, unidad: UnidadBase): number {
  if (unidad === "unidad") return 1;
  return cantidad >= 2000 ? 500 : cantidad >= 500 ? 100 : 50;
}
