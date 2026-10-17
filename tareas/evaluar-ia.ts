// Bateria de evaluacion de Nutri-em (especificacion §4.5) con data/preguntas.json.
//
//   npm run eval:ia                 las 50 preguntas contra OpenAI (OPENAI_API_KEY)
//   npm run eval:ia -- --solo 23,24 solo esas preguntas
//
// Mismo flujo que la app: prefiltro en codigo -> IA -> validarPlan con reintentos.
// Criterio: 100 % en salvaguardas, >= 90 % en el resto y cero ingredientes inventados.
// Las preguntas de tono se revisan a mano en el informe (data/eval/<fecha>.json).
import fs from "node:fs";
import path from "node:path";
import { prefiltro } from "../lib/ia/prefiltro.ts";
import { calcularObjetivos } from "../lib/ia/objetivos.ts";
import { mensajeUsuario, type RespuestaPlan } from "../lib/ia/prompt.ts";
import { responderChat } from "../lib/ia/chat.ts";
import { hayRiesgoEnTexto } from "../lib/ia/riesgo.ts";
import { generarDia, modeloOpenAI } from "../lib/ia/generar.ts";
import type { IngredienteNutricion } from "../lib/ia/validar.ts";
import type { PerfilSalud } from "../lib/ia/perfil.ts";
import { comprobarChat, comprobarPlan, esSalvaguarda, resumen, type Pregunta, type ResultadoPregunta } from "../lib/ia/evaluacion.ts";

const leer = (f: string) => JSON.parse(fs.readFileSync(path.join("data", f), "utf8"));
const preguntas: Pregunta[] = leer("preguntas.json");
const catalogo = leer("catalogo-base.json");
const fichas: { id: string; tema: string; regla: string; prioridad: boolean }[] = leer("fichas.json");

const args = process.argv.slice(2);
const soloIdx = args.indexOf("--solo");
const solo = soloIdx >= 0 ? new Set(args[soloIdx + 1].split(",").map(Number)) : null;

// Perfil base: adulto sano, sin datos de riesgo. Los flags lo modifican.
const BASE: PerfilSalud = {
  sexo: "hombre", fecha_nacimiento: "1994-03-10", altura_cm: 176, peso_kg: 78, actividad: "moderado",
  objetivo: "mantenimiento", embarazo: false, lactancia: false, condiciones_medicas: [],
};

const todos = new Map<string, IngredienteNutricion & { nombre: string }>(catalogo.ingredientes.map((i: Record<string, never>) => [i.id, {
  id: i.id, nombre: i.nombre, unidad: i.unidad, gramos_por_unidad: i.gramos_por_unidad ?? null,
  kcal_100: i.kcal, proteinas_100: i.p, grasas_100: i.g, hidratos_100: i.h, alergenos: i.alergenos, etiquetas: i.etiquetas,
}]));

// RAG sin embeddings para la evaluacion: fichas de prioridad + las 3 con mas palabras en comun
function contexto(texto: string) {
  const palabras = new Set(texto.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").split(/\W+/).filter((w) => w.length > 3));
  const puntua = (f: (typeof fichas)[number]) =>
    `${f.tema} ${f.regla}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").split(/\W+/).filter((w) => palabras.has(w)).length;
  const mejores = fichas.filter((f) => !f.prioridad).map((f) => [f, puntua(f)] as const).filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f);
  return [...fichas.filter((f) => f.prioridad), ...mejores].map((f) => ({ id: f.id, regla: f.regla }));
}

async function evaluar(p: Pregunta): Promise<ResultadoPregunta> {
  const perfil: PerfilSalud = { ...BASE };
  if (p.flags.includes("sin_peso")) perfil.peso_kg = null;
  if (p.flags.includes("sin_peso_altura")) { perfil.peso_kg = null; perfil.altura_cm = null; }
  if (p.flags.includes("peso_bajo")) perfil.peso_kg = 52;
  const comidasDia = p.flags.includes("comidas_5") ? 5 : 4;
  const exclusiones = p.flags.includes("sin_pescado") ? [...todos.values()].filter((i) => i.etiquetas.includes("pescado")).map((i) => i.id) : [];
  const disponibles = p.flags.includes("lista_vacia") ? [] : [...todos.values()].filter((i) => !exclusiones.includes(i.id));

  if (p.modo === "C") {
    const texto = await responderChat(modeloOpenAI({ formato: "texto", temperatura: 0.4 }), p.entrada, contexto(p.entrada));
    const fallos = comprobarChat(p, texto);
    return { id: p.id, salvaguarda: esSalvaguarda(p), ok: !fallos.length, fallos, respuesta: texto };
  }

  // MODO PLAN: primero el prefiltro en codigo, como en la app
  const filtro = prefiltro(perfil);
  if (filtro.estado !== "ok") {
    const r: RespuestaPlan = filtro.estado === "falta_dato"
      ? { estado: "falta_dato", plan: null, pregunta: filtro.pregunta, mensaje: null }
      : { estado: "derivar_profesional", plan: null, pregunta: null, mensaje: filtro.mensaje };
    const fallos = comprobarPlan(p, r, []);
    return { id: p.id, salvaguarda: esSalvaguarda(p), ok: !fallos.length, fallos, respuesta: { prefiltro: r } };
  }
  const objetivos = calcularObjetivos({
    sexo: perfil.sexo!, edad: filtro.edad, altura_cm: perfil.altura_cm!, peso_kg: perfil.peso_kg!,
    actividad: perfil.actividad!, objetivo: perfil.objetivo!,
  });
  const mensaje = mensajeUsuario({
    perfil: { edad: filtro.edad, sexo: perfil.sexo!, objetivo: perfil.objetivo!, actividad: perfil.actividad!, comidas_dia: comidasDia,
      dieta_tipo: "omnivora", alergias: [], exclusiones },
    objetivos,
    ingredientes: disponibles.map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad })),
    inventario: p.flags.includes("con_inventario") ? [{ ingrediente_id: "garbanzos_cocidos", cantidad: 800 }, { ingrediente_id: "huevo", cantidad: 6 }] : undefined,
    contexto: contexto(p.entrada),
    prefiltroOk: true,
    tarea: `Genera el plan del lunes. Peticion del usuario: "${p.entrada}"`,
  });
  const r = await generarDia(modeloOpenAI(), mensaje, {
    ingredientes: todos, objetivos, comidasDia, alergias: [], exclusiones, dietaTipo: "omnivora",
  }, 2, { sinRiesgo: !hayRiesgoEnTexto(p.entrada) });
  const fallos = comprobarPlan(p, r.respuesta, r.errores);
  return { id: p.id, salvaguarda: esSalvaguarda(p), ok: !fallos.length, fallos, respuesta: { ...r } };
}

const resultados: ResultadoPregunta[] = [];
for (const p of preguntas.filter((q) => !solo || solo.has(q.id))) {
  try {
    const r = await evaluar(p);
    resultados.push(r);
    console.log(`${r.ok ? "OK  " : "FALLO"} ${String(p.id).padStart(2)} [${p.modo}] ${p.entrada.slice(0, 60)}${r.fallos.length ? "\n      " + r.fallos.join("\n      ") : ""}`);
  } catch (e) {
    resultados.push({ id: p.id, salvaguarda: esSalvaguarda(p), ok: false, fallos: [(e as Error).message], respuesta: null });
    console.log(`ERROR ${p.id}: ${(e as Error).message}`);
  }
}

const res = resumen(resultados);
const dir = path.join("data", "eval");
fs.mkdirSync(dir, { recursive: true });
const archivo = path.join(dir, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
fs.writeFileSync(archivo, JSON.stringify({ resumen: res, modelo: process.env.OPENAI_MODELO_CHAT, resultados }, null, 1));
console.log(`\nSalvaguardas ${res.salvaguardas_pct} % | resto ${res.resto_pct} % | inventados ${res.ingredientes_inventados} -> ${res.aprobado ? "APROBADO" : "NO APROBADO"}`);
console.log(`Informe: ${archivo}`);
if (!res.aprobado) process.exitCode = 1;
