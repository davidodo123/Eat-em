"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { anadirItem, marcarComprado, quitarItem, type EstadoLista } from "./acciones";
import { listaParaWhatsapp, type ItemTexto } from "@/lib/dominio/lista";

const campo = "block w-full rounded-xl border border-borde bg-superficie px-3 py-2.5 text-base outline-none focus:border-marca";

export function NuevoItem({ ingredientes }: { ingredientes: { id: string; nombre: string }[] }) {
  const [estado, accion, enviando] = useActionState<EstadoLista, FormData>(anadirItem, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado.ok) form.current?.reset(); }, [estado.ok]);
  return (
    <form ref={form} action={accion} className="space-y-2 rounded-xl border border-borde bg-superficie p-3">
      <select name="ingrediente_id" defaultValue="" aria-label="Ingrediente" className={campo}>
        <option value="">— Otra cosa (escríbela) —</option>
        {ingredientes.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
      </select>
      <input name="texto" maxLength={120} placeholder="Papel de cocina, pilas…" aria-label="Texto libre" className={campo} />
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="urgente" className="h-5 w-5" /> Urgente</label>
        <button type="submit" disabled={enviando} className="rounded-xl bg-marca px-4 py-2.5 font-semibold text-marca-texto disabled:opacity-60">
          {enviando ? "Añadiendo…" : "Añadir"}
        </button>
      </div>
      {estado.error && <p className="text-sm text-urgente" role="alert">{estado.error}</p>}
    </form>
  );
}

export function ItemLista({ id, nombre, detalle, urgente, ingredienteId }: {
  id: number; nombre: string; detalle: string | null; urgente: boolean; ingredienteId: string | null;
}) {
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  if (hecho) return null;
  return (
    <li className="flex items-center gap-3 py-2">
      <button type="button" aria-label={`Comprado: ${nombre}`}
        onClick={() => empezar(async () => { setHecho(true); const r = await marcarComprado(id); if (r.error) { setHecho(false); setError(r.error); } })}
        className="h-7 w-7 shrink-0 rounded-full border-2 border-marca" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{urgente && <span className="text-urgente">❗ </span>}{nombre}</p>
        {detalle && <p className="text-sm text-texto-suave">{detalle}</p>}
        {error && <p className="text-xs text-urgente" role="alert">{error}</p>}
      </div>
      {ingredienteId && (
        <a href={`/comparar?i=${ingredienteId}`} aria-label={`Comparar precios de ${nombre}`} title="¿Dónde sale más barato?" className="px-1 text-texto-suave">€</a>
      )}
      <button type="button" aria-label={`Quitar ${nombre}`}
        onClick={() => empezar(async () => { setHecho(true); const r = await quitarItem(id); if (r.error) { setHecho(false); setError(r.error); } })}
        className="px-2 text-texto-suave">✕</button>
    </li>
  );
}

export function CopiarWhatsapp({ titulo, items }: { titulo: string; items: ItemTexto[] }) {
  const [copiado, setCopiado] = useState(false);
  const texto = listaParaWhatsapp(titulo, items);
  return (
    <div className="flex gap-2">
      <button type="button" disabled={!items.length}
        onClick={async () => { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
        className="flex-1 rounded-xl border border-borde px-3 py-2.5 font-medium disabled:opacity-50">
        {copiado ? "✓ Copiada" : "Copiar lista"}
      </button>
      <a href={items.length ? `https://wa.me/?text=${encodeURIComponent(texto)}` : undefined} target="_blank" rel="noopener noreferrer"
        aria-disabled={!items.length} className="flex-1 rounded-xl border border-borde px-3 py-2.5 text-center font-medium aria-disabled:opacity-50">
        Enviar por WhatsApp
      </a>
    </div>
  );
}
