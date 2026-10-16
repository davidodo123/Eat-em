# Scrapers y fuentes de productos

## Estrategia: una "super base de datos" de productos

Las marcas de fabricante (Danone, Cola Cao, Central Lechera…) son **el mismo producto con el mismo EAN** en todos los supermercados. Cambian el precio y las marcas blancas (Hacendado, Carrefour, Dia…). Por eso el catálogo se construye en capas:

1. **Producto maestro por EAN.** `producto_clusters` agrupa las fichas de cada tienda que comparten EAN. La nutrición y los alérgenos se rellenan una vez (Open Food Facts, Fase 3) y valen para todas.
2. **Precio por supermercado.** Cada tienda aporta su fila en `productos` y su histórico en `precios_historico`, por scraping donde se pueda o con los precios que meten los usuarios con el escáner (`precios_usuario`).
3. **Ingrediente genérico.** "Leche semidesnatada" enlaza con todos los productos equivalentes de cualquier tienda (`ingrediente_productos`). La dieta y la lista de la compra trabajan a este nivel.

Así un supermercado sin scraper (Mercadona, Dia, Lidl…) sigue teniendo catálogo, gracias a Open Food Facts y al escáner, y va reuniendo precios con el uso.

## Estado por cadena (verificado el 2026-10-16)

| Cadena | Estado | Detalle |
|---|---|---|
| **Carrefour** | ✅ Scraper | Buscador de Empathy (`api.empathy.co`). `carrefour.es` está tras Cloudflare (403) y no se intenta saltar. |
| **Mercadona** | ✅ Catálogo sin precios | Solo lo permitido por `robots.txt`: sitemap y páginas `/product` (nombre e imagen). `/api` está prohibido y no se usa. Los precios llegan por el escáner. El 18740 (Castell de Ferro) queda fuera de su zona online. Open Prices solo tenía 149 precios de Mercadona en España (2026-10-16). |
| **Ahorramás** | ✅ Scraper | Páginas de categoría HTML (`?start=N&sz=24`), permitidas por `robots.txt`. Distingue ofertas. Sin EAN. |
| **Gadis** | ✅ Scraper | `__NEXT_DATA__` de las categorías hoja (50 primeros) y, para el resto, de cada ficha. Sin EAN. Diario con `--rapido`, completo los domingos. |
| **Caprabo** | ✅ Scraper | Misma plataforma que Eroski, pero su `robots.txt` sí permite la paginación (`supermarket:loadpage?t:ac=`). Sin EAN. |
| Dia, El Corte Inglés, Hipercor | ❌ | 403 a peticiones automáticas |
| Froiz | ❌ | La tienda (`froiz.epreselec.com`) responde con la página de bloqueo de Imperva ("Pardon Our Interruption"). |
| BM, masymas | ⏸ | Misma plataforma (Angular): el HTML no trae productos y todo sale de `/api/`, prohibido en `robots.txt`. |
| Covirán | ➖ | Sin tienda online (solo web corporativa y folleto) → escáner. Importante para Granada. |
| Condis | ⏸ | La tienda exige una sesión OAuth anónima antes de mostrar nada; sin investigar a fondo. |
| Alcampo | ❌ | AWS WAF con captcha: `/products/...` y `/api/...` dan 403 (2026-10-16). La portada y el sitemap sí responden, pero no se intenta saltar. |
| Eroski | ⏸ | Permitido, pero solo los 20 primeros productos de cada categoría: la paginación (`supermarket:loadpage?t:ac=`) y la búsqueda están prohibidas en `robots.txt`, y la ficha no trae EAN. Cobertura parcial; se deja para más adelante. |
| Consum, Bon Preu | ⏸ | `robots.txt` prohíbe `/api/` |
| Lidl, Aldi | ➖ | Sin catálogo de alimentación completo online → escáner |

## Carrefour: detalles

- **Endpoint:** `GET https://api.empathy.co/search/v1/query/carrefour/search?query=<texto>&lang=es&catalog=food&rows=100&start=<n>`
  - `filter=brand:<marca>` y `filter=parent_category.food:<cat>` funcionan.
  - No permite listar todo: `query` vacío o `*` devuelve 0 resultados.
- **Recorrido:** unos 250 términos agrupados por categoría propia ([terminos.ts](../scrapers/carrefour/terminos.ts)) y después cada marca descubierta en los facets.
- **Campos usados:** `product_id`, `display_name`, `brand`, `ean13`, `active_price`, `measure_unit`, `unit_conversion_factor` (cantidad total en l/kg), `recipient`, `parent_category.food`, `image_path.food`, `urls.food`, `active_food`.
- **Se descartan** los productos de marketplace (`active_marketplace: true`): son vendedores externos, con cajas y precios propios.
- **Limitaciones:**
  - Los precios son los nacionales de la tienda online; no dependen del código postal.
  - No se distinguen ofertas: `active_price` ya trae la promoción aplicada.
  - `active_price: 0` significa no disponible.
  - La API no da nutrición ni alérgenos (se cubrirá con Open Food Facts por EAN).
- **Riesgo legal:** los términos de uso de Carrefour pueden prohibir la extracción automatizada. Uso personal, a 1 petición/s, una vez al día, sin redistribuir.

## Ahorramás: detalles

- **Fuente:** `https://www.ahorramas.com/<raiz>/?start=<n>&sz=24` para las raíces `frescos`, `alimentacion`, `lacteos`, `bebidas`, `congelados`, `limpieza`, `cuidado-personal`, `bebe`, `mascotas` y `hogar` ([index.ts](../scrapers/ahorramas/index.ts)). `sz` mayor de 24 se ignora.
- **`robots.txt`:** prohíbe el buscador (`/buscador?`, `Search-ShowAjax`), los filtros (`&prefn1`, `?pmax`), `ver-todo`, carrito y login. Las páginas de categoría están permitidas.
- **Por producto:** `data-pid`, `data-category1..3` (en *frescos* solo la 1), `data-gtm-layer` (JSON con nombre, marca, precio, `category` y `categoryID`), `data-hasunitweight` (al peso), imagen, precio tachado (`strike-through list`), precio vigente (`sales`) y precio por kg/l/ud/docena.
- **Ofertas:** `precio` es el tachado y `precio_oferta` el vigente.
- **Al peso:** el precio es el del kg; se guarda como 1 kg aproximado.
- **Formato:** del nombre ("pack 24 latas 33cl") y, si no cuadra con el precio por unidad de la tienda, el deducido de este.
- **Categoría de origen:** `categoryID` del gtm; la categoría propia se vota con [categorias.ts](../scrapers/comun/categorias.ts).
- Cada página incluye un producto patrocinado repetido (se deduplica por `pid`). Precios de la tienda online (zona de Madrid).
- **Límite de velocidad:** a 1 petición/s, Cloudflare responde `429` con `cf-mitigated: challenge` tras ~200 páginas (2026-10-16). Ahora va a 1 petición cada 4 s (~400 páginas, ~30 min). Si aun así aparece el desafío, el cliente HTTP para la ejecución entera sin insistir y no se descataloga nada.
- Prueba del 2026-10-16 (cortada por el desafío en `lacteos`): 3.686 productos de `frescos`, `alimentacion` y parte de `lacteos`; solo 3 sin formato.

## Gadis: detalles

- **Fuente:** `__NEXT_DATA__` de las páginas Next.js ([index.ts](../scrapers/gadis/index.ts)).
  1. Categorías hoja de `sitemaps/sitemap_categorias.xml` (sin `precios-especiales`, que repite productos): `ProductListComponent.firstProducts` trae los 50 primeros.
  2. Los productos de `sitemaps/sitemap_productos.xml` que no han salido se piden uno a uno (`pageData.product`).
- **La API** (`catalog.gadisline.com`) pide token (401) y no se usa. La paginación de las categorías va por esa API, por eso el paso 2.
- **`robots.txt`:** prohíbe los filtros (`?bra=`, `?q=`, `?cat=`, `/*&`...) y la cuenta. Categorías y fichas permitidas.
- **Campos:** `product_code`, `commercial_description`, `brand(_description)`, `price`, `price_kilo_litre` y su sufijo ("el litro"), `weight` (`U` = por unidad; otro valor = al peso, precio por kg), `categories`, `image(s)`, `slug`, `offers`.
- **Ofertas:** `price` ya trae la oferta aplicada y solo hay icono y fecha de fin; no se publica el precio anterior (como en Carrefour).
- **Sin EAN.** La ficha sí trae nutrición, ingredientes y cantidad neta (`aecoc_properties`): aprovechable en la Fase 3.
- Las páginas pesan ~0,9 MB (el `__NEXT_DATA__` incluye la maqueta). Precios de la tienda online (Galicia).
- **Medido el 2026-10-16:** 415 categorías hoja dan 7.614 productos (35 hojas pasan de 50). El sitemap tiene 12.069 productos, así que quedan ~5.400 fichas (~1,5 h y ~5 GB a 1/s).
- **Modo diario (`--rapido`):** solo categorías, ~10 min. No descataloga (faltan los que solo salen en su ficha) y se compara solo con otras ejecuciones `--rapido`. Los domingos va la completa.

## Caprabo: detalles

- **Fuente:** [index.ts](../scrapers/caprabo/index.ts). Raíces con id numérico del `sitemap.xml` (sin papelería ni hogar/bricolaje). La página de la raíz trae 20 productos; las siguientes se piden a `supermarket:loadpage?t:ac=<raíz>&pageNumber=N&t:zoneid=productListZone` con `X-Requested-With: XMLHttpRequest` y la cookie de sesión de la visita. Responde JSON `{content: html}`; al acabar, `_tapestry.inits` incluye `pages/supermarket:finishPagination`.
- **`robots.txt`:** solo prohíbe `:changelanguage`, la búsqueda (`search/results/?q=`), `?zipCode` y `;jsessionid`. Eroski, con la misma plataforma, sí prohíbe `?t:ac=`.
- **Por producto:** `data-metrics` (JSON con `item_id`, `item_name`, `item_brand`, `price`, `item_category..3`), imagen, enlace, `price-before` (precio anterior si hay oferta), `price-offer-now` y precio por unidad ("1 KILO A 4,17 €").
- El HTML de `loadpage` usa comillas simples en los atributos y el de la página, dobles: el parser acepta las dos.
- Va a 1 petición cada 1,5 s. Prueba del 2026-10-16: 760 productos de *frescos* en 39 páginas.
- Sin ejemplo de oferta todavía: `price-before` venía vacío en todo lo probado. Vigilar en la primera carga que se rellena.

## Ejecutar

```bash
npm run scraper -- carrefour --seco --max-peticiones 25   # prueba sin base de datos (data/raw/)
npm run scraper -- carrefour                              # completo, escribe en Supabase
npm run scraper -- carrefour --rapido                     # sin la expansión por marcas
npm run scraper -- ahorramas                              # ~30 min (1 petición cada 4 s)
npm run scraper -- gadis --rapido                         # solo categorías, ~10 min
npm run scraper -- gadis                                  # categorías + fichas que falten, ~2 h
npm run scraper -- caprabo                                # ~15 min
```

Cada ejecución:
1. Guarda el **dato bruto** comprimido en Storage (`raw/<super>/<fecha>/<hora>.jsonl.gz`).
2. Hace upsert de los productos normalizados.
3. Añade el precio del día a `precios_historico`.
4. Marca como descatalogados (nunca borra) los productos que desaparecen, solo si la ejecución es fiable.
5. Registra el **informe de calidad** en `scraper_ejecuciones.informe_calidad`: sin precio, sin formato, sin EAN, precios anómalos (más del 50 % de cambio), cambios de formato, nuevos y descatalogados.
6. Si la ejecución queda incompleta (tope, bloqueo o errores) tampoco se descataloga nada. Un desafío anti-bots (`cf-mitigated: challenge`) para la ejecución en el acto: no se insiste ni se intenta saltar.
7. Sale con **código 2** si hay 0 productos o caen un 30 % o más frente a la última ejecución completa. En GitHub Actions eso marca el job como fallido y GitHub te avisa por email.

## GitHub Actions

[`.github/workflows/scrapers.yml`](../.github/workflows/scrapers.yml) se ejecuta cada día a las 03:15 UTC y también a mano desde la pestaña *Actions*. Necesita estos secretos del repositorio: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
