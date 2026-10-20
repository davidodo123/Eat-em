// Scraper de Carrefour (catalogo de supermercado "food").
//
// Fuente: buscador de Empathy (api.empathy.co), el proveedor que usa la web
// de Carrefour. Verificado el 2026-10-16:
//  - www.carrefour.es (paginas, sitemap y /cloud-api) responde 403 con desafio
//    de Cloudflare: NO se intenta saltar.
//  - api.empathy.co no publica robots.txt (404) y responde JSON sin autenticacion.
//  - Endpoint: /search/v1/query/carrefour/search?query=..&lang=es&catalog=food&rows=100&start=N
//    filter=brand:<marca> | filter=parent_category.food:<cat>. query vacio o "*" no lista nada.
//  - Campos usados: product_id, display_name, brand, ean13, active_price, list_price (solo en oferta),
//    measure_unit (l/kg/...), unit_conversion_factor (cantidad total en esa unidad), recipient,
//    parent_category.food, image_path.food, urls.food, active_food.
//  - Precios: nacionales de la tienda online ("store=default"), no por codigo postal.
//  - active_marketplace=true son vendedores externos (se descartan). list_price solo aparece
//    en ellos, asi que esta fuente NO distingue ofertas del supermercado: active_price es el
//    precio vigente (con la promocion ya aplicada si la hay).
import { ClienteHttp } from "../comun/http.ts";
import type { ProductoNormalizado, ResultadoScraper, Scraper } from "../comun/tipos.ts";
import { normalizarEan } from "../../lib/dominio/ean.ts";
import { parsearFormato, precioPorUnidad, type Formato } from "../../lib/dominio/formato.ts";
import { TERMINOS } from "./terminos.ts";
import { tituloMarca } from "../comun/texto.ts";

const BASE = "https://api.empathy.co/search/v1/query/carrefour/search";
const FILAS = 100;
const MAX_PAGINAS_TERMINO = 25; // la API no pagina mas alla de start=2500 (HTTP 400, comprobado el 2026-10-17)

interface ItemCarrefour {
  product_id: string;
  display_name?: string;
  brand?: string;
  ean13?: string;
  active_price?: number;
  list_price?: number;
  measure_unit?: string;
  unit_conversion_factor?: number;
  recipient?: string;
  parent_category?: { food?: string };
  image_path?: { food?: string };
  urls?: { food?: string };
  active_food?: boolean;
  variable_weight?: boolean;
  [k: string]: unknown;
}

interface RespuestaBusqueda {
  catalog: {
    numFound: number;
    content: ItemCarrefour[];
    facets?: { facet: string; values: { id: string; value: string; filter: string; count: number }[] }[];
  };
}

export const carrefour: Scraper = {
  id: "carrefour",
  async ejecutar({ maxPeticiones, rapido, guardarRaw }) {
    const http = new ClienteHttp({ intervaloMs: 1000, maxPeticiones });
    const vistos = new Map<string, ItemCarrefour>();
    const votos = new Map<string, Map<string, number>>();
    const marcas = new Map<string, string>(); // filter -> nombre
    const avisos: string[] = [];

    const recorrer = async (query: string, filtro: string | null, grupo: string | null) => {
      for (let pagina = 0; pagina < MAX_PAGINAS_TERMINO && !http.agotado; pagina++) {
        const url = new URL(BASE);
        url.search = new URLSearchParams({
          query, lang: "es", catalog: "food", rows: String(FILAS), start: String(pagina * FILAS),
          ...(filtro ? { filter: filtro } : {}),
        }).toString();
        let r: RespuestaBusqueda;
        try {
          r = await http.json<RespuestaBusqueda>(url.toString());
        } catch (e) {
          avisos.push(`"${query}" ${filtro ?? ""} pag ${pagina}: ${(e as Error).message}`);
          return;
        }
        const items = r.catalog?.content ?? [];
        guardarRaw({ query, filtro, pagina, numFound: r.catalog?.numFound, items: items.map(sinTracking) });

        for (const it of items) {
          // Marketplace = vendedores externos (cajas, precios propios): no es el supermercado
          if (!it.product_id || it.active_marketplace === true) continue;
          vistos.set(it.product_id, it);
          const cat = it.parent_category?.food;
          if (grupo && cat) {
            const v = votos.get(cat) ?? new Map<string, number>();
            v.set(grupo, (v.get(grupo) ?? 0) + 1);
            votos.set(cat, v);
          }
        }
        if (pagina === 0) {
          for (const f of r.catalog?.facets ?? []) {
            if (f.facet === "brand") for (const v of f.values) marcas.set(v.filter, v.value);
          }
        }
        if ((pagina + 1) * FILAS >= (r.catalog?.numFound ?? 0) || items.length === 0) return;
      }
    };

    // 1) Terminos por categoria
    const lista = Object.entries(TERMINOS).flatMap(([g, ts]) => ts.map((t) => [g, t] as const));
    for (const [i, [grupo, termino]] of lista.entries()) {
      if (http.agotado) break;
      await recorrer(termino, null, grupo);
      if (i % 20 === 0) console.log(`  terminos ${i + 1}/${lista.length} | productos ${vistos.size} | peticiones ${http.peticiones}`);
    }
    console.log(`  fase terminos: ${vistos.size} productos, ${marcas.size} marcas descubiertas`);

    // 2) Expansion por marca (completa lo que los terminos no encuentran)
    if (!rapido) {
      let i = 0;
      for (const [filtro, nombre] of marcas) {
        if (http.agotado) break;
        await recorrer(nombre, filtro, null);
        if (++i % 50 === 0) console.log(`  marcas ${i}/${marcas.size} | productos ${vistos.size} | peticiones ${http.peticiones}`);
      }
    }
    if (http.agotado) avisos.push(`Tope de ${maxPeticiones} peticiones alcanzado: catalogo incompleto`);

    const ahora = new Date().toISOString();
    return {
      productos: [...vistos.values()].map((it) => normalizar(it, ahora)),
      votosCategoria: votos,
      peticiones: http.peticiones,
      errores: http.errores,
      avisos,
      parametros: { fuente: "api.empathy.co", catalogo: "food", terminos: lista.length, marcas: marcas.size, rapido: !!rapido },
      completo: !http.bloqueado,
    } satisfies ResultadoScraper;
  },
};

function sinTracking(it: ItemCarrefour) {
  const { tagging, ...resto } = it;
  void tagging;
  return resto;
}

const UNIDADES: Record<string, { unidad: Formato["unidad"]; factor: number }> = {
  l: { unidad: "ml", factor: 1000 },
  kg: { unidad: "g", factor: 1000 },
  ud: { unidad: "unidad", factor: 1 },
  u: { unidad: "unidad", factor: 1 },
};

export function normalizar(it: ItemCarrefour, ahora: string): ProductoNormalizado {
  const texto = it.recipient?.trim() || null;
  // Formato: el factor que da la API, salvo que contradiga al texto del envase. La API a veces
  // trae el factor multiplicado por 10 ("95 g." con 0,95 kg) y el precio por kilo sale 10 veces menor.
  // En los de peso variable ("al corte", "aprox") trae 0,001 kg: 1 g, que no es un formato real.
  let formato: Formato | null = null;
  const u = UNIDADES[(it.measure_unit ?? "").toLowerCase()];
  const delTexto = parsearFormato(texto) ?? parsearFormato(it.display_name);
  const calculado = u && it.unit_conversion_factor && it.unit_conversion_factor > 0 ? Math.round(it.unit_conversion_factor * u.factor * 100) / 100 : null;
  const deApi = calculado !== null && (u!.unidad === "unidad" || calculado >= 5) ? calculado : null;
  const contradice = deApi !== null && delTexto !== null && delTexto.unidad === u!.unidad && !delTexto.aproximado
    && Math.abs(deApi - delTexto.cantidad) / delTexto.cantidad > 0.2;
  if (contradice || deApi === null) formato = delTexto;
  else {
    formato = {
      cantidad: deApi,
      unidad: u!.unidad,
      pack: delTexto?.pack ?? 1,
      aproximado: Boolean(it.variable_weight) || Boolean(delTexto?.aproximado),
    };
  }

  const activo = numero(it.active_price);
  const lista = numero(it.list_price);
  const enOferta = activo !== null && lista !== null && lista > activo;
  const precio = enOferta ? lista : activo;
  const efectivo = enOferta ? activo : precio;
  const ppu = efectivo !== null && formato ? precioPorUnidad(efectivo, formato) : null;

  return {
    supermercado_id: "carrefour",
    id_origen: it.product_id,
    url_origen: it.urls?.food ? "https://www.carrefour.es" + it.urls.food : null,
    nombre: (it.display_name ?? "").trim() || it.product_id,
    marca: tituloMarca(it.brand),
    categoria_origen: it.parent_category?.food ?? null,
    categoria_id: null, // lo asigna el ejecutor con el mapeo de categorias
    formato_texto: texto,
    cantidad_neta: formato?.cantidad ?? null,
    unidad: formato?.unidad ?? null,
    unidades_pack: formato?.pack ?? 1,
    precio,
    precio_oferta: enOferta ? activo : null,
    precio_por_unidad: ppu?.valor ?? null,
    unidad_precio: ppu?.unidad ?? null,
    imagen_url: it.image_path?.food ?? null,
    ean: normalizarEan(it.ean13),
    // active_price = 0 => no se puede comprar ahora (sin stock / retirado temporalmente)
    disponible: it.active_food !== false && activo !== null,
    descatalogado_en: null,
    origen: "scraping",
    actualizado_en: ahora,
  };
}

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
