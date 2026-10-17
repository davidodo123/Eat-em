"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";

// Producto que el hogar suele comprar para un ingrediente (inventario.producto_preferido_id).
// Si el ingrediente aun no esta en la despensa, se crea la fila con cantidad 0.
export async function elegirPreferido(ingredienteId: string, productoId: number | null): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  if (!hogar) return { error: "Necesitas un hogar." };
  const { error } = await supabase.from("inventario").upsert(
    { grupo_id: hogar.id, ingrediente_id: ingredienteId, producto_preferido_id: productoId },
    { onConflict: "grupo_id,ingrediente_id", ignoreDuplicates: false },
  );
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/comparar");
  revalidatePath("/lista");
  return {};
}
