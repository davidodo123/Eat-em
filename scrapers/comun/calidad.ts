import type { ProductoNormalizado } from "./tipos.ts";

export interface Anterior {
  id_origen: string;
  nombre: string | null;
  imagen_url: string | null;
  precio: number | null;
  cantidad_neta: number | null;
  descatalogado_en: string | null;
}

export interface InformeCalidad {
  total: number;
  nuevos: number;
  reaparecidos: number;
  descatalogados: number;
  sin_precio: number;
  sin_formato: number;
  sin_ean: number;
  sin_categoria: number;
  precio_anomalo: number;    // cambio > 50 % frente a la ultima vez
  cambio_formato: number;
  total_anterior: number | null;
  caida_pct: number | null;
  ejemplos: Record<string, string[]>;
  alerta: string | null;
}

const MAX_EJEMPLOS = 8;

export function informeCalidad(
  productos: ProductoNormalizado[],
  anteriores: Map<string, Anterior>,
  totalUltimaEjecucion: number | null,
): InformeCalidad {
  const ej: Record<string, string[]> = {};
  const anotar = (clave: string, p: ProductoNormalizado, extra = "") => {
    (ej[clave] ??= []).length < MAX_EJEMPLOS && ej[clave].push(`${p.id_origen} ${p.nombre}${extra}`);
  };
  const vistos = new Set<string>();
  const inf: InformeCalidad = {
    total: productos.length, nuevos: 0, reaparecidos: 0, descatalogados: 0, sin_precio: 0, sin_formato: 0, sin_ean: 0,
    sin_categoria: 0, precio_anomalo: 0, cambio_formato: 0, total_anterior: totalUltimaEjecucion, caida_pct: null,
    ejemplos: ej, alerta: null,
  };

  for (const p of productos) {
    vistos.add(p.id_origen);
    const a = anteriores.get(p.id_origen);
    if (!a) inf.nuevos++;
    else if (a.descatalogado_en) inf.reaparecidos++;
    if (p.precio === null) { inf.sin_precio++; anotar("sin_precio", p); }
    if (p.cantidad_neta === null) { inf.sin_formato++; anotar("sin_formato", p, ` [${p.formato_texto ?? ""}]`); }
    if (p.ean === null) inf.sin_ean++;
    if (p.categoria_id === null) inf.sin_categoria++;
    if (a?.precio && p.precio && Math.abs(p.precio - a.precio) / a.precio > 0.5) {
      inf.precio_anomalo++; anotar("precio_anomalo", p, ` ${a.precio} -> ${p.precio}`);
    }
    if (a?.cantidad_neta && p.cantidad_neta && a.cantidad_neta !== p.cantidad_neta) {
      inf.cambio_formato++; anotar("cambio_formato", p, ` ${a.cantidad_neta} -> ${p.cantidad_neta}`);
    }
  }
  for (const a of anteriores.values()) if (!a.descatalogado_en && !vistos.has(a.id_origen)) inf.descatalogados++;

  // Alertas: 0 productos o caida >= 30 % frente a la ultima ejecucion correcta
  if (inf.total === 0) inf.alerta = "0 productos: probablemente ha cambiado la web o la API";
  else if (totalUltimaEjecucion) {
    inf.caida_pct = Math.round((1 - inf.total / totalUltimaEjecucion) * 100);
    if (inf.caida_pct >= 30) inf.alerta = `${inf.caida_pct} % menos productos que la ultima ejecucion`;
  }
  return inf;
}
