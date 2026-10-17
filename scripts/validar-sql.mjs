// Valida las migraciones + seed en un Postgres embebido (PGlite) sin Docker.
// Simula lo minimo de Supabase (schema auth, roles) y prueba los flujos clave,
// incluida la seguridad por filas (RLS) entre dos hogares distintos.
// Uso: npm run db:validar
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const raiz = path.resolve(import.meta.dirname, "..");
const db = new PGlite({ extensions: { vector, pg_trgm, unaccent } });

// --- Simulacion minima de Supabase ---
await db.exec(`
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB DEFAULT '{}');
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE ROLE authenticated;
  CREATE ROLE anon;
  GRANT USAGE ON SCHEMA auth, public TO authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
`);

const dirMig = path.join(raiz, "supabase", "migrations");
for (const f of fs.readdirSync(dirMig).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(fs.readFileSync(path.join(dirMig, f), "utf8"));
  console.log("OK migracion", f);
}
await db.exec(fs.readFileSync(path.join(raiz, "supabase", "seed.sql"), "utf8"));
console.log("OK seed");

// Supabase concede estos permisos por defecto al rol authenticated
await db.exec(`
  GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
`);

const A = "00000000-0000-0000-0000-00000000000a"; // hermano
const B = "00000000-0000-0000-0000-00000000000b"; // novia
const X = "00000000-0000-0000-0000-00000000000c"; // otra persona, otro hogar
await db.exec(`INSERT INTO auth.users (id, email) VALUES
  ('${A}', 'a@test.es'), ('${B}', 'b@test.es'), ('${X}', 'x@test.es')`);

// Ejecuta como un usuario autenticado concreto (con RLS activo)
async function como(uid, fn) {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await db.exec("RESET ROLE;"); }
}
const q = (sql, params) => db.query(sql, params).then((r) => r.rows);
const uno = async (sql, params) => (await q(sql, params))[0];

// 1. Alta: el trigger crea perfil, salud y preferencias
assert.equal((await uno("SELECT count(*)::int n FROM perfiles")).n, 3);
assert.equal((await uno("SELECT count(*)::int n FROM perfiles_salud")).n, 3);

// 2. Grupo: A crea, B se une por codigo, X crea otro hogar
const grupo = await como(A, () => uno("SELECT * FROM crear_grupo('Casa')"));
await como(B, () => q("SELECT unirse_grupo($1)", [grupo.codigo_invitacion.toLowerCase()]));
const grupoX = await como(X, () => uno("SELECT * FROM crear_grupo('Otra casa')"));
assert.equal((await uno("SELECT count(*)::int n FROM grupo_miembros WHERE grupo_id=$1", [grupo.id])).n, 2);
console.log("OK grupos e invitacion por codigo");

// 3. Compra: 1 kg de arroz y 1 kg de pollo entran al inventario
await como(A, () => q(
  `INSERT INTO inventario_movimientos (grupo_id, ingrediente_id, tipo, delta, usuario_id, precio_pagado, supermercado_id)
   VALUES ($1,'arroz_blanco','compra',1000,$2,1.20,'mercadona'), ($1,'pechuga_pollo','compra',1000,$2,6.50,'mercadona')`,
  [grupo.id, A]));

// 4. Dieta de A: comida = 100 g arroz + 200 g pollo
const comidaId = await como(A, async () => {
  const d = await uno(`INSERT INTO dietas (usuario_id, grupo_id, semana_inicio, estado) VALUES ($1,$2,'2026-10-12','activa') RETURNING id`, [A, grupo.id]);
  const c = await uno(`INSERT INTO dieta_comidas (dieta_id, dia, tipo, nombre) VALUES ($1,'lunes','comida','Arroz con pollo') RETURNING id`, [d.id]);
  await q(`INSERT INTO dieta_comida_ingredientes VALUES ($1,'arroz_blanco',100), ($1,'pechuga_pollo',200)`, [c.id]);
  return c.id;
});

// 5. Hecha con cantidad editada: arroz 110 g (pollo segun plan, 200 g)
const stock = async () => Object.fromEntries(
  (await q("SELECT ingrediente_id, cantidad::float FROM inventario WHERE grupo_id=$1", [grupo.id]))
    .map((r) => [r.ingrediente_id, r.cantidad]));
await como(A, () => q(`SELECT registrar_consumo($1,'hecha',$2,NULL,'2026-10-12',$3)`,
  [grupo.id, comidaId, JSON.stringify([{ ingrediente_id: "arroz_blanco", cantidad: 110 }, { ingrediente_id: "pechuga_pollo", cantidad: 200 }])]));
assert.deepEqual(await stock(), { arroz_blanco: 890, pechuga_pollo: 800 });

// Corregir la misma comida (120 g arroz) revierte lo anterior y aplica lo nuevo
await como(A, () => q(`SELECT registrar_consumo($1,'hecha',$2,NULL,'2026-10-12',$3)`,
  [grupo.id, comidaId, JSON.stringify([{ ingrediente_id: "arroz_blanco", cantidad: 120 }, { ingrediente_id: "pechuga_pollo", cantidad: 200 }])]));
assert.deepEqual(await stock(), { arroz_blanco: 880, pechuga_pollo: 800 });

// Hecha sin cantidades -> usa las planificadas
await como(A, () => q(`SELECT registrar_consumo($1,'hecha',$2,NULL,'2026-10-13')`, [grupo.id, comidaId]));
assert.deepEqual(await stock(), { arroz_blanco: 780, pechuga_pollo: 600 });

// Saltada -> no descuenta
await como(A, () => q(`SELECT registrar_consumo($1,'saltada',$2,NULL,'2026-10-14')`, [grupo.id, comidaId]));
assert.deepEqual(await stock(), { arroz_blanco: 780, pechuga_pollo: 600 });

// Extra no planificada de B (consume del inventario compartido)
await como(B, () => q(`SELECT registrar_consumo($1,'extra',NULL,'merienda','2026-10-14',$2,'Tortitas')`,
  [grupo.id, JSON.stringify([{ ingrediente_id: "arroz_blanco", cantidad: 30 }])]));
assert.deepEqual(await stock(), { arroz_blanco: 750, pechuga_pollo: 600 });
console.log("OK consumo: hecha, editada, re-registro, saltada y extra");

// 6. Lista: item de pollo, marcar comprado -> pasa al inventario
await como(B, async () => {
  const it = await uno(`INSERT INTO lista_items (grupo_id, ingrediente_id, cantidad, anadido_por) VALUES ($1,'pechuga_pollo',500,$2) RETURNING id`, [grupo.id, B]);
  await q("SELECT marcar_comprado($1)", [it.id]);
  await q("SELECT marcar_comprado($1)", [it.id]); // idempotente
});
assert.equal((await stock()).pechuga_pollo, 1100);
console.log("OK lista de la compra -> inventario");

// 7. RLS: X no ve nada del hogar de A/B ni puede escribir en el
await como(X, async () => {
  assert.equal((await q("SELECT * FROM inventario WHERE grupo_id=$1", [grupo.id])).length, 0);
  assert.equal((await q("SELECT * FROM dietas")).length, 0);
  assert.equal((await q("SELECT * FROM perfiles_salud WHERE usuario_id <> $1", [X])).length, 0);
  assert.equal((await q("SELECT * FROM perfiles")).length, 1);
  await assert.rejects(q(`INSERT INTO lista_items (grupo_id, texto_libre) VALUES ($1,'hackeo')`, [grupo.id]));
  await assert.rejects(q(`SELECT registrar_consumo($1,'extra',NULL,'cena',current_date,'[]')`, [grupo.id]));
  assert.equal((await q("SELECT * FROM grupos")).length, 1);
});
// B ve el perfil (nombre) de A pero no su salud; ve la dieta de A (mismo grupo)
await como(B, async () => {
  assert.equal((await q("SELECT * FROM perfiles")).length, 2);
  assert.equal((await q("SELECT * FROM perfiles_salud")).length, 1);
  assert.equal((await q("SELECT * FROM dietas")).length, 1);
  await q("UPDATE grupos SET nombre='x' WHERE id=$1", [grupo.id]); // miembro no-admin: RLS lo ignora
});
assert.equal((await uno("SELECT nombre FROM grupos WHERE id=$1", [grupo.id])).nombre, "Casa");
console.log("OK seguridad por filas (RLS) entre hogares y datos de salud");

// 8. Busqueda tolerante: acentos y erratas
await db.exec(`INSERT INTO productos (supermercado_id, id_origen, nombre, marca, formato_texto, cantidad_neta, unidad, precio)
  VALUES ('mercadona','1','Leche semidesnatada','Hacendado','1 L',1000,'ml',0.89),
         ('mercadona','2','Plátano de Canarias','Hacendado','1 kg',1000,'g',2.10)`);
await como(A, async () => {
  assert.equal((await uno("SELECT nombre FROM buscar_productos('platano')")).nombre, "Plátano de Canarias");
  assert.equal((await uno("SELECT nombre FROM buscar_productos('leche semidesnatda')")).nombre, "Leche semidesnatada");
});
console.log("OK busqueda sin acentos y con erratas");

// 9. Fichas y busqueda hibrida (con un embedding ficticio)
const ficticio = "[" + Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0)).join(",") + "]";
await db.query("UPDATE fichas SET embedding = $1::vector WHERE id='FICHA-007'", [ficticio]);
const fichas = await q("SELECT * FROM buscar_fichas($1::vector, 'como por ansiedad y estres', 3)", [ficticio]);
assert.equal(fichas[0].id, "FICHA-007");
assert.equal((await uno("SELECT count(*)::int n FROM fichas WHERE prioridad")).n, 3);
console.log("OK fichas RAG (busqueda hibrida)");

// 10. Open Food Facts: nutricion por EAN y clusters (sin pisar datos de la tienda)
await db.exec(`
  INSERT INTO productos (supermercado_id, id_origen, nombre, ean, precio) VALUES
    ('carrefour','c1','Yogur natural Danone','8480000123459',1.0),
    ('ahorramas','a1','Yogur natural Danone','8480000123459',1.1);
  INSERT INTO productos (supermercado_id, id_origen, nombre, ean, kcal_100, nutricion_origen) VALUES
    ('gadis','g1','Yogur natural Danone','8480000123459',99,'tienda');
  INSERT INTO off_productos (ean, nombre, kcal_100, proteinas_100, alergenos, en_espana)
    VALUES ('8480000123459','Yogur natural',60,3.5,'{leche}',true);
`);
assert.equal((await uno("SELECT aplicar_off(1, 100000) n")).n, 2);
assert.equal((await uno("SELECT aplicar_off(1, 100000) n")).n, 0); // idempotente
const yogures = await q("SELECT supermercado_id, kcal_100::float k, alergenos, nutricion_origen FROM productos WHERE ean='8480000123459' ORDER BY supermercado_id");
assert.deepEqual(yogures.map((y) => [y.supermercado_id, y.k, y.nutricion_origen]),
  [["ahorramas", 60, "off"], ["carrefour", 60, "off"], ["gadis", 99, "tienda"]]);
assert.deepEqual(yogures[0].alergenos, ["leche"]);
assert.equal((await uno("SELECT agrupar_por_ean(1, 100000) n")).n, 3);
assert.equal((await uno("SELECT count(DISTINCT cluster_id)::int n FROM productos WHERE ean='8480000123459'")).n, 1);
await como(A, async () => {
  assert.equal((await uno("SELECT count(*)::int n FROM off_productos")).n, 1); // lectura para usuarios
});
console.log("OK Open Food Facts por EAN y clusters");

// 11. Enlace automatico ingrediente -> productos
await db.exec(`
  INSERT INTO productos (supermercado_id, id_origen, nombre, categoria_id) VALUES
    ('carrefour','l1','Leche semidesnatada Asturiana 1 l', (SELECT id FROM categorias WHERE slug='lacteos')),
    ('carrefour','l2','Leche semi Pascual 1 l',            (SELECT id FROM categorias WHERE slug='lacteos')),
    ('carrefour','l5','Leche entera Pascual 1 l',          (SELECT id FROM categorias WHERE slug='lacteos')),
    ('carrefour','l3','Chocolate con leche Milka',          (SELECT id FROM categorias WHERE slug='despensa')),
    ('carrefour','l4','Platanos de Canarias',               (SELECT id FROM categorias WHERE slug='fruta'));
`);
const conf = async (ing, nombre) => (await uno(
  "SELECT ip.confianza::float c, ip.metodo FROM ingrediente_productos ip JOIN productos p ON p.id = ip.producto_id WHERE ip.ingrediente_id = $1 AND p.nombre = $2",
  [ing, nombre]));
assert.ok((await uno("SELECT enlazar_ingredientes('carrefour', 1, 100000) n")).n >= 3);
assert.equal((await conf("leche_semidesnatada", "Leche semidesnatada Asturiana 1 l")).c, 1);
assert.equal((await conf("leche_semidesnatada", "Leche semi Pascual 1 l")).c, 0.8);     // por el sinonimo "leche semi"
assert.equal(await conf("leche_semidesnatada", "Leche entera Pascual 1 l"), undefined);   // "entera" esta excluida
assert.equal(await conf("leche_semidesnatada", "Chocolate con leche Milka"), undefined); // otra categoria
assert.equal((await conf("platano", "Platanos de Canarias")).c, 1);                      // plural por stemming
await db.exec("SELECT enlazar_ingredientes('mercadona', 1, 100000)");                    // sin categoria: x0.7
assert.equal((await conf("leche_semidesnatada", "Leche semidesnatada")).c, 0.7);
// Los manuales no se tocan y los automaticos que dejan de casar se borran
await db.exec(`UPDATE ingrediente_productos SET metodo='manual', confianza=1
  WHERE producto_id = (SELECT id FROM productos WHERE id_origen='l2')`);
await db.exec("UPDATE productos SET nombre='Bebida de avena Oatly' WHERE id_origen='l1'");
await db.exec("SELECT enlazar_ingredientes('carrefour', 1, 100000)");
assert.equal(await conf("leche_semidesnatada", "Bebida de avena Oatly"), undefined);
assert.deepEqual(await conf("leche_semidesnatada", "Leche semi Pascual 1 l"), { c: 1, metodo: "manual" });
// Las palabras excluidas descartan el producto aunque el nombre case
await db.exec(`INSERT INTO productos (supermercado_id, id_origen, nombre, categoria_id) VALUES
  ('carrefour','hv1','Huevos frescos L Carrefour 12 ud', (SELECT id FROM categorias WHERE slug='huevos')),
  ('carrefour','hv2','Huevos de codorniz 18 ud',          (SELECT id FROM categorias WHERE slug='huevos'))`);
await db.exec("SELECT enlazar_ingredientes('carrefour', 1, 100000)");
assert.ok(await conf("huevo", "Huevos frescos L Carrefour 12 ud"));
assert.equal(await conf("huevo", "Huevos de codorniz 18 ud"), undefined);
console.log("OK enlace automatico de ingredientes");

// 12. Emparejar por nombre los productos sin EAN (Mercadona) con OFF y con otras tiendas
assert.equal((await uno("SELECT nombre_comparable('Leche Semidesnatada HACENDADO 1 L', 'Hacendado') n")).n, "leche semidesnatada 1 l");
assert.deepEqual((await uno("SELECT palabras_clave('Leche entera Hacendado 6 bricks x 1 L', 'Hacendado') p")).p, ["entera", "leche"]);
assert.deepEqual((await uno("SELECT palabras_clave('Atún claro en aceite de oliva, pack 3x80g', NULL) p")).p, ["aceite", "atun", "claro", "oliva"]);
await db.exec(`
  INSERT INTO off_productos (ean, nombre, marca, cantidad_neta, unidad, kcal_100, en_espana) VALUES
    ('8480000101234','Leche semidesnatada','Hacendado',1000,'ml',46,true),
    ('8480000105555','Leche entera','Hacendado',1000,'ml',63,true);
  INSERT INTO productos (supermercado_id, id_origen, nombre, marca, ean, cantidad_neta, unidad) VALUES
    ('carrefour','cc1','Cacao soluble Cola Cao 760 g','Cola Cao','8410014312345',760,'g');
  INSERT INTO productos (supermercado_id, id_origen, nombre, marca, cantidad_neta, unidad) VALUES
    ('mercadona','3','Leche entera Hacendado 6 bricks x 1 L','Hacendado',6000,'ml'),
    ('mercadona','4','Cacao soluble Cola Cao','Cola Cao',NULL,NULL),
    ('mercadona','5','Leche desnatada Hacendado 1 L','Hacendado',1000,'ml');
`);
// '1' (leche semi 1 L) -> OFF; '4' -> Carrefour por marca; '3' (pack de 6) y '5' (desnatada) no casan
assert.equal((await uno("SELECT agrupar_por_similitud('mercadona', 1, 100000) n")).n, 2);
const clusterDe = async (idOrigen) => (await uno(
  "SELECT c.ean FROM productos p LEFT JOIN producto_clusters c ON c.id = p.cluster_id WHERE p.supermercado_id='mercadona' AND p.id_origen=$1",
  [idOrigen])).ean;
assert.equal(await clusterDe("1"), "8480000101234");
assert.equal(await clusterDe("4"), "8410014312345");
assert.equal(await clusterDe("3"), null);
assert.equal(await clusterDe("5"), null);
// La nutricion de OFF llega por el cluster
await db.exec("SELECT aplicar_off(1, 100000)");
assert.equal((await uno("SELECT kcal_100::float k FROM productos WHERE supermercado_id='mercadona' AND id_origen='1'")).k, 46);
console.log("OK emparejado por nombre sin EAN");

// 13. Comparador de precios por ingrediente (web de la tienda y precios de usuario)
await db.exec(`
  INSERT INTO productos (supermercado_id, id_origen, nombre, cantidad_neta, unidad, precio, precio_oferta, precio_por_unidad, unidad_precio) VALUES
    ('carrefour','ac1','AOVE Carbonell 1 l',     1000,'ml', 9.95, 8.95, 8.95,'l'),
    ('carrefour','ac2','AOVE Carrefour 1 l',     1000,'ml', 7.50, NULL, 7.50,'l'),
    ('carrefour','ac3','AOVE garrafa 5 l',       5000,'ml',34.00, NULL, 6.80,'l'),
    ('ahorramas','ah1','AOVE Alipende 1 l',      1000,'ml', 7.20, NULL, 7.20,'l');
  INSERT INTO productos (supermercado_id, id_origen, nombre, cantidad_neta, unidad) VALUES
    ('mercadona','me1','Aceite de oliva virgen extra Hacendado 1 L', 1000, 'ml');
  INSERT INTO ingrediente_productos (ingrediente_id, producto_id, confianza, metodo)
    SELECT 'aceite_oliva', id, 1, 'manual' FROM productos WHERE id_origen IN ('ac1','ac2','ac3','ah1','me1');
  INSERT INTO precios_usuario (ean, supermercado, precio, usuario_id, producto_id)
    SELECT '8480000000000', 'mercadona', 6.95, '${A}', id FROM productos WHERE id_origen = 'me1';
`);
const precios = await como(A, () => q("SELECT supermercado_id, nombre, precio::float, precio_por_unidad::float ppu, fuente FROM comparar_precios('aceite_oliva') ORDER BY ppu"));
assert.deepEqual(precios.map((p) => [p.supermercado_id, p.ppu, p.fuente]),
  [["carrefour", 6.8, "web"], ["mercadona", 6.95, "usuario"], ["ahorramas", 7.2, "web"]]);
console.log("OK comparador de precios por ingrediente");

// 14. Busqueda en el catalogo de las tiendas cercanas (prefijo, filtro por cadena, erratas)
await como(A, async () => {
  const nombres = async (sql) => (await q(sql)).map((r) => r.nombre);
  assert.ok((await nombres("SELECT nombre FROM buscar_en_tiendas('aove carb')")).includes("AOVE Carbonell 1 l"));
  assert.deepEqual(await nombres("SELECT nombre FROM buscar_en_tiendas('aove', ARRAY['ahorramas'])"), ["AOVE Alipende 1 l"]);
  assert.deepEqual(await nombres("SELECT nombre FROM buscar_en_tiendas('aove', '{}')"), await nombres("SELECT nombre FROM buscar_en_tiendas('aove')"));
  assert.equal((await nombres("SELECT nombre FROM buscar_en_tiendas('a')")).length, 0);
  assert.equal((await uno("SELECT precio::float FROM buscar_en_tiendas('carbonell')")).precio, 8.95);   // oferta
  assert.ok((await nombres("SELECT nombre FROM buscar_en_tiendas('platno canarias')")).includes("Plátano de Canarias")); // errata
});
console.log("OK busqueda en las tiendas cercanas");

// 15. Ubicacion del hogar (cualquier miembro, redondeada) y despensa por producto (RLS)
await como(B, () => q("SELECT fijar_ubicacion($1, 36.7238, -3.5221, 'Motril', 5::smallint, ARRAY['mercadona','carrefour'], '[]')", [grupo.id]));
const g = await uno("SELECT lat::float, lon::float, cadenas_cerca FROM grupos WHERE id = $1", [grupo.id]);
assert.deepEqual([g.lat, g.lon, g.cadenas_cerca], [36.72, -3.52, ["mercadona", "carrefour"]]);
await assert.rejects(como(X, () => q("SELECT fijar_ubicacion($1, 40, -3, 'Madrid', 5::smallint, '{}', '[]')", [grupo.id])));
const carb = await uno("SELECT id FROM productos WHERE id_origen = 'ac1'");
await como(A, () => q("INSERT INTO despensa (grupo_id, producto_id, ingrediente_id, cantidad_por_unidad, nombre, unidades) VALUES ($1, $2, 'aceite_oliva', 1000, 'AOVE Carbonell 1 l', 2)", [grupo.id, carb.id]));
await assert.rejects(como(A, () => q("INSERT INTO despensa (grupo_id, producto_id, nombre) VALUES ($1, $2, 'otra vez')", [grupo.id, carb.id])));
assert.equal((await como(B, () => q("SELECT * FROM despensa"))).length, 1);
assert.equal((await como(X, () => q("SELECT * FROM despensa"))).length, 0);
await assert.rejects(como(X, () => q("INSERT INTO despensa (grupo_id, nombre) VALUES ($1, 'intruso')", [grupo.id])));
console.log("OK ubicacion del hogar y despensa por producto");

// 16. Supermercados cercanos desde la copia de OpenStreetMap
await db.exec(`INSERT INTO tiendas_osm (osm_id, cadena, nombre, lat, lon) VALUES
  ('n1', 'mercadona', 'Mercadona', 36.7250, -3.5220),
  ('n2', 'lidl', 'Lidl', 36.7400, -3.5200),
  ('n3', NULL, 'Covirán', 36.7300, -3.5300),
  ('n4', 'carrefour', 'Carrefour Granada', 37.1773, -3.5986)`);
const cerca = await como(A, () => q("SELECT cadena, nombre, km::float FROM tiendas_cerca(36.7238, -3.5221, 5)"));
assert.deepEqual(cerca.map((t) => t.nombre), ["Mercadona", "Covirán", "Lidl"]);   // Granada (~55 km) fuera
assert.ok(cerca[0].km < 0.2 && cerca[2].km > 1.5 && cerca[2].km < 2);
assert.equal((await como(A, () => q("SELECT * FROM tiendas_cerca(36.7238, -3.5221, 100)"))).length, 4);
await assert.rejects(como(A, () => q("INSERT INTO tiendas_osm (osm_id, nombre, lat, lon) VALUES ('x', 'x', 0, 0)")));
console.log("OK supermercados cercanos (OpenStreetMap)");

console.log("\nTODO OK");
await db.close();
