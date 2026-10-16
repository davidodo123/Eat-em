// Scraper de Gadis (gadisline.com, Next.js).
//
// Verificado el 2026-10-16 (https://www.gadisline.com/robots.txt):
//   User-agent: * con Disallow de filtros (?bra=, ?pro=, ?q=, ?cat=, /*&...) y mi-cuenta.
//   Las paginas de categoria y de producto estan permitidas.
//  - La API (catalog.gadisline.com) pide token (401): no se usa.
//  - Cada pagina lleva __NEXT_DATA__. En las categorias, ProductListComponent.firstProducts
//    trae los 50 primeros productos (las siguientes paginas se piden a la API, asi que
//    no se pueden recorrer). Por eso:
//      1) se recorren las categorias hoja del sitemap (casi todas tienen <= 50 productos);
//      2) los productos del sitemap que no hayan salido se piden uno a uno (pageData.product).
//  - Campos: product_code, commercial_description, brand(_description), price (ya con la
//    oferta aplicada), price_kilo_litre + sufijo ("el litro", "el kilo"), weight ("U" = por
//    unidad), categories, image(s), slug, offers (solo icono y fecha fin: no hay precio anterior).
//  - Sin EAN. La ficha trae nutricion e ingredientes (aecoc_properties), sin usar por ahora.
//  - Precios de la tienda online (Galicia y alrededores).
import { ClienteHttp } from "../comun/http.ts";
import type { ProductoNormalizado, ResultadoScraper, Scraper } from "../comun/tipos.ts";
import { elegirFormato, formatoDesdePrecioUnidad, parsearFormato, precioPorUnidad } from "../../lib/dominio/formato.ts";
import { adivinarCategoria, votar } from "../comun/categorias.ts";
import { tituloMarca } from "../comun/texto.ts";

const BASE = "https://www.gadisline.com";
const SITEMAP_CATEGORIAS = `${BASE}/sitemaps/sitemap_categorias.xml`;
const SITEMAP_PRODUCTOS = `${BASE}/sitemaps/sitemap_productos.xml`;

type Traducible = string | { language: string; value: string }[] | null | undefined;

export interface ElementoGadis {
  id?: string;
  product_code: number | string;
  commercial_description?: Traducible;
  price?: number | null;
  price_kilo_litre?: number | null;
  price_kilo_litre_suffix?: Traducible;
  weight?: string | null;
  brand?: string | null;
  brand_description?: string | null;
  categories?: { id: string; name?: string | null; descriptions_translate?: { language: string; value: string }[]; level?: number | null }[];
  category?: { id: string; descriptions_translate?: { language: string; value: string }[] } | null;
  image?: { image?: string | null } | null;
  images?: { image?: string | null }[];
  slug?: string | null;
  offers?: { end_date?: string | null; type?: string | null }[];
  [k: string]: unknown;
}

export const gadis: Scraper = {
  id: "gadis",
  async ejecutar({ maxPeticiones, rapido, guardarRaw }) {
    const http = new ClienteHttp({ intervaloMs: 1000, maxPeticiones });
    const vistos = new Map<string, { el: ElementoGadis; url: string | null }>();
    const slugsVistos = new Set<string>();
    const avisos: string[] = [];

    // 1) Categorias hoja
    const hojas = categoriasHoja(locs(await http.texto(SITEMAP_CATEGORIAS)));
    let truncadas = 0;
    let fallos = 0;
    for (const [i, url] of hojas.entries()) {
      if (http.agotado) break;
      try {
        const { elementos, paginas } = parsearCategoria(await http.texto(url));
        if (paginas > 1) truncadas++;
        guardarRaw({ url, paginas, elementos });
        for (const el of elementos) {
          const pu = el.slug ? BASE + el.slug : null;
          vistos.set(String(el.product_code), { el, url: pu });
          if (el.slug) slugsVistos.add(el.slug.replace(/^\//, ""));
        }
      } catch (e) {
        avisos.push(`${url}: ${(e as Error).message}`);
        fallos++;
      }
      if ((i + 1) % 50 === 0) console.log(`  categorias ${i + 1}/${hojas.length} | productos ${vistos.size} | peticiones ${http.peticiones}`);
    }
    console.log(`  fase categorias: ${vistos.size} productos en ${hojas.length} hojas (${truncadas} con mas de 50)`);

    // 2) Productos del sitemap que no han salido en las categorias (~5.400 fichas de ~0,9 MB
    //    el 2026-10-16, ~1,5 h): solo en la ejecucion completa. Con --rapido se omite.
    const urlsProducto = http.agotado || rapido ? [] : locs(await http.texto(SITEMAP_PRODUCTOS));
    const pendientes = urlsProducto.filter((u) => !slugsVistos.has(u.slice(BASE.length + 1)));
    console.log(`  sitemap: ${urlsProducto.length} productos, ${pendientes.length} por pedir uno a uno`);
    let fichas = 0;
    for (const url of pendientes) {
      if (http.agotado) break;
      try {
        const el = parsearFicha(await http.texto(url));
        if (el) {
          vistos.set(String(el.product_code), { el, url });
          guardarRaw({ url, elementos: [el] });
        }
      } catch (e) {
        avisos.push(`${url}: ${(e as Error).message}`);
      }
      if (++fichas % 200 === 0) console.log(`  fichas ${fichas}/${pendientes.length} | productos ${vistos.size} | peticiones ${http.peticiones}`);
    }
    if (http.bloqueado) avisos.push("Desafio anti-bots: ejecucion parada, catalogo incompleto");
    else if (http.agotado) avisos.push(`Tope de ${maxPeticiones} peticiones alcanzado: catalogo incompleto`);

    const ahora = new Date().toISOString();
    const votos = new Map<string, Map<string, number>>();
    const productos = [...vistos.values()].map(({ el, url }) => {
      const p = normalizar(el, url, ahora);
      votar(votos, p.categoria_origen, adivinarCategoria(rutaCategorias(el)));
      return p;
    });
    return {
      productos,
      votosCategoria: votos,
      peticiones: http.peticiones,
      errores: http.errores,
      avisos,
      parametros: {
        fuente: "categorias hoja + fichas (__NEXT_DATA__)", rapido: !!rapido, hojas: hojas.length, hojas_truncadas: truncadas,
        sitemap_productos: urlsProducto.length, fichas_pedidas: fichas,
      },
      // Con --rapido faltan los productos que solo salen en su ficha: no se descataloga
      completo: !rapido && !http.agotado && fallos === 0,
    } satisfies ResultadoScraper;
  },
};

const locs = (xml: string) => [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()))];

// Hojas: categorias sin subcategorias en el sitemap. "precios-especiales" repite productos.
export function categoriasHoja(urls: string[]) {
  const limpias = urls.map((u) => u.replace(/\/$/, "")).filter((u) => !u.includes("/precios-especiales"));
  return limpias.filter((u) => !limpias.some((o) => o.startsWith(u + "/")));
}

function nextData(html: string) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("pagina sin __NEXT_DATA__");
  return JSON.parse(m[1]);
}

export function parsearCategoria(html: string): { elementos: ElementoGadis[]; paginas: number } {
  const listas: { page?: { total_pages?: number }; elements?: ElementoGadis[] }[] = [];
  const recorrer = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    const r = o as Record<string, unknown>;
    if (r.firstProducts && typeof r.firstProducts === "object") listas.push(r.firstProducts as (typeof listas)[number]);
    for (const v of Object.values(r)) recorrer(v);
  };
  recorrer(nextData(html).props);
  return {
    elementos: listas.flatMap((l) => l.elements ?? []).filter((e) => e?.product_code),
    paginas: Math.max(0, ...listas.map((l) => l.page?.total_pages ?? 0)),
  };
}

export function parsearFicha(html: string): ElementoGadis | null {
  const p = nextData(html).props?.pageProps?.pageData?.product;
  return p?.product_code ? (p as ElementoGadis) : null;
}

const es = (t: Traducible) =>
  (typeof t === "string" ? t : t?.find((x) => x.language === "ES")?.value ?? t?.[0]?.value ?? "").trim();

export function rutaCategorias(el: ElementoGadis): string[] {
  return [...(el.categories ?? [])]
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
    .map((c) => c.name ?? es(c.descriptions_translate))
    .filter(Boolean);
}

export function normalizar(el: ElementoGadis, url: string | null, ahora: string): ProductoNormalizado {
  const nombre = es(el.commercial_description) || String(el.product_code);
  const precio = num(el.price);
  const ppuTienda = num(el.price_kilo_litre);
  const sufijo = es(el.price_kilo_litre_suffix).toLowerCase();
  const unidadPpu = /litro/.test(sufijo) ? "l" : /kilo/.test(sufijo) ? "kg" : /unidad/.test(sufijo) ? "unidad" : null;
  const porUnidad = !el.weight || el.weight === "U";
  // Al peso (weight != "U"): se compra por kg (min_weight..max_weight) y price es el precio del kg
  const formato = porUnidad
    ? elegirFormato(parsearFormato(nombre), formatoDesdePrecioUnidad(precio, ppuTienda, unidadPpu))
    : { cantidad: 1000, unidad: "g" as const, pack: 1, aproximado: true };
  const ppu = !porUnidad && precio
    ? { valor: precio, unidad: "kg" as const }
    : ppuTienda && unidadPpu
      ? { valor: ppuTienda, unidad: unidadPpu as "kg" | "l" | "unidad" }
      : precio && formato ? precioPorUnidad(precio, formato) : null;
  const ruta = rutaCategorias(el);

  return {
    supermercado_id: "gadis",
    id_origen: String(el.product_code),
    url_origen: url,
    nombre,
    marca: tituloMarca(el.brand_description ?? el.brand),
    categoria_origen: ruta.length ? ruta.join(" > ") : null,
    categoria_id: null,
    formato_texto: porUnidad ? null : "al peso (precio por kg)",
    cantidad_neta: formato?.cantidad ?? null,
    unidad: formato?.unidad ?? null,
    unidades_pack: formato?.pack ?? 1,
    precio,
    precio_oferta: null, // price ya trae la oferta aplicada y no se publica el precio anterior
    precio_por_unidad: ppu?.valor ?? null,
    unidad_precio: ppu?.unidad ?? null,
    imagen_url: el.image?.image ?? el.images?.[0]?.image ?? null,
    ean: null,
    disponible: precio !== null,
    descatalogado_en: null,
    origen: "scraping",
    actualizado_en: ahora,
  };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
