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
