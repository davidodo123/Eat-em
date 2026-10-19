---
tags: [roadmap]
---
# Roadmap

Regla: se trabaja **una fase cada vez** y no se pasa a la siguiente hasta que David la comprueba.

Leyenda: `[x]` hecho · `[ ]` pendiente · `[/]` empezado · `[-]` descartado

## Fase 1 · Datos de supermercados
- [x] Esquema en Supabase con RLS, hogares e invitación por código
- [x] Scrapers: Carrefour, Ahorramás, Gadis, Caprabo (con precios) y Mercadona (catálogo, sin precios: su robots.txt prohíbe la API)
- [x] Open Food Facts: nutrición por EAN y emparejado por nombre entre tiendas
- [x] Enlace de productos a ingredientes con palabras excluidas (migración 9) → [[Decisiones#Palabras excluidas por ingrediente]]
- [ ] Crear los secretos SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en GitHub Actions (los scrapers fallan sin ellos)
- [ ] Comprobar una semana de ejecuciones diarias sin fallos

## Fase 2 · App móvil
- [x] Barra inferior Lista · Despensa · Dieta · Ajustes → [[Decisiones#App móvil con tres secciones]]
- [x] Ubicación por GPS o código postal y supermercados cercanos de OpenStreetMap → [[Decisiones#Supermercados cercanos desde una copia de OpenStreetMap]]
- [x] Buscador sobre todos los productos de las tiendas cercanas
- [x] Lista: productos, texto libre, lo que falta para la dieta y total estimado
- [x] Despensa por producto: nevera/congelador, caducidad y paso a la lista al acabarse
- [x] Dieta: vista semana y mes, comidas a mano, IA opcional, repetir la semana en el mes
- [x] Acciones más rápidas (avisos push tras responder, una consulta menos por pantalla)
- [x] Esqueletos de carga con la forma de cada pantalla
- [x] Aviso por la mañana de lo que caduca pronto en la despensa
- [x] Pantallas secundarias (Hogar, Perfil, Nutri-em, Escanear, Comparar) con el diseño de la app; Comparar solo con tiendas cercanas
- [x] Aplicar migraciones 9, 10 y 11 (desde el SQL Editor de Supabase)
- [x] Cargar supermercados de OSM (18.895) y exclusiones de ingredientes
- [/] Rehacer enlaces de ingredientes y Open Food Facts (`npm run off -- --solo-aplicar`)
- [x] Rediseño sin iconos, con campos y casillas propios → [[Decisiones#Diseño sin iconos]]
- [ ] David prueba la app en el móvil

## Fase 3 · Publicar
- [x] Desplegar en Vercel con las variables de [[Configuración]] (https://eat-em.vercel.app)
- [ ] URL de redirección del login en Supabase
- [ ] Evaluación completa de la IA gratuita (50 peticiones al día, en dos tandas)
