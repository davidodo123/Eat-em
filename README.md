# Eat-em

**La compra, la despensa y la dieta, en el bolsillo.**
App web para el móvil (se instala como una app) que te dice qué te falta, guarda lo que tienes en casa y organiza tus comidas, con los productos y precios de los supermercados que tienes cerca. Se comparte con quien vive contigo.

**Web:** https://eat-em.vercel.app

> Eat-em no sustituye a un profesional sanitario.

## Qué hace

| Sección | Para qué sirve |
|---|---|
| **Lista** | Lo que falta, compartida con tu hogar en tiempo real. Buscas cualquier producto de tus supermercados (unos 80.000) o escribes lo que sea ("pilas"). El botón **¿Qué me falta?** lo calcula a partir de la dieta y de lo que hay en casa. Muestra dónde sale más barato y un total estimado, y se comparte por WhatsApp. Lo que marcas como comprado pasa a la despensa. |
| **Despensa** | Todo lo que tenéis en casa, por producto: nevera, congelador o despensa, unidades y fecha de caducidad. Lo que caduca pronto sale arriba y se avisa por la mañana. Cuando algo se acaba, entra solo en la lista. También se añade escaneando el código de barras. |
| **Dieta** | Tus comidas en vista **semana** o **mes**. Las añades a mano o dejas que la IA rellene la semana según tu perfil y tus objetivos; puedes repetir una semana en todo el mes. El día de hoy sale arriba para marcar cada comida como hecha, y eso descuenta los ingredientes de la despensa. |
| **Ajustes** | Ubicación y supermercados, hogar (invitación con código), perfil de salud, Nutri-em (chat de dudas de alimentación), comparador de precios, notificaciones y tema claro/oscuro. |

### Supermercados cercanos
Pones tu ubicación (GPS o código postal) y la distancia a la que compras. La app busca los supermercados de alrededor en una copia de **OpenStreetMap** (~18.900 en España) y te enseña solo las cadenas que tienes cerca.

Hay catálogo de **Carrefour, Ahorramás, Gadis y Caprabo** (con precios, actualizados a diario) y de **Mercadona** (catálogo; su web no permite leer precios, así que llegan de lo que se escanea).

### Acceso
Con **Google** ("Continuar con Google"): Google verifica el email y la primera vez se crea la cuenta. Quien tenga contraseña puesta en Ajustes también puede entrar con email y contraseña.

### IA con salvaguardas
La dieta y el chat usan un modelo de IA (OpenRouter, modelo gratuito). **El código hace las cuentas y los controles; la IA solo redacta.** Antes de pedir nada a la IA se calculan los objetivos y se comprueba el perfil: ante embarazo, enfermedad, medicación o señales de riesgo no propone dieta y recomienda un profesional. Los datos de salud se guardan solo con consentimiento y se borran al retirarlo.

## Cómo está hecho

- **App:** Next.js 16 (App Router, Server Actions) con React 19 y TypeScript, Tailwind CSS. PWA con notificaciones push (Web Push).
- **Datos:** Supabase (PostgreSQL con seguridad por filas, Auth y tiempo real). Toda la lógica de datos está en `supabase/migrations/`.
- **Precios:** scrapers en TypeScript que corren cada día en GitHub Actions, despacio y respetando el `robots.txt` de cada tienda. Los productos se cruzan con **Open Food Facts** (nutrición) y se enlazan con ingredientes genéricos para la dieta.
- **Despliegue:** Vercel (cada push a `main` se publica solo) y un cron diario para los avisos.

```
app/          pantallas y acciones del servidor (lista, despensa, dieta, ajustes, entrar…)
lib/          lógica: dominio (formatos, cantidades, calendario…), IA, catálogo, ubicación
scrapers/     un scraper por supermercado + Open Food Facts
supabase/     migraciones SQL y datos iniciales
scripts/      validación del SQL, carga de supermercados de OSM, seed
diario/       diario del proyecto en Obsidian (roadmap, decisiones, pendientes)
docs/         arquitectura y scrapers
```

## En local

Requisitos: Node 20.9 o superior.

```bash
npm install
cp .env.example .env.local     # rellena las claves (Supabase, Google, IA, VAPID)
npm run dev                    # http://localhost:3000
npm test                       # tests unitarios
npm run db:validar             # valida migraciones + seed en Postgres embebido (sin Docker)
```

Otros comandos:

```bash
npm run scraper -- <carrefour|mercadona|ahorramas|gadis|caprabo> [--seco] [--rapido]
npm run off                    # Open Food Facts: nutrición por EAN y emparejado por nombre
npm run tiendas                # supermercados de OpenStreetMap
```

### Configuración
- **Supabase:** aplica `supabase/migrations/*.sql` (con `npx supabase db push` o pegándolas en el SQL Editor) y `supabase/seed.sql`.
- **Google:** un cliente OAuth web con estas vueltas autorizadas: `https://<tu-dominio>/api/auth/google/callback`, `http://localhost:3000/api/auth/google/callback` y `https://<proyecto>.supabase.co/auth/v1/callback`. El mismo ID y secreto van en Supabase (proveedor Google) y en `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- **Vercel:** las variables de `.env.example`. Comprueba `https://<tu-app>/api/salud`.
- **GitHub Actions** (scrapers): secretos `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

Más detalle: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) · [docs/SCRAPERS.md](docs/SCRAPERS.md) · estado y pendientes en [diario/Pendiente.md](diario/Pendiente.md).

## Datos de terceros
Mapas y supermercados © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL). Información nutricional de [Open Food Facts](https://world.openfoodfacts.org) (ODbL). Los precios se leen de las webs públicas de cada supermercado.
