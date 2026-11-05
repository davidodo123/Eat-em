import { test } from "node:test";
import assert from "node:assert/strict";
import { rutaInterna } from "./rutas.ts";

test("solo redirecciones internas", () => {
  assert.equal(rutaInterna("/inventario?x=1"), "/inventario?x=1");
  assert.equal(rutaInterna("/"), "/lista"); // la portada ya no es una pagina: redirige en next.config.ts
  assert.equal(rutaInterna(null), "/lista");
  assert.equal(rutaInterna(""), "/lista");
  assert.equal(rutaInterna("https://evil.com"), "/lista");
  assert.equal(rutaInterna("//evil.com"), "/lista");
  assert.equal(rutaInterna("/\\evil.com"), "/lista");
  assert.equal(rutaInterna("javascript:alert(1)"), "/lista");
});
