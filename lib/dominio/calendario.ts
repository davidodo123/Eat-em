// Fechas como texto ISO (YYYY-MM-DD), sin zonas horarias: se opera en UTC a mediodia.
export const DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

const fecha = (iso: string) => new Date(`${iso}T12:00:00Z`);
const texto = (d: Date) => d.toISOString().slice(0, 10);

export const esFecha = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && texto(fecha(iso)) === iso;

export function sumarDias(iso: string, n: number): string {
  const d = fecha(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return texto(d);
}

// 0 = lunes ... 6 = domingo
export const indiceDia = (iso: string) => (fecha(iso).getUTCDay() + 6) % 7;
export const diaSemana = (iso: string): DiaSemana => DIAS_SEMANA[indiceDia(iso)];
export const lunesDeLaSemana = (iso: string) => sumarDias(iso, -indiceDia(iso));
export const semanaDe = (iso: string) => Array.from({ length: 7 }, (_, i) => sumarDias(lunesDeLaSemana(iso), i));

// Cuadricula del mes (semanas completas de lunes a domingo) que contiene `iso`
export function cuadriculaMes(iso: string): string[] {
  const primero = `${iso.slice(0, 7)}-01`;
  const inicio = lunesDeLaSemana(primero);
  const siguienteMes = sumarDias(primero, 32).slice(0, 7);
  const dias: string[] = [];
  for (let d = inicio; d.slice(0, 7) !== siguienteMes || indiceDia(d) !== 0; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

export const mismoMes = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);
export const numeroDia = (iso: string) => Number(iso.slice(8, 10));
