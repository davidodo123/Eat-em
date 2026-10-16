"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export interface EstadoGrupo {
  error?: string;
}

export async function crearHogar(_previo: EstadoGrupo, datos: FormData): Promise<EstadoGrupo> {
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 60);
  if (!nombre) return { error: "Ponle un nombre al hogar." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("crear_grupo", { p_nombre: nombre });
  if (error) return { error: "No se pudo crear el hogar." };
  revalidatePath("/", "layout");
  redirect("/grupo");
}

export async function unirseHogar(_previo: EstadoGrupo, datos: FormData): Promise<EstadoGrupo> {
  const codigo = String(datos.get("codigo") ?? "").trim();
  if (!/^[a-z0-9]{8}$/i.test(codigo)) return { error: "El código tiene 8 letras y números." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("unirse_grupo", { p_codigo: codigo });
  if (error) return { error: /no valido/.test(error.message) ? "Ese código no existe." : "No se pudo unir al hogar." };
  revalidatePath("/", "layout");
  redirect("/grupo");
}
