import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { DIAS } from "@/lib/ia/prompt";
import { diaDe, lunesDe } from "@/lib/ia/semana";
import { formatearCantidad } from "@/lib/dominio/cantidad";
import type { UnidadBase } from "@/lib/dominio/formato";
import { BotonGenerar } from "./boton";

export const metadata: Metadata = { title: "Dieta · Eat-em" };
// Generar la semana son 7 llamadas a la IA: las Server Actions de esta pagina necesitan tiempo
export const maxDuration = 300;

const NOMBRE_DIA: Record<string, string> = { lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves", viernes: "Viernes", sabado: "Sábado", domingo: "Domingo" };
const NOMBRE_TIPO: Record<string, string> = { desayuno: "Desayuno", media_manana: "Media mañana", comida: "Comida", merienda: "Merienda", cena: "Cena", extra: "Extra" };

export default async function Dieta() {
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  const { data: dieta } = await supabase.from("dietas").select("id, objetivos, semana_inicio")
    .eq("usuario_id", u.user!.id).eq("semana_inicio", lunesDe()).eq("estado", "activa").maybeSingle();
  const [{ data: comidas }, { data: ings }] = await Promise.all([
    dieta ? supabase.from("dieta_comidas").select("id, dia, tipo, orden, nombre, preparacion, nota_dia, dieta_comida_ingredientes (ingrediente_id, cantidad)")
      .eq("dieta_id", dieta.id).order("orden") : Promise.resolve({ data: [] }),
    supabase.from("ingredientes").select("id, nombre, unidad"),
  ]);
  const ing = new Map((ings ?? []).map((i) => [i.id, i]));
  const hoy = diaDe();
  const objetivos = dieta?.objetivos as { kcal: number; proteina_g: number } | null;

  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10">
      <Link href="/" className="text-sm text-texto-suave">← Inicio</Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold">Tu semana</h1>
      {objetivos && <p className="mb-4 text-sm text-texto-suave">Objetivo diario: {objetivos.kcal.toLocaleString("es-ES")} kcal · {objetivos.proteina_g} g de proteína</p>}

      <div className="mb-6"><BotonGenerar hayPlan={Boolean(dieta)} iaLista={Boolean(process.env.OPENAI_API_KEY)} /></div>

      {!dieta && <p className="text-texto-suave">Aún no tienes plan para esta semana.</p>}
      {DIAS.map((d) => {
        const delDia = (comidas ?? []).filter((c) => c.dia === d);
        if (!delDia.length) return null;
        return (
          <details key={d} open={d === hoy} className="mb-3 rounded-xl border border-borde bg-superficie">
            <summary className="cursor-pointer px-4 py-3 font-semibold">{NOMBRE_DIA[d]}{d === hoy ? " · hoy" : ""}</summary>
            <div className="space-y-3 px-4 pb-4">
              {delDia[0].nota_dia && <p className="text-sm text-texto-suave">{delDia[0].nota_dia}</p>}
              {delDia.map((c) => (
                <div key={c.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-marca">{NOMBRE_TIPO[c.tipo]}</p>
                  <p className="font-medium">{c.nombre}</p>
                  <ul className="text-sm text-texto-suave">
                    {(c.dieta_comida_ingredientes as { ingrediente_id: string; cantidad: number }[]).map((x) => {
                      const i = ing.get(x.ingrediente_id);
                      return <li key={x.ingrediente_id}>{i?.nombre ?? x.ingrediente_id}: {formatearCantidad(Number(x.cantidad), (i?.unidad ?? "g") as UnidadBase)}</li>;
                    })}
                  </ul>
                  {c.preparacion && <p className="mt-1 text-sm">{c.preparacion}</p>}
                </div>
              ))}
            </div>
          </details>
        );
      })}
      <p className="mt-8 text-xs text-texto-suave">Plan orientativo generado con IA y revisado por reglas de seguridad. Eat-em no sustituye a un profesional sanitario.</p>
    </main>
  );
}
