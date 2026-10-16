"use client";
import { useState, useTransition } from "react";
import { deshacerComida, marcarComida } from "./acciones";

export function BotonesComida({ comidaId, consumo }: { comidaId: number; consumo: { id: number; estado: string } | null }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hacer = (f: () => Promise<{ error?: string }>) => empezar(async () => setError((await f()).error ?? null));

  if (consumo) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-medium ${consumo.estado === "hecha" ? "text-marca" : "text-texto-suave"}`}>
          {consumo.estado === "hecha" ? "✓ Hecha" : "Saltada"}
        </span>
        <button type="button" disabled={pendiente} onClick={() => hacer(() => deshacerComida(consumo.id))}
          className="text-sm text-texto-suave underline">Deshacer</button>
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={pendiente} onClick={() => hacer(() => marcarComida(comidaId, "hecha"))}
          className="rounded-xl bg-marca px-3 py-2 font-semibold text-marca-texto disabled:opacity-60">Hecha</button>
        <button type="button" disabled={pendiente} onClick={() => hacer(() => marcarComida(comidaId, "saltada"))}
          className="rounded-xl border border-borde px-3 py-2 font-medium disabled:opacity-60">Saltada</button>
      </div>
      {error && <p className="mt-1 text-xs text-urgente" role="alert">{error}</p>}
    </div>
  );
}
