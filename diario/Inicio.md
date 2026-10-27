---
tags: [inicio]
---
# Eat-em

App de móvil (PWA) para la compra de casa: **Lista** de lo que falta, **Despensa** con todo lo que hay y **Dieta** con las comidas de la semana o del mes. Pones tu ubicación y te da los productos y precios de los supermercados que tienes cerca. Se comparte con quien vive contigo (un "hogar").

- Repo: https://github.com/davidodo123/Eat-em
- Web: https://eat-em.vercel.app (Vercel, se despliega solo con cada push a `main`)
- Base de datos: Supabase (Postgres + Auth + Realtime)
- Precios: scrapers diarios en GitHub Actions (Carrefour, Ahorramás, Gadis, Caprabo; Mercadona solo catálogo)

## Fase actual
Fase 2 · App móvil — publicada en https://eat-em.vercel.app con acceso con Google; falta que David la pruebe a fondo en el móvil. Scrapers diarios en GitHub salvo Caprabo (bloquea GitHub, se carga desde casa). IA con modelo gratuito nuevo (ver [[Pendiente]]).

## Cómo usamos el diario
- [[Roadmap]]: fases y tareas con casillas (de aquí sale el % del panel).
- [[Pendiente]]: todo lo que queda, con pasos y prompt para seguir.
- [[Ideas]]: bandeja de entrada sin ordenar.
- [[Decisiones]]: qué se decidió, por qué y cuándo.
- [[Configuración]]: servicios y nombres de variables (nunca valores).
- `Diario/`: una nota por día de trabajo.
