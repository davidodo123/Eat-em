import { test } from "node:test";
import assert from "node:assert/strict";
import { formatearCantidad, pasoAjuste } from "./cantidad.ts";

test("formatear cantidades", () => {
  assert.equal(formatearCantidad(1500, "g"), "1,5 kg");
  assert.equal(formatearCantidad(250, "ml"), "250 ml");
  assert.equal(formatearCantidad(1000, "ml"), "1 l");
  assert.equal(formatearCantidad(2250, "g"), "2,25 kg");
  assert.equal(formatearCantidad(1, "unidad"), "1 ud");
  assert.equal(formatearCantidad(12, "unidad"), "12 uds");
  assert.equal(formatearCantidad(0, "g"), "0 g");
});

test("paso de ajuste", () => {
  assert.equal(pasoAjuste(12, "unidad"), 1);
  assert.equal(pasoAjuste(300, "g"), 50);
  assert.equal(pasoAjuste(800, "ml"), 100);
  assert.equal(pasoAjuste(5000, "g"), 500);
});
