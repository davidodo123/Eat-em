---
tags: [decisiones]
---
# Decisiones

## Mercadona sin precios automáticos
*2026-10-16* — Su robots.txt prohíbe `/api`. Se usa solo el catálogo (sitemap) y los precios llegan de lo que apunta el hogar al escanear. Nunca se saltan protecciones anti-bot.

## IA con modelo gratuito
*2026-10-16* — OpenRouter con `nvidia/nemotron-3-super-120b-a12b:free` (≈50 peticiones al día). Alternativa descartada por ahora: créditos de pago.

## Palabras excluidas por ingrediente
*2026-10-17* — Los enlaces automáticos metían "leche entera" en leche semidesnatada o "huevos de codorniz" en huevos. Cada ingrediente tiene una lista `excluir`, comparada al inicio de palabra (así "desnatada" no descarta "semidesnatada"). Migración 9.

## App móvil con tres secciones
*2026-10-17* — David quiere una app de móvil general (no una web ni algo de Castell de Ferro): Lista, Despensa y Dieta. Elegido: buscar en **todos** los productos de las tiendas (no solo 24 ingredientes), ubicación por GPS + código postal, dieta en calendario manual con IA opcional, y "Hoy" dentro de Dieta. La portada de marketing se quitó.

## Despensa por producto
*2026-10-17* — Tabla `despensa` por producto real; el inventario por ingrediente se mantiene por debajo para que la dieta sepa qué falta (cada producto equivale a una cantidad del ingrediente).

## Supermercados cercanos desde una copia de OpenStreetMap
*2026-10-17* — La API pública de Overpass tardaba 30–40 s o fallaba. Se descargan una vez los ~18.900 supermercados de España a `tiendas_osm` (migración 11, `npm run tiendas`) y se buscan con SQL. Overpass queda de reserva.

## Diseño sin iconos
*2026-10-19* — David pidió quitar los iconos y rediseñar. Todo pasa a tipografía: Bricolage Grotesque (títulos) y Figtree (texto), papel cálido con tinta casi negra y verde bosque de acento, cajas con borde fino en vez de sombras, barra inferior solo con texto. Desplegables, casillas, radios, fechas y `<details>` tienen estilo propio en `app/globals.css`; las casillas de Perfil y Ajustes son cajas que se marcan enteras (clase `opcion`).

## Acceso con Google, como en StatsRun
*2026-10-19* — Para pasársela a amigos, David quiere el mismo acceso que en StatsRun (run-in-out): **"Continuar con Google"**. Google verifica el email y quien entra lo acepta en su pantalla; la primera vez se crea la cuenta. La app hace el OAuth con Google ella misma (`/api/auth/google`, como StatsRun) para que Google muestre "Ir a eat-em.vercel.app" y no el dominio de Supabase, y entrega el `id_token` a Supabase (`signInWithIdToken` con nonce), así las sesiones y la seguridad por filas siguen igual. Sin las variables de Google se usa el proveedor de Supabase. Si ya existía una cuenta con ese email, Supabase la enlaza. Se queda "Ya tengo contraseña" para cuentas con contraseña. Descartados antes: alta con contraseña sin verificar, verificación por correo de Supabase y SMTP propio.

## Caprabo fuera de GitHub Actions
*2026-10-27* — Desde el 24-10 capraboacasa.com responde **403 al sitemap desde las IPs de GitHub** (desde casa da 200 con el mismo User-Agent y su robots.txt sigue permitiéndolo). Es un bloqueo de centros de datos y no se salta (ni proxies ni cambiar el User-Agent). Se quita su cron del workflow para que no falle cada día y se carga a mano desde casa con `npm run scraper -- caprabo` (~15 min). Alternativa pendiente de David: una tarea programada de Windows en su PC.
