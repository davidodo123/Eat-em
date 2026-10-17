import { test } from "node:test";
import assert from "node:assert/strict";
import { cadenaDe, codigoPostalValido, distanciaKm, resumirTiendas } from "./cadenas.ts";

test("cadena desde las etiquetas de OpenStreetMap", () => {
  assert.equal(cadenaDe({ brand: "Mercadona", name: "Mercadona" }), "mercadona");
  assert.equal(cadenaDe({ name: "Carrefour Express" }), "carrefour");
  assert.equal(cadenaDe({ brand: "Ahorramás" }), "ahorramas");
  assert.equal(cadenaDe({ name: "Dia %" }), "dia");
  assert.equal(cadenaDe({ name: "Supermercados Dia" }), "dia");
  assert.equal(cadenaDe({ name: "Supermercado Medina" }), null);   // "medina" no es Dia
  assert.equal(cadenaDe({ name: "Coviran" }), null);
  assert.equal(cadenaDe({ brand: "Lidl", name: "Lidl Motril" }), "lidl");
});

test("distancia y resumen de tiendas cercanas", () => {
  const motril = { lat: 36.7238, lon: -3.5221 };
  assert.ok(Math.abs(distanciaKm(motril, { lat: 36.7144, lon: -3.3486 }) - 15.5) < 0.6); // Castell de Ferro
  const r = resumirTiendas(motril, [
    { lat: 36.74, lon: -3.52, tags: { name: "Lidl" } },
    { lat: 36.725, lon: -3.522, tags: { brand: "Mercadona", name: "Mercadona" } },
    { lat: 36.73, lon: -3.53, tags: { name: "Coviran" } },
    { lat: 36.726, lon: -3.521, tags: { brand: "Mercadona" } },
  ]);
  assert.deepEqual(r.cadenas, ["mercadona", "lidl"]);
  assert.equal(r.tiendas[0].nombre, "Mercadona");
  assert.equal(r.tiendas.at(-1)!.nombre, "Lidl");
});

test("codigo postal", () => {
  assert.ok(codigoPostalValido("18740"));
  assert.ok(codigoPostalValido("08001"));
  assert.ok(!codigoPostalValido("00123"));
  assert.ok(!codigoPostalValido("53000"));
  assert.ok(!codigoPostalValido("1874"));
});
