// Scraper de Mercadona, limitado a lo que permite su robots.txt.
//
// Verificado el 2026-10-16 (https://tienda.mercadona.es/robots.txt):
//   Allow: /product, /sitemap.xml   Disallow: /api, /
// Por eso NO se usa la API JSON (/api/...), que es donde estan los precios.
// Del sitemap (~4.300 productos) y de cada pagina /product/<id>/<slug> se obtiene:
//   nombre (<meta name="description">), imagen (og:image) y URL. Sin precio,
//   sin EAN y sin formato (solo si aparece en el nombre).
// Los precios llegan por el escaner (precios_usuario) desde la tienda fisica.
// Incremental: solo se descargan las paginas de productos que aun no estan en la base.
import { ClienteHttp } from "../comun/http.ts";
import type { ProductoNormalizado, ResultadoScraper, Scraper } from "../comun/tipos.ts";
import { parsearFormato } from "../../lib/dominio/formato.ts";
import { decodificar } from "../comun/texto.ts";

const SITEMAP = "https://tienda.mercadona.es/sitemap.xml";
const MARCAS_PROPIAS = ["Hacendado", "Deliplus", "Bosque Verde", "Compy", "Solcare", "Agerul"];

export const mercadona: Scraper = {
  id: "mercadona",
  async ejecutar({ maxPeticiones, guardarRaw, conocidos }) {
    const http = new ClienteHttp({ intervaloMs: 1000, maxPeticiones });
    const avisos: string[] = [];
    const xml = await http.texto(SITEMAP);
    const urls = [...xml.matchAll(/<loc>(https:\/\/tienda\.mercadona\.es\/product\/(\d+)\/[^<]+)<\/loc>/g)]
      .map((m) => ({ url: m[1], id: m[2] }));
    guardarRaw({ sitemap: SITEMAP, n: urls.length });
    console.log(`  sitemap: ${urls.length} productos (${conocidos.size} ya conocidos)`);

    const ahora = new Date().toISOString();
    const productos: ProductoNormalizado[] = [];
    let descargadas = 0;
    for (const { url, id } of urls) {
      const previo = conocidos.get(id);
      if (previo?.nombre && previo.imagen_url) {
        productos.push(fila(id, url, previo.nombre, previo.imagen_url, ahora));
        continue;
      }
      if (http.agotado) continue; // sin tope: el producto queda para la proxima ejecucion
      try {
        const { nombre, imagen } = parsearPagina(await http.texto(url));
        guardarRaw({ id, url, nombre, imagen });
        productos.push(fila(id, url, nombre || nombreDesdeSlug(url), imagen, ahora));
      } catch (e) {
        avisos.push(`${url}: ${(e as Error).message}`);
        // Si falla la pagina, se conserva igualmente (nombre desde el slug)
        productos.push(fila(id, url, previo?.nombre ?? nombreDesdeSlug(url), previo?.imagen_url ?? null, ahora));
      }
      if (++descargadas % 200 === 0) console.log(`  paginas ${descargadas} | peticiones ${http.peticiones}`);
    }
    if (http.agotado) avisos.push(`Tope de ${maxPeticiones} peticiones: quedan paginas por descargar`);

    return {
      productos,
      votosCategoria: new Map(),
      peticiones: http.peticiones,
      errores: http.errores,
      avisos,
      parametros: { fuente: "sitemap + /product (robots.txt)", sin_precios: true, paginas_nuevas: descargadas },
      completo: !http.bloqueado,
    } satisfies ResultadoScraper;
  },
};

export function fila(id: string, url: string, nombre: string, imagen: string | null, ahora: string): ProductoNormalizado {
  const formato = parsearFormato(nombre);
  return {
    supermercado_id: "mercadona",
    id_origen: id,
    url_origen: url,
    nombre,
    marca: MARCAS_PROPIAS.find((m) => nombre.toLowerCase().includes(m.toLowerCase())) ?? null,
    categoria_origen: null,
    categoria_id: null,
    formato_texto: null,
    cantidad_neta: formato?.cantidad ?? null,
    unidad: formato?.unidad ?? null,
    unidades_pack: formato?.pack ?? 1,
    precio: null,
    precio_oferta: null,
    precio_por_unidad: null,
    unidad_precio: null,
    imagen_url: imagen,
    ean: null,
    disponible: true,
    descatalogado_en: null,
    origen: "scraping",
    actualizado_en: ahora,
  };
}

// Pagina /product/<id>/<slug>: nombre (meta description) e imagen (og:image)
export function parsearPagina(html: string) {
  return {
    nombre: decodificar(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ""),
    imagen: html.match(/property="og:image" content="([^"]*)"/)?.[1] ?? null,
  };
}

// ".../product/31011/huevos-codorniz-paquete" -> "Huevos codorniz paquete"
export function nombreDesdeSlug(url: string) {
  const slug = url.split("/").pop() ?? "";
  const t = slug.replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
