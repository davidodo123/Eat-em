"use client";
import { useState, useTransition } from "react";
import { deshacerComida, marcarComida, registrarExtra } from "./acciones";

export interface IngredienteComida { id: string; nombre: string; cantidad: number; unidad: string }
const UD: Record<string, string> = { g: "g", ml: "ml", unidad: "ud" };
const campo = "rounded-lg border border-borde bg-superficie px-2 py-1.5 text-base";

export function BotonesComida({ comidaId, consumo, ingredientes }: {
  comidaId: number; consumo: { id: number; estado: string } | null; ingredientes: IngredienteComida[];
}) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [reales, setReales] = useState<Record<string, string>>(() => Object.fromEntries(ingredientes.map((i) => [i.id, String(i.cantidad)])));
  const hacer = (f: () => Promise<{ error?: string }>) => empezar(async () => {
    const r = await f();
    setError(r.error ?? null);
    if (!r.error) setEditando(false);
  });

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
  if (editando) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-texto-suave">¿Cuánto has comido de verdad? (0 si no lo has tomado)</p>
        {ingredientes.map((i) => (
          <label key={i.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{i.nombre}</span>
            <span className="flex items-center gap-1">
              <input inputMode="decimal" value={reales[i.id]} onChange={(e) => setReales({ ...reales, [i.id]: e.target.value })}
                className={`${campo} w-20 text-right`} aria-label={`Cantidad de ${i.nombre}`} />
              <span className="w-6 text-texto-suave">{UD[i.unidad] ?? i.unidad}</span>
            </span>
          </label>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={pendiente}
            onClick={() => hacer(() => marcarComida(comidaId, "hecha",
              ingredientes.map((i) => ({ ingrediente_id: i.id, cantidad: Number(String(reales[i.id] ?? "0").replace(",", ".")) || 0 }))))}
            className="rounded-xl bg-marca px-3 py-2 font-semibold text-marca-texto disabled:opacity-60">Guardar</button>
          <button type="button" onClick={() => setEditando(false)} className="rounded-xl border border-borde px-3 py-2 font-medium">Cancelar</button>
        </div>
        {error && <p className="text-xs text-urgente" role="alert">{error}</p>}
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
      {ingredientes.length > 0 && (
        <button type="button" onClick={() => setEditando(true)} className="mt-2 text-sm text-texto-suave underline">Hecha con cambios</button>
      )}
      {error && <p className="mt-1 text-xs text-urgente" role="alert">{error}</p>}
    </div>
  );
}

export function NuevaExtra({ ingredientes }: { ingredientes: { id: string; nombre: string; unidad: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("extra");
  const [filas, setFilas] = useState([{ id: "", cantidad: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, empezar] = useTransition();

  if (!abierto) {
    return <button type="button" onClick={() => { setAbierto(true); setOk(false); }} className="w-full rounded-xl border border-dashed border-borde px-4 py-3 font-medium">
      {ok ? "✓ Apuntado. ¿Algo más fuera del plan?" : "+ Algo fuera del plan"}
    </button>;
  }
  return (
    <div className="space-y-2 rounded-xl border border-borde bg-superficie p-4">
      <p className="font-semibold">Algo fuera del plan</p>
      <p className="text-xs text-texto-suave">Sin culpa: apuntarlo sirve para que la despensa cuadre.</p>
      <div className="flex gap-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder="Tostada con aceite" aria-label="Qué has comido" className={`${campo} flex-1`} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Momento" className={campo}>
          <option value="extra">Picoteo</option><option value="desayuno">Desayuno</option><option value="media_manana">Media mañana</option>
          <option value="comida">Comida</option><option value="merienda">Merienda</option><option value="cena">Cena</option>
        </select>
      </div>
      {filas.map((f, k) => {
        const ing = ingredientes.find((i) => i.id === f.id);
        return (
          <div key={k} className="flex gap-2">
            <select value={f.id} onChange={(e) => setFilas(filas.map((x, j) => (j === k ? { ...x, id: e.target.value } : x)))} aria-label="Ingrediente" className={`${campo} flex-1`}>
              <option value="">Ingrediente (opcional)</option>
              {ingredientes.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
            <input inputMode="decimal" value={f.cantidad} onChange={(e) => setFilas(filas.map((x, j) => (j === k ? { ...x, cantidad: e.target.value } : x)))}
              placeholder={ing ? UD[ing.unidad] : "cant."} aria-label="Cantidad" className={`${campo} w-20`} />
          </div>
        );
      })}
      {filas.length < 5 && <button type="button" onClick={() => setFilas([...filas, { id: "", cantidad: "" }])} className="text-sm text-texto-suave underline">+ otro ingrediente</button>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={pendiente} onClick={() => empezar(async () => {
          const r = await registrarExtra(nombre, tipo, filas.filter((f) => f.id).map((f) => ({ ingrediente_id: f.id, cantidad: Number(f.cantidad.replace(",", ".")) || 0 })));
          if (r.error) setError(r.error);
          else { setError(null); setAbierto(false); setOk(true); setNombre(""); setFilas([{ id: "", cantidad: "" }]); }
        })} className="rounded-xl bg-marca px-3 py-2 font-semibold text-marca-texto disabled:opacity-60">Apuntar</button>
        <button type="button" onClick={() => setAbierto(false)} className="rounded-xl border border-borde px-3 py-2 font-medium">Cancelar</button>
      </div>
      {error && <p className="text-xs text-urgente" role="alert">{error}</p>}
    </div>
  );
}
