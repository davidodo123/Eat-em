---
tags: [pendiente]
actualizado: 2026-10-19
---
# Lo que queda

Foto del 19 de octubre de 2026. Lo que se vaya haciendo se marca en el [[Roadmap]]; esta nota explica el contexto y los pasos.

## 1. Lo que tiene que hacer David

- [ ] **Secretos de GitHub** (sin ellos fallan todos los scrapers desde el 17)
  github.com/davidodo123/Eat-em → Settings → Secrets and variables → Actions → *New repository secret*:
  - `SUPABASE_URL` = el valor de `NEXT_PUBLIC_SUPABASE_URL` de `.env.local`
  - `SUPABASE_SERVICE_ROLE_KEY` = el de `.env.local`
  Después: Actions → **Scrapers** → *Run workflow* → `carrefour` con `--max-peticiones 5` para comprobarlo.
- [ ] **Probar la app** en `http://localhost:3000` (o en el móvil cuando esté en Vercel):
  1. Ajustes → Ubicación → código postal o GPS
  2. Lista → buscar y añadir productos → marcar comprado
  3. Despensa → que aparezca, +/−, caducidad
  4. Dieta → añadir comida, vista Mes, repetir semana
- [ ] **Contraseña de la base de datos**: guardarla en un gestor. `npx supabase db push` falló con ella; si vuelve a fallar, las migraciones se pegan en el SQL Editor (ver [[Decisiones]]).

## 2. Scraping

### Estado (19-10-2026)

| Tienda | Productos | Con precio | Última carga buena | Programado (UTC) | Notas |
|---|---:|---:|---|---|---|
| Carrefour | 52.023 | 51.297 | 17-10 | diario 03:15 | API Empathy, 1 s entre peticiones, tope 25 páginas por búsqueda |
| Ahorramás | 6.200 | 6.200 | 16-10 | diario 04:45 | HTML, 4 s entre peticiones (Cloudflare: no se fuerza) |
| Gadis | 7.614 | 7.614 | 16-10 | L-S 05:15 `--rapido`; D completo | `__NEXT_DATA__` |
| Caprabo | 12.701 | 12.701 | 16-10 | diario 06:30 | con cookies, 1,5 s |
| Mercadona | 4.269 | 0 | 16-10 | lunes 02:30 | solo catálogo del sitemap: su robots.txt prohíbe `/api`; los precios llegan del escáner |

Los precios tienen ya **2-3 días**: hasta que estén los secretos no se actualizan.

### Procesos que quedan
- [ ] Que los 5 scrapers corran una semana sin fallos (tras los secretos). Si alguno falla con código 2 es la alerta de calidad (0 productos o caída ≥ 30 %): mirar si la web ha cambiado.
- [/] `npm run off -- --solo-aplicar`: rehace emparejados por nombre, nutrición de Open Food Facts y **enlaces ingrediente → producto con las palabras excluidas** (migración 9). Lanzado el 19-10; log en `data/logs/off-aplicar.log`. Antes había 8.099 enlaces con las reglas viejas.
- [ ] Revisar después que la cesta tiene sentido (leche semidesnatada ya no enlaza leche entera; huevos no enlaza codorniz; pechuga no enlaza latas).
- [ ] Workflow **Open Food Facts** (semanal): falla por los mismos secretos.
- [ ] Supermercados de OpenStreetMap: recargar cada pocos meses con `npm run tiendas` (sin `--local` descarga de nuevo, ~1-2 min). Hoy: 18.895.
- [ ] Más cadenas con catálogo: salen cerca a menudo **Dia, Lidl, Aldi, Alcampo, Eroski, Consum, Covirán**. Antes de escribir un scraper: leer su robots.txt y condiciones, ir despacio y **no saltar nunca protecciones anti-bot** (Cloudflare, WAF, Imperva). Si no se puede, se quedan como "cerca, sin datos".

## 3. App

- [ ] Que David la pruebe (arriba) y apuntar lo que falle.
- [ ] Desplegar en **Vercel**: variables de [[Configuración]] (incluidas las VAPID y `CRON_SECRET`), y en Supabase → Authentication → URL Configuration añadir la URL de Vercel en *Redirect URLs*.
- [ ] Cron de Vercel (`vercel.json`, 07:00 UTC): recordatorios de compra, comidas y caducidad. Solo funciona desplegado.
- [ ] Probar en el iPhone: Safari → Compartir → *Añadir a pantalla de inicio* (necesario para las notificaciones).

- [ ] SMTP propio en Supabase (Authentication → Emails → SMTP) si hay que enviar más de unos pocos correos por hora: con el correo incluido de Supabase el límite es muy bajo.

## 4. IA

- Modelo gratuito de OpenRouter `nvidia/nemotron-3-super-120b-a12b:free`, unas **50 peticiones al día** para todo el hogar.
- [ ] Evaluación completa: 50 preguntas en dos tandas de 25 (una por día) con `npm run eval`. Las que fallaban antes ya pasan.
- [ ] Si se queda corto: valorar créditos de pago (decisión de David).

## 5. Ideas sin ordenar
Ver [[Ideas]].

## Prompt para seguir en otra sesión

Copiar y pegar en Claude Code abierto en la carpeta del proyecto:

```text
Seguimos con Eat-em (app móvil de lista de la compra, despensa y dieta con precios de los
supermercados cercanos; Next.js 16 + Supabase). Lee primero diario/Inicio.md, diario/Roadmap.md,
diario/Pendiente.md y la última nota de diario/Diario/, y sigue desde ahí.

Reglas: commits sin Co-Authored-By; no hagas git push sin preguntarme; nunca pegues ni
guardes claves en el diario; los scrapers respetan robots.txt y no saltan protecciones
anti-bot. Antes de tocar Next lee node_modules/next/dist/docs/ (esta versión cambia cosas).

Empieza por: comprobar si los scrapers de GitHub Actions ya funcionan (API pública de
GitHub: /repos/davidodo123/Eat-em/actions/runs), revisar data/logs/off-aplicar.log y que
los enlaces de ingredientes tienen sentido (rpc comparar_precios para leche_semidesnatada,
huevo y pechuga_pollo). Luego lo siguiente pendiente del Roadmap. Al acabar, actualiza el
Roadmap, Pendiente.md y la nota del día.
```
