// Carga los supermercados de Espana de OpenStreetMap en tiendas_osm.
// Uso: npm run tiendas            (descarga de Overpass, ~1-2 min, y carga)
//      npm run tiendas -- --local (usa data/osm/supermercados-es.json ya descargado)
// Datos © colaboradores de OpenStreetMap, ODbL. Conviene repetirlo cada pocos meses.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { cadenaDe } from "../lib/dominio/cadenas.ts";

const raiz = path.resolve(import.meta.dirname, "..");
const fichero = path.join(raiz, "data", "osm", "supermercados-es.json");
const CONSULTA = `[out:json][timeout:300];area["ISO3166-1"="ES"][admin_level=2]->.es;nwr["shop"="supermarket"](area.es);out center tags;`;
const SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];

interface Elemento { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

async function descargar(): Promise<string> {
  for (const url of SERVIDORES) {
    try {
      console.log(`descargando de ${new URL(url).host}…`);
      const r = await fetch(url, {
        method: "POST", body: new URLSearchParams({ data: CONSULTA }),
        headers: { "User-Agent": "Eat-em/0.1 (app de la compra sin animo de lucro)" }, signal: AbortSignal.timeout(400_000),
      });
      if (r.ok) return await r.text();
      console.log(`  ${r.status}`);
    } catch (e) { console.log(`  ${String(e).slice(0, 100)}`); }
  }
  throw new Error("Ningun servidor de Overpass ha respondido");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(url, clave, { auth: { persistSession: false } });

let texto: string;
if (process.argv.includes("--local") && fs.existsSync(fichero)) texto = fs.readFileSync(fichero, "utf8");
else {
  texto = await descargar();
  fs.mkdirSync(path.dirname(fichero), { recursive: true });
  fs.writeFileSync(fichero, texto);
}

const elementos: Elemento[] = JSON.parse(texto).elements ?? [];
const filas = elementos
  .map((e) => {
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon, tags = e.tags ?? {};
    return {
      osm_id: `${e.type[0]}${e.id}`, cadena: cadenaDe(tags), lat, lon,
      nombre: (tags.name || tags.brand || "Supermercado").slice(0, 120), actualizado: new Date().toISOString(),
    };
  })
  .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon));

let cargadas = 0;
for (let i = 0; i < filas.length; i += 1000) {
  const { error } = await db.from("tiendas_osm").upsert(filas.slice(i, i + 1000), { onConflict: "osm_id" });
  if (error) throw new Error(`tiendas_osm: ${error.message}`);
  cargadas += Math.min(1000, filas.length - i);
}
const porCadena = new Map<string, number>();
for (const f of filas) porCadena.set(f.cadena ?? "otras", (porCadena.get(f.cadena ?? "otras") ?? 0) + 1);
console.log(`${cargadas} supermercados cargados`);
console.log([...porCadena].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}: ${n}`).join(" · "));
