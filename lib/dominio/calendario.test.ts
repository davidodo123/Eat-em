import { test } from "node:test";
import assert from "node:assert/strict";
import { cuadriculaMes, diaSemana, esFecha, lunesDeLaSemana, semanaDe, sumarDias } from "./calendario.ts";

test("dias y semanas", () => {
  assert.equal(diaSemana("2026-10-17"), "sabado");
  assert.equal(lunesDeLaSemana("2026-10-17"), "2026-10-12");
  assert.equal(lunesDeLaSemana("2026-10-12"), "2026-10-12");
  assert.equal(lunesDeLaSemana("2026-10-18"), "2026-10-12");
  assert.equal(sumarDias("2026-10-31", 1), "2026-11-01");
  assert.equal(sumarDias("2026-03-28", 2), "2026-03-30");   // cambio de hora: sin saltos
  assert.deepEqual(semanaDe("2026-10-15"), ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
});

test("cuadricula del mes", () => {
  const oct = cuadriculaMes("2026-10-17");
  assert.equal(oct[0], "2026-09-28");          // lunes antes del 1 (jueves)
  assert.equal(oct.at(-1), "2026-11-01");      // domingo tras el 31 (sabado)
  assert.equal(oct.length % 7, 0);
  assert.equal(cuadriculaMes("2027-02-10").length, 28);   // febrero 2027 empieza en lunes y acaba en domingo
});

test("fechas validas", () => {
  assert.ok(esFecha("2026-02-28"));
  assert.ok(!esFecha("2026-02-30"));
  assert.ok(!esFecha("17/10/2026"));
});
