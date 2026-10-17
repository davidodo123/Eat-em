"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { avisar, otrosMiembros } from "@/lib/push";

export interface EstadoLista { error?: string; ok?: number }

export async function anadirItem(_previo: EstadoLista, datos: FormData): Promise<EstadoLista> {
  const ingredienteId = String(datos.get("ingrediente_id") ?? "") || null;
  const texto = String(datos.get("texto") ?? "").trim().slice(0, 120) || null;
  const urgente = datos.get("urgente") === "on";
  if (!ingredienteId && !texto) return { error: "Elige un ingrediente o escribe qué falta." };

  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Tu sesión ha caducado." };
  const hogar = await hogarActual(supabase);
  if (!hogar) return { error: "No tienes hogar." };

  const { error } = await supabase.from("lista_items").insert({
    grupo_id: hogar.id, ingrediente_id: ingredienteId, texto_libre: ingredienteId ? null : texto,
    urgente, origen: "manual", anadido_por: u.user.id,
  });
  if (error) return { error: error.code === "23505" ? "Ya está en la lista." : "No se pudo añadir." };
  revalidatePath("/lista");

  // Aviso a los demas del hogar (si lo tienen activado)
  const [{ data: yo }, { data: ing }] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", u.user.id).single(),
    ingredienteId ? supabase.from("ingredientes").select("nombre").eq("id", ingredienteId).single() : Promise.resolve({ data: null }),
  ]);
  const que = (ing?.nombre ?? texto ?? "algo").toLowerCase();
  await avisar(await otrosMiembros(hogar.id, u.user.id), {
    tipo: "item_anadido", grupoId: hogar.id, url: "/lista",
    titulo: urgente ? "❗ Urgente en la lista" : "Lista de la compra",
    cuerpo: `${yo?.nombre || "Alguien"} ha añadido ${que}`,
  });
  return { ok: Date.now() };
}

// Comprado: si es un ingrediente, marcar_comprado() lo mete tambien en el inventario
export async function marcarComprado(itemId: number): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("marcar_comprado", { p_item_id: itemId });
  if (error) return { error: "No se pudo marcar." };
  revalidatePath("/lista");
  revalidatePath("/inventario");
  return {};
}

export async function quitarItem(itemId: number): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("lista_items").delete().eq("id", itemId).eq("comprado", false);
  if (error) return { error: "No se pudo quitar." };
  revalidatePath("/lista");
  return {};
}
