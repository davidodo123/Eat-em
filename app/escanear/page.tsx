import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { Escaner, type IngredienteOpcion } from "./escaner";
import { Cabecera, Pantalla } from "../ui";

export const metadata: Metadata = { title: "Escanear · Eat-em" };

// Tienda por defecto: la del hogar (Castell de Ferro compra en Mercadona Motril)
const SUPER_POR_DEFECTO = "mercadona";

export default async function Escanear() {
  const supabase = await crearClienteServidor();
  const [hogar, { data: ingredientes }, { data: supermercados }] = await Promise.all([
    hogarActual(supabase),
    supabase.from("ingredientes").select("id, nombre, unidad, gramos_por_unidad").eq("activo", true).order("nombre"),
    supabase.from("supermercados").select("id, nombre").eq("activo", true).order("orden"),
  ]);

  return (
    <Pantalla>
      <Cabecera titulo="Escanear" volver={{ href: "/despensa", texto: "Despensa" }} />
      {!hogar ? (
        <p className="rounded-xl border border-borde bg-superficie p-4">
          Para apuntar compras necesitas un hogar. <Link href="/grupo" className="font-semibold text-marca">Crea uno o únete</Link>.
        </p>
      ) : (
        <Escaner
          ingredientes={(ingredientes ?? []).map((i) => ({ ...i, gramos_por_unidad: i.gramos_por_unidad === null ? null : Number(i.gramos_por_unidad) })) as IngredienteOpcion[]}
          supermercados={supermercados ?? []}
          superPorDefecto={SUPER_POR_DEFECTO}
        />
      )}
      <p className="mt-8 text-xs text-texto-suave">
        Datos de producto de <a href="https://world.openfoodfacts.org" className="underline">Open Food Facts</a> (licencia ODbL) y de las webs de cada tienda.
      </p>
    </Pantalla>
  );
}
