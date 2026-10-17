"use client";
import { useEffect } from "react";

// Entrada escalonada de las partes de cada seccion al aparecer. Sin JavaScript (o con
// movimiento reducido) todo se ve desde el principio: el CSS solo oculta si hay clase "js".
export function Movimiento() {
  useEffect(() => {
    document.documentElement.classList.add("js");
    const zonas = document.querySelectorAll<HTMLElement>(".lp [data-entra]");
    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) if (e.isIntersecting) { e.target.classList.add("dentro"); obs.unobserve(e.target); }
    }, { rootMargin: "0px 0px -12% 0px" });
    zonas.forEach((z) => obs.observe(z));
    return () => obs.disconnect();
  }, []);
  return null;
}
