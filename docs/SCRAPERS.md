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
| Dia, El Corte Inglés, Hipercor | ❌ | 403 a peticiones automáticas |
| Consum, Bon Preu | ⏸ | `robots.txt` prohíbe `/api/` |
| Alcampo, Eroski, Gadis | 🔍 Por investigar | Su `robots.txt` no bloquea a bots genéricos |
| Lidl, Aldi | ➖ | Sin catálogo de alimentación completo online → escáner |
| Ahorramás, Caprabo, masymas, Condis, Froiz, BM, Covirán | 🔍 Por investigar | |

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

## Ejecutar

```bash
npm run scraper -- carrefour --seco --max-peticiones 25   # prueba sin base de datos (data/raw/)
npm run scraper -- carrefour                              # completo, escribe en Supabase
npm run scraper -- carrefour --rapido                     # sin la expansión por marcas
```

Cada ejecución:
1. Guarda el **dato bruto** comprimido en Storage (`raw/<super>/<fecha>/<hora>.jsonl.gz`).
2. Hace upsert de los productos normalizados.
3. Añade el precio del día a `precios_historico`.
4. Marca como descatalogados (nunca borra) los productos que desaparecen, solo si la ejecución es fiable.
5. Registra el **informe de calidad** en `scraper_ejecuciones.informe_calidad`: sin precio, sin formato, sin EAN, precios anómalos (más del 50 % de cambio), cambios de formato, nuevos y descatalogados.
6. Sale con **código 2** si hay 0 productos o caen un 30 % o más frente a la última ejecución completa. En GitHub Actions eso marca el job como fallido y GitHub te avisa por email.

## GitHub Actions

[`.github/workflows/scrapers.yml`](../.github/workflows/scrapers.yml) se ejecuta cada día a las 03:15 UTC y también a mano desde la pestaña *Actions*. Necesita estos secretos del repositorio: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
