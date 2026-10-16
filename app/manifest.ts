import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eat-em",
    short_name: "Eat-em",
    description: "Dieta, inventario y lista de la compra para tu hogar.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f4",
    theme_color: "#1f7a55",
    lang: "es",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
