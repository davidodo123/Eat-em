"use client";
import { useActionState, useState, useTransition } from "react";
import { anadirComida, borrarComida, generarSemana, repetirSemana, type EstadoDieta } from "./acciones";
import { campo } from "../ui";

export function BotonGenerar({ semana, hayPlan, iaLista }: { semana: string; hayPlan: boolean; iaLista: boolean }) {
  const [estado, accion, generando] = useActionState<EstadoDieta, FormData>(generarSemana, {});
  return (
    <form action={accion}>
      <input type="hidden" name="semana" value={semana} />
      <button type="submit" disabled={generando || !iaLista}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-borde/40 disabled:opacity-60">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-marca/10 text-marca">✦</span>
        <span className="flex-1">
          <span className="block font-medium">{generando ? "Preparando la semana… (≈1 min)" : hayPlan ? "Rehacer la semana con IA" : "Rellenar la semana con IA"}</span>
          <span className="block text-xs text-texto-suave">{iaLista ? "Según tu perfil, tus objetivos y lo que hay en casa" : "La IA aún no está configurada"}</span>
        </span>
      </button>
      {estado.error && <p className="px-4 pb-3 text-sm text-urgente" role="alert">{estado.error}</p>}
      {estado.aviso && <p className="mx-4 mb-3 rounded-xl bg-aviso/10 p-3 text-sm" role="status">{estado.aviso}</p>}
    </form>
  );
}

export function RepetirSemana({ semana }: { semana: string }) {
  const [pendiente, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  return (
    <div>
      <button type="button" disabled={pendiente}
        onClick={() => empezar(async () => { const r = await repetirSemana(semana, 3); setMensaje(r.error ?? r.resumen ?? null); })}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-borde/40 disabled:opacity-60">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-marca/10 text-marca">↻</span>
        <span className="flex-1">
          <span className="block font-medium">{pendiente ? "Copiando…" : "Repetir esta semana todo el mes"}</span>
          <span className="block text-xs text-texto-suave">La copia en las 3 semanas siguientes que estén libres</span>
        </span>
      </button>
      {mensaje && <p className="px-4 pb-3 text-sm text-texto-suave" role="status">{mensaje}</p>}
    </div>
  );
}

export function BorrarComida({ id, nombre }: { id: number; nombre: string }) {
  const [pendiente, empezar] = useTransition();
  return (
    <button type="button" disabled={pendiente} aria-label={`Borrar ${nombre}`}
      onClick={() => { if (confirm(`¿Quitar «${nombre}» del plan?`)) empezar(async () => { await borrarComida(id); }); }}
      className="-mr-2 -mt-1 p-2 text-texto-suave disabled:opacity-40">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  );
}

const MOMENTOS = [["desayuno", "Desayuno"], ["media_manana", "Media mañana"], ["comida", "Comida"], ["merienda", "Merienda"], ["cena", "Cena"], ["extra", "Otro"]] as const;
const UD: Record<string, string> = { g: "g", ml: "ml", unidad: "ud" };

export function NuevaComida({ fecha, ingredientes, tipoInicial }: {
  fecha: string; ingredientes: { id: string; nombre: string; unidad: string }[]; tipoInicial: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState(tipoInicial);
  const [nombre, setNombre] = useState("");
  const [preparacion, setPreparacion] = useState("");
  const [filas, setFilas] = useState<{ id: string; cantidad: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-borde py-3.5 font-medium text-texto-suave active:bg-superficie">
        <span className="text-lg leading-none">+</span> Añadir comida
      </button>
    );
  }
  const guardar = () => empezar(async () => {
    const r = await anadirComida(fecha, tipo, nombre, filas.filter((f) => f.id).map((f) => ({ ingrediente_id: f.id, cantidad: Number(f.cantidad.replace(",", ".")) || 0 })), preparacion);
    if (r.error) return setError(r.error);
    setAbierto(false); setNombre(""); setPreparacion(""); setFilas([]); setError(null);
  });

  return (
    <div className="space-y-3 rounded-2xl bg-superficie p-4 shadow-[0_1px_0_var(--borde)]">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {MOMENTOS.map(([v, t]) => (
          <button key={v} type="button" onClick={() => setTipo(v)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${tipo === v ? "bg-marca text-marca-texto" : "bg-fondo text-texto-suave"}`}>{t}</button>
        ))}
      </div>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} placeholder="¿Qué vas a comer?" aria-label="Nombre de la comida" className={campo} autoFocus />
      <textarea value={preparacion} onChange={(e) => setPreparacion(e.target.value)} maxLength={500} rows={2} placeholder="Notas o preparación (opcional)" aria-label="Preparación" className={campo} />

      {filas.map((f, k) => {
        const ing = ingredientes.find((i) => i.id === f.id);
        return (
          <div key={k} className="flex gap-2">
            <select value={f.id} onChange={(e) => setFilas(filas.map((x, j) => (j === k ? { ...x, id: e.target.value } : x)))} aria-label="Ingrediente" className={`${campo} flex-1`}>
              <option value="">Ingrediente</option>
              {ingredientes.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
            <input inputMode="decimal" value={f.cantidad} onChange={(e) => setFilas(filas.map((x, j) => (j === k ? { ...x, cantidad: e.target.value } : x)))}
              placeholder={ing ? UD[ing.unidad] : "cant."} aria-label="Cantidad" className={`${campo} w-20`} />
          </div>
        );
      })}
      {filas.length < 8 && (
        <button type="button" onClick={() => setFilas([...filas, { id: "", cantidad: "" }])} className="text-sm font-medium text-marca">
          + Ingrediente <span className="font-normal text-texto-suave">(para calcular la compra)</span>
        </button>
      )}
      {error && <p className="text-sm text-urgente" role="alert">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setAbierto(false)} className="rounded-xl bg-fondo py-3 font-medium">Cancelar</button>
        <button type="button" onClick={guardar} disabled={pendiente} className="rounded-xl bg-marca py-3 font-semibold text-marca-texto disabled:opacity-60">
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
