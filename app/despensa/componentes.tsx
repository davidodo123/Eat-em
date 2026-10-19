"use client";
import { useOptimistic, useState, useTransition } from "react";
import { ajustar, anadirProducto, anadirTexto, editar } from "./acciones";
import { Buscador } from "../buscador";

export function AnadirADespensa() {
  return <Buscador placeholder="Añadir a la despensa…" textoBoton="Guardar"
    onElegir={(r, o) => anadirProducto(o.id, r.nombre)} onTexto={(t) => anadirTexto(t)} />;
}

const LUGARES = [["despensa", "Despensa"], ["nevera", "Nevera"], ["congelador", "Congelador"]] as const;

export interface FilaDespensaDatos {
  id: number; nombre: string; detalle: string | null; imagen: string | null; unidades: number; lugar: string; caduca: string | null;
  diasParaCaducar: number | null;
}

export function FilaDespensa({ f }: { f: FilaDespensaDatos }) {
  const [unidades, cambiar] = useOptimistic(f.unidades, (actual: number, d: number) => Math.max(0, actual + d));
  const [abierta, setAbierta] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [, empezar] = useTransition();
  const sumar = (d: number, tipo: "ajuste" | "desperdicio" = "ajuste") => empezar(async () => {
    cambiar(d);
    const r = await ajustar(f.id, d, tipo);
    setMensaje(r.error ?? r.aviso ?? null);
  });
  const guardar = (c: { lugar?: string; caduca?: string | null }) => empezar(async () => setMensaje((await editar(f.id, c)).error ?? null));

  const caduca = f.diasParaCaducar;
  const etiqueta = caduca === null ? null
    : caduca < 0 ? { t: "caducado", c: "bg-urgente text-white" }
    : caduca === 0 ? { t: "caduca hoy", c: "bg-urgente text-white" }
    : caduca <= 3 ? { t: `${caduca} ${caduca === 1 ? "día" : "días"}`, c: "bg-aviso/15 text-aviso" }
    : null;

  if (unidades <= 0 && mensaje) return <li className="px-4 py-3 text-sm text-texto-suave" role="status">{f.nombre}: {mensaje.toLowerCase()}</li>;

  return (
    <li>
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {f.imagen ? <img src={f.imagen} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-0.5" />
            : null}
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 leading-snug">{f.nombre}</span>
            <span className="flex items-center gap-1.5 text-xs text-texto-suave">
              {etiqueta && <span className={`rounded px-1.5 py-px font-semibold ${etiqueta.c}`}>{etiqueta.t}</span>}
              {f.detalle}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center rounded-full border border-borde">
          <button type="button" aria-label={`Gastar uno de ${f.nombre}`} onClick={() => sumar(-1)} className="h-9 w-9 text-lg">−</button>
          <span className="min-w-6 text-center font-semibold tabular-nums">{unidades.toLocaleString("es-ES")}</span>
          <button type="button" aria-label={`Uno más de ${f.nombre}`} onClick={() => sumar(1)} className="h-9 w-9 text-lg">+</button>
        </div>
      </div>
      {mensaje && <p className="-mt-1 px-4 pb-2 text-xs text-marca" role="status">{mensaje}</p>}
      {abierta && (
        <div className="space-y-3 border-t border-borde bg-fondo/60 px-4 py-3">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-borde bg-fondo p-1">
            {LUGARES.map(([v, t]) => (
              <button key={v} type="button" onClick={() => guardar({ lugar: v })}
                className={`rounded-lg py-1.5 text-sm font-medium ${f.lugar === v ? "bg-superficie shadow-sm" : "text-texto-suave"}`}>{t}</button>
            ))}
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Caduca</span>
            <input type="date" defaultValue={f.caduca ?? ""} onChange={(e) => guardar({ caduca: e.target.value || null })}
              className="px-3 py-2 text-base" />
          </label>
          <button type="button" onClick={() => { if (confirm(`¿Tirar ${f.nombre}?`)) sumar(-unidades, "desperdicio"); }}
            className="w-full rounded-xl py-2 text-sm font-medium text-urgente">Se ha estropeado: tirar</button>
        </div>
      )}
    </li>
  );
}
