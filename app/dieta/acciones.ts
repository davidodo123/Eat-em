"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor, usuarioActual } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { prefiltro } from "@/lib/ia/prefiltro";
import { calcularObjetivos } from "@/lib/ia/objetivos";
import { DIAS, mensajeUsuario } from "@/lib/ia/prompt";
import { ErrorIA, generarDia, mensajeErrorIA, modeloOpenAI } from "@/lib/ia/generar";
import { filasDelDia, lunesDe } from "@/lib/ia/semana";
import { diaSemana, esFecha, lunesDeLaSemana, sumarDias } from "@/lib/dominio/calendario";
import type { IngredienteNutricion } from "@/lib/ia/validar";
import type { PerfilSalud } from "@/lib/ia/perfil";

export interface EstadoDieta { error?: string; aviso?: string; ok?: boolean }

// Fichas que acompanan siempre a la generacion del plan (ademas de las de salvaguarda)
const FICHAS_PLAN = ["FICHA-003", "FICHA-012", "FICHA-013"];

export async function generarSemana(_previo: EstadoDieta, datos: FormData): Promise<EstadoDieta> {
  const pedida = String(datos.get("semana") ?? "");
  if (!esFecha(pedida) || lunesDeLaSemana(pedida) !== pedida || pedida < lunesDe()) return { error: "Semana no válida." };
  if (!process.env.OPENAI_API_KEY) return { error: "La IA aún no está configurada (falta OPENAI_API_KEY)." };
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
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
  const semana = pedida;
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
  revalidatePath("/dieta");
  return fallidos.length
    ? { ok: true, aviso: `Plan guardado. No se pudo generar: ${fallidos.join(", ")}. Puedes volver a intentarlo.` }
    : { ok: true };
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// --- Planificacion a mano (semana o mes) ---

const TIPOS = ["desayuno", "media_manana", "comida", "merienda", "cena", "extra"] as const;
export interface IngredienteComida { ingrediente_id: string; cantidad: number }

// Dieta activa del usuario para la semana de esa fecha; si no hay, se crea vacia (manual)
async function dietaDeLaSemana(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, usuarioId: string, semana: string) {
  const { data } = await supabase.from("dietas").select("id").eq("usuario_id", usuarioId).eq("semana_inicio", semana).eq("estado", "activa").maybeSingle();
  if (data) return data.id as number;
  const hogar = await hogarActual(supabase);
  const { data: nueva, error } = await supabase.from("dietas").insert({
    usuario_id: usuarioId, grupo_id: hogar?.id ?? null, semana_inicio: semana, estado: "activa", generada_por: "manual",
  }).select("id").single();
  if (error || !nueva) throw new Error("dieta");
  return nueva.id as number;
}

export async function anadirComida(fecha: string, tipo: string, nombre: string, ingredientes: IngredienteComida[], preparacion = ""): Promise<{ error?: string }> {
  const n = nombre.trim().slice(0, 200);
  if (!esFecha(fecha)) return { error: "Fecha no válida." };
  if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) return { error: "Elige el momento del día." };
  if (!n) return { error: "Ponle nombre (p. ej. «Lentejas con verduras»)." };
  const validos = ingredientes.filter((i) => i.ingrediente_id && Number.isFinite(i.cantidad) && i.cantidad > 0 && i.cantidad <= 5000);
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  if (!u.user) return { error: "Tu sesión ha caducado." };
  try {
    const dietaId = await dietaDeLaSemana(supabase, u.user.id, lunesDeLaSemana(fecha));
    const { count } = await supabase.from("dieta_comidas").select("id", { count: "exact", head: true }).eq("dieta_id", dietaId);
    const { data: comida, error } = await supabase.from("dieta_comidas").insert({
      dieta_id: dietaId, dia: diaSemana(fecha), tipo, orden: count ?? 0, nombre: n, preparacion: preparacion.trim().slice(0, 500) || null,
    }).select("id").single();
    if (error || !comida) return { error: "No se pudo guardar." };
    if (validos.length) {
      const suma = new Map<string, number>();
      for (const i of validos) suma.set(i.ingrediente_id, (suma.get(i.ingrediente_id) ?? 0) + i.cantidad);
      const { error: e2 } = await supabase.from("dieta_comida_ingredientes")
        .insert([...suma].map(([ingrediente_id, cantidad]) => ({ comida_id: comida.id, ingrediente_id, cantidad })));
      if (e2) return { error: "Guardada, pero sin los ingredientes." };
    }
  } catch { return { error: "No se pudo guardar." }; }
  revalidatePath("/dieta");
  return {};
}

export async function borrarComida(comidaId: number): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("dieta_comidas").delete().eq("id", comidaId);
  if (error) return { error: "No se pudo borrar." };
  revalidatePath("/dieta");
  return {};
}

// Copia la semana a las `semanas` siguientes (para programar el mes). No pisa semanas ya planificadas.
export async function repetirSemana(semana: string, semanas: number): Promise<{ error?: string; resumen?: string }> {
  if (!esFecha(semana) || lunesDeLaSemana(semana) !== semana) return { error: "Semana no válida." };
  if (!Number.isInteger(semanas) || semanas < 1 || semanas > 8) return { error: "Número de semanas no válido." };
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  if (!u.user) return { error: "Tu sesión ha caducado." };
  const { data: origen } = await supabase.from("dietas").select("id, objetivos, grupo_id")
    .eq("usuario_id", u.user.id).eq("semana_inicio", semana).eq("estado", "activa").maybeSingle();
  const { data: comidas } = origen
    ? await supabase.from("dieta_comidas").select("dia, tipo, orden, nombre, preparacion, nota_dia, dieta_comida_ingredientes (ingrediente_id, cantidad)").eq("dieta_id", origen.id)
    : { data: [] };
  if (!origen || !comidas?.length) return { error: "Esta semana no tiene comidas que repetir." };

  const destinos = Array.from({ length: semanas }, (_, k) => sumarDias(semana, 7 * (k + 1)));
  const { data: ocupadas } = await supabase.from("dietas").select("id, semana_inicio, dieta_comidas (id)")
    .eq("usuario_id", u.user.id).eq("estado", "activa").in("semana_inicio", destinos);
  const conComidas = new Set((ocupadas ?? []).filter((d) => (d.dieta_comidas as unknown[]).length).map((d) => d.semana_inicio));
  const vacias = new Map((ocupadas ?? []).filter((d) => !conComidas.has(d.semana_inicio)).map((d) => [d.semana_inicio, d.id as number]));

  let copiadas = 0;
  for (const destino of destinos) {
    if (conComidas.has(destino)) continue;
    let dietaId = vacias.get(destino);
    if (!dietaId) {
      const { data: nueva, error } = await supabase.from("dietas").insert({
        usuario_id: u.user.id, grupo_id: origen.grupo_id, semana_inicio: destino, estado: "activa", generada_por: "manual", objetivos: origen.objetivos,
      }).select("id").single();
      if (error || !nueva) return { error: "No se pudo copiar." };
      dietaId = nueva.id as number;
    }
    const { data: nuevas, error: e1 } = await supabase.from("dieta_comidas")
      .insert(comidas.map(({ dieta_comida_ingredientes: _i, ...c }) => ({ ...c, dieta_id: dietaId }))).select("id");
    if (e1 || !nuevas) return { error: "No se pudo copiar." };
    const ings = comidas.flatMap((c, k) => (c.dieta_comida_ingredientes as IngredienteComida[]).map((x) => ({ comida_id: nuevas[k].id, ingrediente_id: x.ingrediente_id, cantidad: x.cantidad })));
    if (ings.length) await supabase.from("dieta_comida_ingredientes").insert(ings);
    copiadas++;
  }
  revalidatePath("/dieta");
  const saltadas = destinos.length - copiadas;
  return { resumen: `Copiada a ${copiadas} ${copiadas === 1 ? "semana" : "semanas"}${saltadas ? ` (${saltadas} ya tenían plan y no se han tocado)` : ""}.` };
}
