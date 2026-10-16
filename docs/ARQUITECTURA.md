# Eat-em · Arquitectura (Fase 1)

## 1. Stack elegido y por qué

| Pieza | Elección | Motivo |
|---|---|---|
| App | **Next.js 16 (App Router) como PWA** | Se despliega en Vercel sin fricción; una sola base de código para web, Android e iPhone (instalada en pantalla de inicio). |
| Hosting | **Vercel** | Requisito. Front, API (Route Handlers / Server Actions) y cron ligero. |
| Base de datos, auth, realtime, ficheros | **Supabase** | Postgres gestionado con `pgvector`, `pg_trgm` y `unaccent`; auth con email, Google y Apple; Realtime para sincronizar la pareja; Storage para el dato bruto de los scrapers y las fotos de etiquetas. Región UE (Frankfurt/Irlanda) para RGPD. |
| Scrapers | **Node/TypeScript en GitHub Actions (cron)** | Las funciones de Vercel tienen límite de duración y en el plan Hobby el cron solo se ejecuta una vez al día. Un scraper a 1 petición/s tarda minutos: no cabe bien en una función. Actions es gratis y deja registros. |
| IA | **OpenAI GPT-4o mini + text-embedding-3-small** | Requisito. Siempre se llama desde el servidor (Route Handler en Vercel); la clave nunca llega al navegador. |
| Push | **Web Push (VAPID) con `web-push`** | Funciona en Android y en iPhone ≥ iOS 16.4 **si la PWA está instalada** en la pantalla de inicio. |
| Escáner | **`zxing-js` / `html5-qrcode`** | `BarcodeDetector` no existe en Safari iOS. |
| Offline | Service Worker + caché de lista e inventario | Consultar lista e inventario sin cobertura en el súper. |

**Descartado:** Expo nativo. Daría mejor push y cámara en iOS, pero no se despliega en Vercel (solo su versión web) y obliga a pasar por las tiendas. Si más adelante hiciera falta, el backend (Supabase y las API de Next) se reutiliza tal cual.

## 2. Diagrama

```
 Móvil (PWA Next.js)  ──HTTPS──►  Vercel (Next.js)
   │  supabase-js (RLS)              ├─ Server Actions / API: lista, consumo, escaner
   │  Realtime (websocket)           ├─ /api/ia/*  → OpenAI (plan por día, chat)
   ▼                                 ├─ /api/push  → Web Push
 Supabase  ◄────────service role─────┘  Vercel Cron (1/día): recordatorios
   ├─ Postgres (RLS, pgvector, pg_trgm)
   ├─ Auth (email / Google / Apple)
   ├─ Realtime (inventario, lista, consumos)
   └─ Storage (raw scrapers, fotos etiquetas)
        ▲
 GitHub Actions (cron) ── scrapers por supermercado ── API JSON de cada tienda
                        └─ enriquecimiento Open Food Facts
```

## 3. Principios del modelo de datos

- **Todo en unidad base** (`g`, `ml`, `unidad`). Los formatos ("6 x 125 g") se normalizan al importar.
- **Ingrediente genérico ≠ producto.** La dieta y el inventario trabajan con `ingredientes` ("arroz_blanco"); la compra y los precios con `productos` concretos de cada súper. Los enlaza `ingrediente_productos`.
- **El stock sale de un libro de movimientos.** `inventario_movimientos` (compra, consumo, ajuste, desperdicio) es la fuente de verdad y el historial de "quién hizo qué". Un trigger mantiene `inventario.cantidad`.
- **Hogar compartido, salud individual.** Inventario y lista son por `grupo`; dieta, consumo y perfil de salud son por usuario. `perfiles_salud` (categoría especial del RGPD) solo la ve su dueño; la pareja ve nombre y dieta, no los datos médicos.
- **El catálogo nunca se borra.** Se marca `descatalogado_en` y se guarda el histórico de precios.
- **Escritura del catálogo solo con service role** (scrapers y backend). Los usuarios aportan a través de `precios_usuario` y `revision_productos`.

## 4. Tablas (resumen)

| Bloque | Tablas |
|---|---|
| Usuarios y grupos | `perfiles`, `perfiles_salud`, `pesajes`, `grupos`, `grupo_miembros` |
| Catálogo | `supermercados`, `categorias`, `productos` (EAN, `origen`, `verificado`, nutrición/100 g, búsqueda), `producto_clusters`, `precios_historico`, `precios_usuario`, `revision_productos`, `scraper_ejecuciones` |
| Ingredientes | `ingredientes` (nutrición de referencia, alérgenos, etiquetas), `ingrediente_productos` |
| Inventario | `inventario` (stock + umbral), `inventario_movimientos` |
| Dieta y consumo | `dietas`, `dieta_comidas`, `dieta_comida_ingredientes`, `consumos`, `consumo_ingredientes` |
| Lista | `lista_items` |
| Notificaciones | `push_suscripciones`, `notificacion_prefs`, `notificaciones` |
| IA | `fichas` (RAG con vector(1536) + tsvector), `ia_llamadas` |

Funciones SQL: `crear_grupo`, `unirse_grupo`, `registrar_consumo` (hecha/saltada/extra con cantidades reales y descuento en la misma transacción), `deshacer_consumo`, `marcar_comprado` (de la lista al inventario), `buscar_productos` (texto completo sin acentos + tolerancia a erratas), `buscar_fichas` (híbrida con RRF).

SQL completo: [`supabase/migrations/20261016000001_init.sql`](../supabase/migrations/20261016000001_init.sql).

## 5. Estructura del proyecto

```
app/                 Next.js (pantallas y API)
  api/salud/         comprobación de despliegue
lib/
  supabase/          clientes navegador / servidor / admin
  dominio/           (Fase 5) stock, lista, umbrales, formatos
  ia/                (Fase 6) prompt, esquema, prefiltro, objetivos, validación, RAG
scrapers/            (Fase 2) uno por supermercado + normalización + calidad
data/                fichas.json, preguntas.json, catalogo-base.json (fuente del seed)
scripts/             generar-seed.mjs, validar-sql.mjs (PGlite, sin Docker)
supabase/            config.toml, migrations/, seed.sql (generado)
docs/                arquitectura, super prompt, PDF de la IA
.github/workflows/   (Fase 2) cron de scrapers
```

## 6. Qué se ha verificado y qué no

**Verificado:**
- La migración y el seed se ejecutan en Postgres real (PGlite, Postgres 17 en WASM, con pgvector, pg_trgm y unaccent) y pasan una batería de pruebas: alta de usuarios, grupo e invitación, compra, comida hecha con cantidad editada, corrección, saltada, extra, lista → inventario, aislamiento RLS entre hogares, privacidad de salud, búsqueda sin acentos y con erratas, búsqueda híbrida de fichas (`npm run db:validar`).
- `next build` compila sin errores.

**No verificado todavía:**
- La migración contra un proyecto Supabase real. Diferencias posibles: los permisos por defecto y la publicación `supabase_realtime` se simulan en la validación.
- El nombre vigente del modelo `gpt-4o-mini` en OpenAI (Fase 6).
- Los endpoints de los supermercados (Fase 2, empezando por Mercadona).
- Los valores nutricionales de `catalogo-base.json`: son aproximados y se marcan como `aprox_referencia`. Se contrastarán con BEDCA en la Fase 3.

## 7. Riesgos y decisiones legales

- **Scraping:** los términos de uso de muchos supermercados prohíben la extracción automatizada. Uso personal, sin redistribuir, a 1 petición/s, respetando `robots.txt` y con un User-Agent identificativo. Si la app se publica: acuerdos, datos abiertos, catálogo propio y precios aportados por los usuarios con el escáner.
- **RGPD:** los datos de salud tienen tabla propia, consentimiento explícito (`consentimiento_salud_en`), proyecto Supabase en la UE y borrado en cascada al eliminar la cuenta. A OpenAI solo se envía el perfil mínimo necesario, sin nombre ni email.
- **Salud:** doble salvaguarda (prefiltro en código y reglas en el prompt), y el aviso "Eat-em no sustituye a un profesional sanitario" en la app.
- **Open Food Facts:** datos colaborativos (licencia ODbL). Se marcan como `verificado = false` y se cita la fuente.

## 8. Correcciones al material de partida

1. `eval.mjs` usa `SYSTEM_PROMPT` y `ESQUEMA_PLAN` sin importarlos → se exportarán desde `lib/ia` (Fase 6).
2. Los ids de las fichas no coinciden: `FICHA-001` en el JSON, `F-001` en el PDF y `001` en preguntas.json. El formato canónico es `FICHA-001`; el script de evaluación normalizará el resto.
3. `validarPlan` no comprueba alérgenos ni suma de kcal y macros → se añadirá usando `ingredientes.alergenos` y la nutrición de referencia.
4. `prefiltro` con peso o altura ausentes calcula `NaN` y deja pasar → devolverá `falta_dato`.
