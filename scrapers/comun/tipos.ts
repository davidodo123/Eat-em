import type { UnidadBase } from "../../lib/dominio/formato.ts";

// Producto ya normalizado, listo para la tabla productos.
// Solo incluye columnas que "posee" el scraper: no pisa la nutricion
// ni los alergenos que anada el enriquecimiento (Fase 3).
export interface ProductoNormalizado {
  supermercado_id: string;
  id_origen: string;
  url_origen: string | null;
  nombre: string;
  marca: string | null;
  categoria_origen: string | null;
  categoria_id: number | null;
  formato_texto: string | null;
  cantidad_neta: number | null;
  unidad: UnidadBase | null;
  unidades_pack: number;
  precio: number | null;
  precio_oferta: number | null;
  precio_por_unidad: number | null;
  unidad_precio: "kg" | "l" | "unidad" | null;
  imagen_url: string | null;
  ean: string | null;
  disponible: boolean;
  descatalogado_en: null;
  origen: "scraping";
  actualizado_en: string;
}

// Lo que devuelve cada scraper
export interface ResultadoScraper {
  productos: ProductoNormalizado[];
  // votos categoria de origen -> slug propio (para el mapeo automatico)
  votosCategoria: Map<string, Map<string, number>>;
  peticiones: number;
  errores: number;
  avisos: string[];
  parametros: Record<string, unknown>;
  // false si faltan partes del catalogo (bloqueo, errores): no se descatalogan productos
  completo?: boolean;
}

// Lo que ya hay en la base de un producto (para scrapers incrementales)
export interface ProductoConocido {
  nombre: string | null;
  imagen_url: string | null;
}

export interface Scraper {
  id: string;
  ejecutar(op: {
    maxPeticiones?: number;
    rapido?: boolean;
    guardarRaw: (pagina: unknown) => void;
    conocidos: Map<string, ProductoConocido>;
  }): Promise<ResultadoScraper>;
}
