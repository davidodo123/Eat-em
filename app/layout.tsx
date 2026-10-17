import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eat-em",
  description: "Tu dieta, tu despensa y tu lista de la compra, sincronizadas.",
  appleWebApp: { capable: true, title: "Eat-em", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#121513" },
  ],
};

// Tema elegido en Ajustes (localStorage "tema": "claro" | "oscuro"; sin valor = el del sistema).
// Script en linea para aplicarlo antes de pintar y evitar el parpadeo
// (node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md).
const TEMA = `try{var t=localStorage.getItem("tema");if(t==="claro"||t==="oscuro")document.documentElement.dataset.theme=t==="claro"?"light":"dark"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
