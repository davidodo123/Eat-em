import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import type { UnidadBase } from "@/lib/dominio/formato";
import { AnadirADespensa, FilaDespensa, type FilaDespensaDatos } from "./componentes";
import { FilaInventario } from "../inventario/fila";
import { TiempoReal } from "../tiempo-real";
import { Cabecera, Pantalla, Seccion, SinHogar, Tarjeta, Vacio } from "../ui";

export const metadata: Metadata = { title: "Despensa · Eat-em" };

const FILTROS = [["", "Todo"], ["nevera", "Nevera"], ["congelador", "Congelador"], ["despensa", "Despensa"]] as const;

export default async function Despensa({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const { l = "" } = await searchParams;
  const filtro = FILTROS.some(([v]) => v === l) ? l : "";
  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  if (!hogar) return <Pantalla><Cabecera titulo="Despensa" /><SinHogar que="La despensa" /></Pantalla>;

  const [{ data: filas }, { data: stock }] = await Promise.all([
    supabase.from("despensa").select("id, nombre, unidades, lugar, caduca, ingrediente_id, productos (imagen_url, formato_texto, marca)")
      .eq("grupo_id", hogar.id).gt("unidades", 0).order("nombre"),
    supabase.from("inventario").select("ingrediente_id, cantidad, umbral_cantidad, ingredientes (nombre, unidad)").eq("grupo_id", hogar.id).gt("cantidad", 0),
  ]);

  const hoy = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }));
  const datos: FilaDespensaDatos[] = (filas ?? []).map((f) => {
    const p = f.productos as unknown as { imagen_url: string | null; formato_texto: string | null; marca: string | null } | null;
    return {
      id: f.id, nombre: f.nombre, imagen: p?.imagen_url ?? null, unidades: Number(f.unidades), lugar: f.lugar, caduca: f.caduca,
      detalle: [p?.marca, p?.formato_texto].filter(Boolean).join(" · ") || null,
      diasParaCaducar: f.caduca ? Math.round((new Date(f.caduca).getTime() - hoy.getTime()) / 864e5) : null,
    };
  });
  const visibles = datos.filter((d) => !filtro || d.lugar === filtro);
  const pronto = visibles.filter((d) => d.diasParaCaducar !== null && d.diasParaCaducar <= 3).sort((a, b) => a.diasParaCaducar! - b.diasParaCaducar!);
  const resto = visibles.filter((d) => !pronto.includes(d));

  // Ingredientes con stock que no estan como linea de la despensa (compras antiguas o de la dieta)
  const conLinea = new Set((filas ?? []).map((f) => f.ingrediente_id).filter(Boolean));
  const sueltos = (stock ?? []).filter((s) => !conLinea.has(s.ingrediente_id) && s.ingredientes);
  const total = datos.length;

  return (
    <Pantalla>
      <TiempoReal grupoId={hogar.id} tablas={["despensa", "inventario"]} />
      <Cabecera titulo="Despensa" sub={total ? `${total} ${total === 1 ? "producto" : "productos"} en casa` : "Lo que tenéis en casa"}
        accion={
          <Link href="/escanear" aria-label="Escanear código de barras" className="grid h-10 w-10 place-items-center rounded-full bg-marca text-marca-texto">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M8 8v8M11 8v8M14 8v8M17 8v8" /></svg>
          </Link>
        } />

      <div className="sticky top-0 z-10 -mx-4 bg-fondo/95 px-4 pb-3 pt-1 backdrop-blur">
        <AnadirADespensa />
        <nav aria-label="Filtrar por lugar" className="mt-3 flex gap-2 overflow-x-auto">
          {FILTROS.map(([v, t]) => (
            <Link key={v} href={v ? `/despensa?l=${v}` : "/despensa"} aria-current={filtro === v ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${filtro === v ? "bg-texto text-fondo" : "bg-superficie text-texto-suave shadow-[0_1px_0_var(--borde)]"}`}>{t}</Link>
          ))}
        </nav>
      </div>

      {!visibles.length && !sueltos.length && (
        <Vacio icono="🥫" titulo={filtro ? "Aquí no hay nada" : "La despensa está vacía"}
          texto="Busca arriba lo que tienes, escanea el código de barras o marca cosas como compradas en la lista." />
      )}

      {pronto.length > 0 && (
        <Seccion titulo="Caduca pronto">
          <Tarjeta><ul className="divide-y divide-borde">{pronto.map((f) => <FilaDespensa key={f.id} f={f} />)}</ul></Tarjeta>
        </Seccion>
      )}
      {resto.length > 0 && (
        <Seccion titulo={pronto.length ? "El resto" : undefined}>
          <Tarjeta><ul className="divide-y divide-borde">{resto.map((f) => <FilaDespensa key={f.id} f={f} />)}</ul></Tarjeta>
        </Seccion>
      )}

      {!filtro && sueltos.length > 0 && (
        <Seccion titulo="Ingredientes (para la dieta)">
          <Tarjeta className="px-4">
            <ul className="divide-y divide-borde">
              {sueltos.map((s) => {
                const i = s.ingredientes as unknown as { nombre: string; unidad: UnidadBase };
                const cantidad = Number(s.cantidad), umbral = s.umbral_cantidad === null ? null : Number(s.umbral_cantidad);
                return <FilaInventario key={s.ingrediente_id} id={s.ingrediente_id} nombre={i.nombre} cantidad={cantidad} unidad={i.unidad}
                  bajo={umbral !== null && cantidad < umbral} umbral={umbral} />;
              })}
            </ul>
          </Tarjeta>
        </Seccion>
      )}
    </Pantalla>
  );
}
