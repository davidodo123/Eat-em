// Ejecuta un scraper y guarda el resultado.
//
//   npm run scraper -- carrefour                 ejecucion completa (escribe en Supabase)
//   npm run scraper -- carrefour --seco          sin tocar la base de datos (guarda en data/raw/)
//   npm run scraper -- carrefour --rapido        sin la expansion por marcas
//   npm run scraper -- carrefour --max-peticiones 50
//   npm run scraper -- carrefour --cargar data/raw/carrefour/2026-10-16/1530.pendiente.json
//                                                 sube un respaldo sin volver a descargar
//
// Antes de escribir en la base se guarda un respaldo en data/raw/<super>/<fecha>/<hora>.pendiente.json
// (se borra si todo va bien). Las escrituras se reintentan ante cortes de red.
// Variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SCRAPER_USER_AGENT.
// Codigo de salida 2 si hay alerta de calidad (para que GitHub Actions avise).
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { carrefour } from "./carrefour/index.ts";
import { mercadona } from "./mercadona/index.ts";
import { ahorramas } from "./ahorramas/index.ts";
import { gadis } from "./gadis/index.ts";
import { caprabo } from "./caprabo/index.ts";
import { informeCalidad, type Anterior } from "./comun/calidad.ts";
import type { ProductoNormalizado, Scraper } from "./comun/tipos.ts";

const SCRAPERS: Record<string, Scraper> = { carrefour, mercadona, ahorramas, gadis, caprabo };

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const seco = args.includes("--seco");
const rapido = args.includes("--rapido");
const maxIdx = args.indexOf("--max-peticiones");
const maxPeticiones = maxIdx >= 0 ? Number(args[maxIdx + 1]) : undefined;
const cargarIdx = args.indexOf("--cargar");
const archivoCargar = cargarIdx >= 0 ? args[cargarIdx + 1] : undefined;

const scraper = id ? SCRAPERS[id] : undefined;
const dirRaw = id ? path.join("data", "raw", id, new Date().toISOString().slice(0, 10)) : "";
if (!scraper) {
  console.error(`Uso: npm run scraper -- <${Object.keys(SCRAPERS).join("|")}> [--seco] [--rapido] [--max-peticiones N] [--cargar archivo]`);
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
    const { data } = await reintentar("alta de la ejecucion", () => db.from("scraper_ejecuciones")
      .insert({ supermercado_id: scraper!.id, parametros: { rapido, maxPeticiones: maxPeticiones ?? null, cargado_de: archivoCargar ?? null } })
      .select("id").single());
    ejecucionId = data!.id;
  }

  // Dato bruto: JSONL comprimido, una linea por pagina descargada
  const raw: string[] = [];
  try {
    console.log(`Scraper ${scraper!.id}${seco ? " (seco)" : ""}...`);
    const anteriores = await cargarAnteriores(db, scraper!.id);
    const res = archivoCargar ? leerRespaldo(archivoCargar) : await scraper!.ejecutar({
      maxPeticiones, rapido, conocidos: anteriores, guardarRaw: (p) => raw.push(JSON.stringify(p)),
    });
    const respaldo = db && !archivoCargar ? guardarRespaldo(res) : null;
    const rawGz = gzipSync(raw.join("\n"));
    const rawPath = `${scraper!.id}/${hoy}/${marca}.jsonl.gz`;

    // Mapeo de categorias de origen -> propias
    const categorias = await cargarCategorias(db);
    const mapeo = await mapearCategorias(db, scraper!.id, res.votosCategoria, categorias);
    for (const p of res.productos) p.categoria_id = p.categoria_origen ? mapeo.get(p.categoria_origen) ?? null : null;

    // Con --max-peticiones la carga es parcial a proposito: no se compara con la ultima completa
    // (la alerta de 0 productos sigue valiendo)
    const ultimoTotal = maxPeticiones === undefined ? await ultimoTotalOk(db, scraper!.id, rapido) : null;
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
      const subida = await reintentar("subida del raw", () => db.storage.from("raw").upload(rawPath, rawGz, { contentType: "application/gzip", upsert: true }))
        .catch((e: Error) => ({ error: { message: e.message } }));
      if (subida.error) res.avisos.push("No se pudo subir el raw: " + subida.error.message);

      const ids = await guardarProductos(db, res.productos);
      await guardarPrecios(db, res.productos, ids);
      const enlaces = await enlazarIngredientes(db, scraper!.id, ids);
      if (typeof enlaces === "string") res.avisos.push(enlaces);
      else Object.assign(resumen, { enlaces_ingredientes: enlaces });
      // Solo se descatalogan productos si la ejecucion es fiable: sin alerta, sin tope, completa
      // y casi sin errores HTTP (un corte de red no debe dar por retirados productos que siguen a la venta)
      const pocosErrores = res.errores <= Math.max(5, res.peticiones * 0.01);
      const fiable = !informe.alerta && maxPeticiones === undefined && res.completo !== false && pocosErrores;
      if (!pocosErrores) res.avisos.push(`${res.errores} errores HTTP: no se descataloga nada en esta ejecucion`);
      if (fiable) informe.descatalogados = await descatalogar(db, scraper!.id, res.productos, anteriores);
      else informe.descatalogados = 0;

      await reintentar("cierre de la ejecucion", () => db.from("scraper_ejecuciones").update({
        fin: new Date().toISOString(),
        estado: informe.alerta ? "alerta" : "ok",
        parametros: { ...res.parametros, tope: maxPeticiones ?? null, completo: res.completo ?? true },
        n_productos: informe.total,
        n_nuevos: informe.nuevos,
        n_descatalogados: informe.descatalogados,
        n_errores: res.errores,
        raw_path: subida.error ? null : "raw/" + rawPath,
        informe_calidad: { ...resumen, descatalogados: informe.descatalogados },
      }).eq("id", ejecucionId!));
      if (respaldo) fs.rmSync(respaldo, { force: true });
    }

    imprimir(resumen);
    if (informe.alerta) {
      console.error(`\nALERTA: ${informe.alerta}`);
      process.exitCode = 2;
    }
  } catch (e) {
    console.error(e);
    const pendiente = fs.existsSync(dirRaw) ? fs.readdirSync(dirRaw).filter((f) => f.endsWith(".pendiente.json")).pop() : undefined;
    if (pendiente) console.error(`
Respaldo sin subir: npm run scraper -- ${scraper!.id} --cargar ${path.join(dirRaw, pendiente)}`);
    if (db && ejecucionId) {
      await db.from("scraper_ejecuciones").update({
        fin: new Date().toISOString(), estado: "error", error: String((e as Error).message ?? e),
      }).eq("id", ejecucionId);
    }
    process.exitCode = 1;
  }
}

// Reintenta una operacion de Supabase ante cortes de red o errores 5xx (espera 5, 10, 20, 40, 80 s)
async function reintentar<T extends { error: { message: string; code?: string } | null }>(
  que: string, fn: () => PromiseLike<T>, intentos = 6,
): Promise<T> {
  for (let i = 1; ; i++) {
    let r: T;
    try {
      r = await fn();
    } catch (e) {
      r = { error: { message: String((e as Error).message ?? e) } } as T;
    }
    if (!r.error) return r;
    const red = /fetch failed|timeout|network|ECONN|ETIMEDOUT|EAI_AGAIN|socket|50[234]|gateway/i.test(r.error.message);
    if (!red || i >= intentos) throw new Error(`${que}: ${r.error.message}`);
    const espera = 5000 * 2 ** (i - 1);
    console.warn(`  ${que}: ${r.error.message}; reintento ${i}/${intentos - 1} en ${espera / 1000} s`);
    await new Promise((ok) => setTimeout(ok, espera));
  }
}

type Resultado = Awaited<ReturnType<Scraper["ejecutar"]>>;

// Respaldo local del resultado (por si la base no responde al final de una carga larga)
function guardarRespaldo(res: Resultado) {
  fs.mkdirSync(dirRaw, { recursive: true });
  const archivo = path.join(dirRaw, `${marca}.pendiente.json`);
  const votos = [...res.votosCategoria].map(([k, v]) => [k, [...v]]);
  fs.writeFileSync(archivo, JSON.stringify({ ...res, votosCategoria: votos }));
  return archivo;
}

function leerRespaldo(archivo: string): Resultado {
  const r = JSON.parse(fs.readFileSync(archivo, "utf8"));
  return { ...r, votosCategoria: new Map((r.votosCategoria as [string, [string, number][]][]).map(([k, v]) => [k, new Map(v)])) };
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
  const { data } = await reintentar("lectura de categorias", () => db.from("categorias").select("id, slug"));
  return new Map(data!.map((c) => [c.slug, c.id]));
}

// Categoria de origen -> la categoria propia con mas votos. Las manuales mandan.
async function mapearCategorias(
  db: SupabaseClient | null, sid: string, votos: Map<string, Map<string, number>>, categorias: Map<string, number>,
) {
  const mapeo = new Map<string, number>();
  const manuales = new Set<string>();
  if (db) {
    const { data } = await reintentar("lectura de categorias_origen", () =>
      db.from("categorias_origen").select("id_origen, categoria_id, metodo").eq("supermercado_id", sid));
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
    await reintentar("categorias_origen", () => db.from("categorias_origen").upsert(lote, { onConflict: "supermercado_id,id_origen" }));
  }
  return mapeo;
}

async function cargarAnteriores(db: SupabaseClient | null, sid: string): Promise<Map<string, Anterior>> {
  const m = new Map<string, Anterior>();
  if (!db) return m;
  for (let desde = 0; ; desde += 1000) {
    const { data } = await reintentar("lectura de productos", () => db.from("productos")
      .select("id_origen, nombre, imagen_url, precio, cantidad_neta, descatalogado_en")
      .eq("supermercado_id", sid).order("id").range(desde, desde + 999));
    for (const p of data!) m.set(p.id_origen, p);
    if (data!.length < 1000) return m;
  }
}

// Ultima ejecucion correcta del mismo modo (una --rapido no se compara con una completa)
async function ultimoTotalOk(db: SupabaseClient | null, sid: string, rapido: boolean): Promise<number | null> {
  if (!db) return null;
  let q = db.from("scraper_ejecuciones").select("n_productos")
    .eq("supermercado_id", sid).eq("estado", "ok").filter("parametros->>tope", "is", null);
  q = rapido ? q.eq("parametros->>rapido", "true") : q.or("parametros->>rapido.is.null,parametros->>rapido.eq.false");
  const { data } = await q.order("inicio", { ascending: false }).limit(1);
  return data?.[0]?.n_productos ?? null;
}

// Red de seguridad antes de guardar: un valor fuera de rango en un solo producto
// no debe tumbar la carga entera (las restricciones CHECK de la tabla lo rechazarian).
export function sanear(p: ProductoNormalizado): ProductoNormalizado {
  const positivo = (n: number | null) => (n !== null && Number.isFinite(n) && n > 0 ? n : null);
  return {
    ...p,
    unidades_pack: Number.isInteger(p.unidades_pack) && p.unidades_pack >= 1 ? p.unidades_pack : 1,
    cantidad_neta: positivo(p.cantidad_neta),
    unidad: positivo(p.cantidad_neta) ? p.unidad : null,
    precio: p.precio !== null && Number.isFinite(p.precio) && p.precio >= 0 ? p.precio : null,
    precio_oferta: positivo(p.precio_oferta),
    precio_por_unidad: positivo(p.precio_por_unidad),
    ean: p.ean && /^(\d{8}|\d{13})$/.test(p.ean) ? p.ean : null,
  };
}

async function guardarProductos(db: SupabaseClient, productos: ProductoNormalizado[]) {
  productos = productos.map(sanear);
  const ids = new Map<string, number>();
  for (const lote of trozos(productos, LOTE)) {
    const { data } = await reintentar("upsert de productos", () => db.from("productos")
      .upsert(lote, { onConflict: "supermercado_id,id_origen" }).select("id, id_origen"));
    for (const p of data!) ids.set(p.id_origen, p.id);
  }
  return ids;
}

async function guardarPrecios(db: SupabaseClient, productos: ProductoNormalizado[], ids: Map<string, number>) {
  const filas = productos.filter((p) => p.precio !== null && ids.has(p.id_origen)).map((p) => ({
    producto_id: ids.get(p.id_origen)!, fecha: hoy, precio: p.precio!, precio_oferta: p.precio_oferta,
  }));
  for (const lote of trozos(filas, LOTE)) {
    await reintentar("precios_historico", () => db.from("precios_historico").upsert(lote, { onConflict: "producto_id,fecha" }));
  }
}

// Enlaza los productos guardados con los ingredientes genericos (por tramos de id).
// Devuelve el numero de enlaces o un aviso si la funcion aun no existe en la base.
async function enlazarIngredientes(db: SupabaseClient, sid: string, ids: Map<string, number>): Promise<number | string> {
  if (!ids.size) return 0;
  let min = Infinity, max = 0;
  for (const id of ids.values()) { if (id < min) min = id; if (id > max) max = id; }
  let n = 0;
  for (let desde = min; desde <= max; desde += 5000) {
    const { data, error } = await db.rpc("enlazar_ingredientes", { p_supermercado: sid, p_desde: desde, p_hasta: desde + 4999 });
    if (error) return `Sin enlace de ingredientes: ${error.message} (aplica la migracion 20261016000006)`;
    n += data ?? 0;
  }
  return n;
}

// Marca (nunca borra) los productos que ya no aparecen
async function descatalogar(db: SupabaseClient, sid: string, productos: ProductoNormalizado[], anteriores: Map<string, Anterior>) {
  const vistos = new Set(productos.map((p) => p.id_origen));
  const fuera = [...anteriores.values()].filter((a) => !a.descatalogado_en && !vistos.has(a.id_origen)).map((a) => a.id_origen);
  for (const lote of trozos(fuera, 200)) {
    await reintentar("descatalogar", () => db.from("productos").update({ disponible: false, descatalogado_en: new Date().toISOString() })
      .eq("supermercado_id", sid).in("id_origen", lote));
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
