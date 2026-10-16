// Scraper de Caprabo (capraboacasa.com, misma plataforma Tapestry que Eroski).
//
// Verificado el 2026-10-16 (https://www.capraboacasa.com/robots.txt):
//   User-agent: * con Disallow solo de :changelanguage, la busqueda (search/results/?q=),
//   ?zipCode y ;jsessionid. A diferencia de Eroski, NO prohibe ?t:ac=, asi que la
//   paginacion (supermarket:loadpage?t:ac=...&pageNumber=N) esta permitida.
//  - La pagina de categoria trae los 20 primeros productos; las siguientes se piden a
//    loadpage (JSON {content: html}) con la cookie de sesion de la visita. Cuando no hay
//    mas, _tapestry.inits incluye "pages/supermarket:finishPagination".
//  - Por producto: data-metrics (JSON con item_id, item_name, item_brand, price e
//    item_category..3), imagen, enlace, precio anterior (price-before, si hay oferta),
//    precio vigente (price-offer-now) y precio por unidad ("1 KILO A 4,17 €").
//  - Ojo: el html de loadpage usa comillas simples en los atributos.
//  - Sin EAN. Precios de la tienda online (Cataluna).
import { ClienteHttp } from "../comun/http.ts";
import type { ProductoNormalizado, ResultadoScraper, Scraper } from "../comun/tipos.ts";
import { elegirFormato, formatoDesdePrecioUnidad, parsearFormato, precioPorUnidad } from "../../lib/dominio/formato.ts";
import { adivinarCategoria, votar } from "../comun/categorias.ts";
import { decodificar, tituloMarca } from "../comun/texto.ts";

const BASE = "https://www.capraboacasa.com";
const SITEMAP = `${BASE}/sitemap.xml`;
const MAX_PAGINAS = 500;
// Raices que no son de supermercado
const EXCLUIR = /papeleria|hogar-bricolaje/;

export interface ItemCaprabo {
  id: string;
  nombre: string;
  marca: string | null;
  categorias: string[];        // ids de item_category, item_category2, item_category3
  url: string | null;
  imagen: string | null;
  precioAntes: number | null;  // price-before (solo en oferta)
  precio: number | null;       // vigente
  ppu: number | null;
  unidadPpu: string | null;    // "KILO", "LITRO", "UNIDAD"...
}

export const caprabo: Scraper = {
  id: "caprabo",
  async ejecutar({ maxPeticiones, guardarRaw }) {
    const http = new ClienteHttp({ intervaloMs: 1500, maxPeticiones, cookies: true });
    const vistos = new Map<string, ItemCaprabo>();
    const avisos: string[] = [];
    let completo = true;

    const urls = [...(await http.texto(SITEMAP)).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    const nombres = nombresCategoria(urls);
    const raices = raicesCatalogo(urls);
    console.log(`  sitemap: ${raices.length} raices, ${nombres.size} categorias`);

    for (const raiz of raices) {
      const ac = raiz.replace(`${BASE}/es/supermercado/`, "").replace(/\/$/, "");
      const antes = vistos.size;
      try {
        const primera = parsearTarjetas(await http.texto(raiz));
        guardarRaw({ raiz, pagina: 0, items: primera });
        for (const it of primera) vistos.set(it.id, it);
        for (let pagina = 1; pagina < MAX_PAGINAS && !http.agotado; pagina++) {
          const r = JSON.parse(await http.texto(
            `${BASE}/es/supermarket:loadpage?t:ac=${ac}&pageNumber=${pagina}&t:zoneid=productListZone`,
            "application/json", { "X-Requested-With": "XMLHttpRequest", Referer: raiz },
          )) as { content?: string; _tapestry?: { inits?: unknown[] } };
          const items = parsearTarjetas(r.content ?? "");
          guardarRaw({ raiz, pagina, items });
          let nuevos = 0;
          for (const it of items) if (!vistos.has(it.id)) { vistos.set(it.id, it); nuevos++; }
          const fin = (r._tapestry?.inits ?? []).includes("pages/supermarket:finishPagination");
          if (fin || items.length === 0 || nuevos === 0) break;
        }
      } catch (e) {
        avisos.push(`${ac}: ${(e as Error).message}`);
        completo = false;
      }
      console.log(`  ${ac}: +${vistos.size - antes} | productos ${vistos.size} | peticiones ${http.peticiones}`);
      if (http.agotado) break;
    }
    if (http.bloqueado) avisos.push("Desafio anti-bots: ejecucion parada, catalogo incompleto");
    else if (http.agotado) avisos.push(`Tope de ${maxPeticiones} peticiones alcanzado: catalogo incompleto`);

    const ahora = new Date().toISOString();
    const votos = new Map<string, Map<string, number>>();
    const productos = [...vistos.values()].map((it) => {
      const p = normalizar(it, ahora);
      votar(votos, p.categoria_origen, adivinarCategoria(it.categorias.map((c) => nombres.get(c))));
      return p;
    });
    return {
      productos,
      votosCategoria: votos,
      peticiones: http.peticiones,
      errores: http.errores,
      avisos,
      parametros: { fuente: "categorias html + loadpage", raices: raices.length },
      completo: completo && !http.agotado,
    } satisfies ResultadoScraper;
  },
};

// ".../2059806-alimentacion/2059818-yogures/" -> 2059818 => "yogures"
export function nombresCategoria(urls: string[]) {
  const m = new Map<string, string>();
  for (const u of urls) for (const [, id, slug] of u.matchAll(/\/(\d+)-([a-z0-9-]+)/g)) m.set(id, slug.replace(/-/g, " "));
  return m;
}

// Categorias raiz con id numerico (las demas son landings de marcas y promociones)
export function raicesCatalogo(urls: string[]) {
  return [...new Set(urls.filter((u) => /\/es\/supermercado\/\d+-[^/]+\/$/.test(u) && !EXCLUIR.test(u)))];
}

const Q = `["']`;   // el html de loadpage usa comillas simples
const NQ = `[^"']`;

export function parsearTarjetas(html: string): ItemCaprabo[] {
  const items: ItemCaprabo[] = [];
  for (const t of html.split(new RegExp(`class=${Q}col border-0 product-item-lineal`)).slice(1)) {
    const metrica = leerMetrica(t.match(new RegExp(`data-metrics=(?:"([^"]*)"|'([^']*)')`)));
    if (!metrica?.item_id) continue; // huecos de publicidad (criteo)
    const href = t.match(new RegExp(`href=${Q}(https://www\\.capraboacasa\\.com(?::443)?/es/productdetail/${NQ}+)${Q}`))?.[1];
    const img = t.match(new RegExp(`src=${Q}(${NQ}+)${Q}[^>]*class=${Q}product-img`))?.[1];
    const antes = t.match(new RegExp(`class=${Q}price-before${Q}>(.*?)<span class=${Q}price-now`))?.[1];
    const ahora = t.match(new RegExp(`class=${Q}price-offer-now${Q}>\\s*([\\d.,]+)`))?.[1];
    const cant = t.match(new RegExp(`class=${Q}quantity-text${Q}>([^<]*)<`))?.[1] ?? "";
    const ppu = decodificar(cant).match(/([A-ZÁÉÍÓÚ]+)\s+A\s+([\d.,]+)\s*€/i);
    items.push({
      id: String(metrica.item_id),
      nombre: decodificar(String(metrica.item_name ?? "")) || String(metrica.item_id),
      marca: metrica.item_brand ? String(metrica.item_brand) : null,
      categorias: [metrica.item_category, metrica.item_category2, metrica.item_category3]
        .filter((c): c is string => !!c).map(String),
      url: href ? href.replace(":443", "") : null,
      imagen: img ? img.replace(/([^:])\/\/+/g, "$1/") : null,
      precioAntes: antes ? euros(antes.replace(/<[^>]*>/g, " ")) : null,
      precio: euros(ahora) ?? (typeof metrica.price === "number" && metrica.price > 0 ? metrica.price : null),
      ppu: ppu ? euros(ppu[2]) : null,
      unidadPpu: ppu ? ppu[1].toUpperCase() : null,
    });
  }
  return items;
}

const UNIDADES: Record<string, ["kg" | "l" | "unidad", number]> = {
  KILO: ["kg", 1], KG: ["kg", 1], LITRO: ["l", 1], UNIDAD: ["unidad", 1], DOCENA: ["unidad", 12], LAVADO: ["unidad", 1],
};

export function normalizar(it: ItemCaprabo, ahora: string): ProductoNormalizado {
  const enOferta = it.precioAntes !== null && it.precio !== null && it.precioAntes > it.precio;
  const [unidadPpu, porCada] = (it.unidadPpu && UNIDADES[it.unidadPpu]) || [null, 1];
  const ppuTienda = it.ppu ? Math.round((it.ppu / porCada) * 10000) / 10000 : null;
  const alPeso = /al peso|al corte/i.test(it.nombre);
  const formato = alPeso
    ? { cantidad: 1000, unidad: "g" as const, pack: 1, aproximado: true }
    : elegirFormato(parsearFormato(it.nombre), formatoDesdePrecioUnidad(it.precio, ppuTienda, unidadPpu));
  const ppu = ppuTienda && unidadPpu
    ? { valor: ppuTienda, unidad: unidadPpu }
    : it.precio && formato ? precioPorUnidad(it.precio, formato) : null;

  return {
    supermercado_id: "caprabo",
    id_origen: it.id,
    url_origen: it.url,
    nombre: it.nombre,
    marca: tituloMarca(it.marca),
    categoria_origen: it.categorias.at(-1) ?? null,
    categoria_id: null,
    formato_texto: alPeso ? "al peso (precio por kg)" : null,
    cantidad_neta: formato?.cantidad ?? null,
    unidad: formato?.unidad ?? null,
    unidades_pack: formato?.pack ?? 1,
    precio: enOferta ? it.precioAntes : it.precio,
    precio_oferta: enOferta ? it.precio : null,
    precio_por_unidad: ppu?.valor ?? null,
    unidad_precio: ppu?.unidad ?? null,
    imagen_url: it.imagen,
    ean: null,
    disponible: it.precio !== null,
    descatalogado_en: null,
    origen: "scraping",
    actualizado_en: ahora,
  };
}

function leerMetrica(m: RegExpMatchArray | null): Record<string, string | number> | null {
  const crudo = m?.[1] ?? m?.[2];
  if (!crudo) return null;
  try {
    const j = JSON.parse(crudo.replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
    return j?.ecommerce?.items?.[0] ?? null;
  } catch {
    return null;
  }
}

// "3,99" -> 3.99 | "1.234,50" -> 1234.5
function euros(s: string | null | undefined) {
  const m = s?.match(/\d[\d.]*(?:,\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
