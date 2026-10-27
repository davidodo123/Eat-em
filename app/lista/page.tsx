import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { NOMBRE_CADENA, zonaDelHogar } from "@/lib/zona";
import { formatearCantidad } from "@/lib/dominio/cantidad";
import type { UnidadBase } from "@/lib/dominio/formato";
import { AnadirALista, Compartir, ItemLista, RecalcularLista, type FilaLista } from "./componentes";
import { TiempoReal } from "../tiempo-real";
import { Cabecera, Pantalla, Seccion, SinHogar, Tarjeta, Vacio, euros } from "../ui";

export const metadata: Metadata = { title: "Lista · Eat-em" };

interface Prod { nombre: string; imagen_url: string | null; supermercado_id: string | null; formato_texto: string | null; precio: number | null; precio_oferta: number | null; oferta_hasta: string | null }

const precioDe = (p: Prod) => {
  const oferta = p.precio_oferta !== null && (!p.oferta_hasta || p.oferta_hasta >= new Date().toISOString().slice(0, 10));
  const v = oferta ? p.precio_oferta : p.precio;
  return v === null ? null : Number(v);
};

type Barato = { precio: number; tienda: string; nombre: string };

// El mas barato de cada ingrediente en las tiendas cercanas, en un solo viaje (migracion 12).
// Si la migracion aun no esta aplicada, una llamada a comparar_precios por ingrediente.
async function preciosMinimos(supabase: SupabaseClient, ids: string[], tiendas: string[] | null): Promise<Map<string, Barato | null>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase.rpc("precios_minimos", { p_ingredientes: ids, p_supermercados: tiendas });
  if (!error) {
    const filas = data as { ingrediente_id: string; supermercado_id: string; nombre: string; precio: number }[];
    return new Map(filas.map((f) => [f.ingrediente_id, { precio: Number(f.precio), tienda: f.supermercado_id, nombre: f.nombre }]));
  }
  return new Map(await Promise.all(ids.map(async (id) => {
    const { data } = await supabase.rpc("comparar_precios", { p_ingrediente: id });
    const filas = ((data ?? []) as { supermercado_id: string; nombre: string; precio: number }[])
      .filter((f) => !tiendas || tiendas.includes(f.supermercado_id));
    const mejor = filas.sort((a, b) => Number(a.precio) - Number(b.precio))[0];
    return [id, mejor ? { precio: Number(mejor.precio), tienda: mejor.supermercado_id, nombre: mejor.nombre } : null] as const;
  })));
}

export default async function Lista() {
  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  if (!hogar) return <Pantalla><Cabecera titulo="Lista" /><SinHogar que="La lista de la compra" /></Pantalla>;

  const zona = zonaDelHogar(hogar);
  const { data: items } = await supabase.from("lista_items")
    .select("id, ingrediente_id, texto_libre, cantidad, paquetes, urgente, origen, ingredientes (nombre, unidad), productos (nombre, imagen_url, supermercado_id, formato_texto, precio, precio_oferta, oferta_hasta)")
    .eq("grupo_id", hogar.id).eq("comprado", false).order("created_at");

  // Lineas de ingrediente generico (las de la dieta): el mas barato de las tiendas cercanas
  const genericos = [...new Set((items ?? []).filter((i) => i.ingrediente_id && !i.productos).map((i) => i.ingrediente_id as string))];
  const masBarato = await preciosMinimos(supabase, genericos, zona.buscarEn);

  let total = 0;
  const filas: (FilaLista & { auto: boolean })[] = (items ?? []).map((it) => {
    const p = it.productos as unknown as Prod | null;
    const ing = it.ingredientes as unknown as { nombre: string; unidad: UnidadBase } | null;
    const n = it.paquetes ?? 1;
    if (p) {
      const precio = precioDe(p);
      if (precio !== null) total += precio * n;
      return {
        id: it.id, nombre: p.nombre, detalle: p.formato_texto, precio: precio !== null ? euros(precio) : null,
        tienda: p.supermercado_id ? NOMBRE_CADENA[p.supermercado_id] ?? p.supermercado_id : null,
        urgente: it.urgente, paquetes: n, esProducto: true, imagen: p.imagen_url, auto: it.origen === "auto",
      };
    }
    const barato = it.ingrediente_id ? masBarato.get(it.ingrediente_id) : null;
    if (barato && it.paquetes) total += barato.precio * it.paquetes;
    const cantidad = it.paquetes ? `${it.paquetes} ${it.paquetes === 1 ? "paquete" : "paquetes"}`
      : it.cantidad && ing ? formatearCantidad(Number(it.cantidad), ing.unidad) : null;
    return {
      id: it.id, nombre: ing?.nombre ?? it.texto_libre ?? "?", detalle: cantidad,
      precio: barato ? `desde ${euros(barato.precio)}` : null, tienda: barato ? NOMBRE_CADENA[barato.tienda] ?? barato.tienda : null,
      urgente: it.urgente, paquetes: it.paquetes, esProducto: false, imagen: null, auto: it.origen === "auto",
    };
  });
  const orden = (a: FilaLista, b: FilaLista) => Number(b.urgente) - Number(a.urgente);
  const dieta = filas.filter((f) => f.auto).sort(orden);
  const manual = filas.filter((f) => !f.auto).sort(orden);

  return (
    <Pantalla>
      <TiempoReal grupoId={hogar.id} tablas={["lista_items"]} />
      <Cabecera titulo="Lista"
        accion={<Compartir titulo={`Lista de ${hogar.nombre}`} items={filas.map((f) => ({ nombre: f.nombre, detalle: f.detalle, urgente: f.urgente }))} />}
        sub={
          <Link href="/ubicacion" className="font-medium text-marca underline decoration-marca/30 underline-offset-4">
            {zona.lugar ? `${zona.lugar} · ${zona.buscarEn ? zona.buscarEn.map((c) => NOMBRE_CADENA[c]).join(", ") : "todas las tiendas"}` : "Pon tu ubicación para ver tus supermercados"}
          </Link>
        } />

      <div className="sticky top-0 z-10 -mx-4 bg-fondo/95 px-4 pb-3 pt-1 backdrop-blur"><AnadirALista /></div>

      <div className="mb-5"><RecalcularLista dias={hogar.dias_planificacion ?? 7} /></div>

      {!filas.length && <Vacio titulo="No falta nada" texto="Busca arriba un producto o pulsa «¿Qué me falta?» para calcularlo con tu dieta." />}

      {manual.length > 0 && (
        <Seccion titulo="Añadido por vosotros">
          <Tarjeta><ul className="divide-y divide-borde">{manual.map((f) => <ItemLista key={f.id} f={f} />)}</ul></Tarjeta>
        </Seccion>
      )}
      {dieta.length > 0 && (
        <Seccion titulo="Te falta para la dieta">
          <Tarjeta><ul className="divide-y divide-borde">{dieta.map((f) => <ItemLista key={f.id} f={f} />)}</ul></Tarjeta>
        </Seccion>
      )}

      {total > 0 && (
        <div className="flex items-baseline justify-between px-1 text-sm">
          <span className="text-texto-suave">Estimado</span>
          <span className="text-lg font-bold tabular-nums">{euros(total)}</span>
        </div>
      )}
      <p className="mt-4 px-1 text-xs text-texto-suave">Lo que marcas como comprado pasa a la despensa.</p>
    </Pantalla>
  );
}
