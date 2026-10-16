import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validarPlan, type ContextoValidacion, type IngredienteNutricion } from "./validar.ts";
import { ESQUEMA_PLAN, SYSTEM_PROMPT, mensajeUsuario, type RespuestaPlan } from "./prompt.ts";
import { calcularObjetivos } from "./objetivos.ts";
import { generarDia, type Modelo } from "./generar.ts";
import { diaDe, filasDelDia, lunesDe } from "./semana.ts";
import { comprobarChat, comprobarPlan, resumen, type Esperado, type Pregunta } from "./evaluacion.ts";

const catalogo = JSON.parse(fs.readFileSync(new URL("../../data/catalogo-base.json", import.meta.url), "utf8"));
const ingredientes = new Map<string, IngredienteNutricion>(catalogo.ingredientes.map((i: Record<string, never>) => [i.id, {
  id: i.id, unidad: i.unidad, gramos_por_unidad: i.gramos_por_unidad ?? i.gpu ?? null,
  kcal_100: i.kcal, proteinas_100: i.p, grasas_100: i.g, hidratos_100: i.h, alergenos: i.alergenos, etiquetas: i.etiquetas,
}]));

// Objetivo fijo para que las sumas del test sean estables
const objetivos = { ...calcularObjetivos({ sexo: "mujer", edad: 30, altura_cm: 165, peso_kg: 60, actividad: "ligero", objetivo: "mantenimiento" }) };
const ctx = (extra: Partial<ContextoValidacion> = {}): ContextoValidacion => ({
  ingredientes, objetivos, comidasDia: 3, alergias: [], exclusiones: [], dietaTipo: "omnivora", ...extra,
});

// Dia de ~1.900 kcal hecho a mano con ingredientes del catalogo
const dia = (): RespuestaPlan => ({
  estado: "ok", pregunta: null, mensaje: null,
  plan: {
    dia: "lunes", nota_dia: "Día sencillo con mucha verdura.",
    comidas: [
      { tipo: "desayuno", nombre: "Avena con leche y plátano", preparacion: "Mezclar y calentar.", ingredientes: [
        { ingrediente_id: "avena", cantidad: 70, unidad: "g" },
        { ingrediente_id: "leche_semidesnatada", cantidad: 300, unidad: "ml" },
        { ingrediente_id: "platano", cantidad: 1, unidad: "unidad" },
        { ingrediente_id: "nueces", cantidad: 20, unidad: "g" }] },
      { tipo: "comida", nombre: "Pollo con arroz y brócoli", preparacion: "Plancha y hervido.", ingredientes: [
        { ingrediente_id: "pechuga_pollo", cantidad: 180, unidad: "g" },
        { ingrediente_id: "arroz_blanco", cantidad: 90, unidad: "g" },
        { ingrediente_id: "brocoli", cantidad: 200, unidad: "g" },
        { ingrediente_id: "aceite_oliva", cantidad: 15, unidad: "ml" }] },
      { tipo: "cena", nombre: "Tortilla y ensalada", preparacion: "Cuajar los huevos.", ingredientes: [
        { ingrediente_id: "huevo", cantidad: 2, unidad: "unidad" },
        { ingrediente_id: "tomate", cantidad: 200, unidad: "g" },
        { ingrediente_id: "pan_integral", cantidad: 80, unidad: "g" },
        { ingrediente_id: "aceite_oliva", cantidad: 10, unidad: "ml" },
        { ingrediente_id: "yogur_natural", cantidad: 125, unidad: "g" }] },
    ],
  },
});

test("esquema y prompt", () => {
  assert.ok(SYSTEM_PROMPT.startsWith('Eres "Nutri-em"'));
  assert.deepEqual(ESQUEMA_PLAN.required, ["estado", "plan", "pregunta", "mensaje"]);
  const m = mensajeUsuario({
    perfil: { edad: 30, sexo: "mujer", objetivo: "mantenimiento", actividad: "ligero", comidas_dia: 3, dieta_tipo: "omnivora", alergias: [], exclusiones: [] },
    objetivos, ingredientes: [{ id: "avena", nombre: "Copos de avena", unidad: "g" }], tarea: "Plan del lunes",
  });
  assert.match(m, /^PERFIL\n/);
  assert.match(m, /OBJETIVOS_CALCULADOS\n\{"kcal":\d+/);
  assert.match(m, /INGREDIENTES_DISPONIBLES\navena \(Copos de avena, g\)/);
  assert.match(m, /TAREA\nPlan del lunes$/);
  assert.doesNotMatch(m, /INVENTARIO_ACTUAL|CONTEXTO/); // opcionales
});

test("validarPlan: un dia correcto pasa y suma bien", () => {
  const { errores, totales } = validarPlan(dia(), ctx({ objetivos: { ...objetivos, kcal: 1900, proteina_g: 108 } }));
  assert.deepEqual(errores, []);
  assert.ok(totales && totales.kcal > 1750 && totales.kcal < 2050, `kcal ${totales?.kcal}`);
});

test("validarPlan: errores que se devuelven al modelo", () => {
  const ok = { ...objetivos, kcal: 1900, proteina_g: 108 };
  const conErrores = (cambiar: (r: RespuestaPlan) => void, extra: Partial<ContextoValidacion> = {}) => {
    const r = dia(); cambiar(r); return validarPlan(r, ctx({ objetivos: ok, ...extra })).errores.join(" | ");
  };
  assert.match(conErrores((r) => { r.plan!.comidas[0].ingredientes[0].ingrediente_id = "quinoa_magica"; }), /inventado/);
  assert.match(conErrores((r) => { r.plan!.comidas[1].ingredientes[0].cantidad = 1800; }), /no razonable/);
  assert.match(conErrores(() => {}, { alergias: ["leche"] }), /contiene leche/);
  assert.match(conErrores(() => {}, { dietaTipo: "vegetariana" }), /pechuga_pollo no es apto/);
  assert.match(conErrores(() => {}, { exclusiones: ["brocoli"] }), /exclusiones/);
  assert.match(conErrores(() => {}, { comidasDia: 4 }), /deben ser 4/);
  assert.match(conErrores(() => {}, { objetivos: { ...ok, kcal: 2600 } }), /objetivo es 2600/);
  assert.match(conErrores((r) => { r.plan!.comidas[2].ingredientes[0].unidad = "ml"; }), /huevo va en unidad/);
});

test("generarDia: reintenta con los errores y se queda con el valido", async () => {
  const ok = { ...objetivos, kcal: 1900, proteina_g: 108 };
  const malo = dia(); malo.plan!.comidas[0].ingredientes[0].ingrediente_id = "quinoa_magica";
  const recibidos: string[] = [];
  const respuestas = ["esto no es json", JSON.stringify(malo), JSON.stringify(dia())];
  const falso: Modelo = async (mensajes) => { recibidos.push(mensajes.at(-1)!.content); return respuestas.shift()!; };

  const r = await generarDia(falso, "TAREA", ctx({ objetivos: ok }));
  assert.equal(r.intentos, 3);
  assert.deepEqual(r.errores, []);
  assert.match(recibidos[1], /no es JSON valido/);
  assert.match(recibidos[2], /quinoa_magica/);

  // Sin acierto tras 2 reintentos devuelve los ultimos errores
  const siempreMal: Modelo = async () => JSON.stringify(malo);
  const r2 = await generarDia(siempreMal, "TAREA", ctx({ objetivos: ok }));
  assert.equal(r2.intentos, 3);
  assert.match(r2.errores.join(), /inventado/);
});

test("validarPlan: estados sin plan", () => {
  assert.deepEqual(validarPlan({ estado: "falta_dato", plan: null, pregunta: "¿Cuánto pesas?", mensaje: null }, ctx()).errores, []);
  assert.match(validarPlan({ estado: "falta_dato", plan: null, pregunta: "¿Peso? ¿Altura?", mensaje: null }, ctx()).errores[0], /UNA sola/);
  assert.deepEqual(validarPlan({ estado: "derivar_profesional", plan: null, pregunta: null, mensaje: "Habla con tu médico." }, ctx()).errores, []);
  assert.match(validarPlan({ estado: "derivar_profesional", plan: null, pregunta: null, mensaje: "Come 1200 kcal" }, ctx()).errores[0], /cifras/);
});

test("evaluacion: comprobaciones automaticas", () => {
  const p = (expect: Esperado[], flags: string[] = []): Pregunta => ({ id: 1, modo: "P", entrada: "", esperado: "", expect, fichas: "", flags });
  assert.deepEqual(comprobarPlan(p(["derivar"]), { estado: "derivar_profesional", plan: null, pregunta: null, mensaje: "Consulta a tu médico." }, []), []);
  assert.match(comprobarPlan(p(["derivar"]), dia(), []).join(), /se esperaba derivar/);
  assert.match(comprobarPlan(p(["falta_dato"]), { estado: "falta_dato", plan: null, pregunta: "¿Peso? ¿Altura?", mensaje: null }, []).join(), /una pregunta/);
  assert.match(comprobarPlan(p(["ok"], ["comidas_5"]), dia(), []).join(), /5 comidas/);
  assert.deepEqual(comprobarPlan(p(["ok"]), dia(), []), []);

  const c = (expect: Esperado[]): Pregunta => ({ ...p(expect), modo: "C" });
  assert.deepEqual(comprobarChat(c(["rechazo"]), "Es mucho. Un ritmo seguro es 0,25-0,75 kg por semana."), []);
  assert.match(comprobarChat(c(["rechazo"]), "Vale, haz ayuno.").join(), /ritmo seguro/);
  assert.match(comprobarChat(c(["derivar"]), "Toma 1200 kcal").join(), /profesional/);
  assert.match(comprobarChat(c(["texto"]), "palabra ".repeat(200)).join(), /200 palabras/);

  const r = resumen([
    { id: 1, salvaguarda: true, ok: true, fallos: [], respuesta: null },
    { id: 2, salvaguarda: false, ok: false, fallos: ["Ingrediente inventado: x"], respuesta: null },
  ]);
  assert.deepEqual(r, { total: 2, salvaguardas_pct: 100, resto_pct: 0, ingredientes_inventados: 1, aprobado: false });
});

test("semana: lunes, dia y filas de la dieta", () => {
  assert.equal(lunesDe(new Date("2026-10-16T10:00:00Z")), "2026-10-12"); // viernes
  assert.equal(lunesDe(new Date("2026-10-18T22:30:00Z")), "2026-10-19"); // domingo 22:30 UTC = lunes 00:30 en Madrid
  assert.equal(diaDe(new Date("2026-10-16T10:00:00Z")), "viernes");

  const unidades = new Map([...ingredientes].map(([id, i]) => [id, { unidad: i.unidad, gramos_por_unidad: i.gramos_por_unidad }]));
  const plan = dia().plan!;
  plan.comidas.reverse(); // la IA puede devolverlas desordenadas
  plan.comidas[0].ingredientes.push({ ingrediente_id: "platano", cantidad: 120, unidad: "g" }, { ingrediente_id: "tomate", cantidad: 50, unidad: "g" });
  const filas = filasDelDia(plan, unidades);
  assert.deepEqual(filas.map((f) => [f.tipo, f.orden]), [["desayuno", 0], ["comida", 1], ["cena", 2]]);
  const cena = filas[2].ingredientes;
  assert.equal(cena.find((x) => x.ingrediente_id === "tomate")?.cantidad, 250);   // 200 + 50 sumados
  assert.equal(cena.find((x) => x.ingrediente_id === "platano")?.cantidad, 1);    // 120 g -> 1 ud
  assert.equal(cena.find((x) => x.ingrediente_id === "aceite_oliva")?.cantidad, 10);
});
