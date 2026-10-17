import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { formatearCantidad } from "@/lib/dominio/cantidad";
import type { UnidadBase } from "@/lib/dominio/formato";
import { FilaInventario } from "./fila";
import { TiempoReal } from "../tiempo-real";

export const metadata: Metadata = { title: "Inventario · Eat-em" };

const TIPO: Record<string, string> = { compra: "compró", consumo: "consumió", ajuste: "ajustó", desperdicio: "tiró" };

export default async function Inventario() {
  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  if (!hogar) {
    return (
      <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10">
        <Link href="/" className="text-sm text-texto-suave">← Inicio</Link>
        <h1 className="mt-2 mb-4 text-2xl font-bold">Inventario</h1>
        <p className="rounded-xl border border-borde bg-superficie p-4">
          El inventario es del hogar. <Link href="/grupo" className="font-semibold text-marca">Crea uno o únete</Link>.
        </p>
      </main>
    );
  }

  const [{ data: stock }, { data: ingredientes }, { data: categorias }, { data: movimientos }] = await Promise.all([
    supabase.from("inventario").select("ingrediente_id, cantidad, umbral_cantidad").eq("grupo_id", hogar.id),
    supabase.from("ingredientes").select("id, nombre, unidad, categoria_id"),
    supabase.from("categorias").select("id, nombre, orden").order("orden"),
    supabase.from("inventario_movimientos").select("id, ingrediente_id, tipo, delta, usuario_id, created_at")
      .eq("grupo_id", hogar.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const ing = new Map((ingredientes ?? []).map((i) => [i.id, i]));
  const ids = [...new Set((movimientos ?? []).map((m) => m.usuario_id).filter(Boolean))] as string[];
  const nombres = new Map(ids.length
    ? ((await supabase.from("perfiles").select("id, nombre").in("id", ids)).data ?? []).map((p) => [p.id, p.nombre])
    : []);

  const filas = (stock ?? [])
    .map((s) => ({ ...s, cantidad: Number(s.cantidad), umbral: s.umbral_cantidad === null ? null : Number(s.umbral_cantidad), i: ing.get(s.ingrediente_id) }))
    .filter((f) => f.i && f.cantidad > 0);
  const grupos = (categorias ?? [])
    .map((c) => ({ ...c, filas: filas.filter((f) => f.i!.categoria_id === c.id).sort((a, b) => a.i!.nombre.localeCompare(b.i!.nombre)) }))
    .filter((g) => g.filas.length);
  const sinCategoria = filas.filter((f) => !f.i!.categoria_id);

  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10">
      <Link href="/" className="text-sm text-texto-suave">← Inicio</Link>
      <TiempoReal grupoId={hogar.id} tablas={["inventario"]} />
      <div className="mt-2 mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventario</h1>
        <Link href="/escanear" className="rounded-xl bg-marca px-3 py-2 text-sm font-semibold text-marca-texto">+ Escanear</Link>
      </div>

      {!filas.length && (
        <p className="rounded-xl border border-borde bg-superficie p-4 text-texto-suave">
          No hay nada en la despensa todavía. Escanea lo que compres para ir llenándola.
        </p>
      )}

      {[...grupos, ...(sinCategoria.length ? [{ id: 0, nombre: "Otros", orden: 999, filas: sinCategoria }] : [])].map((g) => (
        <section key={g.id} className="mb-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">{g.nombre}</h2>
          <ul className="divide-y divide-borde rounded-xl border border-borde bg-superficie px-3">
            {g.filas.map((f) => (
              <FilaInventario key={f.ingrediente_id} id={f.ingrediente_id} nombre={f.i!.nombre} cantidad={f.cantidad}
                unidad={f.i!.unidad as UnidadBase} bajo={f.umbral !== null && f.cantidad < f.umbral} umbral={f.umbral} />
            ))}
          </ul>
        </section>
      ))}

      {!!movimientos?.length && (
        <section className="mt-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">Últimos movimientos</h2>
          <ul className="space-y-1 text-sm">
            {movimientos.map((m) => {
              const i = ing.get(m.ingrediente_id);
              return (
                <li key={m.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {(m.usuario_id && nombres.get(m.usuario_id)) || "Alguien"} {TIPO[m.tipo] ?? m.tipo}{" "}
                    {i ? `${formatearCantidad(Math.abs(Number(m.delta)), i.unidad as UnidadBase)} de ${i.nombre.toLowerCase()}` : m.ingrediente_id}
                  </span>
                  <time className="shrink-0 text-texto-suave" dateTime={m.created_at}>
                    {new Date(m.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" })}
                  </time>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
