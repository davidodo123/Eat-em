import "server-only";
import { unstable_cache } from "next/cache";
import { crearClienteAdmin } from "@/lib/supabase/server";

// Datos reales para la pagina publica (/entrar): precios del comparador para una cesta
// semanal de muestra de dos personas. Las cantidades son de ejemplo; los precios, los de
// las webs de las tiendas (y los apuntados con el escaner) en el momento de la consulta.
export const CESTA: { id: string; nombre: string; cantidad: number; texto: string }[] = [
  { id: "leche_semidesnatada", nombre: "Leche semidesnatada", cantidad: 6, texto: "6 l" },
  { id: "huevo", nombre: "Huevos", cantidad: 12, texto: "12 uds" },
  { id: "pechuga_pollo", nombre: "Pechuga de pollo", cantidad: 1, texto: "1 kg" },
  { id: "arroz_blanco", nombre: "Arroz", cantidad: 1, texto: "1 kg" },
  { id: "yogur_natural", nombre: "Yogur natural", cantidad: 1, texto: "1 kg" },
  { id: "tomate", nombre: "Tomate", cantidad: 1.5, texto: "1,5 kg" },
  { id: "garbanzos_cocidos", nombre: "Garbanzos", cantidad: 1, texto: "1 kg" },
  { id: "aceite_oliva", nombre: "Aceite de oliva virgen extra", cantidad: 1, texto: "1 l" },
];

export interface PrecioTienda { tienda: string; producto: string; precio: number; ppu: number; unidad: string }
export interface LineaTicket { id: string; nombre: string; texto: string; cantidad: number; tiendas: PrecioTienda[]; mejor: PrecioTienda | null; coste: number | null }
export interface Ticket { lineas: LineaTicket[]; total: number; tiendaUnica: { tienda: string; total: number } | null; productos: number; tiendas: number }

const NOMBRES: Record<string, string> = { carrefour: "Carrefour", mercadona: "Mercadona", ahorramas: "Ahorramás", gadis: "Gadis", caprabo: "Caprabo" };

async function cargar(): Promise<Ticket> {
  const db = crearClienteAdmin();
  const lineas: LineaTicket[] = [];
  for (const item of CESTA) {
    const { data } = await db.rpc("comparar_precios", { p_ingrediente: item.id });
    const tiendas = ((data ?? []) as { supermercado_id: string; nombre: string; precio: number; precio_por_unidad: number; unidad_precio: string }[])
      .map((r) => ({ tienda: NOMBRES[r.supermercado_id] ?? r.supermercado_id, producto: r.nombre, precio: Number(r.precio), ppu: Number(r.precio_por_unidad), unidad: r.unidad_precio }))
      .sort((a, b) => a.ppu - b.ppu);
    const mejor = tiendas[0] ?? null;
    lineas.push({ ...item, tiendas, mejor, coste: mejor ? Math.round(mejor.ppu * item.cantidad * 100) / 100 : null });
  }
  // Toda la cesta en una sola tienda (la que tiene todo y sale mas barata) frente a la mejor de cada linea
  const conPrecio = lineas.filter((l) => l.mejor);
  const tiendasTodas = new Set(conPrecio.flatMap((l) => l.tiendas.map((t) => t.tienda)));
  let tiendaUnica: Ticket["tiendaUnica"] = null;
  for (const t of tiendasTodas) {
    if (!conPrecio.every((l) => l.tiendas.some((x) => x.tienda === t))) continue;
    const total = Math.round(conPrecio.reduce((s, l) => s + l.tiendas.find((x) => x.tienda === t)!.ppu * l.cantidad, 0) * 100) / 100;
    if (!tiendaUnica || total < tiendaUnica.total) tiendaUnica = { tienda: t, total };
  }
  const { count: productos } = await db.from("productos").select("id", { count: "exact", head: true }).not("supermercado_id", "is", null);
  const { data: tiendasConProductos } = await db.from("scraper_ejecuciones").select("supermercado_id").eq("estado", "ok");
  return {
    lineas,
    total: Math.round(conPrecio.reduce((s, l) => s + (l.coste ?? 0), 0) * 100) / 100,
    tiendaUnica,
    productos: productos ?? 0,
    tiendas: new Set((tiendasConProductos ?? []).map((t) => t.supermercado_id)).size,
  };
}

// Se recalcula como mucho cada 6 horas (los precios se cargan una vez al dia)
export const ticketDeMuestra = unstable_cache(cargar, ["landing-ticket-v2"], { revalidate: 60 * 60 * 6 });

export const euros = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
