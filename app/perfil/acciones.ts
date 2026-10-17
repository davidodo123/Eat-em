"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor, usuarioActual } from "@/lib/supabase/server";
import { leerFormularioSalud } from "@/lib/ia/formulario";

export interface EstadoPerfil { ok?: boolean; errores?: string[] }

export async function guardarPerfil(_previo: EstadoPerfil, d: FormData): Promise<EstadoPerfil> {
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  if (!u.user) return { errores: ["Tu sesión ha caducado."] };

  const nombre = String(d.get("nombre") ?? "").trim().slice(0, 60);
  if (!nombre) return { errores: ["Escribe tu nombre."] };
  const { error: e1 } = await supabase.from("perfiles").update({ nombre }).eq("id", u.user.id);
  if (e1) return { errores: ["No se pudo guardar el nombre."] };

  // Datos de salud (RGPD art. 9): solo con consentimiento explicito marcado en este envio
  if (d.get("consentimiento") !== "on") {
    revalidatePath("/perfil");
    return { ok: true, errores: ["Nombre guardado. Para guardar tus datos de salud marca el consentimiento."] };
  }
  const { datos, errores } = leerFormularioSalud(d);
  if (errores.length) return { errores };
  const { data: previo } = await supabase.from("perfiles_salud").select("consentimiento_salud_en").eq("usuario_id", u.user.id).single();
  const { error } = await supabase.from("perfiles_salud").update({
    ...datos,
    consentimiento_salud_en: previo?.consentimiento_salud_en ?? new Date().toISOString(),
  }).eq("usuario_id", u.user.id);
  if (error) return { errores: ["No se pudieron guardar los datos de salud."] };
  revalidatePath("/perfil");
  return { ok: true };
}

// Retirar el consentimiento borra los datos de salud (vuelven a los valores por defecto)
export async function retirarConsentimiento(): Promise<EstadoPerfil> {
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  if (!u.user) return { errores: ["Tu sesión ha caducado."] };
  const { error } = await supabase.from("perfiles_salud").update({
    sexo: null, fecha_nacimiento: null, altura_cm: null, peso_kg: null, actividad: null, objetivo: null,
    comidas_dia: 4, alergias: [], exclusiones: [], dieta_tipo: "omnivora", condiciones_medicas: [],
    embarazo: false, lactancia: false, tiempo_cocina_min: null, presupuesto_semana: null, consentimiento_salud_en: null,
  }).eq("usuario_id", u.user.id);
  if (!error) await supabase.from("pesajes").delete().eq("usuario_id", u.user.id);
  revalidatePath("/perfil");
  return error ? { errores: ["No se pudo retirar."] } : { ok: true };
}
