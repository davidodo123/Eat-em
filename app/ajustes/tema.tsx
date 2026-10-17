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
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
      {[["sistema", "Sistema"], ["claro", "Claro"], ["oscuro", "Oscuro"]].map(([k, t]) => (
        <button key={k} type="button" role="radio" aria-checked={tema === k} onClick={() => elegir(k)} suppressHydrationWarning
          className={`rounded-xl border px-3 py-2 text-sm font-medium ${tema === k ? "border-marca bg-marca text-marca-texto" : "border-borde"}`}>{t}</button>
      ))}
    </div>
  );
}
