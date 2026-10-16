// Prefiltro de seguridad ANTES de llamar a la IA (especificacion §4, punto 2).
// Si falta un dato imprescindible devuelve "falta_dato" (antes, con peso o altura
// vacios, el IMC salia NaN y se dejaba pasar: ARQUITECTURA.md §8.4).
import { edad, imc, type PerfilSalud } from "./perfil.ts";

export type ResultadoPrefiltro =
  | { estado: "ok"; edad: number; imc: number }
  | { estado: "falta_dato"; campo: keyof PerfilSalud; pregunta: string }
  | { estado: "derivar_profesional"; motivo: "menor" | "embarazo" | "lactancia" | "condicion_medica" | "imc_bajo"; mensaje: string };

const MENSAJE =
  "Con lo que nos cuentas, lo más seguro es que un profesional sanitario (medicina o dietética-nutrición) " +
  "te ayude a ajustar la alimentación. Eat-em puede seguir ayudándote con la despensa y la lista de la compra.";

export function prefiltro(p: PerfilSalud, hoy = new Date()): ResultadoPrefiltro {
  // 1) Derivaciones que no dependen de los datos numericos
  if (p.embarazo) return { estado: "derivar_profesional", motivo: "embarazo", mensaje: MENSAJE };
  if (p.lactancia) return { estado: "derivar_profesional", motivo: "lactancia", mensaje: MENSAJE };
  if (p.condiciones_medicas.length) return { estado: "derivar_profesional", motivo: "condicion_medica", mensaje: MENSAJE };

  // 2) Datos imprescindibles
  if (!p.fecha_nacimiento || !/^\d{4}-\d{2}-\d{2}$/.test(p.fecha_nacimiento))
    return { estado: "falta_dato", campo: "fecha_nacimiento", pregunta: "¿Cuál es tu fecha de nacimiento?" };
  const e = edad(p.fecha_nacimiento, hoy);
  if (e < 18) return { estado: "derivar_profesional", motivo: "menor", mensaje: MENSAJE };
  if (!p.sexo) return { estado: "falta_dato", campo: "sexo", pregunta: "Para calcular tu energía, ¿usamos la fórmula de hombre o de mujer?" };
  if (!(p.altura_cm && p.altura_cm >= 100 && p.altura_cm <= 250))
    return { estado: "falta_dato", campo: "altura_cm", pregunta: "¿Cuánto mides (en cm)?" };
  if (!(p.peso_kg && p.peso_kg >= 30 && p.peso_kg <= 300))
    return { estado: "falta_dato", campo: "peso_kg", pregunta: "¿Cuánto pesas ahora (en kg)?" };
  if (!p.actividad) return { estado: "falta_dato", campo: "actividad", pregunta: "¿Cómo de activo es tu día a día?" };
  if (!p.objetivo) return { estado: "falta_dato", campo: "objetivo", pregunta: "¿Qué te gustaría conseguir?" };

  // 3) IMC bajo: posible riesgo, no se da plan (salvaguarda de TCA)
  const i = imc(p.peso_kg, p.altura_cm);
  if (i < 18.5) return { estado: "derivar_profesional", motivo: "imc_bajo", mensaje: MENSAJE };
  return { estado: "ok", edad: e, imc: Math.round(i * 10) / 10 };
}
