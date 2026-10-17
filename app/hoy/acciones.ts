"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { fotoStock, revisarStockBajo } from "@/lib/stock";

const hoyMadrid = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });

export interface CantidadReal { ingrediente_id: string; cantidad: number }

// Hecha: descuenta del inventario del hogar los ingredientes planificados, o las cantidades
// reales si se pasan (los no enviados cuentan como no consumidos). Saltada: no descuenta.
export async function marcarComida(comidaId: number, estado: "hecha" | "saltada", reales?: CantidadReal[]): Promise<{ error?: string }> {
  if (reales && !reales.every((r) => r.ingrediente_id && Number.isFinite(r.cantidad) && r.cantidad >= 0 && r.cantidad <= 5000)) return { error: "Cantidades no válidas." };
  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  if (!hogar) return { error: "Necesitas un hogar para registrar comidas." };
  const { data: u } = await supabase.auth.getUser();
  const { data: ings } = await supabase.from("dieta_comida_ingredientes").select("ingrediente_id").eq("comida_id", comidaId);
  const antes = estado === "hecha" ? await fotoStock(supabase, hogar.id, (ings ?? []).map((i) => i.ingrediente_id)) : new Map();
  const { error } = await supabase.rpc("registrar_consumo", {
    p_grupo_id: hogar.id, p_estado: estado, p_dieta_comida_id: comidaId, p_fecha: hoyMadrid(),
    ...(reales ? { p_ingredientes: reales } : {}),
  });
  if (error) return { error: "No se pudo registrar." };
  if (u.user && antes.size) await revisarStockBajo(supabase, hogar.id, u.user.id, antes);
  revalidatePath("/hoy");
  revalidatePath("/inventario");
  revalidatePath("/lista");
  return {};
}

// Algo fuera del plan ("extra"): tambien descuenta del inventario lo que se indique
export async function registrarExtra(nombre: string, tipo: string, ingredientes: CantidadReal[]): Promise<{ error?: string }> {
  const n = nombre.trim().slice(0, 120);
  if (!n) return { error: "Ponle nombre (p. ej. «Tostada con aceite»)." };
  if (!["desayuno", "media_manana", "comida", "merienda", "cena", "extra"].includes(tipo)) return { error: "Tipo no válido." };
  const validos = ingredientes.filter((i) => i.ingrediente_id && i.cantidad > 0 && i.cantidad <= 5000);
  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  if (!hogar) return { error: "Necesitas un hogar para registrar comidas." };
  const { data: u } = await supabase.auth.getUser();
  const antes = await fotoStock(supabase, hogar.id, validos.map((i) => i.ingrediente_id));
  const { error } = await supabase.rpc("registrar_consumo", {
    p_grupo_id: hogar.id, p_estado: "extra", p_tipo: tipo, p_fecha: hoyMadrid(), p_nombre: n, p_ingredientes: validos,
  });
  if (error) return { error: "No se pudo registrar." };
  if (u.user && antes.size) await revisarStockBajo(supabase, hogar.id, u.user.id, antes);
  revalidatePath("/hoy");
  revalidatePath("/inventario");
  return {};
}

export async function deshacerComida(consumoId: number): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("deshacer_consumo", { p_consumo_id: consumoId });
  if (error) return { error: "No se pudo deshacer." };
  revalidatePath("/hoy");
  revalidatePath("/inventario");
  return {};
}
