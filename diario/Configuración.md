---
tags: [configuracion]
---
# Configuración

Solo nombres. Los valores van en `.env.local`, en Vercel y en los secretos de GitHub, **nunca aquí**.

## Servicios
- **Supabase**: base de datos, login por enlace al correo, tiempo real. Migraciones en `supabase/migrations/`, se aplican con `npx supabase db push` (pide `SUPABASE_DB_PASSWORD`).
- **GitHub Actions**: `scrapers.yml` (diario), `open-food-facts.yml`, `ci.yml`.
- **OpenRouter** (IA, modelo gratuito) por la API compatible con OpenAI.
- **OpenStreetMap**: Nominatim (código postal) y copia de supermercados en `tiendas_osm`.
- **Vercel**: proyecto `eat-em` (cuenta davidodo123), https://eat-em.vercel.app. Variables copiadas de `.env.local`. Cron diario 07:00 UTC (`vercel.json`).

## Variables de entorno (`.env.local` / Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODELO_CHAT`, `OPENAI_MODELO_EMBEDDINGS`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`
- `SCRAPER_USER_AGENT`, `MERCADONA_CODIGO_POSTAL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_REMITENTE` (correos propios de acceso)
- Opcionales: `CONTACTO_OSM`, `OVERPASS_URL`

## Secretos de GitHub Actions (Settings › Secrets and variables › Actions)
- `SUPABASE_URL` (el mismo valor que `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`
- Variable (no secreto) opcional: `SCRAPER_USER_AGENT`
