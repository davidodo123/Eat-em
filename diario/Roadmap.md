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
- [x] Crear los secretos SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en GitHub Actions (20-10)
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
- [x] Rehacer enlaces de ingredientes con las exclusiones (2.188 enlaces; leche, huevos, pollo y aceite ya cuadran)
- [x] Corregir 1.187 formatos de Carrefour (la API trae a veces el factor x10) y que el scraper prefiera el texto del envase
- [x] Corregir los €/kg de los 1.959 productos de peso variable de Carrefour (la API da 0,001 kg)
- [x] Buscador con resultados flotantes, sin scroll de más y textos, icono y Escanear al día
- [x] Funciones de Vercel en Dublín, junto a la base de datos (las acciones tardaban por cruzar el Atlántico)
- [ ] `aplicar_off` de Open Food Facts se corta por tiempo: hacerlo adaptativo como el resto (y `agrupar_por_ean`)
- [x] Rediseño sin iconos, con campos y casillas propios → [[Decisiones#Diseño sin iconos]]
- [x] Acceso con Google como en StatsRun (Google muestra eat-em.vercel.app) → [[Decisiones#Acceso con Google, como en StatsRun]]
- [ ] Quitar la protección de Vercel (pide iniciar sesión en Vercel en el móvil)
- [/] David prueba la app en el móvil (entrar con Google ya funciona)

## Fase 3 · Publicar
- [x] Desplegar en Vercel con las variables de [[Configuración]] (https://eat-em.vercel.app)
- [-] ~~URL de redirección del login en Supabase~~ (no hace falta: Google vuelve a la propia app)
- [x] README con la explicación de la web
- [ ] Evaluación completa de la IA gratuita (50 peticiones al día, en dos tandas)
