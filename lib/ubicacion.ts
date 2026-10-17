import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resumirTiendas, type TiendaCerca, type TiendaOSM } from "@/lib/dominio/cadenas";

// Datos abiertos de OpenStreetMap (ODbL): Nominatim para el codigo postal / el nombre del sitio
// y, para los supermercados, nuestra copia en tiendas_osm (npm run tiendas). La API de Overpass
// solo se usa de reserva: tarda de 10 a 40 s o falla cuando esta saturada.
const UA = `Eat-em/0.1 (app de la compra sin animo de lucro${process.env.CONTACTO_OSM ? `; ${process.env.CONTACTO_OSM}` : ""})`;
const OVERPASS = [process.env.OVERPASS_URL, "https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
  .filter((u): u is string => Boolean(u));

export interface Punto { lat: number; lon: number }

async function pedir(url: string, init?: RequestInit, espera = 10_000) {
  const r = await fetch(url, { ...init, headers: { "User-Agent": UA, "Accept-Language": "es", ...init?.headers }, signal: AbortSignal.timeout(espera), cache: "no-store" });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}

// Codigo postal -> punto y nombre del sitio
export async function buscarCodigoPostal(cp: string): Promise<(Punto & { lugar: string }) | null> {
  const datos = await pedir(`https://nominatim.openstreetmap.org/search?postalcode=${cp}&country=es&format=jsonv2&addressdetails=1&limit=1`);
  const r = datos?.[0];
  if (!r) return null;
  return { lat: Number(r.lat), lon: Number(r.lon), lugar: nombreLugar(r.address) ?? `CP ${cp}` };
}

// Punto -> "Motril, Granada"
export async function nombreDelSitio(p: Punto): Promise<string | null> {
  const r = await pedir(`https://nominatim.openstreetmap.org/reverse?lat=${p.lat}&lon=${p.lon}&format=jsonv2&zoom=14&addressdetails=1`, undefined, 6_000);
  return nombreLugar(r?.address);
}

function nombreLugar(a: Record<string, string> | undefined): string | null {
  if (!a) return null;
  const sitio = a.city || a.town || a.village || a.municipality || a.suburb;
  const provincia = a.province || a.state;
  return [sitio, provincia && provincia !== sitio ? provincia : null].filter(Boolean).join(", ") || null;
}

// Supermercados en un radio (km) alrededor del punto
export async function supermercadosCerca(supabase: SupabaseClient, p: Punto, radioKm: number): Promise<{ tiendas: TiendaCerca[]; cadenas: string[] }> {
  const { data, error } = await supabase.rpc("tiendas_cerca", { p_lat: p.lat, p_lon: p.lon, p_km: radioKm, p_limite: 200 });
  if (!error && data?.length) {
    const tiendas = (data as { cadena: string | null; nombre: string; km: number }[]).map((t) => ({ ...t, km: Number(t.km) }));
    return { tiendas: tiendas.slice(0, 40), cadenas: [...new Set(tiendas.map((t) => t.cadena).filter((c): c is string => c !== null))] };
  }
  if (!error) {
    // Copia cargada pero sin nada en ese radio
    const { count } = await supabase.from("tiendas_osm").select("osm_id", { count: "exact", head: true });
    if (count) return { tiendas: [], cadenas: [] };
  }
  return overpass(p, radioKm);
}

async function overpass(p: Punto, radioKm: number) {
  const consulta = `[out:json][timeout:15];nwr["shop"="supermarket"](around:${Math.round(radioKm * 1000)},${p.lat},${p.lon});out center tags;`;
  let ultimo: unknown;
  for (const url of OVERPASS) {
    try {
      const datos = await pedir(url, {
        method: "POST", body: new URLSearchParams({ data: consulta }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }, 15_000);
      const tiendas: TiendaOSM[] = (datos?.elements ?? [])
        .map((e: { lat?: number; lon?: number; center?: Punto; tags?: Record<string, string> }) => ({
          lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, tags: e.tags ?? {},
        }))
        .filter((t: TiendaOSM) => Number.isFinite(t.lat) && Number.isFinite(t.lon));
      return resumirTiendas(p, tiendas);
    } catch (e) { ultimo = e; }
  }
  throw ultimo;
}
