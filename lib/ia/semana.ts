// Del plan de la IA a las filas de dietas / dieta_comidas / dieta_comida_ingredientes.
import { DIAS, TIPOS_COMIDA, type Dia, type RespuestaPlan } from "./prompt.ts";

export interface UnidadIngrediente { unidad: "g" | "ml" | "unidad"; gramos_por_unidad: number | null }

export interface FilaComida {
  dia: Dia;
  tipo: (typeof TIPOS_COMIDA)[number];
  orden: number;
  nombre: string;
  preparacion: string;
  nota_dia: string;
  ingredientes: { ingrediente_id: string; cantidad: number }[];   // en la unidad del ingrediente
}

// Lunes (YYYY-MM-DD) de la semana de una fecha, en hora de Madrid
export function lunesDe(fecha = new Date()): string {
  const [a, m, d] = fecha.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }).split("-").map(Number);
  const local = new Date(Date.UTC(a, m - 1, d));
  const dow = (local.getUTCDay() + 6) % 7; // 0 = lunes
  local.setUTCDate(local.getUTCDate() - dow);
  return local.toISOString().slice(0, 10);
}

// Dia de la semana ("lunes"...) de una fecha, en hora de Madrid
export function diaDe(fecha = new Date()): Dia {
  const [a, m, d] = fecha.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }).split("-").map(Number);
  return DIAS[(new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7];
}

export function filasDelDia(plan: NonNullable<RespuestaPlan["plan"]>, unidades: Map<string, UnidadIngrediente>): FilaComida[] {
  const orden = (t: string) => TIPOS_COMIDA.indexOf(t as (typeof TIPOS_COMIDA)[number]);
  return [...plan.comidas]
    .sort((a, b) => orden(a.tipo) - orden(b.tipo))
    .map((c, i) => {
      const suma = new Map<string, number>();
      for (const x of c.ingredientes) {
        const u = unidades.get(x.ingrediente_id);
        if (!u) continue;
        const cantidad = enUnidadDelIngrediente(x.cantidad, x.unidad, u);
        if (cantidad > 0) suma.set(x.ingrediente_id, (suma.get(x.ingrediente_id) ?? 0) + cantidad);
      }
      return {
        dia: plan.dia, tipo: c.tipo, orden: i, nombre: c.nombre.slice(0, 200), preparacion: c.preparacion.slice(0, 500),
        nota_dia: plan.nota_dia.slice(0, 150),
        ingredientes: [...suma].map(([ingrediente_id, cantidad]) => ({ ingrediente_id, cantidad: Math.min(1000, Math.round(cantidad * 100) / 100) })),
      };
    });
}

function enUnidadDelIngrediente(cantidad: number, unidad: string, u: UnidadIngrediente): number {
  if (unidad === u.unidad || (unidad !== "unidad" && u.unidad !== "unidad")) return cantidad;   // igual, o g <-> ml
  if (u.unidad === "unidad") return u.gramos_por_unidad ? cantidad / u.gramos_por_unidad : 0;    // 120 g -> 1 platano
  return u.gramos_por_unidad ? cantidad * u.gramos_por_unidad : 0;                              // 2 unidades -> g
}
