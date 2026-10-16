// Ejecuta un scraper y guarda el resultado.
//
//   npm run scraper -- carrefour                 ejecucion completa (escribe en Supabase)
//   npm run scraper -- carrefour --seco          sin tocar la base de datos (guarda en data/raw/)
//   npm run scraper -- carrefour --rapido        sin la expansion por marcas
//   npm run scraper -- carrefour --max-peticiones 50
//
// Variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SCRAPER_USER_AGENT.
// Codigo de salida 2 si hay alerta de calidad (para que GitHub Actions avise).
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { carrefour } from "./carrefour/index.ts";
import { mercadona } from "./mercadona/index.ts";
import { informeCalidad, type Anterior } from "./comun/calidad.ts";
import type { ProductoNormalizado, Scraper } from "./comun/tipos.ts";

const SCRAPERS: Record<string, Scraper> = { carrefour, mercadona };

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const seco = args.includes("--seco");
const rapido = args.includes("--rapido");
const maxIdx = args.indexOf("--max-peticiones");
const maxPeticiones = maxIdx >= 0 ? Number(args[maxIdx + 1]) : undefined;

const scraper = id ? SCRAPERS[id] : undefined;
if (!scraper) {
  console.error(`Uso: npm run scraper -- <${Object.keys(SCRAPERS).join("|")}> [--seco] [--rapido] [--max-peticiones N]`);
  process.exit(1);
}

const LOTE = 500;
const hoy = new Date().toISOString().slice(0, 10);
const marca = new Date().toISOString().slice(11, 16).replace(":", "");

async function main() {
  const db = seco ? null : clienteAdmin();
  const inicio = Date.now();
  let ejecucionId: number | null = null;

  if (db) {
    const { data, error } = await db.from("scraper_ejecuciones")
      .insert({ supermercado_id: scraper!.id, parametros: { rapido, maxPeticiones: maxPeticiones ?? null } })
      .select("id").single();
    if (error) throw error;
    ejecucionId = data.id;
  }

  // Dato bruto: JSONL comprimido, una linea por pagina descargada
  const raw: string[] = [];
  try {
    console.log(`Scraper ${scraper!.id}${seco ? " (seco)" : ""}...`);
    const anteriores = await cargarAnteriores(db, scraper!.id);
    const res = await scraper!.ejecutar({
      maxPeticiones, rapido, conocidos: anteriores, guardarRaw: (p) => raw.push(JSON.stringify(p)),
    });
    const rawGz = gzipSync(raw.join("\n"));
    const rawPath = `${scraper!.id}/${hoy}/${marca}.jsonl.gz`;

    // Mapeo de categorias de origen -> propias
    const categorias = await cargarCategorias(db);
    const mapeo = await mapearCategorias(db, scraper!.id, res.votosCategoria, categorias);
    for (const p of res.productos) p.categoria_id = p.categoria_origen ? mapeo.get(p.categoria_origen) ?? null : null;

    const ultimoTotal = await ultimoTotalOk(db, scraper!.id);
    const informe = informeCalidad(res.productos, anteriores, ultimoTotal);
    const resumen = {
      ...informe, peticiones: res.peticiones, errores_http: res.errores, avisos: res.avisos.slice(0, 30),
      duracion_s: Math.round((Date.now() - inicio) / 1000),
    };

    if (!db) {
      const dir = path.join("data", "raw", scraper!.id, hoy);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${marca}.jsonl.gz`), rawGz);
      fs.writeFileSync(path.join(dir, `${marca}.normalizado.json`), JSON.stringify(res.productos, null, 1));
      fs.writeFileSync(path.join(dir, `${marca}.informe.json`), JSON.stringify(resumen, null, 2));
      console.log(`\nGuardado en ${dir}`);
    } else {
      const subida = await db.storage.from("raw").upload(rawPath, rawGz, { contentType: "application/gzip", upsert: true });
      if (subida.error) res.avisos.push("No se pudo subir el raw: " + subida.error.message);

      const ids = await guardarProductos(db, res.productos);
      await guardarPrecios(db, res.productos, ids);
      // Solo se descatalogan productos si la ejecucion es fiable (sin alerta y sin tope)
      const fiable = !informe.alerta && maxPeticiones === undefined;
      if (fiable) informe.descatalogados = await descatalogar(db, scraper!.id, res.productos, anteriores);
      else informe.descatalogados = 0;

      const { error } = await db.from("scraper_ejecuciones").update({
        fin: new Date().toISOString(),
        estado: informe.alerta ? "alerta" : "ok",
        parametros: { ...res.parametros, tope: maxPeticiones ?? null },
        n_productos: informe.total,
        n_nuevos: informe.nuevos,
        n_descatalogados: informe.descatalogados,
        n_errores: res.errores,
        raw_path: subida.error ? null : "raw/" + rawPath,
        informe_calidad: { ...resumen, descatalogados: informe.descatalogados },
      }).eq("id", ejecucionId!);
      if (error) throw error;
    }

    imprimir(resumen);
    if (informe.alerta) {
      console.error(`\nALERTA: ${informe.alerta}`);
      process.exitCode = 2;
    }
  } catch (e) {
    console.error(e);
    if (db && ejecucionId) {
      await db.from("scraper_ejecuciones").update({
        fin: new Date().toISOString(), estado: "error", error: String((e as Error).message ?? e),
      }).eq("id", ejecucionId);
    }
    process.exitCode = 1;
  }
}

function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (o usa --seco)");
  return createClient(url, clave, { auth: { persistSession: false } });
}

async function cargarCategorias(db: SupabaseClient | null): Promise<Map<string, number>> {
  if (!db) {
    // En seco: ids ficticios en el orden del catalogo base
    const base = JSON.parse(fs.readFileSync("data/catalogo-base.json", "utf8"));
    return new Map(base.categorias.map((c: { slug: string }, i: number) => [c.slug, i + 1]));
  }
  const { data, error } = await db.from("categorias").select("id, slug");
  if (error) throw error;
  return new Map(data.map((c) => [c.slug, c.id]));
}

// Categoria de origen -> la categoria propia con mas votos. Las manuales mandan.
async function mapearCategorias(
  db: SupabaseClient | null, sid: string, votos: Map<string, Map<string, number>>, categorias: Map<string, number>,
) {
  const mapeo = new Map<string, number>();
  const manuales = new Set<string>();
  if (db) {
    const { data } = await db.from("categorias_origen").select("id_origen, categoria_id, metodo").eq("supermercado_id", sid);
    for (const c of data ?? []) {
      if (c.categoria_id) mapeo.set(c.id_origen, c.categoria_id);
      if (c.metodo === "manual") manuales.add(c.id_origen);
    }
  }
  const filas = [];
  for (const [cat, v] of votos) {
    if (manuales.has(cat)) continue;
    const [slug] = [...v.entries()].sort((a, b) => b[1] - a[1])[0];
    const catId = categorias.get(slug) ?? null;
    if (catId) mapeo.set(cat, catId);
    filas.push({ supermercado_id: sid, id_origen: cat, categoria_id: catId, metodo: "auto", updated_at: new Date().toISOString() });
  }
  if (db) for (const lote of trozos(filas, LOTE)) {
    const { error } = await db.from("categorias_origen").upsert(lote, { onConflict: "supermercado_id,id_origen" });
    if (error) throw error;
  }
  return mapeo;
}

async function cargarAnteriores(db: SupabaseClient | null, sid: string): Promise<Map<string, Anterior>> {
  const m = new Map<string, Anterior>();
  if (!db) return m;
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from("productos")
      .select("id_origen, nombre, imagen_url, precio, cantidad_neta, descatalogado_en")
      .eq("supermercado_id", sid).order("id").range(desde, desde + 999);
    if (error) throw error;
    for (const p of data) m.set(p.id_origen, p);
    if (data.length < 1000) return m;
  }
}

async function ultimoTotalOk(db: SupabaseClient | null, sid: string): Promise<number | null> {
  if (!db) return null;
  const { data } = await db.from("scraper_ejecuciones").select("n_productos")
    .eq("supermercado_id", sid).eq("estado", "ok").filter("parametros->>tope", "is", null)
    .order("inicio", { ascending: false }).limit(1);
  return data?.[0]?.n_productos ?? null;
}

async function guardarProductos(db: SupabaseClient, productos: ProductoNormalizado[]) {
  const ids = new Map<string, number>();
  for (const lote of trozos(productos, LOTE)) {
    const { data, error } = await db.from("productos")
      .upsert(lote, { onConflict: "supermercado_id,id_origen" }).select("id, id_origen");
    if (error) throw error;
    for (const p of data) ids.set(p.id_origen, p.id);
  }
  return ids;
}

async function guardarPrecios(db: SupabaseClient, productos: ProductoNormalizado[], ids: Map<string, number>) {
  const filas = productos.filter((p) => p.precio !== null && ids.has(p.id_origen)).map((p) => ({
    producto_id: ids.get(p.id_origen)!, fecha: hoy, precio: p.precio!, precio_oferta: p.precio_oferta,
  }));
  for (const lote of trozos(filas, LOTE)) {
    const { error } = await db.from("precios_historico").upsert(lote, { onConflict: "producto_id,fecha" });
    if (error) throw error;
  }
}

// Marca (nunca borra) los productos que ya no aparecen
async function descatalogar(db: SupabaseClient, sid: string, productos: ProductoNormalizado[], anteriores: Map<string, Anterior>) {
  const vistos = new Set(productos.map((p) => p.id_origen));
  const fuera = [...anteriores.values()].filter((a) => !a.descatalogado_en && !vistos.has(a.id_origen)).map((a) => a.id_origen);
  for (const lote of trozos(fuera, 200)) {
    const { error } = await db.from("productos").update({ disponible: false, descatalogado_en: new Date().toISOString() })
      .eq("supermercado_id", sid).in("id_origen", lote);
    if (error) throw error;
  }
  return fuera.length;
}

function trozos<T>(arr: T[], n: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n));
  return r;
}

function imprimir(r: Record<string, unknown> & { ejemplos?: Record<string, string[]> }) {
  const { ejemplos, avisos, ...cifras } = r as { ejemplos: Record<string, string[]>; avisos: string[] };
  console.log("\n=== Informe de calidad ===");
  for (const [k, v] of Object.entries(cifras)) console.log(`${k.padEnd(16)} ${v}`);
  for (const [k, v] of Object.entries(ejemplos ?? {})) console.log(`\n${k}:\n  ` + v.join("\n  "));
  if (avisos?.length) console.log("\navisos:\n  " + avisos.join("\n  "));
}

await main();
