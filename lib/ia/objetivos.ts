// Objetivos diarios calculados en codigo (especificacion §4, punto 3):
// Mifflin-St Jeor x factor de actividad, ajuste por objetivo, minimos de seguridad,
// proteina 1,8 g/kg, grasa 0,8 g/kg e hidratos con el resto.
import { ACTIVIDADES, OBJETIVOS, type Actividad, type Objetivo, type PerfilSalud } from "./perfil.ts";
import { prefiltro } from "./prefiltro.ts";

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

// Fila de perfiles_salud -> objetivos, con las mismas salvaguardas que el plan: sin consentimiento
// o sin datos no hay objetivos ("falta_perfil") y si hay que derivar a un profesional no se dan ("derivar").
export function objetivosDeFila(s: {
  consentimiento_salud_en: string | null; sexo: PerfilSalud["sexo"]; fecha_nacimiento: string | null;
  altura_cm: number | string | null; peso_kg: number | string | null; actividad: Actividad | null; objetivo: Objetivo | null;
  embarazo: boolean; lactancia: boolean; condiciones_medicas: string[] | null;
} | null, hoy = new Date()): Objetivos | "falta_perfil" | "derivar" {
  if (!s?.consentimiento_salud_en) return "falta_perfil";
  const p: PerfilSalud = {
    sexo: s.sexo, fecha_nacimiento: s.fecha_nacimiento, altura_cm: s.altura_cm === null ? null : Number(s.altura_cm),
    peso_kg: s.peso_kg === null ? null : Number(s.peso_kg), actividad: s.actividad, objetivo: s.objetivo,
    embarazo: s.embarazo, lactancia: s.lactancia, condiciones_medicas: s.condiciones_medicas ?? [],
  };
  const f = prefiltro(p, hoy);
  if (f.estado === "derivar_profesional") return "derivar";
  if (f.estado === "falta_dato") return "falta_perfil";
  return calcularObjetivos({ sexo: p.sexo!, edad: f.edad, altura_cm: p.altura_cm!, peso_kg: p.peso_kg!, actividad: p.actividad!, objetivo: p.objetivo! });
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
