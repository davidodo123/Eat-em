// Lista de la compra automatica: lo que piden las dietas del hogar en los proximos dias
// menos lo que hay en la despensa.

export interface Consumo { ingrediente_id: string; cantidad: number; diasDesdeHoy: number } // 0 = hoy
export interface Falta { ingrediente_id: string; necesario: number; stock: number; falta: number; urgente: boolean }

// horizonte: dias a cubrir contando hoy (3, 7 o 14). Urgente = no llega ni para lo de hoy.
export function calcularFaltas(consumos: Consumo[], stock: Map<string, number>, horizonte: number): Falta[] {
  const total = new Map<string, number>();
  const hoy = new Map<string, number>();
  for (const c of consumos) {
    if (c.diasDesdeHoy < 0 || c.diasDesdeHoy >= horizonte || !(c.cantidad > 0)) continue;
    total.set(c.ingrediente_id, (total.get(c.ingrediente_id) ?? 0) + c.cantidad);
    if (c.diasDesdeHoy === 0) hoy.set(c.ingrediente_id, (hoy.get(c.ingrediente_id) ?? 0) + c.cantidad);
  }
  const faltas: Falta[] = [];
  for (const [id, necesario] of total) {
    const hay = stock.get(id) ?? 0;
    const falta = Math.round((necesario - hay) * 100) / 100;
    if (falta > 0) faltas.push({ ingrediente_id: id, necesario, stock: hay, falta, urgente: hay < (hoy.get(id) ?? 0) });
  }
  return faltas.sort((a, b) => Number(b.urgente) - Number(a.urgente) || a.ingrediente_id.localeCompare(b.ingrediente_id));
}

// Envases necesarios para cubrir la falta con un formato (en la unidad del ingrediente)
export function paquetesPara(falta: number, porPaquete: number | null): number | null {
  return porPaquete && porPaquete > 0 ? Math.max(1, Math.ceil(falta / porPaquete - 1e-9)) : null;
}

// Indice de un dia de la semana ("lunes" = 0) y su distancia a hoy dentro de dos semanas
export function diasDesdeHoy(semanaDelPlan: 0 | 1, diaIndice: number, hoyIndice: number): number {
  return semanaDelPlan * 7 + diaIndice - hoyIndice;
}
