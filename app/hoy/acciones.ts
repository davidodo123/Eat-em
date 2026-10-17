"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { fotoStock, revisarStockBajo } from "@/lib/stock";

const hoyMadrid = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });

// Hecha: descuenta los ingredientes planificados del inventario del hogar. Saltada: no descuenta.
export async function marcarComida(comidaId: number, estado: "hecha" | "saltada"): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  if (!hogar) return { error: "Necesitas un hogar para registrar comidas." };
  const { data: u } = await supabase.auth.getUser();
  const { data: ings } = await supabase.from("dieta_comida_ingredientes").select("ingrediente_id").eq("comida_id", comidaId);
  const antes = estado === "hecha" ? await fotoStock(supabase, hogar.id, (ings ?? []).map((i) => i.ingrediente_id)) : new Map();
  const { error } = await supabase.rpc("registrar_consumo", {
    p_grupo_id: hogar.id, p_estado: estado, p_dieta_comida_id: comidaId, p_fecha: hoyMadrid(),
  });
  if (error) return { error: "No se pudo registrar." };
  if (u.user && antes.size) await revisarStockBajo(supabase, hogar.id, u.user.id, antes);
  revalidatePath("/hoy");
  revalidatePath("/inventario");
  revalidatePath("/lista");
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
