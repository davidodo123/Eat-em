import "server-only";
import { resumirTiendas, type TiendaCerca, type TiendaOSM } from "@/lib/dominio/cadenas";

// Datos abiertos de OpenStreetMap (ODbL): Nominatim para el codigo postal / el nombre del sitio
// y Overpass para los supermercados alrededor. Ambos piden identificarse y no abusar:
// se llaman solo cuando alguien cambia la ubicacion del hogar.
const UA = `Eat-em/0.1 (app de la compra sin animo de lucro${process.env.CONTACTO_OSM ? `; ${process.env.CONTACTO_OSM}` : ""})`;
const OVERPASS = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

export interface Punto { lat: number; lon: number }

async function pedir(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, headers: { "User-Agent": UA, "Accept-Language": "es", ...init?.headers }, signal: AbortSignal.timeout(25_000), cache: "no-store" });
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
  const r = await pedir(`https://nominatim.openstreetmap.org/reverse?lat=${p.lat}&lon=${p.lon}&format=jsonv2&zoom=14&addressdetails=1`);
  return nombreLugar(r?.address);
}

function nombreLugar(a: Record<string, string> | undefined): string | null {
  if (!a) return null;
  const sitio = a.city || a.town || a.village || a.municipality || a.suburb;
  const provincia = a.province || a.state;
  return [sitio, provincia && provincia !== sitio ? provincia : null].filter(Boolean).join(", ") || null;
}

// Supermercados en un radio (km) alrededor del punto
export async function supermercadosCerca(p: Punto, radioKm: number): Promise<{ tiendas: TiendaCerca[]; cadenas: string[] }> {
  const consulta = `[out:json][timeout:20];nwr["shop"="supermarket"](around:${Math.round(radioKm * 1000)},${p.lat},${p.lon});out center tags;`;
  const datos = await pedir(OVERPASS, {
    method: "POST", body: new URLSearchParams({ data: consulta }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const tiendas: TiendaOSM[] = (datos?.elements ?? [])
    .map((e: { lat?: number; lon?: number; center?: Punto; tags?: Record<string, string> }) => ({
      lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, tags: e.tags ?? {},
    }))
    .filter((t: TiendaOSM) => Number.isFinite(t.lat) && Number.isFinite(t.lon));
  return resumirTiendas(p, tiendas);
}
