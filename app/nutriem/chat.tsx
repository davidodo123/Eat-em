"use client";
import { useState, useTransition } from "react";
import { preguntar } from "./acciones";
import type { Mensaje } from "@/lib/ia/generar";

// Conversacion solo en memoria del navegador: no se guarda (son datos sensibles)
export function Chat({ disponible }: { disponible: boolean }) {
  const [historial, setHistorial] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pensando, empezar] = useTransition();

  const enviar = () => {
    const pregunta = texto.trim();
    if (!pregunta) return;
    setTexto("");
    setError(null);
    const previo = historial;
    setHistorial([...previo, { role: "user", content: pregunta }]);
    empezar(async () => {
      const r = await preguntar(pregunta, previo);
      if (r.respuesta) setHistorial((h) => [...h, { role: "assistant", content: r.respuesta! }]);
      else setError(r.error ?? "Error");
    });
  };

  return (
    <div className="caja p-3">
      <div className="mb-3 max-h-96 space-y-2 overflow-y-auto" aria-live="polite">
        {!historial.length && <p className="text-sm text-texto-suave">Pregúntame por hambre entre horas, cómo retomar tras un mal día, ideas para la cena…</p>}
        {historial.map((m, i) => (
          <p key={i} className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-marca text-marca-texto" : "mr-8 bg-fondo"}`}>{m.content}</p>
        ))}
        {pensando && <p className="mr-8 rounded-xl bg-fondo px-3 py-2 text-sm text-texto-suave">Pensando…</p>}
      </div>
      {error && <p className="mb-2 text-sm text-urgente" role="alert">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex gap-2">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} disabled={!disponible}
          placeholder={disponible ? "Escribe a Nutri-em" : "Nutri-em aún no está configurado"} aria-label="Pregunta para Nutri-em"
          className="flex-1 px-3.5 py-3 text-base" />
        <button type="submit" disabled={!disponible || pensando || !texto.trim()}
          className="rounded-xl bg-marca px-4 font-semibold text-marca-texto disabled:opacity-60">Enviar</button>
      </form>
    </div>
  );
}
