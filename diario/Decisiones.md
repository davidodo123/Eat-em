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

## Modelo de IA de reserva
*2026-10-27* — OpenRouter retiró la versión gratuita de `nvidia/nemotron-3-super-120b-a12b:free` (404 "unavailable for free"): la IA de la app dejó de funcionar. Elegido como sustituto `nvidia/nemotron-3.5-super-vl:free`, el único gratuito con Structured Outputs de su familia (los otros: xing4.0-29b, dots-3-note-preview, lfm-2.5-2.6b, más pequeños o en preview); pasó 6 de 6 preguntas de prueba. El código prueba el modelo de reserva cuando el principal da 404 (`OPENAI_MODELO_RESERVA`, por defecto ese), así la app no se cae la próxima vez que retiren uno. Alternativa: pagar el modelo antiguo (decisión de David, ver [[Pendiente]]).

## Velocidad entre pestañas
*2026-10-27* — David pidió que las secciones carguen más rápido. Medido: cada viaje a Supabase cuesta 100-500 ms y la Lista hacía uno por ingrediente de la dieta (24 en paralelo ≈ 1,6 s). Elegido:
- Las cuatro pestañas de la barra se precargan (`prefetch`) y el navegador las guarda 30 s si se han visitado y 60 s si solo se han precargado (`staleTimes`). Cualquier acción con `revalidatePath` y el tiempo real borran esa caché, así que lo que cambia uno mismo o el hogar se ve al momento. Coste: 3 renders más en el servidor al abrir la app.
- Lista: `precios_minimos()` (migración 12) da el más barato de todos los ingredientes en un solo viaje, con el mismo criterio que `comparar_precios`. Si la migración aún no está aplicada, se usa la forma antigua.
- Dieta: dietas y comidas en una sola consulta.
- `/`, `/hoy` e `/inventario` pasan a redirecciones de `next.config.ts` (antes renderizaban una página solo para redirigir; abrir la PWA eran dos viajes al servidor). La PWA abre en `/lista`.
Descartado: Cache Components / PPR (cambia cómo se escriben todas las páginas; mucho trabajo para lo que queda por ganar).

## Ahorramás avanza según lo que trae cada página
*2026-11-05* — La web anuncia ~7.700 productos y el scraper veía ~5.700, un conjunto distinto cada día, y retiraba ~1.000 productos diarios que seguían a la venta. Las ejecuciones salían "ok" porque el total no caía de golpe. Causa: el tamaño de página cambia por categoría y día (14 propios + 3 patrocinados, 24…) y se avanzaba siempre de 24 en 24. Ahora se avanza lo que trae de nuevo cada página y, si una categoría no llega al 98 % de lo anunciado, no se retira nada. Comprobado: 497 de 497 en lácteos; 7.505 en total y 1.812 recuperados. Coste: de 23 a 33 min. Descartado: leer el sitemap de productos (no trae precios).

## Tiempo real con el token de la sesión
*2026-11-05* — Los cambios de otra persona del hogar nunca llegaban solos al navegador: el canal entraba sin `access_token`, Supabase aceptaba la suscripción y RLS descartaba los eventos sin ningún error. Se pasa el token antes de suscribirse. Además, al volver a una pestaña o a la app tras 30 s en segundo plano se pide la versión al día, porque la caché de pestañas de [[Decisiones#Velocidad entre pestañas]] enseñaba datos viejos. Coste: un render más al volver, y a veces la pestaña siguiente tarda ~0,8 s en vez de ~30 ms.

## Movimientos de inventario con lo que salió de verdad
*2026-11-05* — El stock no baja de 0, pero el movimiento guardaba lo pedido: con 0 g en casa, Hecha (-250) dejaba 0 y Deshacer (+250) dejaba 250 g que no existen. Migración 13: el movimiento guarda lo que salió de verdad y, si no salió nada, no se registra. Descartado: permitir stock negativo (la despensa enseñaría cantidades sin sentido).

## Semana con IA por tandas
*2026-11-05* — Uno a uno, 7 días con el modelo gratuito pasaban de los 5 min de la función de Vercel y no se guardaba nada. Ahora van 4 días a la vez y, a los 270 s o sin cupo, se guarda lo generado y se avisa de lo que falta. Coste: los días de una misma tanda no se ven entre sí, así que pueden variar menos.

## Casos de uso con navegador real
*2026-11-05* — `tareas/casos-de-uso.ts` con `playwright-core` y el Chrome instalado (no descarga navegadores), contra producción o un build local, con cuentas temporales que se borran al acabar. Solo se añade como dependencia de desarrollo. Encontró en su primer día el tiempo real roto, el stock fantasma, la pantalla rota con fechas imposibles y un fallo que había metido yo: tras quitar `app/page.tsx`, al entrar la URL se quedaba en `/` sin pestaña marcada.
