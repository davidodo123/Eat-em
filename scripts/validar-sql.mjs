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

console.log("\nTODO OK");
await db.close();
