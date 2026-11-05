---
tags: [pendiente]
actualizado: 2026-11-05
---
# Lo que queda

Foto del 5 de noviembre de 2026. Lo que se vaya haciendo se marca en el [[Roadmap]]; esta nota explica el contexto y los pasos.

La app está publicada en **https://eat-em.vercel.app** con acceso con Google. Comparte siempre esa dirección: las direcciones largas de cada despliegue (`eat-em-xxxx-davidodo123s-projects.vercel.app`) piden iniciar sesión en Vercel.

## 1. Lo que tiene que hacer David

- [x] **Secretos de GitHub** creados el 20-10 (`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`). Prueba: Actions → **Scrapers** → *Run workflow* → `carrefour` con `--max-peticiones 5`.
- [x] **Variables de Google en Vercel** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) comprobadas el 20-10.
- [ ] **IA de pago**: la gratuita da ~50 peticiones al día para todos; decidir si se pagan créditos cuando la usen amigos. El 27-10 OpenRouter retiró gratis el modelo de siempre; la app usa ya el de reserva `nvidia/nemotron-3.5-super-vl:free` → [[Decisiones#Modelo de IA de reserva]].
- [ ] **Cambiar `OPENAI_MODELO_CHAT`** a `nvidia/nemotron-3.5-super-vl:free` en Vercel y en `.env.local` (ahora funciona igual gracias a la reserva, pero cada petición gasta un 404 antes).
- [x] **Migración 12** (`precios_minimos`) aplicada el 27-10.
- [ ] **Migración 13** (`supabase/migrations/20261105000013_deshacer_sin_stock_fantasma.sql`): pegarla en el SQL Editor de Supabase. Hasta entonces, marcar una comida como Hecha sin tener el ingrediente y pulsar Deshacer crea comida de la nada (casos T9 y T10 de [[Casos de uso]]).
- [ ] **Caprabo desde casa**: GitHub está bloqueado (403); última carga 05-11. Cargarlo a mano con `npm run scraper -- caprabo` (~20 min) o decidir si se crea una tarea programada de Windows → [[Decisiones#Caprabo fuera de GitHub Actions]].
- [x] **Protección de Vercel** quitada el 20-10.
- [ ] **Probar la app en el móvil** y apuntar lo que falle:
  1. Entrar con Google
  2. Ajustes → Ubicación → código postal o GPS
  3. Lista → buscar y añadir productos → marcar comprado
  4. Despensa → que aparezca, +/−, caducidad
  5. Dieta → añadir comida, vista Mes, repetir semana
  6. Instalarla: iPhone (Safari → Compartir → *Añadir a pantalla de inicio*) o Android (Chrome → *Instalar aplicación*) y activar avisos en Ajustes
- [x] **Contraseña de la base de datos** guardada en un gestor (20-10). Si `npx supabase db push` falla, las migraciones se pegan en el SQL Editor (ver [[Decisiones]]).

## 2. Scraping

### Estado (05-11-2026)

| Tienda | Productos en la última carga | Última carga buena | Programado (UTC) | Notas |
|---|---:|---|---|---|
| Carrefour | 52.478 | 05-11 | diario 03:15 | API Empathy, 1 s, ~2 h. Se colgó el 27 y 28-10. Retira ~100 y recupera ~80 al día (0,2 %): normal por su búsqueda |
| Ahorramás | 7.505 de ~7.700 | 05-11 | diario 04:45 | HTML, 4 s, ahora ~33 min. Recorrido arreglado el 05-11 |
| Gadis | 11.244 (`--rapido`) / 12.051 (domingo) | 05-11 | L-S 05:15 `--rapido`; D completo | Hay días con 8.000 en `--rapido`: no retira nada, solo se quedan sin precio nuevo |
| Caprabo | 12.698 | 05-11 | **a mano desde casa** | 403 desde GitHub. Por subcategorías |
| Mercadona | 4.330 | 02-11 | lunes 02:30 | solo catálogo; los precios llegan del escáner |

GitHub empieza los trabajos programados ~6 h tarde (Carrefour a las 9-11 UTC en vez de las 03:15).

### Procesos que quedan
- [x] Una semana sin fallos en GitHub: del 29-10 al 05-11. Si alguno falla con código 2 es la alerta de calidad (0 productos o caída ≥ 30 %): mirar si la web ha cambiado.
- [ ] Si Carrefour vuelve a colgarse, mirar en `scraper_ejecuciones.error` en qué fase y URL quedó (vigilante nuevo).
- [x] Enlaces ingrediente → producto rehechos con las palabras excluidas: 2.188 enlaces, la cesta cuadra (leche semidesnatada, huevos de gallina, pechuga fresca, aceite de oliva).
- [x] `aplicar_off` por tramos que se parten solos (27-10). `npm run off -- --solo-aplicar` completo sin cortes el 27-10 (45 enriquecidos, 2.101 enlaces).
- [x] Workflow **Open Food Facts** (semanal): funciona desde el 25-10.
- [ ] Supermercados de OpenStreetMap: recargar cada pocos meses con `npm run tiendas` (sin `--local` descarga de nuevo, ~1-2 min). Hoy: 18.895.
- [ ] Más cadenas con catálogo: salen cerca a menudo **Dia, Lidl, Aldi, Alcampo, Eroski, Consum, Covirán**. Antes de escribir un scraper: leer su robots.txt y condiciones, ir despacio y **no saltar nunca protecciones anti-bot** (Cloudflare, WAF, Imperva). Si no se puede, se quedan como "cerca, sin datos".

## 3. App

- [ ] Lo que salga de la prueba de David en el móvil.
- [ ] Lista: compara el precio de **paquete**, y para 150 ml de aceite sugiere una garrafa de 3 l como «la más barata» aunque otra tienda salga más barata por litro. Ver [[Ideas]].
- [ ] Cron de Vercel (`vercel.json`, 07:00 UTC): recordatorios de compra, comidas y caducidad. Comprobar el primer día que llegan avisos.
- [ ] No hay "¿Olvidaste tu contraseña?": con Google no hace falta. Si alguien entra con contraseña y la olvida, se resetea a mano.

## 4. IA

- Modelo gratuito de OpenRouter `nvidia/nemotron-3-super-120b-a12b:free`, unas **50 peticiones al día** para toda la app (todos los usuarios).
- [x] Evaluación completa con el modelo nuevo: **50/50** (salvaguardas 100 %, 0 ingredientes inventados).
- [ ] Revisar a mano el tono de esas respuestas (`data/eval/2026-10-27-14-29.json` y `2026-11-05-18-05.json`).
- [ ] Repetir «Rellenar la semana» con el cupo limpio: `npm run casos -- --ia --solo I2`. El 05-11 salieron 3 de 7 días en 1 min, con el cupo casi gastado.
- [ ] Con amigos usándola, 50 al día se quedan cortas enseguida: valorar créditos de pago (decisión de David).

## 5. Ideas sin ordenar
Ver [[Ideas]].

## Prompt para seguir en otra sesión

Copiar y pegar en Claude Code abierto en la carpeta del proyecto:

```text
Seguimos con Eat-em (app móvil de lista de la compra, despensa y dieta con precios de los
supermercados cercanos; Next.js 16 + Supabase, publicada en https://eat-em.vercel.app).
Lee primero diario/Inicio.md, diario/Roadmap.md, diario/Pendiente.md y la última nota de
diario/Diario/, y sigue desde ahí.

Reglas: commits sin Co-Authored-By; no hagas git push sin preguntarme; nunca pegues ni
guardes claves en el diario; los scrapers respetan robots.txt y no saltan protecciones
anti-bot. Antes de tocar Next lee node_modules/next/dist/docs/ (esta versión cambia cosas).
El acceso es con Google (OAuth propio en /api/auth/google + signInWithIdToken de Supabase).

Empieza por: comprobar si está aplicada la migración 13, pasar la batería (npm run casos) y
revisar las ejecuciones de los scrapers (tabla scraper_ejecuciones), sobre todo Carrefour.
Luego lo siguiente del Roadmap. Al acabar, actualiza
el Roadmap, Pendiente.md y la nota del día.
```
