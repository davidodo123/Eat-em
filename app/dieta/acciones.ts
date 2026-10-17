"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { prefiltro } from "@/lib/ia/prefiltro";
import { calcularObjetivos } from "@/lib/ia/objetivos";
import { DIAS, mensajeUsuario } from "@/lib/ia/prompt";
import { ErrorIA, generarDia, mensajeErrorIA, modeloOpenAI } from "@/lib/ia/generar";
import { filasDelDia, lunesDe } from "@/lib/ia/semana";
import type { IngredienteNutricion } from "@/lib/ia/validar";
import type { PerfilSalud } from "@/lib/ia/perfil";

export interface EstadoDieta { error?: string; aviso?: string; ok?: boolean }

// Fichas que acompanan siempre a la generacion del plan (ademas de las de salvaguarda)
const FICHAS_PLAN = ["FICHA-003", "FICHA-012", "FICHA-013"];

export async function generarSemana(_previo: EstadoDieta): Promise<EstadoDieta> {
  if (!process.env.OPENAI_API_KEY) return { error: "La IA aún no está configurada (falta OPENAI_API_KEY)." };
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Tu sesión ha caducado." };

  const { data: s } = await supabase.from("perfiles_salud").select("*").eq("usuario_id", u.user.id).single();
  if (!s?.consentimiento_salud_en) return { error: "Primero completa tu perfil y da el consentimiento para tus datos de salud." };
  const perfil: PerfilSalud = {
    sexo: s.sexo, fecha_nacimiento: s.fecha_nacimiento, altura_cm: s.altura_cm && Number(s.altura_cm), peso_kg: s.peso_kg && Number(s.peso_kg),
    actividad: s.actividad, objetivo: s.objetivo, embarazo: s.embarazo, lactancia: s.lactancia, condiciones_medicas: s.condiciones_medicas ?? [],
  };
  // Salvaguarda en codigo ANTES de llamar a la IA
  const filtro = prefiltro(perfil);
  if (filtro.estado === "derivar_profesional") return { aviso: filtro.mensaje };
  if (filtro.estado === "falta_dato") return { error: `Falta un dato en tu perfil: ${filtro.pregunta}` };
  const objetivos = calcularObjetivos({
    sexo: perfil.sexo!, edad: filtro.edad, altura_cm: perfil.altura_cm!, peso_kg: perfil.peso_kg!, actividad: perfil.actividad!, objetivo: perfil.objetivo!,
  });

  const hogar = await hogarActual(supabase);
  const [{ data: ings }, { data: inventario }, { data: fichas }] = await Promise.all([
    supabase.from("ingredientes").select("id, nombre, unidad, gramos_por_unidad, kcal_100, proteinas_100, grasas_100, hidratos_100, alergenos, etiquetas").eq("activo", true),
    hogar ? supabase.from("inventario").select("ingrediente_id, cantidad").eq("grupo_id", hogar.id).gt("cantidad", 0) : Promise.resolve({ data: [] }),
    supabase.from("fichas").select("id, regla, prioridad").or(`prioridad.eq.true,id.in.(${FICHAS_PLAN.join(",")})`),
  ]);
  const todos = new Map<string, IngredienteNutricion>((ings ?? []).map((i) => [i.id, {
    id: i.id, unidad: i.unidad, gramos_por_unidad: i.gramos_por_unidad === null ? null : Number(i.gramos_por_unidad),
    kcal_100: num(i.kcal_100), proteinas_100: num(i.proteinas_100), grasas_100: num(i.grasas_100), hidratos_100: num(i.hidratos_100),
    alergenos: i.alergenos ?? [], etiquetas: i.etiquetas ?? [],
  }]));
  const dieta = s.dieta_tipo as "omnivora" | "vegetariana" | "vegana" | "pescetariana";
  const aptos = (ings ?? []).filter((i) =>
    !(i.alergenos ?? []).some((a: string) => (s.alergias ?? []).includes(a)) && !(s.exclusiones ?? []).includes(i.id)
    && (dieta !== "vegana" || i.etiquetas?.includes("vegano"))
    && (dieta !== "vegetariana" || !i.etiquetas?.some((e: string) => e === "carne" || e === "pescado"))
    && (dieta !== "pescetariana" || !i.etiquetas?.includes("carne")));

  const modelo = modeloOpenAI();
  const ctx = { ingredientes: todos, objetivos, comidasDia: s.comidas_dia, alergias: s.alergias ?? [], exclusiones: s.exclusiones ?? [], dietaTipo: dieta };
  const dias: ReturnType<typeof filasDelDia>[] = [];
  const fallidos: string[] = [];
  const nombresPrevios: string[] = [];
  for (const dia of DIAS) {
    const mensaje = mensajeUsuario({
      perfil: { edad: filtro.edad, sexo: perfil.sexo!, objetivo: perfil.objetivo!, actividad: perfil.actividad!, comidas_dia: s.comidas_dia,
        dieta_tipo: dieta, alergias: s.alergias ?? [], exclusiones: s.exclusiones ?? [] },
      objetivos,
      ingredientes: aptos.map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad })),
      inventario: (inventario ?? []).map((x) => ({ ingrediente_id: x.ingrediente_id, cantidad: Number(x.cantidad) })),
      contexto: (fichas ?? []).map((f) => ({ id: f.id, regla: f.regla })),
      prefiltroOk: true,
      tarea: `Genera el plan del ${dia} con ${s.comidas_dia} comidas.` +
        (nombresPrevios.length ? ` Varía respecto a lo ya planificado esta semana: ${nombresPrevios.slice(-12).join("; ")}.` : ""),
    });
    try {
      // La peticion la redacta la app (sin texto libre del usuario) y el perfil ya paso el prefiltro
      const r = await generarDia(modelo, mensaje, ctx, 2, { sinRiesgo: true });
      if (r.respuesta?.estado === "derivar_profesional") return { aviso: r.respuesta.mensaje ?? "Te recomendamos consultar con un profesional sanitario." };
      if (r.errores.length || !r.respuesta?.plan) { fallidos.push(dia); continue; }
      const filas = filasDelDia({ ...r.respuesta.plan, dia }, todos);
      dias.push(filas);
      nombresPrevios.push(...filas.map((f) => f.nombre));
    } catch (e) {
      fallidos.push(dia);
      // Sin cupo no merece la pena seguir: se guarda lo que haya y se avisa
      if (e instanceof ErrorIA && e.cupo) {
        fallidos.push(...DIAS.slice(DIAS.indexOf(dia) + 1));
        if (!dias.length) return { error: mensajeErrorIA(e) };
        break;
      }
    }
  }
  if (!dias.length) return { error: "No se pudo generar ningún día válido. Inténtalo más tarde." };

  // Guardar: borrador -> comidas -> ingredientes -> activar (archivando la anterior de la semana)
  const semana = lunesDe();
  const { data: nueva, error: e1 } = await supabase.from("dietas").insert({
    usuario_id: u.user.id, grupo_id: hogar?.id ?? null, semana_inicio: semana, estado: "borrador",
    objetivos: { kcal: objetivos.kcal, proteina_g: objetivos.proteina_g, grasa_g: objetivos.grasa_g, hidratos_g: objetivos.hidratos_g },
    generada_por: "ia", modelo_ia: process.env.OPENAI_MODELO_CHAT ?? "gpt-4o-mini",
  }).select("id").single();
  if (e1 || !nueva) return { error: "No se pudo guardar la dieta." };
  for (const filas of dias) {
    const { data: comidas, error: e2 } = await supabase.from("dieta_comidas")
      .insert(filas.map(({ ingredientes: _i, ...c }) => ({ ...c, dieta_id: nueva.id }))).select("id, orden");
    if (e2 || !comidas) return { error: "No se pudieron guardar las comidas." };
    const porOrden = new Map(comidas.map((c) => [c.orden, c.id]));
    const ingredientes = filas.flatMap((f) => f.ingredientes.map((x) => ({ comida_id: porOrden.get(f.orden)!, ...x })));
    if (ingredientes.length) {
      const { error: e3 } = await supabase.from("dieta_comida_ingredientes").insert(ingredientes);
      if (e3) return { error: "No se pudieron guardar los ingredientes." };
    }
  }
  await supabase.from("dietas").update({ estado: "archivada" }).eq("usuario_id", u.user.id).eq("semana_inicio", semana).eq("estado", "activa");
  await supabase.from("dietas").update({ estado: "activa" }).eq("id", nueva.id);
  revalidatePath("/dieta");
  revalidatePath("/hoy");
  return fallidos.length
    ? { ok: true, aviso: `Plan guardado. No se pudo generar: ${fallidos.join(", ")}. Puedes volver a intentarlo.` }
    : { ok: true };
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
