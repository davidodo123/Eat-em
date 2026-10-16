// Importa Open Food Facts (licencia ODbL) y enriquece `productos` por EAN.
//
//   npm run off                    descarga el volcado, actualiza off_productos y aplica a productos
//   npm run off -- --seco          sin base de datos: guarda un resumen en data/off/
//   npm run off -- --max-filas N   corta tras N filas del volcado (pruebas)
//
// Fuente: https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
// (~1,3 GB comprimido, separado por tabuladores, una fila por producto). Se lee en
// streaming, sin guardarlo en disco. Se quedan los productos con pais "en:spain" y los
// que comparten EAN con alguna tienda, y solo si traen nutricion, ingredientes o alergenos.
// La API por EAN tiene limite de 100 peticiones/min: para el catalogo entero no sirve.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizarEan } from "../../lib/dominio/ean.ts";
import { alergenosDesdeOff } from "../../lib/dominio/alergenos.ts";

const VOLCADO = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz";
const LOTE = 500;
const TRAMO_IDS = 5000;

export interface FilaOff {
  ean: string;
  nombre: string | null;
  marca: string | null;
  cantidad_texto: string | null;
  categorias: string[];
  ingredientes_texto: string | null;
  alergenos: string[];
  trazas: string[];
  kcal_100: number | null;
  grasas_100: number | null;
  saturadas_100: number | null;
  hidratos_100: number | null;
  azucares_100: number | null;
  fibra_100: number | null;
  proteinas_100: number | null;
  sal_100: number | null;
  nutriscore: string | null;
  nova: number | null;
  imagen_url: string | null;
  en_espana: boolean;
  modificado_off: string | null;
}

// Columnas usadas del CSV
const COLUMNAS = [
  "code", "last_modified_t", "product_name", "quantity", "brands", "categories_tags", "countries_tags",
  "ingredients_text", "allergens", "traces_tags", "nutriscore_grade", "nova_group", "image_url",
  "energy-kcal_100g", "fat_100g", "saturated-fat_100g", "carbohydrates_100g", "sugars_100g", "fiber_100g",
  "proteins_100g", "salt_100g",
] as const;
type Col = (typeof COLUMNAS)[number];

// Fila del volcado -> fila de off_productos (null si no sirve)
export function convertir(v: Record<Col, string>, eanesTienda: Set<string>): FilaOff | null {
  const ean = normalizarEan(v.code?.length === 12 ? "0" + v.code : v.code); // UPC-A -> EAN-13
  if (!ean) return null;
  const enEspana = /(^|,)en:spain(,|$)/.test(v.countries_tags ?? "");
  if (!enEspana && !eanesTienda.has(ean)) return null;

  const fila: FilaOff = {
    ean,
    nombre: texto(v.product_name, 300),
    marca: texto(v.brands?.split(",")[0], 120),
    cantidad_texto: texto(v.quantity, 60),
    categorias: (v.categories_tags ?? "").split(",").map((c) => c.trim()).filter(Boolean).slice(0, 15),
    ingredientes_texto: texto(v.ingredients_text, 3000),
    alergenos: alergenosDesdeOff(v.allergens),
    trazas: alergenosDesdeOff(v.traces_tags),
    kcal_100: nutriente(v["energy-kcal_100g"], 1000),
    grasas_100: nutriente(v.fat_100g, 100),
    saturadas_100: nutriente(v["saturated-fat_100g"], 100),
    hidratos_100: nutriente(v.carbohydrates_100g, 100),
    azucares_100: nutriente(v.sugars_100g, 100),
    fibra_100: nutriente(v.fiber_100g, 100),
    proteinas_100: nutriente(v.proteins_100g, 100),
    sal_100: nutriente(v.salt_100g, 100),
    nutriscore: /^[a-e]$/.test(v.nutriscore_grade ?? "") ? v.nutriscore_grade : null,
    nova: /^[1-4]$/.test(v.nova_group ?? "") ? Number(v.nova_group) : null,
    imagen_url: texto(v.image_url, 500),
    en_espana: enEspana,
    modificado_off: /^\d+$/.test(v.last_modified_t ?? "") ? new Date(Number(v.last_modified_t) * 1000).toISOString() : null,
  };
  const util = fila.kcal_100 !== null || fila.ingredientes_texto !== null || fila.alergenos.length > 0;
  return util ? fila : null;
}

function texto(s: string | undefined, max: number) {
  const t = s?.trim();
  return t ? t.slice(0, max) : null;
}

// Valores fuera de rango (errores de carga en OFF) se descartan
function nutriente(s: string | undefined, max: number) {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 1000) / 1000 : null;
}

async function main() {
  const args = process.argv.slice(2);
  const seco = args.includes("--seco");
  const i = args.indexOf("--max-filas");
  const maxFilas = i >= 0 ? Number(args[i + 1]) : Infinity;
  const db = seco ? null : clienteAdmin();
  const inicio = Date.now();

  const eanes = db ? await eanesDeTiendas(db) : new Set<string>();
  console.log(`EAN de tiendas en la base: ${eanes.size}`);

  const r = await fetch(VOLCADO, { headers: { "User-Agent": process.env.SCRAPER_USER_AGENT || "Eat-em/0.1 (uso personal)" } });
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status} en ${VOLCADO}`);
  const lineas = readline.createInterface({ input: Readable.fromWeb(r.body as never).pipe(createGunzip()), crlfDelay: Infinity });

  let indices: Record<Col, number> | null = null;
  let leidas = 0, guardadas = 0, enEspana = 0, deTiendas = 0;
  let lote: FilaOff[] = [];
  const muestra: FilaOff[] = [];
  const vaciar = async () => {
    if (!lote.length) return;
    if (db) {
      const { error } = await db.from("off_productos").upsert(lote.map((f) => ({ ...f, importado_en: new Date().toISOString() })), { onConflict: "ean" });
      if (error) throw error;
    }
    guardadas += lote.length;
    lote = [];
  };

  for await (const linea of lineas) {
    const campos = linea.split("\t");
    if (!indices) {
      indices = Object.fromEntries(COLUMNAS.map((c) => [c, campos.indexOf(c)])) as Record<Col, number>;
      const faltan = COLUMNAS.filter((c) => indices![c] < 0);
      if (faltan.length) throw new Error(`Columnas que ya no estan en el volcado: ${faltan.join(", ")}`);
      continue;
    }
    if (leidas >= maxFilas) break;
    leidas++;
    const v = Object.fromEntries(COLUMNAS.map((c) => [c, campos[indices![c]] ?? ""])) as Record<Col, string>;
    const f = convertir(v, eanes);
    if (f) {
      if (f.en_espana) enEspana++;
      if (eanes.has(f.ean)) deTiendas++;
      if (muestra.length < 20) muestra.push(f);
      lote.push(f);
      if (lote.length >= LOTE) await vaciar();
    }
    if (leidas % 500_000 === 0) console.log(`  ${leidas} filas | ${guardadas + lote.length} utiles | ${Math.round((Date.now() - inicio) / 1000)} s`);
  }
  await vaciar();
  lineas.close();

  const resumen: Record<string, unknown> = {
    filas_leidas: leidas, guardadas, en_espana: enEspana, con_ean_de_tienda: deTiendas, duracion_s: Math.round((Date.now() - inicio) / 1000),
  };
  if (db) Object.assign(resumen, await aplicar(db));
  else {
    const dir = path.join("data", "off");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "resumen.json"), JSON.stringify({ ...resumen, muestra }, null, 1));
    console.log(`Guardado en ${dir}`);
  }
  console.log("\n=== Open Food Facts ===");
  for (const [k, val] of Object.entries(resumen)) console.log(`${k.padEnd(20)} ${val}`);
}

// Aplica OFF a productos y agrupa por EAN, por tramos de id
async function aplicar(db: SupabaseClient) {
  const { data } = await db.from("productos").select("id").order("id", { ascending: false }).limit(1);
  const max = data?.[0]?.id ?? 0;
  let enriquecidos = 0, agrupados = 0;
  for (let desde = 1; desde <= max; desde += TRAMO_IDS) {
    const tramo = { p_desde: desde, p_hasta: desde + TRAMO_IDS - 1 };
    const a = await db.rpc("aplicar_off", tramo);
    if (a.error) throw a.error;
    const b = await db.rpc("agrupar_por_ean", tramo);
    if (b.error) throw b.error;
    enriquecidos += a.data ?? 0;
    agrupados += b.data ?? 0;
  }
  return { productos_enriquecidos: enriquecidos, productos_agrupados: agrupados };
}

async function eanesDeTiendas(db: SupabaseClient) {
  const s = new Set<string>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from("productos").select("ean").not("ean", "is", null).order("id").range(desde, desde + 999);
    if (error) throw error;
    for (const p of data) s.add(p.ean);
    if (data.length < 1000) return s;
  }
}

function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (o usa --seco)");
  return createClient(url, clave, { auth: { persistSession: false } });
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("off/importar.ts")) await main();
