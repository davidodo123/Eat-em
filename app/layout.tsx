import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import { Navegacion } from "./navegacion";

// Titulos con caracter y texto muy legible en pantallas pequenas
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display", display: "swap" });
const texto = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-texto", display: "swap" });

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
    { media: "(prefers-color-scheme: light)", color: "#f3efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#121310" },
  ],
};

// Tema elegido en Ajustes (localStorage "tema": "claro" | "oscuro"; sin valor = el del sistema).
// Script en linea para aplicarlo antes de pintar y evitar el parpadeo
// (node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md).
const TEMA = `try{var t=localStorage.getItem("tema");if(t==="claro"||t==="oscuro")document.documentElement.dataset.theme=t==="claro"?"light":"dark"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${display.variable} ${texto.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Navegacion />
      </body>
    </html>
  );
}
