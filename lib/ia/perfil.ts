// Perfil de salud tal como lo usan el prefiltro y el calculo de objetivos (Fase 6).
// Todo en codigo: la IA nunca calcula ni decide si es seguro dar un plan.

export const ACTIVIDADES = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, alto: 1.725 } as const;
export type Actividad = keyof typeof ACTIVIDADES;
export const OBJETIVOS = { perder_grasa: -0.15, ganar_musculo: 0.07, mantenimiento: 0 } as const;
export type Objetivo = keyof typeof OBJETIVOS;

// Condiciones que obligan a derivar a un profesional (salvaguarda 015)
export const CONDICIONES_MEDICAS = {
  diabetes: "Diabetes",
  renal: "Enfermedad renal",
  hepatica: "Enfermedad hepática",
  cardiovascular: "Enfermedad cardiovascular o hipertensión",
  anticoagulantes: "Tomo anticoagulantes",
  tca: "Trastorno de la conducta alimentaria (actual o pasado)",
  otra: "Otra condición médica o medicación relevante",
} as const;

export interface PerfilSalud {
  sexo: "hombre" | "mujer" | null;
  fecha_nacimiento: string | null;   // YYYY-MM-DD
  altura_cm: number | null;
  peso_kg: number | null;
  actividad: Actividad | null;
  objetivo: Objetivo | null;
  embarazo: boolean;
  lactancia: boolean;
  condiciones_medicas: string[];
}

// Edad cumplida en una fecha (por defecto hoy)
export function edad(fechaNacimiento: string, hoy = new Date()): number {
  const [a, m, d] = fechaNacimiento.split("-").map(Number);
  let e = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) e--;
  return e;
}

export const imc = (pesoKg: number, alturaCm: number) => pesoKg / (alturaCm / 100) ** 2;
