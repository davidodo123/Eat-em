# Eat-em

Planifica la lista de la compra a partir de la dieta de cada persona del hogar: controla el stock real, descuenta lo que se come y propone qué comprar y dónde sale más barato. La dieta la genera una IA ("Nutri-em") con salvaguardas de salud: el código hace las cuentas y los controles, la IA solo redacta.

> Eat-em no sustituye a un profesional sanitario.

- Arquitectura y decisiones: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- Especificación completa: [docs/Eat-em_super_prompt.md](docs/Eat-em_super_prompt.md)
- Scrapers, Open Food Facts y emparejado de productos: [docs/SCRAPERS.md](docs/SCRAPERS.md)
- Estado y pendientes (traspaso entre sesiones): [docs/PENDIENTE.md](docs/PENDIENTE.md)

## Stack

Next.js 16 (PWA) en **Vercel** · **Supabase** (Postgres + pgvector, Auth, Realtime, Storage) · scrapers en **GitHub Actions** · IA por OpenAI u **OpenRouter** (se detecta por la clave; vale un modelo gratuito) · Web Push.

## En local

Requisitos: Node 20.9 o superior.

```bash
npm install
cp .env.example .env.local     # rellena las claves de Supabase
npm run db:validar             # valida migraciones + seed en Postgres embebido (sin Docker)
npm run dev                    # http://localhost:3000  ·  /api/salud
npm test                       # tests unitarios
```

Otros comandos:

```bash
npm run scraper -- <carrefour|mercadona|ahorramas|gadis|caprabo> [--seco] [--rapido] [--max-peticiones N] [--cargar respaldo]
npm run off                    # Open Food Facts: nutricion por EAN y emparejado por nombre
npm run ia:embeddings          # embeddings de las fichas de Nutri-em
npm run eval:ia [-- --solo 1,2] # bateria de 50 preguntas de Nutri-em
```

## Pantallas

`/hoy` (comidas del día) · `/dieta` (semana generada con IA) · `/escanear` (código de barras → precio e inventario) · `/inventario` · `/lista` (compartida, WhatsApp) · `/comparar` (dónde sale más barato) · `/grupo` (hogar) · `/perfil` (salud con consentimiento RGPD) · `/nutriem` (chat y consejos) · `/ajustes` (notificaciones).

Se entra con un enlace mágico por email. En Supabase, *Authentication → URL Configuration* debe incluir `<url-de-la-app>/auth/confirmar` en *Redirect URLs*.

## Base de datos (Supabase)

1. Crea un proyecto en https://supabase.com (región UE).
2. Aplica el esquema y los datos iniciales:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push --include-seed
   ```
   Alternativa sin CLI: pega `supabase/migrations/*.sql` y luego `supabase/seed.sql` en el SQL Editor.
3. Si cambias `data/*.json`, regenera el seed con `npm run db:seed`.

## Despliegue en Vercel

1. Importa el repositorio en Vercel (framework detectado: Next.js).
2. Copia las variables de `.env.example` en *Settings → Environment Variables* (incluidas las VAPID de `.env.local`). `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` y `VAPID_PRIVATE_KEY` sin el prefijo `NEXT_PUBLIC_`.
3. Despliega y comprueba `https://<tu-app>.vercel.app/api/salud`.

## Fases

1. ✅ Arquitectura, modelo de datos y estructura
2. ✅ Scrapers: Carrefour, Mercadona (sin precios), Ahorramás, Gadis y Caprabo
3. ✅ Open Food Facts, emparejado por EAN y por nombre, enlace ingrediente → producto (falta aplicar las migraciones en la base)
4. ✅ Escáner de códigos de barras
5. ✅ Usuarios, hogar, inventario, consumo, lista, comparador y notificaciones (faltan recordatorios programados)
6. 🟡 Motor de dieta con IA y evaluación de 50 preguntas (falta una pasada completa seguida)
7. 🟡 Pantallas funcionales; falta pulir diseño y probar en móvil
8. ⏳ Despliegue en Vercel, monitorización
