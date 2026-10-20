"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { buscar } from "./catalogo";
import type { Oferta, ResultadoProducto } from "@/lib/catalogo";

const CADENA: Record<string, string> = { mercadona: "Mercadona", carrefour: "Carrefour", ahorramas: "Ahorramás", gadis: "Gadis", caprabo: "Caprabo" };
const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const ppu = (o: Oferta) => (o.ppu && o.unidadPrecio ? `${eur(o.ppu)}/${o.unidadPrecio === "unidad" ? "ud" : o.unidadPrecio}` : null);

// Buscador de productos de los supermercados: escribe y toca para elegir.
// `onTexto` permite anadir lo escrito tal cual (papel de cocina, pilas...).
export function Buscador({ placeholder, onElegir, onTexto, textoBoton = "Añadir" }: {
  placeholder: string;
  onElegir: (r: ResultadoProducto, o: Oferta) => Promise<string | void>;
  onTexto?: (texto: string) => Promise<string | void>;
  textoBoton?: string;
}) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ResultadoProducto[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [buscando, empezarBusqueda] = useTransition();
  const [, empezar] = useTransition();
  const ultima = useRef("");
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setResultados(null); return; }
    const espera = setTimeout(() => {
      ultima.current = t;
      empezarBusqueda(async () => {
        const r = await buscar(t);
        if (ultima.current === t) { setResultados(r.resultados); if (r.error) setAviso(r.error); }
      });
    }, 250);
    return () => clearTimeout(espera);
  }, [q]);

  const hecho = (msg: string | void, nombre: string) => {
    setAviso(msg || `Añadido: ${nombre}`);
    if (!msg) { setQ(""); setResultados(null); entrada.current?.blur(); }
    setTimeout(() => setAviso(null), 2200);
  };
  const cerrar = () => { setQ(""); setResultados(null); entrada.current?.blur(); };

  return (
    <div className="relative">
      {/* Fondo que tapa la pantalla mientras hay resultados: tocarlo los cierra */}
      {resultados && <div aria-hidden onClick={cerrar} className="fixed inset-0 z-20 bg-fondo/75 backdrop-blur-[2px]" />}
      <div className="relative z-30 flex items-center gap-2 rounded-2xl border border-borde bg-superficie pl-4 pr-2 transition-shadow focus-within:border-marca focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--marca)_22%,transparent)]">
        <input ref={entrada} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} enterKeyHint="search"
          onKeyDown={(e) => { if (e.key === "Escape") cerrar(); }} aria-label={placeholder} className="min-w-0 flex-1 !border-0 !bg-transparent py-3.5 text-base !shadow-none outline-none" />
        {buscando && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-marca border-t-transparent" aria-label="Buscando" />}
        {q && !buscando && <button type="button" onClick={() => setQ("")} className="px-2 text-sm font-semibold text-texto-suave">Borrar</button>}
      </div>

      {aviso && <p role="status" className="relative z-30 mt-2 px-1 text-sm font-medium text-marca">{aviso}</p>}

      {resultados && (
        <div className="caja absolute inset-x-0 top-full z-30 mt-2 overflow-hidden shadow-[0_16px_40px_rgb(0_0_0/0.16)]">
          {onTexto && q.trim().length >= 2 && (
            <button type="button" onClick={() => empezar(async () => hecho(await onTexto(q.trim()), q.trim()))}
              className="flex w-full items-center gap-3 border-b border-borde px-4 py-3 text-left active:bg-borde/40">
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">«{q.trim()}»</span><span className="text-sm text-texto-suave">{textoBoton} tal cual</span></span>
              <span className="text-sm font-semibold text-marca">{textoBoton}</span>
            </button>
          )}
          {!resultados.length && !buscando && <p className="px-4 py-6 text-center text-sm text-texto-suave">Nada con «{q.trim()}» en tus supermercados.</p>}
          <ul className="max-h-[55dvh] divide-y divide-borde overflow-y-auto overscroll-contain">
            {resultados.map((r) => {
              const mejor = r.ofertas[0];
              return (
                <li key={r.clave}>
                  <button type="button" onClick={() => empezar(async () => hecho(await onElegir(r, mejor), r.nombre))}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-borde/40">
                    {r.imagen
                      ? <img src={r.imagen} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-0.5" />
                      : null}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[0.95rem] font-medium leading-snug">{r.nombre}</span>
                      <span className="block truncate text-xs text-texto-suave">
                        {[r.marca, r.formato].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums">{mejor.precio !== null ? eur(mejor.precio) : "—"}</span>
                      <span className="block text-[0.7rem] text-texto-suave">
                        {CADENA[mejor.cadena] ?? mejor.cadena}{r.ofertas.length > 1 ? ` +${r.ofertas.length - 1}` : ""}
                      </span>
                      {ppu(mejor) && <span className="block text-[0.7rem] tabular-nums text-texto-suave">{ppu(mejor)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
