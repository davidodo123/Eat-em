// Tests de parseo y normalizacion con respuestas grabadas (fixtures/) o recortadas de las reales.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as ahorramas from "./ahorramas/index.ts";
import * as gadis from "./gadis/index.ts";
import * as caprabo from "./caprabo/index.ts";
import * as mercadona from "./mercadona/index.ts";
import { normalizar as normalizarCarrefour } from "./carrefour/index.ts";
import { adivinarCategoria } from "./comun/categorias.ts";
import { decodificar, tituloMarca } from "./comun/texto.ts";
import { convertir as convertirOff } from "./off/importar.ts";
import { alergenosDesdeOff } from "../lib/dominio/alergenos.ts";

const AHORA = "2026-10-16T00:00:00.000Z";
const fixture = (ruta: string) => fs.readFileSync(new URL(ruta, import.meta.url), "utf8");

test("carrefour: normalizar", () => {
  const p = normalizarCarrefour({
    product_id: "R-521006458", display_name: "Leche semidesnatada La Cantara 1 l.", brand: "LA CANTARA",
    ean13: "8437012214583", active_price: 0.95, measure_unit: "l", unit_conversion_factor: 1, recipient: "1 l.",
    parent_category: { food: "cat20005" }, image_path: { food: "https://static.carrefour.es/x.jpg" },
    urls: { food: "/supermercado/leche/R-521006458/p" }, active_food: true,
  }, AHORA);
  assert.equal(p.marca, "La Cantara");
  assert.equal(p.ean, "8437012214583");
  assert.deepEqual([p.cantidad_neta, p.unidad, p.unidades_pack], [1000, "ml", 1]);
  assert.deepEqual([p.precio, p.precio_oferta, p.precio_por_unidad, p.unidad_precio], [0.95, null, 0.95, "l"]);
  assert.equal(p.url_origen, "https://www.carrefour.es/supermercado/leche/R-521006458/p");
  assert.equal(p.disponible, true);

  // Pack: el factor de la API es el total; el pack sale del texto. Precio 0 = no disponible
  const pack = normalizarCarrefour({
    product_id: "R-1", display_name: "Cerveza Mahou pack 12x33 cl.", measure_unit: "l", unit_conversion_factor: 3.96,
    recipient: "pack 12x33 cl.", active_price: 0,
  }, AHORA);
  assert.deepEqual([pack.cantidad_neta, pack.unidad, pack.unidades_pack], [3960, "ml", 12]);
  assert.equal(pack.precio, null);
  assert.equal(pack.disponible, false);

  // La API trae a veces el factor x10 ("95 g." con 0,95 kg): manda el texto del envase
  const lata = normalizarCarrefour({
    product_id: "R-2", display_name: "Pechuga de pollo al natural Adelís sin gluten 95 g.", measure_unit: "kg",
    unit_conversion_factor: 0.95, recipient: "95 g.", active_price: 2.09,
  }, AHORA);
  assert.deepEqual([lata.cantidad_neta, lata.unidad, lata.precio_por_unidad], [95, "g", 22]);

  // El envase tambien falla ("0,25 l." con "250 cl."): el nombre confirma la API y manda la API
  const aceite = normalizarCarrefour({
    product_id: "R-5", display_name: "Aceite de oliva virgen extra Manzuno 0,25 l.", measure_unit: "l",
    unit_conversion_factor: 0.25, recipient: "250 cl.", active_price: 2.55,
  }, AHORA);
  assert.deepEqual([aceite.cantidad_neta, aceite.unidad, aceite.precio_por_unidad], [250, "ml", 10.2]);

  // Peso variable: la API trae 0,001 kg (1 g); manda el nombre, y sin el no hay formato
  const corte = normalizarCarrefour({
    product_id: "R-3", display_name: "Pechuga de Pollo Pollosí Noel al corte 250 g aprox", measure_unit: "kg",
    unit_conversion_factor: 0.001, recipient: "Bandeja de ", active_price: 1.97, variable_weight: true,
  }, AHORA);
  assert.deepEqual([corte.cantidad_neta, corte.unidad, corte.precio_por_unidad], [250, "g", 7.88]);
  const sinTexto = normalizarCarrefour({
    product_id: "R-4", display_name: "Pechuga de pollo Label", measure_unit: "kg",
    unit_conversion_factor: 0.001, recipient: "Bandeja de ", active_price: 9.83, variable_weight: true,
  }, AHORA);
  assert.deepEqual([sinTexto.cantidad_neta, sinTexto.precio_por_unidad, sinTexto.precio], [null, null, 9.83]);
});

test("mercadona: pagina de producto", () => {
  const html = `<head><meta name="description" content="Huevos de codorniz &amp; m&aacute;s">
    <meta property="og:image" content="https://prod-mercadona.imgix.net/images/f884.jpeg?fit=crop&h=600&w=600"></head>`;
  assert.deepEqual(mercadona.parsearPagina(html),
    { nombre: "Huevos de codorniz & más", imagen: "https://prod-mercadona.imgix.net/images/f884.jpeg?fit=crop&h=600&w=600" });
  assert.equal(mercadona.nombreDesdeSlug("https://tienda.mercadona.es/product/31011/huevos-codorniz-paquete"),
    "Huevos codorniz paquete");
  const p = mercadona.fila("4241", "u", "Leche semidesnatada Hacendado 6 bricks x 1 L", null, AHORA);
  assert.equal(p.marca, "Hacendado");
  assert.equal(p.precio, null);
});

test("ahorramas: listado de categoria", () => {
  const html = fixture("./ahorramas/fixtures/listado.html");
  assert.equal(ahorramas.totalProductos(html), 2689);
  const items = ahorramas.parsearListado(html);
  assert.equal(items.length, 2);

  const [cerveza, patata] = items;
  assert.equal(cerveza.pid, "46839");
  assert.equal(cerveza.nombre, "Cerveza rubia Mahou Clásica pack 24 latas 33cl");
  assert.deepEqual([cerveza.precioLista, cerveza.precioVenta, cerveza.ppu, cerveza.unidadPpu], [18, 13.44, 1.7, "LITRO"]);
  assert.equal(cerveza.url, "https://www.ahorramas.com/cerveza-rubia-mahou-clasica-pack-24-latas-33cl-46839.html");
  assert.ok(cerveza.imagen?.startsWith("https://www.ahorramas.com/dw/image/") && !cerveza.imagen.includes("?"));

  const p = ahorramas.normalizar(cerveza, AHORA);
  assert.equal(p.marca, "Mahou Clasica");
  assert.deepEqual([p.precio, p.precio_oferta], [18, 13.44]); // en oferta
  assert.deepEqual([p.cantidad_neta, p.unidad, p.unidades_pack], [7920, "ml", 24]);
  assert.deepEqual([p.precio_por_unidad, p.unidad_precio], [1.7, "l"]);
  assert.equal(p.categoria_origen, "cerveza");

  // Frescos: la subcategoria viene en el gtm; al peso -> 1 kg aproximado
  assert.ok(patata.alPeso);
  assert.deepEqual(patata.ruta, ["Frescos", "Verduras de temporada"]);
  const q = ahorramas.normalizar(patata, AHORA);
  assert.deepEqual([q.cantidad_neta, q.unidad, q.precio, q.precio_oferta], [1000, "g", 1.89, 1.49]);
  assert.equal(q.categoria_origen, "verduras/de/temporada");
  assert.equal(adivinarCategoria(patata.ruta), "verdura");
});

test("ahorramas: docena", () => {
  const p = ahorramas.normalizar({
    pid: "1", nombre: "Huevos L Ahorramas 12 uds", marca: null, ruta: [], categoria: null, alPeso: false,
    url: null, imagen: null, precioLista: null, precioVenta: 2.4, ppu: 2.4, unidadPpu: "DOCENA",
  }, AHORA);
  assert.deepEqual([p.cantidad_neta, p.unidad, p.precio_por_unidad, p.unidad_precio], [12, "unidad", 0.2, "unidad"]);
});

test("gadis: categoria y ficha", () => {
  const { elementos, paginas } = gadis.parsearCategoria(fixture("./gadis/fixtures/categoria.html"));
  assert.equal(paginas, 1);
  assert.equal(elementos.length, 2);
  const p = gadis.normalizar(elementos[0], "https://www.gadisline.com/x", AHORA);
  assert.equal(p.id_origen, "8736179");
  assert.equal(p.nombre, "Vino blanco D.O.Monterrei CREGO E MONAGUILLO godello botella 75 cl");
  assert.deepEqual([p.cantidad_neta, p.unidad, p.precio, p.precio_por_unidad, p.unidad_precio], [750, "ml", 10.49, 13.99, "l"]);
  assert.equal(p.categoria_origen, "Bodega y bebidas > Vino blanco > Vino blanco D.O. Monterrei");

  const ficha = gadis.parsearFicha(fixture("./gadis/fixtures/ficha.html"))!;
  const f = gadis.normalizar(ficha, "https://www.gadisline.com/y", AHORA);
  assert.deepEqual([f.id_origen, f.marca, f.precio, f.cantidad_neta], ["8736184", "Ladairo", 8.1, 750]);
  assert.equal(adivinarCategoria(gadis.rutaCategorias(ficha)), "bebidas");

  // Al peso: el precio es el del kg
  const peso = gadis.normalizar({ product_code: 9104002, commercial_description: "Cordero entero kilo", price: 18.95, weight: "K" }, null, AHORA);
  assert.deepEqual([peso.cantidad_neta, peso.unidad, peso.precio_por_unidad, peso.unidad_precio], [1000, "g", 18.95, "kg"]);
});

test("gadis: categorias hoja", () => {
  const urls = ["https://g.com/lacteos", "https://g.com/lacteos/leche", "https://g.com/lacteos/leche/entera",
    "https://g.com/lacteos/yogures", "https://g.com/precios-especiales/lacteos"];
  assert.deepEqual(gadis.categoriasHoja(urls), ["https://g.com/lacteos/leche/entera", "https://g.com/lacteos/yogures"]);
});

test("caprabo: categoria y loadpage", () => {
  // Pagina de categoria (comillas dobles, metricas con &quot;)
  const [a] = caprabo.parsearTarjetas(fixture("./caprabo/fixtures/categoria.html"));
  assert.equal(a.id, "16837858");
  assert.equal(a.url, "https://www.capraboacasa.com/es/productdetail/16837858-danacol-para-beber-natural-danone-pack-14x110-ml/");
  assert.equal(a.imagen, "https://www.capraboacasa.com/images/16837858.jpg");
  assert.deepEqual([a.precio, a.precioAntes, a.ppu, a.unidadPpu], [7.99, null, 5.7, "KILO"]);
  const p = caprabo.normalizar(a, AHORA);
  assert.deepEqual([p.marca, p.cantidad_neta, p.unidad, p.unidades_pack, p.categoria_origen], ["Danacol", 1540, "ml", 14, "2059829"]);

  // loadpage (JSON con html de comillas simples)
  const lp = JSON.parse(fixture("./caprabo/fixtures/loadpage.json"));
  const [b] = caprabo.parsearTarjetas(lp.content);
  assert.equal(b.id, "26621649");
  assert.deepEqual([b.precio, b.ppu, b.categorias.length], [2.39, 6.29, 3]);
  assert.ok(lp._tapestry.inits.includes("pages/supermarket:finishPagination"));

  // Oferta (price-before) con el formato de la plataforma
  const oferta = caprabo.parsearTarjetas(`<div class="col border-0 product-item-lineal"><a class="product-title-link"
    data-metrics="{&quot;ecommerce&quot;:{&quot;items&quot;:[{&quot;price&quot;:1.5,&quot;item_name&quot;:&quot;Leche entera 1 l&quot;,&quot;item_id&quot;:&quot;9&quot;}]}}"></a>
    <span class="price-before"><span>1,95</span></span><span class="price-now"><span class="price-offer-now"> 1,50</span></span>`);
  const o = caprabo.normalizar(oferta[0], AHORA);
  assert.deepEqual([o.precio, o.precio_oferta, o.cantidad_neta], [1.95, 1.5, 1000]);
});

test("caprabo: sitemap", () => {
  const urls = ["https://www.capraboacasa.com/es/supermercado/2059806-alimentacion/",
    "https://www.capraboacasa.com/es/supermercado/2059806-alimentacion/2059818-yogures/",
    "https://www.capraboacasa.com/es/supermercado/6000072-papeleria-libros-y-juguetes/",
    "https://www.capraboacasa.com/es/supermercado/danacol/"];
  assert.deepEqual(caprabo.raicesCatalogo(urls), [urls[0]]);
  assert.equal(caprabo.nombresCategoria(urls).get("2059818"), "yogures");
});

test("categorias propias", () => {
  assert.equal(adivinarCategoria(["Congelados", "Verduras", "Guisantes"]), "congelados");
  assert.equal(adivinarCategoria(["Mascotas", "Perros", "Comida húmeda carne"]), "otros");
  assert.equal(adivinarCategoria(["Lácteos", "Yogures y kéfir"]), "lacteos");
  assert.equal(adivinarCategoria(["Alimentación", "Arroz, legumbres y pastas", "Alubias"]), "legumbres");
  assert.equal(adivinarCategoria(["Dulces y desayuno", "Cafés"]), "bebidas");
  assert.equal(adivinarCategoria(["Bebidas", "Refrescos"]), "bebidas");
  assert.equal(adivinarCategoria(["Frescos", "Charcutería"]), "carne");
  assert.equal(adivinarCategoria([]), null);
});

test("open food facts: conversion de filas", () => {
  const base = Object.fromEntries([
    "code", "last_modified_t", "product_name", "quantity", "brands", "categories_tags", "countries_tags",
    "ingredients_text", "allergens", "traces_tags", "nutriscore_grade", "nova_group", "image_url",
    "energy-kcal_100g", "fat_100g", "saturated-fat_100g", "carbohydrates_100g", "sugars_100g", "fiber_100g",
    "proteins_100g", "salt_100g"].map((c) => [c, ""])) as Parameters<typeof convertirOff>[0];
  const fila = {
    ...base, code: "8437012214583", product_name: "Leche semidesnatada", brands: "Hacendado,Mercadona",
    countries_tags: "en:france,en:spain", allergens: "en:milk", traces_tags: "en:nuts,en:soybeans",
    "energy-kcal_100g": "46", proteins_100g: "3.1", salt_100g: "0.13", nutriscore_grade: "b", nova_group: "1",
    last_modified_t: "1791181482",
  };
  const f = convertirOff(fila, new Set())!;
  assert.deepEqual([f.ean, f.marca, f.kcal_100, f.proteinas_100, f.sal_100, f.nutriscore, f.nova, f.en_espana],
    ["8437012214583", "Hacendado", 46, 3.1, 0.13, "b", 1, true]);
  assert.deepEqual([f.alergenos, f.trazas], [["leche"], ["soja", "frutos_cascara"]]);

  // Fuera de Espana o de marca de fabricante, solo si lo vende alguna tienda; sin datos utiles, nada
  const fuera = { ...fila, countries_tags: "en:france" };
  assert.equal(convertirOff(fuera, new Set()), null);
  assert.ok(convertirOff(fuera, new Set(["8437012214583"])));
  assert.equal(convertirOff({ ...fila, brands: "Danone" }, new Set()), null);
  assert.ok(convertirOff({ ...fila, brands: "Pascual, Dia" }, new Set()));
  assert.equal(convertirOff({ ...fila, brands: "Diamante" }, new Set()), null);
  assert.equal(convertirOff({ ...fila, "energy-kcal_100g": "", allergens: "", ingredients_text: "" }, new Set()), null);
  // EAN invalido, kcal imposibles y UPC-A de 12 digitos
  assert.equal(convertirOff({ ...fila, code: "8437012214584" }, new Set()), null);
  assert.equal(convertirOff({ ...fila, "energy-kcal_100g": "4600" }, new Set())?.kcal_100, null);
  assert.equal(convertirOff({ ...fila, code: "036000291452" }, new Set())?.ean, "0036000291452");
});

test("alergenos desde OFF", () => {
  assert.deepEqual(alergenosDesdeOff("en:milk,en:gluten,en:unknown,en:milk"), ["gluten", "leche"]);
  assert.deepEqual(alergenosDesdeOff(""), []);
  assert.deepEqual(alergenosDesdeOff("en:sulphur-dioxide-and-sulphites, EN:Sesame-seeds"), ["sesamo", "sulfitos"]);
});

test("texto", () => {
  assert.equal(decodificar("Caf&eacute; &amp; t&#233; &quot;x&quot;"), 'Café & té "x"');
  assert.equal(tituloMarca("DON SIMON"), "Don Simon");
  assert.equal(tituloMarca("Danone"), "Danone");
  assert.equal(tituloMarca(""), null);
});
