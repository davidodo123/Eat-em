// Validacion posterior del plan que devuelve la IA (especificacion §4, punto 6, y
// ARQUITECTURA.md §8.3): ids validos, cantidades razonables, alergenos, tipo de dieta,
// exclusiones, numero de comidas y suma real de kcal y macros frente al objetivo.
import type { Objetivos } from "./objetivos.ts";
import type { RespuestaPlan } from "./prompt.ts";

export interface IngredienteNutricion {
  id: string;
  unidad: "g" | "ml" | "unidad";
  gramos_por_unidad: number | null;
  kcal_100: number | null; proteinas_100: number | null; grasas_100: number | null; hidratos_100: number | null;
  alergenos: string[];
  etiquetas: string[];
}

export interface ContextoValidacion {
  ingredientes: Map<string, IngredienteNutricion>;
  objetivos: Objetivos;
  comidasDia: number;
  alergias: string[];
  exclusiones: string[];
  dietaTipo: "omnivora" | "vegetariana" | "vegana" | "pescetariana";
  // Tolerancias (fraccion del objetivo)
  toleranciaKcal?: number;       // por defecto 0,10
  toleranciaProteina?: number;   // por defecto 0,15
}

export interface Totales { kcal: number; proteina_g: number; grasa_g: number; hidratos_g: number }

// El codigo hace las cuentas: escala las cantidades del dia para acercar las kcal al objetivo
// (el modelo pequeno se queda corto o se pasa). Factor limitado a 0,7-1,8; g y ml se redondean
// a 5 y las unidades a entero (minimo 1). Devuelve una copia.
export function ajustarAKcal(r: RespuestaPlan, c: ContextoValidacion): RespuestaPlan {
  if (r.estado !== "ok" || !r.plan) return r;
  let kcal = 0;
  for (const comida of r.plan.comidas) for (const x of comida.ingredientes) {
    const ing = c.ingredientes.get(x.ingrediente_id);
    const g = ing ? aGramos(x.cantidad, x.unidad, ing) : null;
    if (ing && g !== null) kcal += ((ing.kcal_100 ?? 0) * g) / 100;
  }
  if (kcal <= 0) return r;
  const factor = Math.min(1.8, Math.max(0.7, c.objetivos.kcal / kcal));
  if (Math.abs(factor - 1) < 0.03) return r;
  return {
    ...r,
    plan: {
      ...r.plan,
      comidas: r.plan.comidas.map((m) => ({
        ...m,
        ingredientes: m.ingredientes.map((x) => ({
          ...x,
          cantidad: x.unidad === "unidad"
            ? Math.max(1, Math.round(x.cantidad * factor))
            : Math.min(1000, Math.max(5, Math.round((x.cantidad * factor) / 5) * 5)),
        })),
      })),
    },
  };
}

export function validarPlan(r: RespuestaPlan, c: ContextoValidacion): { errores: string[]; totales: Totales | null } {
  const errores: string[] = [];
  if (r.estado === "falta_dato") {
    if (r.plan || r.mensaje) errores.push('Con estado "falta_dato" plan y mensaje deben ser null.');
    if (!r.pregunta?.trim()) errores.push('Con estado "falta_dato" hay que hacer una pregunta.');
    else if ((r.pregunta.match(/\?/g) ?? []).length > 1) errores.push("Haz UNA sola pregunta.");
    return { errores, totales: null };
  }
  if (r.estado === "derivar_profesional") {
    if (r.plan || r.pregunta) errores.push('Con estado "derivar_profesional" plan y pregunta deben ser null.');
    if (!r.mensaje?.trim()) errores.push("Falta el mensaje de derivacion.");
    else if (/\d{3,}\s*(kcal|calor)/i.test(r.mensaje)) errores.push("El mensaje de derivacion no debe llevar cifras de calorias.");
    return { errores, totales: null };
  }
  if (!r.plan) return { errores: ['Con estado "ok" falta el plan.'], totales: null };
  if (r.pregunta || r.mensaje) errores.push('Con estado "ok" pregunta y mensaje deben ser null.');
  if (r.plan.nota_dia.length > 150) errores.push("nota_dia supera 150 caracteres.");

  const principales = r.plan.comidas.filter((m) => m.tipo !== "extra");
  if (principales.length !== c.comidasDia) errores.push(`El plan tiene ${principales.length} comidas y deben ser ${c.comidasDia}.`);
  const tipos = principales.map((m) => m.tipo);
  if (new Set(tipos).size !== tipos.length) errores.push("Hay tipos de comida repetidos.");

  const t: Totales = { kcal: 0, proteina_g: 0, grasa_g: 0, hidratos_g: 0 };
  for (const comida of r.plan.comidas) {
    if (!comida.ingredientes.length) errores.push(`"${comida.nombre}" no tiene ingredientes.`);
    for (const x of comida.ingredientes) {
      const ing = c.ingredientes.get(x.ingrediente_id);
      if (!ing) { errores.push(`Ingrediente inventado: "${x.ingrediente_id}" no esta en INGREDIENTES_DISPONIBLES.`); continue; }
      const maximo = x.unidad === "unidad" ? 12 : 1000;
      if (!(x.cantidad > 0 && x.cantidad <= maximo)) errores.push(`Cantidad no razonable de ${x.ingrediente_id}: ${x.cantidad} ${x.unidad}.`);
      const gramos = aGramos(x.cantidad, x.unidad, ing);
      if (gramos === null) { errores.push(`${x.ingrediente_id} va en ${ing.unidad}, no en ${x.unidad}.`); continue; }

      const alergeno = ing.alergenos.find((a) => c.alergias.includes(a));
      if (alergeno) errores.push(`${x.ingrediente_id} contiene ${alergeno}, al que el usuario es alergico.`);
      if (c.exclusiones.includes(x.ingrediente_id)) errores.push(`${x.ingrediente_id} esta en las exclusiones del usuario.`);
      const motivo = incompatible(ing.etiquetas, c.dietaTipo);
      if (motivo) errores.push(`${x.ingrediente_id} no es apto para una dieta ${c.dietaTipo} (${motivo}).`);

      const f = gramos / 100;
      t.kcal += (ing.kcal_100 ?? 0) * f;
      t.proteina_g += (ing.proteinas_100 ?? 0) * f;
      t.grasa_g += (ing.grasas_100 ?? 0) * f;
      t.hidratos_g += (ing.hidratos_100 ?? 0) * f;
    }
  }
  for (const k of Object.keys(t) as (keyof Totales)[]) t[k] = Math.round(t[k]);

  const o = c.objetivos;
  const tk = c.toleranciaKcal ?? 0.1;
  const tp = c.toleranciaProteina ?? 0.15;
  if (Math.abs(t.kcal - o.kcal) > o.kcal * tk)
    errores.push(`El dia suma ${t.kcal} kcal y el objetivo es ${o.kcal} (±${Math.round(tk * 100)} %). Ajusta las cantidades.`);
  // La proteina es un minimo (ficha 003): se exige no quedarse corto y se tolera un exceso razonable
  if (t.proteina_g < o.proteina_g * (1 - tp) || t.proteina_g > o.proteina_g * 1.3)
    errores.push(`El dia suma ${t.proteina_g} g de proteina y el objetivo es ${o.proteina_g} g (minimo -${Math.round(tp * 100)} %, maximo +30 %).`);
  return { errores, totales: t };
}

// Cantidad en gramos (ml ~ g) para la nutricion por 100 g/ml
function aGramos(cantidad: number, unidad: string, ing: IngredienteNutricion): number | null {
  if (unidad === ing.unidad) return ing.unidad === "unidad" ? (ing.gramos_por_unidad ? cantidad * ing.gramos_por_unidad : null) : cantidad;
  if (unidad !== "unidad" && ing.unidad !== "unidad") return cantidad;                      // g <-> ml
  if (unidad === "unidad" && ing.gramos_por_unidad) return cantidad * ing.gramos_por_unidad; // 2 platanos
  if (ing.unidad === "unidad" && unidad === "g") return cantidad;                             // 120 g de platano
  return null;
}

function incompatible(etiquetas: string[], dieta: ContextoValidacion["dietaTipo"]): string | null {
  if (dieta === "vegana" && !etiquetas.includes("vegano")) return "no es vegano";
  if (dieta === "vegetariana" && (etiquetas.includes("carne") || etiquetas.includes("pescado"))) return "carne o pescado";
  if (dieta === "pescetariana" && etiquetas.includes("carne")) return "carne";
  return null;
}
