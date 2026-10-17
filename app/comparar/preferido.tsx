"use client";
import { useState, useTransition } from "react";
import { elegirPreferido } from "./acciones";

export function BotonPreferido({ ingredienteId, productoId, elegido }: { ingredienteId: string; productoId: number; elegido: boolean }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" disabled={pendiente}
        onClick={() => empezar(async () => setError((await elegirPreferido(ingredienteId, elegido ? null : productoId)).error ?? null))}
        className={`mt-1 rounded-lg px-2 py-1 text-xs font-medium ${elegido ? "bg-marca text-marca-texto" : "border border-borde"}`}>
        {elegido ? "★ El nuestro" : "Este es el nuestro"}
      </button>
      {error && <span className="ml-2 text-xs text-urgente">{error}</span>}
    </>
  );
}
