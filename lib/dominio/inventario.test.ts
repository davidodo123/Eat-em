import { test } from "node:test";
import assert from "node:assert/strict";
import { cantidadComprada, cruzaUmbral } from "./inventario.ts";

const g = { unidad: "g" as const, gramos_por_unidad: null };
const ml = { unidad: "ml" as const, gramos_por_unidad: null };
const huevo = { unidad: "unidad" as const, gramos_por_unidad: 60 };

test("cantidad comprada para el inventario", () => {
  // Misma unidad: cantidad x envases
  assert.equal(cantidadComprada({ cantidad_neta: 1000, unidad: "g", unidades_pack: 1 }, g, 2), 2000);
  // g <-> ml con densidad 1
  assert.equal(cantidadComprada({ cantidad_neta: 1000, unidad: "ml", unidades_pack: 1 }, g), 1000);
  assert.equal(cantidadComprada({ cantidad_neta: 480, unidad: "g", unidades_pack: 4 }, ml), 480);
  // Piezas: "12 huevos" a un ingrediente por unidad
  assert.equal(cantidadComprada({ cantidad_neta: 12, unidad: "unidad", unidades_pack: 1 }, huevo), 12);
  // Piezas a gramos con el peso medio; sin el, no se sabe
  assert.equal(cantidadComprada({ cantidad_neta: 12, unidad: "unidad", unidades_pack: 1 }, { unidad: "g", gramos_por_unidad: 60 }), 720);
  assert.equal(cantidadComprada({ cantidad_neta: 12, unidad: "unidad", unidades_pack: 1 }, g), null);
  // Gramos a piezas: con el peso medio o por envases del pack
  assert.equal(cantidadComprada({ cantidad_neta: 700, unidad: "g", unidades_pack: 1 }, huevo), 12);
  assert.equal(cantidadComprada({ cantidad_neta: 480, unidad: "g", unidades_pack: 4 }, { unidad: "unidad", gramos_por_unidad: null }), 4);
  // Sin formato: solo si el ingrediente va por piezas
  assert.equal(cantidadComprada({ cantidad_neta: null, unidad: null, unidades_pack: 1 }, huevo, 3), 3);
  assert.equal(cantidadComprada({ cantidad_neta: null, unidad: null, unidades_pack: 1 }, g), null);
  assert.equal(cantidadComprada({ cantidad_neta: 1000, unidad: "g", unidades_pack: 1 }, g, 0), null);
});

test("cruce del umbral de stock bajo", () => {
  assert.equal(cruzaUmbral(600, 400, 500), true);
  assert.equal(cruzaUmbral(400, 300, 500), false); // ya estaba por debajo: no se repite el aviso
  assert.equal(cruzaUmbral(600, 550, 500), false);
  assert.equal(cruzaUmbral(600, 400, null), false);
  assert.equal(cruzaUmbral(500, 0, 500), true);
});
