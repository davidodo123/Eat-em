import { test } from "node:test";
import assert from "node:assert/strict";
import { prefiltro } from "./prefiltro.ts";
import { calcularObjetivos } from "./objetivos.ts";
import { edad, type PerfilSalud } from "./perfil.ts";
import { leerFormularioSalud } from "./formulario.ts";

const HOY = new Date(2026, 9, 16); // 16 oct 2026
const base: PerfilSalud = {
  sexo: "hombre", fecha_nacimiento: "1995-05-20", altura_cm: 178, peso_kg: 82, actividad: "moderado",
  objetivo: "perder_grasa", embarazo: false, lactancia: false, condiciones_medicas: [],
};

test("edad cumplida", () => {
  assert.equal(edad("2008-10-16", HOY), 18);
  assert.equal(edad("2008-10-17", HOY), 17);
  assert.equal(edad("1995-05-20", HOY), 31);
});

test("prefiltro: ok y datos que faltan", () => {
  assert.deepEqual(prefiltro(base, HOY), { estado: "ok", edad: 31, imc: 25.9 });
  // Antes, peso o altura vacios daban IMC NaN y pasaban: ahora piden el dato
  assert.equal((prefiltro({ ...base, peso_kg: null }, HOY) as { campo: string }).campo, "peso_kg");
  assert.equal((prefiltro({ ...base, altura_cm: null }, HOY) as { campo: string }).campo, "altura_cm");
  assert.equal((prefiltro({ ...base, altura_cm: 0 }, HOY) as { campo: string }).campo, "altura_cm");
  assert.equal((prefiltro({ ...base, fecha_nacimiento: null }, HOY) as { campo: string }).campo, "fecha_nacimiento");
  assert.equal(prefiltro({ ...base, objetivo: null }, HOY).estado, "falta_dato");
});

test("prefiltro: salvaguardas", () => {
  const motivo = (p: Partial<PerfilSalud>) => (prefiltro({ ...base, ...p }, HOY) as { motivo?: string }).motivo;
  assert.equal(motivo({ fecha_nacimiento: "2010-01-01" }), "menor");
  assert.equal(motivo({ sexo: "mujer", embarazo: true }), "embarazo");
  assert.equal(motivo({ sexo: "mujer", lactancia: true }), "lactancia");
  assert.equal(motivo({ condiciones_medicas: ["diabetes"] }), "condicion_medica");
  assert.equal(motivo({ condiciones_medicas: ["tca"], peso_kg: null }), "condicion_medica"); // deriva aunque falten datos
  assert.equal(motivo({ peso_kg: 55, altura_cm: 178 }), "imc_bajo");
  assert.equal(motivo({ fecha_nacimiento: "2010-01-01", peso_kg: null }), "menor");
});

test("formulario de salud: validacion", () => {
  const fd = (o: Record<string, string | string[]>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
    return f;
  };
  const { datos, errores } = leerFormularioSalud(fd({
    sexo: "hombre", fecha_nacimiento: "1995-05-20", altura_cm: "178", peso_kg: "82,5", actividad: "moderado",
    objetivo: "perder_grasa", embarazo: "on", condiciones_medicas: ["diabetes", "inventada"], alergias: ["leche", "polen"],
    comidas_dia: "9", dieta_tipo: "carnivora",
  }), HOY);
  assert.deepEqual(errores, []);
  assert.equal(datos.peso_kg, 82.5);
  assert.equal(datos.embarazo, false); // solo si es mujer
  assert.deepEqual(datos.condiciones_medicas, ["diabetes"]);
  assert.deepEqual(datos.alergias, ["leche"]);
  assert.equal(datos.comidas_dia, 4);
  assert.equal(datos.dieta_tipo, "omnivora");

  const malo = leerFormularioSalud(fd({ fecha_nacimiento: "2030-01-01", altura_cm: "17", peso_kg: "abc" }), HOY);
  assert.equal(malo.errores.length, 3);
  assert.deepEqual([malo.datos.fecha_nacimiento, malo.datos.altura_cm, malo.datos.peso_kg], [null, null, null]);
});

test("objetivos: Mifflin-St Jeor, ajuste y minimos", () => {
  const o = calcularObjetivos({ sexo: "hombre", edad: 31, altura_cm: 178, peso_kg: 82, actividad: "moderado", objetivo: "perder_grasa" });
  // TMB = 820 + 1112,5 - 155 + 5 = 1782,5; x1,55 = 2762,9; -15 % = 2348,4 -> 2350
  assert.deepEqual(o, { tmb: 1783, gasto: 2763, kcal: 2350, proteina_g: 148, grasa_g: 66, hidratos_g: 291, minimo_aplicado: false });

  const m = calcularObjetivos({ sexo: "mujer", edad: 40, altura_cm: 150, peso_kg: 50, actividad: "sedentario", objetivo: "perder_grasa" });
  // TMB = 500 + 937,5 - 200 - 161 = 1076,5; x1,2 = 1291,8; -15 % = 1098 -> minimo 1200
  assert.equal(m.kcal, 1200);
  assert.ok(m.minimo_aplicado);

  const g = calcularObjetivos({ sexo: "mujer", edad: 25, altura_cm: 165, peso_kg: 60, actividad: "alto", objetivo: "ganar_musculo" });
  assert.equal(g.kcal, Math.round((10 * 60 + 6.25 * 165 - 125 - 161) * 1.725 * 1.07 / 10) * 10);
});
