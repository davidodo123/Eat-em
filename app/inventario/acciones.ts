"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { fotoStock, revisarStockBajo } from "@/lib/stock";

// Ajuste manual del stock: "he gastado / he encontrado" (ajuste) o "se ha estropeado" (desperdicio).
// Todo pasa por el libro de movimientos; el trigger actualiza `inventario`.
export async function ajustarStock(ingredienteId: string, delta: number, tipo: "ajuste" | "desperdicio"): Promise<{ error?: string; aLista?: boolean }> {
  if (!ingredienteId || !Number.isFinite(delta) || delta === 0) return { error: "Ajuste no válido." };
  if (tipo === "desperdicio" && delta > 0) return { error: "Ajuste no válido." };
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Tu sesión ha caducado." };
  const hogar = await hogarActual(supabase);
  if (!hogar) return { error: "No tienes hogar." };

  const antes = await fotoStock(supabase, hogar.id, [ingredienteId]);
  const { error } = await supabase.from("inventario_movimientos").insert({
    grupo_id: hogar.id, ingrediente_id: ingredienteId, tipo, delta: Math.round(delta * 100) / 100, usuario_id: u.user.id,
    nota: tipo === "desperdicio" ? "tirado" : "ajuste manual",
  });
  if (error) return { error: "No se pudo guardar." };
  const bajos = delta < 0 ? await revisarStockBajo(supabase, hogar.id, u.user.id, antes) : [];
  revalidatePath("/inventario");
  if (bajos.length) revalidatePath("/lista");
  return { aLista: bajos.length > 0 };
}

// "Avisame cuando quede menos de X" (en la unidad del ingrediente). null quita el aviso.
export async function fijarUmbral(ingredienteId: string, umbral: number | null): Promise<{ error?: string }> {
  if (umbral !== null && !(Number.isFinite(umbral) && umbral > 0 && umbral < 100000)) return { error: "Cantidad no válida." };
  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  if (!hogar) return { error: "No tienes hogar." };
  const { error } = await supabase.from("inventario").update({ umbral_cantidad: umbral })
    .eq("grupo_id", hogar.id).eq("ingrediente_id", ingredienteId);
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/inventario");
  return {};
}
