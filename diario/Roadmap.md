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
- [x] Caprabo bloquea las IPs de GitHub (403): fuera del cron, se carga a mano desde casa → [[Decisiones#Caprabo fuera de GitHub Actions]]
- [x] Caprabo por subcategorías: la raíz da 403 pasada la página 100
- [x] Carrefour: timeout del job a 240 min, `Retry-After` largo ya no cuelga el job y la ejecución se cierra si GitHub la corta
- [x] Comprobar una semana de ejecuciones diarias sin fallos (del 29-10 al 05-11 en GitHub, 8 días seguidos)
- [x] Ahorramás: se saltaba hasta un 26 % del catálogo y retiraba ~1.000 productos al día; ahora 7.505 → [[Decisiones#Ahorramás avanza según lo que trae cada página]]
- [x] Vigilante en las ejecuciones: si una se cuelga queda apuntado dónde (Carrefour se colgó el 27 y el 28-10, causa aún desconocida)

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
- [x] `aplicar_off` de Open Food Facts se corta por tiempo: hacerlo adaptativo como el resto (también `agrupar_por_ean`)
- [x] Rediseño sin iconos, con campos y casillas propios → [[Decisiones#Diseño sin iconos]]
- [x] Acceso con Google como en StatsRun (Google muestra eat-em.vercel.app) → [[Decisiones#Acceso con Google, como en StatsRun]]
- [x] Quitar la protección de Vercel (20-10)
- [x] Optimización: pestañas precargadas y en caché 30-60 s, Lista con un viaje a la base en vez de uno por ingrediente, Dieta con uno menos, la app abre directa en Lista y fuera código muerto → [[Decisiones#Velocidad entre pestañas]]
- [x] Aplicar la migración 12 (`precios_minimos`) en el SQL Editor de Supabase (27-10; mismos precios que antes, 170-300 ms estables frente a 220-790 ms)
- [x] Batería de 86 casos de uso con navegador real (`npm run casos`) → [[Casos de uso]]
- [x] Tiempo real: nunca llegaba ningún evento al navegador (el canal entraba sin la sesión) → [[Decisiones#Tiempo real con el token de la sesión]]
- [x] Al volver a una pestaña o a la app, se pone al día
- [x] Dieta: objetivos del perfil también sin plan de IA; fechas imposibles ya no rompen la pantalla
- [x] Páginas de error y 404 en español
- [x] Rellenar la semana con IA por tandas y con límite de tiempo (antes pasaba de 5 min y se perdía todo)
- [/] Migración 13 escrita y probada: Deshacer una comida creaba comida de la nada. Falta aplicarla en el SQL Editor de Supabase
- [ ] Repetir con cupo de IA limpio «Rellenar la semana» (el 05-11 salieron 3 de 7 días, causa sin confirmar)
- [/] David prueba la app en el móvil (entrar con Google ya funciona; 0 dietas y 0 avisos activados hasta ahora)
- [ ] Activar avisos en un móvil y comprobar que llega uno (nadie los ha probado: 0 suscripciones)

## Fase 3 · Publicar
- [x] Desplegar en Vercel con las variables de [[Configuración]] (https://eat-em.vercel.app)
- [-] ~~URL de redirección del login en Supabase~~ (no hace falta: Google vuelve a la propia app)
- [x] README con la explicación de la web
- [x] Modelo de IA de reserva: OpenRouter retiró gratis el de siempre → [[Decisiones#Modelo de IA de reserva]]
- [x] Evaluación completa de la IA gratuita: 50/50 en las comprobaciones automáticas (27-10 y 05-11)
- [ ] Revisar a mano el tono de las respuestas de la evaluación (`data/eval/`), como pide el criterio
