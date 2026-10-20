import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eat-em",
    short_name: "Eat-em",
    description: "La compra, la despensa y la dieta de tu hogar, con los precios de tus supermercados.",
    start_url: "/",
    display: "standalone",
    // Los mismos colores que la app (papel y verde bosque de app/globals.css)
    background_color: "#f3efe6",
    theme_color: "#f3efe6",
    lang: "es",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
