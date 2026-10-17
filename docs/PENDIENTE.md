# Eat-em · Estado y pendientes (traspaso entre sesiones)

> Última actualización: 2026-10-16. Léelo entero antes de seguir. Contexto completo en
> [ARQUITECTURA.md](ARQUITECTURA.md), [SCRAPERS.md](SCRAPERS.md) y la especificación
> [Eat-em_super_prompt.md](Eat-em_super_prompt.md).

## 0. Lo primero al retomar

> **2026-10-16 (2ª sesión):** el repo se clonó de nuevo desde GitHub (`origin` = `github.com/davidodo123/Eat-em`) y se rehízo `.env.local`. Añadidos los scrapers de **Ahorramás**, **Gadis** y **Caprabo** y las migraciones `20261016000003` a `20261016000008` (supermercados, Open Food Facts, enlace de ingredientes, emparejado por nombre y comparador de precios). **El usuario tiene que aplicarlas con `SUPABASE_DB_PASSWORD=... npx supabase db push`** (ver §1). Las filas de `supermercados` ya se insertaron a mano; el `db push` las repetirá sin problema. Hasta entonces, `npm run off` falla (no existe `off_productos`) y las cargas avisan de que no pueden enlazar ingredientes.

1. **Relanzar las cargas completas.** Se cortaron al cerrar la sesión; solo escriben en la base al final, así que no quedó nada a medias.
   ```bash
   npm run scraper -- carrefour     # ~60-90 min. A mitad de la carga ya llevaba 21.400 productos: el catálogo es grande
   npm run scraper -- mercadona     # ~70 min la primera vez (4.269 páginas a 1/s), luego incremental
   npm run scraper -- ahorramas     # ~30 min; ojo: a 1/s salta el desafío de Cloudflare
   npm run scraper -- gadis         # ~2 h la completa; a diario va con --rapido
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
| 2. Productos: scrapers | 🟡 Carrefour, Mercadona, Ahorramás, Gadis y Caprabo escritos; primera carga completa lanzada el 2026-10-16 (revisar informes) |
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
- [x] Alcampo, Eroski, Gadis y Ahorramás investigados (SCRAPERS.md). ✅ Ahorramás y Gadis con scraper. ❌ Alcampo (AWS WAF con captcha). ⏸ Eroski (solo 20 productos por categoría sin saltarse `robots.txt`).
- [x] Caprabo, masymas, Condis, Froiz, BM y Covirán investigados (SCRAPERS.md). ✅ Caprabo con scraper. ❌ Froiz (Imperva). ⏸ BM/masymas (`/api/` prohibido), Condis (sesión OAuth). ➖ Covirán sin tienda online.
- [ ] Caprabo: comprobar en la primera carga que las ofertas (`price-before`) se leen bien.
- [ ] Ahorramás: confirmar en la primera carga real que a 1 petición cada 4 s no salta el desafío de Cloudflare. Si salta, bajar más o repartir las raíces en varios días.
- [ ] Gadis: las fichas traen nutrición, ingredientes y cantidad neta (`aecoc_properties`); aprovecharlas en la Fase 3.
- [ ] **Bloqueados:** Dia, El Corte Inglés e Hipercor (403); Consum y Bon Preu (prohíben `/api/`). Lidl y Aldi no tienen catálogo online completo. Todos ellos se cubren con el escáner y Open Food Facts.
- [x] Tests de los scrapers con respuestas grabadas ([scrapers.test.ts](../scrapers/scrapers.test.ts) y `fixtures/`).
- [ ] Subir el repo a GitHub, configurar los secretos y probar el workflow a mano (*Actions → Scrapers → Run workflow*).

### Fase 3: enriquecimiento y catálogo genérico
- [x] **Open Food Facts:** importador en streaming del CSV completo (`npm run off`), tabla `off_productos`, `aplicar_off()` y `agrupar_por_ean()` (migración `20261016000005`). Workflow semanal. **Falta aplicar las migraciones 3 a 8 con `db push`** y lanzar la primera importación real (~10 min de volcado más el emparejado).
- [ ] Mostrar en la app la atribución de OFF (licencia ODbL).
- [x] `producto_clusters` por EAN (`agrupar_por_ean`).
- [x] Sin EAN (Mercadona, Ahorramás, Gadis, Caprabo): `agrupar_por_similitud()` contra `off_productos` y Carrefour (migración `20261016000007`), dentro de `npm run off`.
- [ ] Revisar una muestra de emparejados por nombre tras la primera importación real y ajustar `palabras_clave()` si hay falsos positivos.
- [ ] Marcas de Mercadona que no son propias (Puleva…): detectarlas con la lista de marcas de Carrefour y OFF.
- [x] Enlace automático `ingredientes` → `productos` (`enlazar_ingredientes`, migración `20261016000006`). Lo llama el ejecutor tras cada carga.
- [ ] Ampliar `data/catalogo-base.json` (solo hay 24 ingredientes) y contrastar su nutrición con BEDCA: ahora es `aprox_referencia`. Afinar los sinónimos demasiado amplios ("pan", "leche", "aceite", "copos").
- [ ] Mapear `categorias_origen` a mano donde la votación automática falle.

### Fase 4: escáner
- [x] `/escanear`: cámara con `@zxing/browser` (EAN-13/8, UPC-A/E; también iOS) y entrada manual del código.
- [x] Flujo: validar EAN → `productos` de cualquier tienda → `off_productos` → API de OFF (`origen = 'off'`, `verificado = false`) → alta manual con entrada en `revision_productos` → ingrediente (★ los candidatos), envases y cantidad sugerida (`cantidadComprada`) → `precios_usuario` + `inventario_movimientos`. Lo que elige el usuario queda como enlace `usuario` en `ingrediente_productos`.
- [x] Tienda por defecto: Mercadona.
- [ ] Foto de la etiqueta en el alta manual (bucket `etiquetas`).
- [ ] Probar en móvil real (iOS Safari y Android Chrome): la cámara exige HTTPS, así que hay que desplegar en Vercel o usar `next dev --experimental-https`.

### Fase 5: backend
- [x] Auth por enlace mágico (email) con `@supabase/ssr`: `proxy.ts` refresca la sesión y manda a `/entrar` lo que no es público; `/auth/confirmar` acepta `?code=` (PKCE) y `?token_hash=`; `/salir` por POST; `rutaInterna()` evita redirecciones abiertas.
- [ ] **Configurar en Supabase** (*Authentication → URL Configuration*): *Site URL* y *Redirect URLs* con `http://localhost:3000/auth/confirmar` y la URL de Vercel (`https://<app>.vercel.app/auth/confirmar`). Sin esto, el enlace del email no vuelve a la app.
- [ ] Google y Apple como proveedores (necesitan credenciales de cada plataforma).
- [x] `/grupo`: crear hogar o unirse por código, ver código y miembros.
- [x] `/perfil`: nombre y datos de salud (solo con consentimiento explícito; retirarlo los borra junto con los pesajes), alergias, situaciones médicas y objetivos estimados.
- [ ] Flujo de primer uso guiado (nombre → hogar → perfil) en vez de pantallas sueltas.
- [x] `/inventario`: stock del hogar por categoría, +/− y "tirar" (movimientos `ajuste`/`desperdicio`) con actualización optimista, aviso de "queda poco" si hay umbral y últimos movimientos con quién los hizo.
- [x] Umbral de "queda poco" por ingrediente (`fijarUmbral`). Al cruzarlo (ajuste manual o comida hecha) entra solo en la lista (`origen = 'auto'`) y se avisa a los demás del hogar (`lib/stock.ts`).
- [ ] Producto preferido por ingrediente.
- [x] `/lista` manual compartida: añadir ingrediente o texto libre (urgente opcional), marcar comprado (`marcar_comprado`, suma al inventario), quitar, copiar o enviar por WhatsApp (`listaParaWhatsapp`, con test).
- [x] Lista e inventario en tiempo real (`app/tiempo-real.tsx`: Supabase Realtime filtrado por hogar y `router.refresh()`). Probar con dos sesiones a la vez.
- [x] Comparador `/comparar` (`comparar_precios()`, migración `20261016000008`): por ingrediente, el producto más barato de cada tienda por kg/l/ud con la oferta aplicada; para Mercadona, el último precio apuntado con el escáner (90 días). Enlace "€" en cada ingrediente de la lista.
- [ ] Lista automática: stock bajo + necesidades de los próximos 3/7/14 días de **todos** los miembros, paquetes según el formato real y urgente si no llega a la próxima comida. Texto para WhatsApp. Comparador de precios.
- [x] Web Push: `public/sw.js` (con las cabeceras de la guía de PWA de Next), `/ajustes` para activar o desactivar en cada dispositivo, preferencias y aviso de prueba, `lib/push.ts` (respeta `notificacion_prefs`, guarda el historial en `notificaciones` y borra suscripciones caducadas). Primer aviso real: lo que se añade a la lista llega a los demás del hogar. Las claves VAPID están en `.env.local` (generadas el 2026-10-17): **copiarlas a Vercel**. En iPhone solo funciona con la app añadida a la pantalla de inicio.
- [ ] Recordatorios (comidas, día de compra) con Vercel Cron.

### Fase 6: IA (Nutri-em)
- [x] `lib/ia/prefiltro.ts` (datos ausentes → `falta_dato`; menores, embarazo, lactancia, condiciones médicas e IMC < 18,5 → derivar) y `lib/ia/objetivos.ts` (Mifflin-St Jeor, ajuste, mínimos 1.500/1.200, macros), con tests.
- [x] `lib/ia/prompt.ts` (`SYSTEM_PROMPT` literal, `ESQUEMA_PLAN`, `mensajeUsuario` con las secciones PERFIL/OBJETIVOS_CALCULADOS/…), `lib/ia/validar.ts` (`validarPlan`: ids, cantidades, alérgenos, tipo de dieta, exclusiones, nº de comidas, kcal ±10 % y proteína ±15 %) y `lib/ia/generar.ts` (`generarDia` con hasta 2 reintentos devolviendo los errores al modelo; `modeloOpenAI` con `json_schema` estricto). Con tests y un modelo falso.
- [x] `/dieta` con la acción `generarSemana`: prefiltro → objetivos → lista cerrada de ingredientes (ya sin alérgenos, exclusiones ni los que no encajan con el tipo de dieta) + inventario + fichas → 7 días con `generarDia` → guarda en borrador y activa (archiva la anterior de la semana). `maxDuration = 300`. **Sin probar contra OpenAI** (falta la clave).
- [x] `/hoy`: comidas del día con Hecha / Saltada / Deshacer (`registrar_consumo`, descuenta del inventario del hogar).
- [ ] Editar cantidades reales al marcar "hecha" y registrar comidas extra.
- [ ] Comprobar el nombre vigente del modelo `gpt-4o-mini` en la documentación de OpenAI.
- [x] `/nutriem`: chat breve (MODO CHAT, historial solo en el navegador) con las fichas de salvaguarda siempre y las 3 más relevantes por texto completo; sección "Consejos de psicología de la dieta" con las fichas visibles.
- [ ] Ingesta de embeddings de `fichas` (`text-embedding-3-small`) y pasar el chat a `buscar_fichas()` (híbrida).
- [x] `npm run eval:ia [-- --solo 23,24]` (`tareas/evaluar-ia.ts` + `lib/ia/evaluacion.ts`): mismo flujo que la app (prefiltro → IA → `validarPlan`), comprobaciones automáticas por tipo de respuesta, RAG por palabras clave para la prueba e informe en `data/eval/`. Criterio: 100 % en salvaguardas, ≥ 90 % en el resto, 0 inventados.
- [ ] Ejecutar la batería completa en cuanto haya `OPENAI_API_KEY` y revisar a mano las de tono.

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
