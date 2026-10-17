// Genera supabase/seed.sql a partir de data/catalogo-base.json y data/fichas.json.
// Uso: npm run db:seed   (no conecta a ninguna base de datos)
// Las fichas se insertan sin embedding; se calculan con la ingesta del RAG (Fase 6).
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const leer = (f) => JSON.parse(fs.readFileSync(path.join(raiz, f), "utf8"));
const catalogo = leer("data/catalogo-base.json");
const fichas = leer("data/fichas.json");

const lit = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return "ARRAY[" + v.map(lit).join(",") + "]::text[]";
  return "'" + String(v).replaceAll("'", "''") + "'";
};
const fila = (vals) => "(" + vals.map(lit).join(", ") + ")";

const sql = [];
sql.push("-- GENERADO por scripts/generar-seed.mjs. No editar a mano.\n");

sql.push("INSERT INTO supermercados (id, nombre, web, activo, orden) VALUES");
sql.push(catalogo.supermercados.map((s) => fila([s.id, s.nombre, s.web, s.activo, s.orden])).join(",\n"));
sql.push("ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, web = EXCLUDED.web, activo = EXCLUDED.activo, orden = EXCLUDED.orden;\n");

sql.push("INSERT INTO categorias (slug, nombre, orden) VALUES");
sql.push(catalogo.categorias.map((c) => fila([c.slug, c.nombre, c.orden])).join(",\n"));
sql.push("ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden;\n");

sql.push(
  "INSERT INTO ingredientes (id, nombre, categoria_id, unidad, gramos_por_unidad, sinonimos, excluir, etiquetas, alergenos,\n" +
  "  perecedero, dias_conservacion, kcal_100, proteinas_100, grasas_100, hidratos_100, fibra_100, nutricion_fuente)\nVALUES"
);
sql.push(
  catalogo.ingredientes
    .map((i) =>
      "(" +
      [
        lit(i.id), lit(i.nombre),
        `(SELECT id FROM categorias WHERE slug = ${lit(i.categoria)})`,
        lit(i.unidad) + "::unidad_base", lit(i.gramos_por_unidad ?? null),
        lit(i.sinonimos), lit(i.excluir ?? []), lit(i.etiquetas), lit(i.alergenos),
        lit(i.perecedero), lit(i.dias ?? null),
        lit(i.kcal), lit(i.p), lit(i.g), lit(i.h), lit(i.f), lit("aprox_referencia"),
      ].join(", ") +
      ")"
    )
    .join(",\n")
);
sql.push(
  "ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, categoria_id = EXCLUDED.categoria_id, unidad = EXCLUDED.unidad,\n" +
  "  gramos_por_unidad = EXCLUDED.gramos_por_unidad, sinonimos = EXCLUDED.sinonimos, excluir = EXCLUDED.excluir, etiquetas = EXCLUDED.etiquetas,\n" +
  "  alergenos = EXCLUDED.alergenos, perecedero = EXCLUDED.perecedero, dias_conservacion = EXCLUDED.dias_conservacion,\n" +
  "  kcal_100 = EXCLUDED.kcal_100, proteinas_100 = EXCLUDED.proteinas_100, grasas_100 = EXCLUDED.grasas_100,\n" +
  "  hidratos_100 = EXCLUDED.hidratos_100, fibra_100 = EXCLUDED.fibra_100;\n"
);

sql.push("INSERT INTO fichas (id, tema, regla, por_que, evidencia, fuente, revision, prioridad) VALUES");
sql.push(
  fichas.map((f) => fila([f.id, f.tema, f.regla, f.por_que, f.evidencia, f.fuente, f.revision, f.prioridad])).join(",\n")
);
sql.push(
  "ON CONFLICT (id) DO UPDATE SET tema = EXCLUDED.tema, regla = EXCLUDED.regla, por_que = EXCLUDED.por_que,\n" +
  "  evidencia = EXCLUDED.evidencia, fuente = EXCLUDED.fuente, revision = EXCLUDED.revision, prioridad = EXCLUDED.prioridad;\n"
);

const destino = path.join(raiz, "supabase", "seed.sql");
fs.writeFileSync(destino, sql.join("\n"));
console.log(
  `seed.sql generado: ${catalogo.supermercados.length} supermercados, ${catalogo.categorias.length} categorias, ` +
  `${catalogo.ingredientes.length} ingredientes, ${fichas.length} fichas`
);
