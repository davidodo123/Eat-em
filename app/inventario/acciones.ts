"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";

// Ajuste manual del stock: "he gastado / he encontrado" (ajuste) o "se ha estropeado" (desperdicio).
// Todo pasa por el libro de movimientos; el trigger actualiza `inventario`.
export async function ajustarStock(ingredienteId: string, delta: number, tipo: "ajuste" | "desperdicio"): Promise<{ error?: string }> {
  if (!ingredienteId || !Number.isFinite(delta) || delta === 0) return { error: "Ajuste no válido." };
  if (tipo === "desperdicio" && delta > 0) return { error: "Ajuste no válido." };
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Tu sesión ha caducado." };
  const hogar = await hogarActual(supabase);
  if (!hogar) return { error: "No tienes hogar." };

  const { error } = await supabase.from("inventario_movimientos").insert({
    grupo_id: hogar.id, ingrediente_id: ingredienteId, tipo, delta: Math.round(delta * 100) / 100, usuario_id: u.user.id,
    nota: tipo === "desperdicio" ? "tirado" : "ajuste manual",
  });
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/inventario");
  return {};
}
