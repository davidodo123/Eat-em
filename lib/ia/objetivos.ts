// Objetivos diarios calculados en codigo (especificacion §4, punto 3):
// Mifflin-St Jeor x factor de actividad, ajuste por objetivo, minimos de seguridad,
// proteina 1,8 g/kg, grasa 0,8 g/kg e hidratos con el resto.
import { ACTIVIDADES, OBJETIVOS, type Actividad, type Objetivo } from "./perfil.ts";

export interface DatosObjetivos {
  sexo: "hombre" | "mujer";
  edad: number;
  altura_cm: number;
  peso_kg: number;
  actividad: Actividad;
  objetivo: Objetivo;
}

export interface Objetivos {
  tmb: number;          // metabolismo basal
  gasto: number;        // TMB x actividad
  kcal: number;
  proteina_g: number;
  grasa_g: number;
  hidratos_g: number;
  minimo_aplicado: boolean;
}

export const KCAL_MINIMAS = { hombre: 1500, mujer: 1200 } as const;

export function calcularObjetivos(d: DatosObjetivos): Objetivos {
  const tmb = 10 * d.peso_kg + 6.25 * d.altura_cm - 5 * d.edad + (d.sexo === "hombre" ? 5 : -161);
  const gasto = tmb * ACTIVIDADES[d.actividad];
  const ajustadas = gasto * (1 + OBJETIVOS[d.objetivo]);
  const minimo = KCAL_MINIMAS[d.sexo];
  const kcal = Math.round(Math.max(ajustadas, minimo) / 10) * 10;

  const proteina_g = Math.round(1.8 * d.peso_kg);
  const grasa_g = Math.round(0.8 * d.peso_kg);
  const hidratos_g = Math.max(0, Math.round((kcal - proteina_g * 4 - grasa_g * 9) / 4));
  return { tmb: Math.round(tmb), gasto: Math.round(gasto), kcal, proteina_g, grasa_g, hidratos_g, minimo_aplicado: ajustadas < minimo };
}
