"use client";
import { useOptimistic, useState, useTransition } from "react";
import { anadirProducto, anadirTexto, cambiarPaquetes, marcarComprado, quitarItem, recalcularLista } from "./acciones";
import { listaParaWhatsapp, type ItemTexto } from "@/lib/dominio/lista";
import { Buscador } from "../buscador";

export function AnadirALista() {
  return (
    <Buscador placeholder="Añadir a la lista…"
      onElegir={(r, o) => anadirProducto(o.id, r.nombre)}
      onTexto={(t) => anadirTexto(t)} />
  );
}

export interface FilaLista {
  id: number; nombre: string; detalle: string | null; precio: string | null; tienda: string | null;
  urgente: boolean; paquetes: number | null; esProducto: boolean; imagen: string | null;
}

export function ItemLista({ f }: { f: FilaLista }) {
  const [estado, setEstado] = useState<"" | "comprado" | "quitado">("");
  const [paquetes, cambiar] = useOptimistic(f.paquetes ?? 1, (_: number, n: number) => n);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  if (estado === "quitado") return null;

  const accion = (nuevo: "comprado" | "quitado", fn: () => Promise<{ error?: string }>) => empezar(async () => {
    setEstado(nuevo);
    const r = await fn();
    if (r.error) { setEstado(""); setError(r.error); }
  });
  const sumar = (d: number) => empezar(async () => {
    const n = Math.max(1, paquetes + d);
    cambiar(n);
    const r = await cambiarPaquetes(f.id, n);
    if (r.error) setError(r.error);
  });

  return (
    <li className={`flex items-center gap-3 px-4 py-3 transition-opacity ${estado === "comprado" ? "opacity-40" : ""}`}>
      <button type="button" aria-label={`Comprado: ${f.nombre}`} disabled={estado !== ""}
        onClick={() => accion("comprado", () => marcarComprado(f.id))}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${estado === "comprado" ? "border-marca bg-marca text-marca-texto" : f.urgente ? "border-urgente" : "border-texto-suave/50"}`}>
        {estado === "comprado" && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3}><path d="m5 12 5 5 9-10" /></svg>}
      </button>
      {f.imagen && <img src={f.imagen} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain" />}
      <div className="min-w-0 flex-1">
        <p className={`line-clamp-2 leading-snug ${estado === "comprado" ? "line-through" : ""}`}>
          {f.urgente && <span className="mr-1 rounded bg-urgente px-1 py-px text-[0.65rem] font-bold uppercase text-white">Urgente</span>}
          {f.nombre}
        </p>
        {(f.detalle || f.precio) && (
          <p className="text-xs text-texto-suave">
            {[f.detalle, f.precio && f.tienda ? `${f.precio} en ${f.tienda}` : f.precio].filter(Boolean).join(" · ")}
          </p>
        )}
        {error && <p className="text-xs text-urgente" role="alert">{error}</p>}
      </div>
      {f.esProducto && (
        <div className="flex shrink-0 items-center rounded-full bg-fondo">
          <button type="button" aria-label="Uno menos" disabled={paquetes <= 1} onClick={() => sumar(-1)} className="h-8 w-8 text-lg disabled:opacity-30">−</button>
          <span className="w-5 text-center text-sm font-semibold tabular-nums">{paquetes}</span>
          <button type="button" aria-label="Uno más" onClick={() => sumar(1)} className="h-8 w-8 text-lg">+</button>
        </div>
      )}
      <button type="button" aria-label={`Quitar ${f.nombre}`} onClick={() => accion("quitado", () => quitarItem(f.id))}
        className="-mr-2 shrink-0 p-2 text-texto-suave">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </li>
  );
}

export function Compartir({ titulo, items }: { titulo: string; items: ItemTexto[] }) {
  const texto = listaParaWhatsapp(titulo, items);
  const [hecho, setHecho] = useState(false);
  const compartir = async () => {
    if (navigator.share) { try { await navigator.share({ title: titulo, text: texto }); } catch { /* cancelado */ } return; }
    await navigator.clipboard.writeText(texto);
    setHecho(true); setTimeout(() => setHecho(false), 2000);
  };
  return (
    <button type="button" onClick={compartir} disabled={!items.length} aria-label="Compartir la lista"
      className="grid h-10 w-10 place-items-center rounded-full bg-superficie text-marca shadow-[0_1px_0_var(--borde)] disabled:opacity-40">
      {hecho ? "✓" : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 8l5-5 5 5M5 13v6h14v-6" /></svg>}
    </button>
  );
}

export function RecalcularLista({ dias }: { dias: number }) {
  const [pendiente, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  return (
    <div>
      <button type="button" disabled={pendiente}
        onClick={() => empezar(async () => {
          const r = await recalcularLista();
          setMensaje(r.error ? { texto: r.error, error: true } : { texto: r.resumen ?? "", error: false });
        })}
        className="flex w-full items-center gap-3 rounded-2xl bg-marca/10 px-4 py-3 text-left text-marca active:bg-marca/20 disabled:opacity-60">
        <svg viewBox="0 0 24 24" aria-hidden className={`h-5 w-5 shrink-0 ${pendiente ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" /></svg>
        <span className="flex-1">
          <span className="block font-semibold">{pendiente ? "Mirando tu dieta y tu despensa…" : "¿Qué me falta?"}</span>
          <span className="block text-xs opacity-80">Según la dieta de los próximos {dias} días y lo que hay en casa</span>
        </span>
      </button>
      {mensaje && <p className={`mt-2 px-1 text-sm ${mensaje.error ? "text-urgente" : "text-texto-suave"}`} role="status">{mensaje.texto}</p>}
    </div>
  );
}
