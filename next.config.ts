import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los scrapers y scripts no forman parte del despliegue en Vercel
  outputFileTracingExcludes: { "*": ["scrapers/**", "scripts/**", "data/raw/**"] },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "prod-mercadona.imgix.net" },
      { protocol: "https", hostname: "images.openfoodfacts.org" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
