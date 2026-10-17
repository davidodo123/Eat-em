"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";

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

// Dias que cubre la lista automatica (solo el admin del hogar, segun RLS)
export async function cambiarDias(_previo: EstadoGrupo, datos: FormData): Promise<EstadoGrupo> {
  const dias = Number(datos.get("dias"));
  if (![3, 7, 14].includes(dias)) return { error: "Elige 3, 7 o 14 días." };
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  const hogar = await hogarActual(supabase);
  if (!u.user || !hogar) return { error: "No tienes hogar." };
  const { data: yo } = await supabase.from("grupo_miembros").select("rol")
    .eq("grupo_id", hogar.id).eq("usuario_id", u.user.id).maybeSingle();
  if (yo?.rol !== "admin") return { error: "Solo quien administra el hogar puede cambiarlo." };
  // RLS filtra en silencio: se comprueba que de verdad se actualizo la fila
  const { data, error } = await supabase.from("grupos").update({ dias_planificacion: dias }).eq("id", hogar.id).select("id");
  if (error || !data?.length) return { error: "No se pudo guardar." };
  revalidatePath("/grupo");
  revalidatePath("/lista");
  return {};
}
