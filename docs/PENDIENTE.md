# Eat-em · Estado y pendientes (traspaso entre sesiones)

> Última actualización: 2026-10-16. Léelo entero antes de seguir. Contexto completo en
> [ARQUITECTURA.md](ARQUITECTURA.md), [SCRAPERS.md](SCRAPERS.md) y la especificación
> [Eat-em_super_prompt.md](Eat-em_super_prompt.md).

## 0. Lo primero al retomar

1. **Relanzar las cargas completas.** Se cortaron al cerrar la sesión; solo escriben en la base al final, así que no quedó nada a medias.
   ```bash
   npm run scraper -- carrefour     # ~60-90 min. A mitad de la carga ya llevaba 21.400 productos: el catálogo es grande
   npm run scraper -- mercadona     # ~70 min la primera vez (4.269 páginas a 1/s), luego incremental
   ```
   Lánzalas en segundo plano y revisa el informe de calidad que imprimen al terminar.
2. **Limpiar las ejecuciones colgadas.** Las cortadas quedaron con `estado = 'en_curso'`:
   ```sql
   UPDATE scraper_ejecuciones SET estado = 'error', fin = now(), error = 'interrumpida (fin de sesion)'
   WHERE estado = 'en_curso';
   ```
3. **Revisar la calidad de Carrefour tras la primera carga completa:** `sin_formato`, `sin_categoria` y los ejemplos del informe (`scraper_ejecuciones.informe_calidad`). Ajusta [terminos.ts](../scrapers/carrefour/terminos.ts) si alguna categoría propia quedó mal mapeada (`categorias_origen`).

## 1. Estado actual

| Fase | Estado |
|---|---|
| 1. Arquitectura, SQL y estructura | ✅ Hecho y aplicado en Supabase (commit `676f0a7`) |
| 2. Productos: scrapers | 🟡 Carrefour y Mercadona escritos y probados; falta la primera carga completa (punto 0) y el resto de cadenas |
| 3 a 8 | ⏳ Sin empezar |

**Infraestructura:**
- **Supabase:** proyecto `lggwuyjalhprkoogllxt` (eu-west-1, Irlanda, plan Free). Migraciones aplicadas: `20261016000001_init.sql` y `20261016000002_scrapers.sql`, más el seed.
- **`.env.local`:** existe con la URL, la publishable key y la secret key. No está en git. Faltan `OPENAI_API_KEY` y las claves VAPID.
- **CLI de Supabase:** con sesión iniciada y proyecto enlazado. Ojo: `db push` falla con `DbConfigLoginRoleStatusError` (no puede crear el rol temporal); hay que pasar la contraseña de la base con `SUPABASE_DB_PASSWORD=... npx supabase db push`. **El usuario debe ejecutarlo él**: la contraseña se compartió en el chat y se le recomendó cambiarla.
- **Vercel:** aún no está desplegado. **GitHub:** el repo no tiene remoto; el workflow `.github/workflows/scrapers.yml` necesita los secretos `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

**Datos del usuario:**
- La app es para el hermano del usuario y su novia (grupo de 2), en **Castell de Ferro, Granada (CP 18740)**.
- El usuario quiere cubrir **todos los supermercados de España**. Estrategia acordada: "super base" por EAN más precios por cadena (ver SCRAPERS.md).
- Commits **sin** línea `Co-Authored-By` de Claude (lo pidió expresamente).

## 2. Decisiones tomadas (no volver a discutir)

- **Stack:** Next.js 16 PWA en Vercel + Supabase. Los scrapers van en GitHub Actions (no en Vercel, por los límites de duración y de cron).
- **Mercadona, opción A:** se respeta el `robots.txt` (prohíbe `/api`). Solo se usan el sitemap y `/product` (nombre e imagen, sin precio). Los precios llegan por el escáner. El usuario delegó la decisión ("la que veas más efectiva").
- **Carrefour:** `carrefour.es` está tras Cloudflare (403) y **no se intenta saltar**. Se usa el buscador de Empathy (`api.empathy.co`), que no tiene `robots.txt`. Se descartan los productos de marketplace (`active_marketplace`). Esta fuente no distingue ofertas.
- **Ids de fichas:** el formato canónico es `FICHA-001`.
- **Cantidades:** todas en unidad base (`g`, `ml`, `unidad`). El stock sale del libro `inventario_movimientos`.

## 3. Pendiente por fase

### Fase 2: catálogo (seguir aquí)
- [ ] Primera carga completa de Carrefour y Mercadona (punto 0) y revisión de la calidad.
- [ ] Investigar y, si se puede sin saltar protecciones, añadir scrapers de **Alcampo**, **Eroski**, **Gadis** y **Ahorramás**. Después Caprabo, masymas, Condis, Froiz, BM y Covirán. Para cada uno: revisar `robots.txt`, buscar la API JSON en DevTools y documentarlo en SCRAPERS.md.
- [ ] **Bloqueados:** Dia, El Corte Inglés e Hipercor (403); Consum y Bon Preu (prohíben `/api/`). Lidl y Aldi no tienen catálogo online completo. Todos ellos se cubren con el escáner y Open Food Facts.
- [ ] Tests de los scrapers con respuestas grabadas: `normalizar()` de Carrefour y el parseo de páginas de Mercadona.
- [ ] Subir el repo a GitHub, configurar los secretos y probar el workflow a mano (*Actions → Scrapers → Run workflow*).

### Fase 3: enriquecimiento y catálogo genérico
- [ ] **Open Food Facts:** importar el **volcado completo** de productos de España (JSONL/Parquet en `static.openfoodfacts.org/data/`). El buscador `/api/v2/search` estaba caído ("temporarily unavailable"); `/api/v2/product/<ean>` sí funciona. Licencia ODbL: citar la fuente. Cruzar por EAN con `productos` para rellenar `kcal_100`, macros, `alergenos` y `nutricion_origen = 'off'`.
- [ ] `producto_clusters`: agrupar por EAN y, si no hay EAN, por similitud de nombre + marca + formato con `pg_trgm`. Mercadona no tiene EAN: emparejarlo por nombre con Carrefour y OFF.
- [ ] Marcas de Mercadona que no son propias (Puleva…): detectarlas con la lista de marcas de Carrefour y OFF.
- [ ] Enlazar `ingredientes` ↔ `productos` (`ingrediente_productos`) usando los sinónimos y la búsqueda. Ampliar `data/catalogo-base.json` y contrastar su nutrición con BEDCA: ahora es `aprox_referencia`.
- [ ] Mapear `categorias_origen` a mano donde la votación automática falle.

### Fase 4: escáner
- [ ] PWA con `zxing-js` o `html5-qrcode` (no basta `BarcodeDetector`: no funciona en iOS) y entrada manual del código.
- [ ] Flujo: validar EAN (`lib/dominio/ean.ts`) → buscar en `productos` → OFF `/api/v2/product/<ean>` (guardar con `origen = 'off'`, `verificado = false`) → alta manual con foto (bucket `etiquetas`) y entrada en `revision_productos` → cantidad y precio → `precios_usuario` + `inventario_movimientos`.
- [ ] Precio por defecto en la tienda del usuario: Mercadona Motril / Castell de Ferro.

### Fase 5: backend
- [ ] Auth (email, Google, Apple) con `@supabase/ssr`. En Next 16 el middleware se llama **`proxy.ts`**; leer `node_modules/next/dist/docs/` antes de usarlo (ver `AGENTS.md`).
- [ ] Onboarding: perfil de salud con consentimiento explícito RGPD (`consentimiento_salud_en`), crear grupo o unirse por código.
- [ ] Lista automática: stock bajo + necesidades de los próximos 3/7/14 días de **todos** los miembros, paquetes según el formato real y urgente si no llega a la próxima comida. Texto para WhatsApp. Comparador de precios.
- [ ] Web Push (VAPID, `web-push`) + Vercel Cron para los recordatorios.

### Fase 6: IA (Nutri-em)
- [ ] Portar a `lib/ia/` el código del PDF con las correcciones de ARQUITECTURA.md §8: exportar `SYSTEM_PROMPT`/`ESQUEMA_PLAN`, `prefiltro` con datos ausentes → `falta_dato`, `validarPlan` con alérgenos y suma de kcal/macros (±5-10 %) y hasta 2 reintentos.
- [ ] Comprobar el nombre vigente del modelo `gpt-4o-mini` en la documentación de OpenAI.
- [ ] Ingesta de embeddings de `fichas` (`text-embedding-3-small`) y uso de `buscar_fichas()` + fichas `prioridad`.
- [ ] Script de evaluación con `data/preguntas.json`: 100 % en salvaguardas.

### Fases 7 y 8
- [ ] Pantallas: Hoy, Inventario, Lista, Dieta, Grupo, Nutri-em, Ajustes. Modo oscuro (los tokens ya están en `app/globals.css`) y offline básico.
- [ ] Despliegue en Vercel con las variables de `.env.example`, monitorización y documentación.

## 4. Comandos útiles

```bash
npm run dev                 # app en local (/api/salud comprueba Supabase)
npm test                    # tests unitarios (formatos, EAN)
npm run db:validar          # migraciones + seed en PGlite, sin Docker
npm run db:seed             # regenera supabase/seed.sql desde data/
npm run scraper -- <super> [--seco] [--rapido] [--max-peticiones N]
npx supabase db query --linked "select ..."     # consultas de solo lectura (funciona sin contraseña)
```

## 5. Detalles técnicos a recordar

- PGlite necesita `@electric-sql/pglite-pgvector` con versión exacta (peer `0.5.10`).
- `tsconfig` incluye los scrapers (`allowImportingTsExtensions`), así que `next build` también los comprueba.
- El `upsert` de productos usa la restricción `productos_origen_key (supermercado_id, id_origen)`: PostgREST no admite índices parciales.
- Las ejecuciones con `--max-peticiones` guardan `parametros.tope` y no cuentan como referencia para las alertas ni descatalogan productos.
- `AGENTS.md` lo genera `next dev`; se versiona tal cual.
