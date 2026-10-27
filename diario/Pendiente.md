---
tags: [pendiente]
actualizado: 2026-10-27
---
# Lo que queda

Foto del 27 de octubre de 2026. Lo que se vaya haciendo se marca en el [[Roadmap]]; esta nota explica el contexto y los pasos.

La app está publicada en **https://eat-em.vercel.app** con acceso con Google. Comparte siempre esa dirección: las direcciones largas de cada despliegue (`eat-em-xxxx-davidodo123s-projects.vercel.app`) piden iniciar sesión en Vercel.

## 1. Lo que tiene que hacer David

- [x] **Secretos de GitHub** creados el 20-10 (`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`). Prueba: Actions → **Scrapers** → *Run workflow* → `carrefour` con `--max-peticiones 5`.
- [x] **Variables de Google en Vercel** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) comprobadas el 20-10.
- [ ] **IA de pago**: la gratuita da ~50 peticiones al día para todos; decidir si se pagan créditos cuando la usen amigos. El 27-10 OpenRouter retiró gratis el modelo de siempre; la app usa ya el de reserva `nvidia/nemotron-3.5-super-vl:free` → [[Decisiones#Modelo de IA de reserva]].
- [ ] **Cambiar `OPENAI_MODELO_CHAT`** a `nvidia/nemotron-3.5-super-vl:free` en Vercel y en `.env.local` (ahora funciona igual gracias a la reserva, pero cada petición gasta un 404 antes).
- [ ] **Caprabo desde casa**: GitHub está bloqueado (403). Cargarlo a mano con `npm run scraper -- caprabo` (~20 min) o decidir si se crea una tarea programada de Windows → [[Decisiones#Caprabo fuera de GitHub Actions]].
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

### Estado (20-10-2026)

| Tienda | Productos | Con precio | Última carga buena | Programado (UTC) | Notas |
|---|---:|---:|---|---|---|
| Carrefour | 52.023 | 51.297 | 17-10 | diario 03:15 | API Empathy, 1 s entre peticiones, tope 25 páginas por búsqueda. 1.187 formatos corregidos el 20-10 |
| Ahorramás | 6.200 | 6.200 | 16-10 | diario 04:45 | HTML, 4 s entre peticiones (Cloudflare: no se fuerza) |
| Gadis | 7.614 | 7.614 | 16-10 | L-S 05:15 `--rapido`; D completo | `__NEXT_DATA__` |
| Caprabo | 12.701 | 12.701 | 16-10 | diario 06:30 | con cookies, 1,5 s |
| Mercadona | 4.269 | 0 | 16-10 | lunes 02:30 | solo catálogo del sitemap: su robots.txt prohíbe `/api`; los precios llegan del escáner |

Los secretos ya están (20-10): la primera carga diaria con ellos es la de la noche del 20 al 21. En esa carga Carrefour corrige los €/kg de los productos de peso variable.

### Procesos que quedan
- [/] Que los scrapers de GitHub corran una semana sin fallos. Del 21 al 26-10 Carrefour, Ahorramás, Gadis y Mercadona bien; Caprabo 403 todos los días (fuera del cron desde el 27-10); Carrefour se colgó el 27-10 (>3 h, ver [[Diario/2026-10-27]]). Si alguno falla con código 2 es la alerta de calidad (0 productos o caída ≥ 30 %): mirar si la web ha cambiado.
- [x] Enlaces ingrediente → producto rehechos con las palabras excluidas: 2.188 enlaces, la cesta cuadra (leche semidesnatada, huevos de gallina, pechuga fresca, aceite de oliva).
- [x] `aplicar_off` por tramos que se parten solos (27-10). `npm run off -- --solo-aplicar` completo sin cortes el 27-10 (45 enriquecidos, 2.101 enlaces).
- [x] Workflow **Open Food Facts** (semanal): funciona desde el 25-10.
- [ ] Supermercados de OpenStreetMap: recargar cada pocos meses con `npm run tiendas` (sin `--local` descarga de nuevo, ~1-2 min). Hoy: 18.895.
- [ ] Más cadenas con catálogo: salen cerca a menudo **Dia, Lidl, Aldi, Alcampo, Eroski, Consum, Covirán**. Antes de escribir un scraper: leer su robots.txt y condiciones, ir despacio y **no saltar nunca protecciones anti-bot** (Cloudflare, WAF, Imperva). Si no se puede, se quedan como "cerca, sin datos".

## 3. App

- [ ] Lo que salga de la prueba de David en el móvil.
- [ ] Cron de Vercel (`vercel.json`, 07:00 UTC): recordatorios de compra, comidas y caducidad. Comprobar el primer día que llegan avisos.
- [ ] No hay "¿Olvidaste tu contraseña?": con Google no hace falta. Si alguien entra con contraseña y la olvida, se resetea a mano.

## 4. IA

- Modelo gratuito de OpenRouter `nvidia/nemotron-3-super-120b-a12b:free`, unas **50 peticiones al día** para toda la app (todos los usuarios).
- [/] Evaluación completa con el modelo nuevo: tanda 1 (preguntas 1-25) **25/25** el 27-10. Falta la tanda 2: `npm run eval:ia -- --solo 26,27,...,50` otro día (gasta ~25 de las 50 peticiones diarias).
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

Empieza por: revisar las ejecuciones de los scrapers (tabla scraper_ejecuciones en Supabase o
la API pública de GitHub /repos/davidodo123/Eat-em/actions/runs), sobre todo Carrefour, y
hacer la tanda 2 de la evaluación de IA (preguntas 26-50). Luego lo siguiente del Roadmap. Al acabar, actualiza
el Roadmap, Pendiente.md y la nota del día.
```
