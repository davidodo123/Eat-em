"use client";
import { useState } from "react";

// Sistema / claro / oscuro. Se guarda solo en este dispositivo.
export function SelectorTema() {
  const [tema, setTema] = useState(() => {
    try { return (typeof window !== "undefined" && localStorage.getItem("tema")) || "sistema"; } catch { return "sistema"; }
  });
  const elegir = (t: string) => {
    setTema(t);
    try { if (t === "sistema") localStorage.removeItem("tema"); else localStorage.setItem("tema", t); } catch { /* modo privado */ }
    if (t === "sistema") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t === "claro" ? "light" : "dark";
  };
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-borde bg-fondo p-1" role="radiogroup" aria-label="Tema">
      {[["sistema", "Sistema"], ["claro", "Claro"], ["oscuro", "Oscuro"]].map(([k, t]) => (
        <button key={k} type="button" role="radio" aria-checked={tema === k} onClick={() => elegir(k)} suppressHydrationWarning
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${tema === k ? "bg-texto text-fondo" : "text-texto-suave"}`}>{t}</button>
      ))}
    </div>
  );
}
