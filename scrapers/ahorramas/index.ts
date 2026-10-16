// Scraper de Ahorramas (Salesforce Commerce Cloud).
//
// Verificado el 2026-10-16 (https://www.ahorramas.com/robots.txt):
//   User-agent: * con Disallow solo de busqueda (/buscador?, Search-ShowAjax), carrito,
//   login, filtros (&prefn1, ?pmax) y "ver-todo". Las paginas de categoria con
//   ?start=N&sz=24 estan permitidas.
//  - Cada pagina de categoria trae 24 productos con: data-pid, data-category1..3 (en
//    "frescos" solo la 1), data-gtm-layer (JSON con id, nombre, marca, precio y la
//    subcategoria: category y categoryID), data-hasunitweight (al peso), imagen, precio tachado
//    (strike-through list) si hay oferta, precio vigente (sales) y precio por kg/l/ud.
//  - sz mayor de 24 se ignora. Cada pagina repite 1 producto patrocinado (se deduplica).
//  - Sin EAN ni nutricion. Precios de la tienda online (zona de Madrid).
//  - Si distingue ofertas: precio = tachado, precio_oferta = vigente.
import { ClienteHttp } from "../comun/http.ts";
import type { ProductoNormalizado, ResultadoScraper, Scraper } from "../comun/tipos.ts";
import { elegirFormato, formatoDesdePrecioUnidad, parsearFormato, precioPorUnidad } from "../../lib/dominio/formato.ts";
import { adivinarCategoria, votar } from "../comun/categorias.ts";
import { decodificar, tituloMarca } from "../comun/texto.ts";

const BASE = "https://www.ahorramas.com";
const POR_PAGINA = 24;
// A 1 peticion/s Cloudflare devuelve un desafio (429, cf-mitigated: challenge) tras ~200
// paginas (2026-10-16). Se va mucho mas despacio: ~400 paginas en ~30 min.
const INTERVALO_MS = 4000;
const MAX_PAGINAS = 400; // 9.600 productos por categoria raiz como maximo
// Categorias raiz del catalogo (sitemap_2-category.xml). Se excluyen las de temporada,
// ofertas y novedades: repiten productos de estas.
export const RAICES = [
  "frescos", "alimentacion", "lacteos", "bebidas", "congelados",
  "limpieza", "cuidado-personal", "bebe", "mascotas", "hogar",
];

export interface ItemAhorramas {
  pid: string;
  nombre: string;
  marca: string | null;
  ruta: string[];
  categoria: string | null;    // categoryID del gtm ("yogures/kefir/y/postres")
  alPeso: boolean;             // data-hasunitweight: se vende al peso, el precio es por kg
  url: string | null;
  imagen: string | null;
  precioLista: number | null;  // tachado (solo en oferta)
  precioVenta: number | null;  // vigente
  ppu: number | null;          // precio por unidad que publica la tienda
  unidadPpu: string | null;    // "LITRO", "KILO", "UNIDAD"...
}

export const ahorramas: Scraper = {
  id: "ahorramas",
  async ejecutar({ maxPeticiones, guardarRaw }) {
    const http = new ClienteHttp({ intervaloMs: INTERVALO_MS, maxPeticiones });
    const vistos = new Map<string, ItemAhorramas>();
    const avisos: string[] = [];
    const totales: Record<string, number | null> = {};
    let completo = true;

    for (const raiz of RAICES) {
      let total: number | null = null;
      for (let pagina = 0; pagina < MAX_PAGINAS && !http.agotado; pagina++) {
        const start = pagina * POR_PAGINA;
        let html: string;
        try {
          html = await http.texto(`${BASE}/${raiz}/?start=${start}&sz=${POR_PAGINA}`);
        } catch (e) {
          avisos.push(`${raiz} start=${start}: ${(e as Error).message}`);
          completo = false;
          break;
        }
        total ??= totalProductos(html);
        const items = parsearListado(html);
        guardarRaw({ raiz, start, total, items });
        for (const it of items) vistos.set(it.pid, it);
        if (items.length === 0 || (total !== null && start + POR_PAGINA >= total)) break;
      }
      totales[raiz] = total;
      console.log(`  ${raiz}: ${total ?? "?"} anunciados | productos ${vistos.size} | peticiones ${http.peticiones}`);
    }
    if (http.bloqueado) avisos.push("Desafio anti-bots de Cloudflare: ejecucion parada, catalogo incompleto");
    else if (http.agotado) avisos.push(`Tope de ${maxPeticiones} peticiones alcanzado: catalogo incompleto`);

    const ahora = new Date().toISOString();
    const votos = new Map<string, Map<string, number>>();
    const productos = [...vistos.values()].map((it) => {
      const p = normalizar(it, ahora);
      votar(votos, p.categoria_origen, adivinarCategoria(it.ruta));
      return p;
    });
    const sinUnidad = [...new Set([...vistos.values()].map((i) => i.unidadPpu).filter((u) => u && !UNIDADES[u]))];
    if (sinUnidad.length) avisos.push(`Unidades de precio sin mapear: ${sinUnidad.join(", ")}`);

    return {
      productos,
      votosCategoria: votos,
      peticiones: http.peticiones,
      errores: http.errores,
      avisos,
      parametros: { fuente: "categorias html (?start&sz=24)", raices: RAICES, anunciados: totales },
      completo: completo && !http.agotado,
    } satisfies ResultadoScraper;
  },
};

// "(2.689 productos)" -> 2689
export function totalProductos(html: string): number | null {
  const m = html.match(/plp-result-count">\s*\(([\d.]+)\s*productos?\)/);
  return m ? Number(m[1].replace(/\./g, "")) : null;
}

// Extrae los productos de una pagina de categoria
export function parsearListado(html: string): ItemAhorramas[] {
  const items: ItemAhorramas[] = [];
  const trozos = html.split(/<div class="product" data-pid="/).slice(1);
  for (const t of trozos) {
    const pid = t.match(/^(\d+)"/)?.[1];
    if (!pid) continue;
    const gtm = leerGtm(t.match(/data-gtm-layer="([^"]*)"/)?.[1]);
    const attr = (n: string) => {
      const v = t.match(new RegExp(`${n}="([^"]*)"`))?.[1];
      return v ? decodificar(v) : null;
    };
    const nombre = gtm?.name ?? decodificar(t.match(/class="link product-name-gtm"[^>]*>([^<]*)</)?.[1] ?? "");
    const href = t.match(/href="([^"]+\.html)"\s+class="product-pdp-link/)?.[1];
    const img = t.match(/class="tile-image" src="([^"]+)"/)?.[1];
    const ppu = t.match(/unit-price-per-unit grey">\s*([\d.,]+)\s*(?:&euro;|€)\s*\/\s*([A-Za-zÁÉÍÓÚáéíóú]+)/);
    items.push({
      pid,
      nombre: nombre || pid,
      marca: gtm?.brand || attr("data-brand"),
      ruta: [...new Set([attr("data-category1"), attr("data-category2"), attr("data-category3"), gtm?.category]
        .filter((c): c is string => !!c))],
      categoria: gtm?.categoryID ?? null,
      alPeso: attr("data-hasunitweight") === "true",
      url: href ? BASE + decodificar(href) : null,
      imagen: img ? decodificar(img).split("?")[0] : null,
      precioLista: num(t.match(/strike-through list">\s*<span class="value" content="([\d.]+)"/)?.[1]),
      precioVenta: num(t.match(/<span class="sales">\s*<span class="value" content="([\d.]+)"/)?.[1]) ?? num(gtm?.price),
      ppu: ppu ? num(ppu[1].replace(/\./g, "").replace(",", ".")) : null,
      unidadPpu: ppu ? ppu[2].toUpperCase() : null,
    });
  }
  return items;
}

// Unidad del precio por unidad -> unidad propia y cuantas hay en ella
const UNIDADES: Record<string, ["kg" | "l" | "unidad", number]> = {
  KILO: ["kg", 1], KG: ["kg", 1], LITRO: ["l", 1], L: ["l", 1], UNIDAD: ["unidad", 1], UD: ["unidad", 1],
  DOCENA: ["unidad", 12],
};

export function normalizar(it: ItemAhorramas, ahora: string): ProductoNormalizado {
  const enOferta = it.precioLista !== null && it.precioVenta !== null && it.precioLista > it.precioVenta;
  const precio = enOferta ? it.precioLista : it.precioVenta;
  const efectivo = it.precioVenta;
  const [unidadPpu, porCada] = (it.unidadPpu && UNIDADES[it.unidadPpu]) || [null, 1];
  const ppuTienda = it.ppu ? Math.round((it.ppu / porCada) * 10000) / 10000 : null;
  const delNombre = parsearFormato(it.nombre);
  const formato = it.alPeso
    ? { cantidad: 1000, unidad: "g" as const, pack: 1, aproximado: true } // precio por kg
    : elegirFormato(delNombre, formatoDesdePrecioUnidad(efectivo, ppuTienda, unidadPpu));
  // El precio por unidad de la tienda manda; si no lo da, se calcula
  const ppu = ppuTienda && unidadPpu
    ? { valor: ppuTienda, unidad: unidadPpu }
    : efectivo && formato ? precioPorUnidad(efectivo, formato) : null;

  return {
    supermercado_id: "ahorramas",
    id_origen: it.pid,
    url_origen: it.url,
    nombre: it.nombre,
    marca: tituloMarca(it.marca),
    categoria_origen: it.categoria ?? (it.ruta.length ? it.ruta.join(" > ") : null),
    categoria_id: null,
    formato_texto: it.alPeso ? "al peso (precio por kg)" : null,
    cantidad_neta: formato?.cantidad ?? null,
    unidad: formato?.unidad ?? null,
    unidades_pack: formato?.pack ?? 1,
    precio,
    precio_oferta: enOferta ? efectivo : null,
    precio_por_unidad: ppu?.valor ?? null,
    unidad_precio: ppu?.unidad ?? null,
    imagen_url: it.imagen,
    ean: null,
    disponible: efectivo !== null,
    descatalogado_en: null,
    origen: "scraping",
    actualizado_en: ahora,
  };
}

function leerGtm(v: string | undefined): { name?: string; brand?: string; price?: string; category?: string; categoryID?: string } | null {
  if (!v) return null;
  try {
    return JSON.parse(decodeURIComponent(decodificar(v)));
  } catch {
    return null;
  }
}

function num(v: string | number | null | undefined) {
  const n = Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) && n > 0 ? n : null;
}
