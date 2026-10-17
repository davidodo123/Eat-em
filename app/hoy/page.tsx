import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { diaDe, lunesDe } from "@/lib/ia/semana";
import { formatearCantidad } from "@/lib/dominio/cantidad";
import type { UnidadBase } from "@/lib/dominio/formato";
import { BotonesComida, NuevaExtra } from "./comida";

export const metadata: Metadata = { title: "Hoy · Eat-em" };

const NOMBRE_TIPO: Record<string, string> = { desayuno: "Desayuno", media_manana: "Media mañana", comida: "Comida", merienda: "Merienda", cena: "Cena", extra: "Extra" };

export default async function Hoy() {
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const { data: dieta } = await supabase.from("dietas").select("id")
    .eq("usuario_id", u.user!.id).eq("semana_inicio", lunesDe()).eq("estado", "activa").maybeSingle();
  const [{ data: comidas }, { data: consumos }, { data: ings }] = await Promise.all([
    dieta ? supabase.from("dieta_comidas").select("id, tipo, nombre, preparacion, dieta_comida_ingredientes (ingrediente_id, cantidad)")
      .eq("dieta_id", dieta.id).eq("dia", diaDe()).order("orden") : Promise.resolve({ data: [] }),
    supabase.from("consumos").select("id, dieta_comida_id, estado, nombre, tipo").eq("usuario_id", u.user!.id).eq("fecha", hoy),
    supabase.from("ingredientes").select("id, nombre, unidad"),
  ]);
  const ing = new Map((ings ?? []).map((i) => [i.id, i]));
  const consumo = new Map((consumos ?? []).filter((c) => c.dieta_comida_id).map((c) => [c.dieta_comida_id as number, c]));
  const hechas = (comidas ?? []).filter((c) => consumo.get(c.id)?.estado === "hecha").length;

  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10">
      <Link href="/" className="text-sm text-texto-suave">← Inicio</Link>
      <h1 className="mt-2 text-2xl font-bold">Hoy</h1>
      <p className="mb-4 text-sm text-texto-suave">
        {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" })}
        {comidas?.length ? ` · ${hechas} de ${comidas.length} comidas hechas` : ""}
      </p>

      {!comidas?.length && (
        <p className="rounded-xl border border-borde bg-superficie p-4">
          No hay comidas planificadas para hoy. <Link href="/dieta" className="font-semibold text-marca">Genera tu semana</Link>.
        </p>
      )}
      <ul className="space-y-3">
        {(comidas ?? []).map((c) => {
          const k = consumo.get(c.id);
          return (
            <li key={c.id} className={`rounded-xl border bg-superficie p-4 ${k?.estado === "hecha" ? "border-marca/50" : "border-borde"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-marca">{NOMBRE_TIPO[c.tipo]}</p>
              <p className="font-medium">{c.nombre}</p>
              <ul className="mb-3 text-sm text-texto-suave">
                {(c.dieta_comida_ingredientes as { ingrediente_id: string; cantidad: number }[]).map((x) => {
                  const i = ing.get(x.ingrediente_id);
                  return <li key={x.ingrediente_id}>{i?.nombre ?? x.ingrediente_id}: {formatearCantidad(Number(x.cantidad), (i?.unidad ?? "g") as UnidadBase)}</li>;
                })}
              </ul>
              <BotonesComida comidaId={c.id} consumo={k ? { id: k.id, estado: k.estado } : null}
                ingredientes={(c.dieta_comida_ingredientes as { ingrediente_id: string; cantidad: number }[]).map((x) => ({
                  id: x.ingrediente_id, nombre: ing.get(x.ingrediente_id)?.nombre ?? x.ingrediente_id,
                  cantidad: Number(x.cantidad), unidad: ing.get(x.ingrediente_id)?.unidad ?? "g",
                }))} />
            </li>
          );
        })}
      </ul>

      {(consumos ?? []).some((c) => c.estado === "extra") && (
        <section className="mt-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">Fuera del plan</h2>
          <ul className="space-y-1 text-sm">
            {(consumos ?? []).filter((c) => c.estado === "extra").map((c) => (
              <li key={c.id} className="flex justify-between rounded-lg border border-borde bg-superficie px-3 py-2">
                <span>{c.nombre ?? "Extra"}</span><span className="text-texto-suave">{NOMBRE_TIPO[c.tipo] ?? c.tipo}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-4"><NuevaExtra ingredientes={(ings ?? []).map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad }))} /></div>
      <p className="mt-6 text-xs text-texto-suave">Un día distinto no arruina nada: retoma en la siguiente comida, sin compensar.</p>
    </main>
  );
}
