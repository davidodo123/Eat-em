import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularFaltas, diasDesdeHoy, paquetesPara } from "./necesidades.ts";

test("faltas de la lista automatica", () => {
  const consumos = [
    // Dos personas, arroz hoy y en dos dias; pollo manana; huevos solo dentro de 10 dias
    { ingrediente_id: "arroz_blanco", cantidad: 80, diasDesdeHoy: 0 }, { ingrediente_id: "arroz_blanco", cantidad: 70, diasDesdeHoy: 0 },
    { ingrediente_id: "arroz_blanco", cantidad: 80, diasDesdeHoy: 2 },
    { ingrediente_id: "pechuga_pollo", cantidad: 180, diasDesdeHoy: 1 },
    { ingrediente_id: "huevo", cantidad: 4, diasDesdeHoy: 10 },
    { ingrediente_id: "tomate", cantidad: 200, diasDesdeHoy: -1 }, // ayer: no cuenta
  ];
  const stock = new Map([["arroz_blanco", 100], ["pechuga_pollo", 500]]);
  assert.deepEqual(calcularFaltas(consumos, stock, 7), [
    { ingrediente_id: "arroz_blanco", necesario: 230, stock: 100, falta: 130, urgente: true }, // no llega a lo de hoy (150)
  ]);
  // A 14 dias entran los huevos
  assert.deepEqual(calcularFaltas(consumos, stock, 14).map((f) => f.ingrediente_id), ["arroz_blanco", "huevo"]);
  // A 3 dias, sin stock de nada
  assert.equal(calcularFaltas(consumos, new Map(), 3).length, 2);
});

test("paquetes y dias", () => {
  assert.equal(paquetesPara(130, 1000), 1);
  assert.equal(paquetesPara(2500, 1000), 3);
  assert.equal(paquetesPara(2000, 1000), 2);
  assert.equal(paquetesPara(5, null), null);
  assert.equal(diasDesdeHoy(0, 4, 4), 0);   // hoy viernes
  assert.equal(diasDesdeHoy(1, 0, 4), 3);   // el lunes que viene
});
