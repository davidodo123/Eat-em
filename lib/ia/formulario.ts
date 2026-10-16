// Lectura y validacion del formulario de perfil de salud (servidor).
import { ACTIVIDADES, CONDICIONES_MEDICAS, OBJETIVOS, type PerfilSalud } from "./perfil.ts";
import { ALERGENOS } from "../dominio/alergenos.ts";

export interface FormularioSalud extends PerfilSalud {
  comidas_dia: number;
  alergias: string[];
  dieta_tipo: "omnivora" | "vegetariana" | "vegana" | "pescetariana";
}

type Lector = { get(k: string): FormDataEntryValue | null; getAll(k: string): FormDataEntryValue[] };

const texto = (d: Lector, k: string) => String(d.get(k) ?? "").trim();
function numero(d: Lector, k: string, min: number, max: number) {
  const n = Number(texto(d, k).replace(",", "."));
  return texto(d, k) && Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 10) / 10 : null;
}
const de = <T extends string>(valor: string, permitidos: readonly T[]) => (permitidos.includes(valor as T) ? (valor as T) : null);

export function leerFormularioSalud(d: Lector, hoy = new Date()): { datos: FormularioSalud; errores: string[] } {
  const errores: string[] = [];
  const fecha = texto(d, "fecha_nacimiento");
  const fechaOk = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(Date.parse(fecha)) && Date.parse(fecha) < hoy.getTime()
    && Number(fecha.slice(0, 4)) > 1900;
  if (fecha && !fechaOk) errores.push("La fecha de nacimiento no es válida.");
  const altura = numero(d, "altura_cm", 100, 250);
  if (texto(d, "altura_cm") && altura === null) errores.push("La altura debe estar entre 100 y 250 cm.");
  const peso = numero(d, "peso_kg", 30, 300);
  if (texto(d, "peso_kg") && peso === null) errores.push("El peso debe estar entre 30 y 300 kg.");
  const sexo = de(texto(d, "sexo"), ["hombre", "mujer"] as const);
  const comidas = Number(texto(d, "comidas_dia"));

  return {
    errores,
    datos: {
      sexo,
      fecha_nacimiento: fechaOk ? fecha : null,
      altura_cm: altura,
      peso_kg: peso,
      actividad: de(texto(d, "actividad"), Object.keys(ACTIVIDADES) as (keyof typeof ACTIVIDADES)[]),
      objetivo: de(texto(d, "objetivo"), Object.keys(OBJETIVOS) as (keyof typeof OBJETIVOS)[]),
      // Embarazo y lactancia solo aplican si el sexo es mujer
      embarazo: sexo === "mujer" && d.get("embarazo") === "on",
      lactancia: sexo === "mujer" && d.get("lactancia") === "on",
      condiciones_medicas: [...new Set(d.getAll("condiciones_medicas").map(String))].filter((c) => c in CONDICIONES_MEDICAS),
      comidas_dia: Number.isInteger(comidas) && comidas >= 2 && comidas <= 6 ? comidas : 4,
      alergias: [...new Set(d.getAll("alergias").map(String))].filter((a) => (ALERGENOS as readonly string[]).includes(a)),
      dieta_tipo: de(texto(d, "dieta_tipo"), ["omnivora", "vegetariana", "vegana", "pescetariana"] as const) ?? "omnivora",
    },
  };
}
