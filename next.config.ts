import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los scrapers y scripts no forman parte del despliegue en Vercel
  outputFileTracingExcludes: { "*": ["scrapers/**", "scripts/**", "tareas/**", "data/raw/**"] },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "prod-mercadona.imgix.net" },
      { protocol: "https", hostname: "images.openfoodfacts.org" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  // Cabeceras recomendadas en la guia de PWA de Next (node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
