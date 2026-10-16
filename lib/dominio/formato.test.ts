import { test } from "node:test";
import assert from "node:assert/strict";
import { elegirFormato, formatoDesdePrecioUnidad, parsearFormato, precioPorUnidad } from "./formato.ts";
import { eanValido, normalizarEan } from "./ean.ts";

test("formatos simples", () => {
  assert.deepEqual(parsearFormato("1 l."), { cantidad: 1000, unidad: "ml", pack: 1, aproximado: false });
  assert.deepEqual(parsearFormato("75 cl."), { cantidad: 750, unidad: "ml", pack: 1, aproximado: false });
  assert.deepEqual(parsearFormato("750 ml ."), { cantidad: 750, unidad: "ml", pack: 1, aproximado: false });
  assert.deepEqual(parsearFormato("Arroz redondo Sos 1 kg."), { cantidad: 1000, unidad: "g", pack: 1, aproximado: false });
  assert.deepEqual(parsearFormato("1,5 kg"), { cantidad: 1500, unidad: "g", pack: 1, aproximado: false });
  assert.deepEqual(parsearFormato("12 ud"), { cantidad: 12, unidad: "unidad", pack: 1, aproximado: false });
  assert.deepEqual(parsearFormato("80 lavados."), { cantidad: 80, unidad: "unidad", pack: 1, aproximado: false });
  assert.equal(parsearFormato("Galletas 4 lunes"), null); // "l" no debe casar dentro de una palabra
});

test("packs", () => {
  assert.deepEqual(parsearFormato("pack 12x33 cl."), { cantidad: 3960, unidad: "ml", pack: 12, aproximado: false });
  assert.deepEqual(parsearFormato("6 x 125 g"), { cantidad: 750, unidad: "g", pack: 6, aproximado: false });
  assert.deepEqual(parsearFormato("Pack 6x25 cl"), { cantidad: 1500, unidad: "ml", pack: 6, aproximado: false });
  assert.deepEqual(parsearFormato("Cerveza Mahou Clásica pack 24 latas 33cl"),
    { cantidad: 7920, unidad: "ml", pack: 24, aproximado: false });
  assert.deepEqual(parsearFormato("Agua 6 botellas de 1,5 l"), { cantidad: 9000, unidad: "ml", pack: 6, aproximado: false });
});

test("formato desde el precio por unidad", () => {
  const delPrecio = formatoDesdePrecioUnidad(13.44, 1.7, "l");
  assert.deepEqual(delPrecio, { cantidad: 7906, unidad: "ml", pack: 1, aproximado: false });
  // El nombre cuadra: se queda el del nombre (exacto)
  assert.deepEqual(elegirFormato(parsearFormato("pack 24 latas 33cl"), delPrecio)?.cantidad, 7920);
  // El nombre no cuadra ("33cl" sin pack): manda la tienda
  assert.equal(elegirFormato(parsearFormato("Cerveza lata 33cl"), delPrecio)?.cantidad, 7906);
  assert.deepEqual(formatoDesdePrecioUnidad(2.4, 0.2, "unidad"), { cantidad: 12, unidad: "unidad", pack: 1, aproximado: false });
  assert.equal(formatoDesdePrecioUnidad(null, 1, "kg"), null);
});

test("peso variable y sin formato", () => {
  assert.deepEqual(parsearFormato("Pechuga de pollo fileteada Carrefour 1 kg aprox"),
    { cantidad: 1000, unidad: "g", pack: 1, aproximado: true });
  assert.equal(parsearFormato(""), null);
  assert.equal(parsearFormato("Recuerdos de un hacendado"), null);
});

test("precio por unidad", () => {
  assert.deepEqual(precioPorUnidad(0.95, parsearFormato("1 l.")!), { valor: 0.95, unidad: "l" });
  assert.deepEqual(precioPorUnidad(1.2, parsearFormato("500 g")!), { valor: 2.4, unidad: "kg" });
  assert.deepEqual(precioPorUnidad(2.4, parsearFormato("12 ud")!), { valor: 0.2, unidad: "unidad" });
});

test("EAN", () => {
  assert.equal(eanValido("8437012214583"), true);   // leche La Cantara (Carrefour)
  assert.equal(eanValido("8437012214584"), false);  // digito de control erroneo
  assert.equal(eanValido("0000000000000"), false);
  assert.equal(eanValido("96385074"), true);         // EAN-8
  assert.equal(normalizarEan(" 8437012214583 "), "8437012214583");
  assert.equal(normalizarEan("123"), null);
});
