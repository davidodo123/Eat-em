import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { BotonPreferido } from "./preferido";

export const metadata: Metadata = { title: "Comparar precios · Eat-em" };

interface Fila {
  supermercado_id: string; producto_id: number; nombre: string; marca: string | null; imagen_url: string | null;
  precio: number; precio_por_unidad: number; unidad_precio: string; fuente: "web" | "usuario"; fecha: string;
}

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

export default async function Comparar({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const { i } = await searchParams;
  const supabase = await crearClienteServidor();
  const [{ data: ingredientes }, { data: supers }] = await Promise.all([
    supabase.from("ingredientes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("supermercados").select("id, nombre"),
  ]);
  const elegido = ingredientes?.find((x) => x.id === i);
  const { data, error } = elegido
    ? await supabase.rpc("comparar_precios", { p_ingrediente: elegido.id })
    : { data: null, error: null };
  const filas = ((data ?? []) as Fila[]).sort((a, b) => a.precio_por_unidad - b.precio_por_unidad);
  const hogar = elegido ? await hogarActual(supabase) : null;
  const preferido = hogar
    ? (await supabase.from("inventario").select("producto_preferido_id").eq("grupo_id", hogar.id).eq("ingrediente_id", elegido!.id).maybeSingle()).data?.producto_preferido_id ?? null
    : null;
  const nombreSuper = new Map((supers ?? []).map((s) => [s.id, s.nombre]));

  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10">
      <Link href="/ajustes" className="text-sm font-medium text-marca">‹ Ajustes</Link>
      <h1 className="mt-2 mb-4 text-2xl font-bold">¿Dónde sale más barato?</h1>

      <form className="mb-4 flex gap-2">
        <select name="i" defaultValue={elegido?.id ?? ""} aria-label="Ingrediente"
          className="flex-1 rounded-xl border border-borde bg-superficie px-3 py-2.5 text-base">
          <option value="" disabled>Elige un ingrediente</option>
          {(ingredientes ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <button className="rounded-xl bg-marca px-4 font-semibold text-marca-texto">Ver</button>
      </form>

      {error && <p className="rounded-xl border border-borde p-4 text-sm text-texto-suave">El comparador aún no está disponible (falta aplicar la migración de la base).</p>}
      {elegido && !error && !filas.length && (
        <p className="rounded-xl border border-borde bg-superficie p-4 text-sm text-texto-suave">
          Todavía no hay precios para {elegido.nombre.toLowerCase()}. Se irán llenando con las webs de las tiendas y con lo que escaneéis.
        </p>
      )}
      <ol className="space-y-2">
        {filas.map((f, k) => (
          <li key={f.supermercado_id} className={`flex gap-3 rounded-xl border bg-superficie p-3 ${k === 0 ? "border-marca" : "border-borde"}`}>
            {f.imagen_url && (
              // eslint-disable-next-line @next/next/no-img-element -- imagenes de muchas tiendas distintas
              <img src={f.imagen_url} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-white object-contain" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{k === 0 && "🏆 "}{nombreSuper.get(f.supermercado_id) ?? f.supermercado_id}</p>
              <p className="truncate text-sm">{f.nombre}</p>
              <p className="text-xs text-texto-suave">
                {f.fuente === "usuario"
                  ? `Precio apuntado el ${new Date(f.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" })}`
                  : "Precio de la web"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">{euros(f.precio_por_unidad)}<span className="text-xs font-normal">/{f.unidad_precio === "unidad" ? "ud" : f.unidad_precio}</span></p>
              <p className="text-sm text-texto-suave">{euros(f.precio)}</p>
              {hogar && <BotonPreferido ingredienteId={elegido!.id} productoId={f.producto_id} elegido={preferido === f.producto_id} />}
            </div>
          </li>
        ))}
      </ol>
      {filas.length > 0 && <p className="mt-4 text-xs text-texto-suave">Precio por kg, litro o unidad, con la oferta aplicada. Los precios online pueden no coincidir con los de tu tienda.</p>}
    </main>
  );
}
