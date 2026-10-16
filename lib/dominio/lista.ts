// Texto de la lista de la compra para pegar en WhatsApp, agrupado por categoria.
export interface ItemTexto {
  nombre: string;
  detalle?: string | null;   // "2 paquetes", "1,5 kg"
  categoria?: string | null;
  urgente?: boolean;
}

export function listaParaWhatsapp(titulo: string, items: ItemTexto[]): string {
  const grupos = new Map<string, ItemTexto[]>();
  for (const it of items) {
    const c = it.categoria || "Otros";
    grupos.set(c, [...(grupos.get(c) ?? []), it]);
  }
  const lineas = [`*${titulo}*`];
  for (const [categoria, lista] of [...grupos].sort(([a], [b]) => (a === "Otros" ? 1 : b === "Otros" ? -1 : a.localeCompare(b, "es")))) {
    lineas.push("", `_${categoria}_`);
    for (const it of lista.sort((a, b) => Number(!!b.urgente) - Number(!!a.urgente) || a.nombre.localeCompare(b.nombre, "es"))) {
      lineas.push(`- ${it.urgente ? "❗ " : ""}${it.nombre}${it.detalle ? ` (${it.detalle})` : ""}`);
    }
  }
  return lineas.join("\n");
}
