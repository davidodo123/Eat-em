---
tags: [pendiente]
actualizado: 2026-10-20
---
# Lo que queda

Foto del 20 de octubre de 2026. Lo que se vaya haciendo se marca en el [[Roadmap]]; esta nota explica el contexto y los pasos.

La app está publicada en **https://eat-em.vercel.app** con acceso con Google. Comparte siempre esa dirección: las direcciones largas de cada despliegue (`eat-em-xxxx-davidodo123s-projects.vercel.app`) piden iniciar sesión en Vercel.

## 1. Lo que tiene que hacer David

- [ ] **Secretos de GitHub** (sin ellos fallan todos los scrapers desde el 17 y los precios no se actualizan)
  github.com/davidodo123/Eat-em → Settings → Secrets and variables → Actions → *New repository secret*:
  - `SUPABASE_URL` = el valor de `NEXT_PUBLIC_SUPABASE_URL` de `.env.local`
  - `SUPABASE_SERVICE_ROLE_KEY` = el de `.env.local`
  Después: Actions → **Scrapers** → *Run workflow* → `carrefour` con `--max-peticiones 5` para comprobarlo.
- [ ] **Protección de Vercel**: proyecto eat-em → Settings → Deployment Protection → *Vercel Authentication* → Disabled (para que ninguna dirección pida iniciar sesión en Vercel).
- [ ] **Probar la app en el móvil** y apuntar lo que falle:
  1. Entrar con Google
  2. Ajustes → Ubicación → código postal o GPS
  3. Lista → buscar y añadir productos → marcar comprado
  4. Despensa → que aparezca, +/−, caducidad
  5. Dieta → añadir comida, vista Mes, repetir semana
  6. Instalarla: iPhone (Safari → Compartir → *Añadir a pantalla de inicio*) o Android (Chrome → *Instalar aplicación*) y activar avisos en Ajustes
- [ ] **Contraseña de la base de datos**: guardarla en un gestor. Si `npx supabase db push` falla, las migraciones se pegan en el SQL Editor (ver [[Decisiones]]).

## 2. Scraping

### Estado (20-10-2026)

| Tienda | Productos | Con precio | Última carga buena | Programado (UTC) | Notas |
|---|---:|---:|---|---|---|
| Carrefour | 52.023 | 51.297 | 17-10 | diario 03:15 | API Empathy, 1 s entre peticiones, tope 25 páginas por búsqueda. 1.187 formatos corregidos el 20-10 |
| Ahorramás | 6.200 | 6.200 | 16-10 | diario 04:45 | HTML, 4 s entre peticiones (Cloudflare: no se fuerza) |
| Gadis | 7.614 | 7.614 | 16-10 | L-S 05:15 `--rapido`; D completo | `__NEXT_DATA__` |
| Caprabo | 12.701 | 12.701 | 16-10 | diario 06:30 | con cookies, 1,5 s |
| Mercadona | 4.269 | 0 | 16-10 | lunes 02:30 | solo catálogo del sitemap: su robots.txt prohíbe `/api`; los precios llegan del escáner |

Los precios tienen ya **3-4 días**: hasta que estén los secretos no se actualizan.

### Procesos que quedan
- [ ] Que los 5 scrapers corran una semana sin fallos (tras los secretos). Si alguno falla con código 2 es la alerta de calidad (0 productos o caída ≥ 30 %): mirar si la web ha cambiado.
- [x] Enlaces ingrediente → producto rehechos con las palabras excluidas: 2.188 enlaces, la cesta cuadra (leche semidesnatada, huevos de gallina, pechuga fresca, aceite de oliva).
- [ ] `aplicar_off` (nutrición de Open Food Facts) se corta por el tiempo máximo de la base de datos: hacerlo por tramos que se parten solos, como `enlazar_ingredientes`. Después, `npm run off -- --solo-aplicar` completo.
- [ ] Workflow **Open Food Facts** (semanal): falla por los mismos secretos.
- [ ] Supermercados de OpenStreetMap: recargar cada pocos meses con `npm run tiendas` (sin `--local` descarga de nuevo, ~1-2 min). Hoy: 18.895.
- [ ] Más cadenas con catálogo: salen cerca a menudo **Dia, Lidl, Aldi, Alcampo, Eroski, Consum, Covirán**. Antes de escribir un scraper: leer su robots.txt y condiciones, ir despacio y **no saltar nunca protecciones anti-bot** (Cloudflare, WAF, Imperva). Si no se puede, se quedan como "cerca, sin datos".

## 3. App

- [ ] Lo que salga de la prueba de David en el móvil.
- [ ] Cron de Vercel (`vercel.json`, 07:00 UTC): recordatorios de compra, comidas y caducidad. Comprobar el primer día que llegan avisos.
- [ ] No hay "¿Olvidaste tu contraseña?": con Google no hace falta. Si alguien entra con contraseña y la olvida, se resetea a mano.

## 4. IA

- Modelo gratuito de OpenRouter `nvidia/nemotron-3-super-120b-a12b:free`, unas **50 peticiones al día** para toda la app (todos los usuarios).
- [ ] Evaluación completa: 50 preguntas en dos tandas de 25 (una por día) con `npm run eval:ia`.
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

Empieza por: comprobar si los scrapers de GitHub Actions ya funcionan (API pública de
GitHub: /repos/davidodo123/Eat-em/actions/runs) y hacer adaptativo aplicar_off en
scrapers/off/importar.ts. Luego lo siguiente pendiente del Roadmap. Al acabar, actualiza
el Roadmap, Pendiente.md y la nota del día.
```
