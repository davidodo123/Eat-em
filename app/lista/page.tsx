import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { formatearCantidad } from "@/lib/dominio/cantidad";
import type { UnidadBase } from "@/lib/dominio/formato";
import { CopiarWhatsapp, ItemLista, NuevoItem } from "./componentes";
import { TiempoReal } from "../tiempo-real";

export const metadata: Metadata = { title: "Lista de la compra · Eat-em" };

export default async function Lista() {
  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  if (!hogar) {
    return (
      <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10">
        <Link href="/" className="text-sm text-texto-suave">← Inicio</Link>
        <h1 className="mt-2 mb-4 text-2xl font-bold">Lista de la compra</h1>
        <p className="rounded-xl border border-borde bg-superficie p-4">
          La lista es del hogar. <Link href="/grupo" className="font-semibold text-marca">Crea uno o únete</Link>.
        </p>
      </main>
    );
  }

  const [{ data: items }, { data: ingredientes }, { data: categorias }] = await Promise.all([
    supabase.from("lista_items").select("id, ingrediente_id, texto_libre, cantidad, paquetes, urgente")
      .eq("grupo_id", hogar.id).eq("comprado", false).order("created_at"),
    supabase.from("ingredientes").select("id, nombre, unidad, categoria_id").eq("activo", true).order("nombre"),
    supabase.from("categorias").select("id, nombre"),
  ]);
  const ing = new Map((ingredientes ?? []).map((i) => [i.id, i]));
  const cat = new Map((categorias ?? []).map((c) => [c.id, c.nombre]));

  const filas = (items ?? []).map((it) => {
    const i = it.ingrediente_id ? ing.get(it.ingrediente_id) : undefined;
    const detalle = it.paquetes ? `${it.paquetes} ${it.paquetes === 1 ? "paquete" : "paquetes"}`
      : it.cantidad && i ? formatearCantidad(Number(it.cantidad), i.unidad as UnidadBase) : null;
    return {
      id: it.id, nombre: i?.nombre ?? it.texto_libre ?? "?", detalle, urgente: it.urgente,
      categoria: (i?.categoria_id && cat.get(i.categoria_id)) || "Otros",
    };
  });
  const porCategoria = [...new Set(filas.map((f) => f.categoria))].sort((a, b) => (a === "Otros" ? 1 : b === "Otros" ? -1 : a.localeCompare(b, "es")));

  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10">
      <Link href="/" className="text-sm text-texto-suave">← Inicio</Link>
      <h1 className="mt-2 mb-4 text-2xl font-bold">Lista de la compra</h1>
      <TiempoReal grupoId={hogar.id} tablas={["lista_items"]} />

      <NuevoItem ingredientes={(ingredientes ?? []).map(({ id, nombre }) => ({ id, nombre }))} />

      <div className="my-4">
        <CopiarWhatsapp titulo={`Lista de ${hogar.nombre}`} items={filas} />
      </div>

      {!filas.length && <p className="text-center text-texto-suave">No falta nada. 🎉</p>}
      {porCategoria.map((c) => (
        <section key={c} className="mb-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">{c}</h2>
          <ul className="divide-y divide-borde rounded-xl border border-borde bg-superficie px-3">
            {filas.filter((f) => f.categoria === c).map((f) => (
              <ItemLista key={f.id} id={f.id} nombre={f.nombre} detalle={f.detalle} urgente={f.urgente} />
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-6 text-xs text-texto-suave">Al marcar un ingrediente como comprado se suma a la despensa del hogar.</p>
    </main>
  );
}
