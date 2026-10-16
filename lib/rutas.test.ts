import { test } from "node:test";
import assert from "node:assert/strict";
import { rutaInterna } from "./rutas.ts";

test("solo redirecciones internas", () => {
  assert.equal(rutaInterna("/inventario?x=1"), "/inventario?x=1");
  assert.equal(rutaInterna(null), "/");
  assert.equal(rutaInterna(""), "/");
  assert.equal(rutaInterna("https://evil.com"), "/");
  assert.equal(rutaInterna("//evil.com"), "/");
  assert.equal(rutaInterna("/\\evil.com"), "/");
  assert.equal(rutaInterna("javascript:alert(1)"), "/");
});
