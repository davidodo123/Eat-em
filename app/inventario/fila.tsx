"use client";
import { useOptimistic, useState, useTransition } from "react";
import { ajustarStock } from "./acciones";
import { formatearCantidad, pasoAjuste } from "@/lib/dominio/cantidad";
import type { UnidadBase } from "@/lib/dominio/formato";

export function FilaInventario({ id, nombre, cantidad, unidad, bajo }: {
  id: string; nombre: string; cantidad: number; unidad: UnidadBase; bajo: boolean;
}) {
  const [optimista, aplicar] = useOptimistic(cantidad, (actual: number, delta: number) => Math.max(0, actual + delta));
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  const paso = pasoAjuste(optimista, unidad);

  const ajustar = (delta: number, tipo: "ajuste" | "desperdicio") =>
    empezar(async () => {
      aplicar(delta);
      const r = await ajustarStock(id, delta, tipo);
      setError(r.error ?? null);
    });

  return (
    <li className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{nombre}</p>
        <p className={`text-sm ${bajo ? "text-aviso" : "text-texto-suave"}`}>
          {formatearCantidad(optimista, unidad)}{bajo ? " · queda poco" : ""}
        </p>
        {error && <p className="text-xs text-urgente" role="alert">{error}</p>}
      </div>
      <button type="button" aria-label={`Quitar ${formatearCantidad(paso, unidad)} de ${nombre}`} disabled={optimista <= 0}
        onClick={() => ajustar(-Math.min(paso, optimista), "ajuste")}
        className="h-10 w-10 rounded-full border border-borde text-lg disabled:opacity-40">−</button>
      <button type="button" aria-label={`Añadir ${formatearCantidad(paso, unidad)} de ${nombre}`}
        onClick={() => ajustar(paso, "ajuste")}
        className="h-10 w-10 rounded-full border border-borde text-lg">+</button>
      <button type="button" aria-label={`Se ha tirado todo: ${nombre}`} title="Se ha estropeado (tirar todo)" disabled={optimista <= 0}
        onClick={() => { if (confirm(`¿Tirar ${formatearCantidad(optimista, unidad)} de ${nombre}?`)) ajustar(-optimista, "desperdicio"); }}
        className="h-10 w-10 rounded-full border border-borde text-sm disabled:opacity-40">🗑</button>
    </li>
  );
}
