"use server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { codigoPostalValido } from "@/lib/dominio/cadenas";
import { buscarCodigoPostal, nombreDelSitio, supermercadosCerca, type Punto } from "@/lib/ubicacion";

export interface EstadoUbicacion { error?: string; ok?: number }
const RADIOS = [2, 5, 10, 20];

// Desde el GPS del movil (lat/lon) o desde un codigo postal
export async function guardarUbicacion(_previo: EstadoUbicacion, datos: FormData): Promise<EstadoUbicacion> {
  const radio = Number(datos.get("radio"));
  if (!RADIOS.includes(radio)) return { error: "Radio no válido." };
  const cp = String(datos.get("cp") ?? "").trim();
  const coord = (k: string) => (String(datos.get(k) ?? "").trim() ? Number(datos.get(k)) : NaN);
  const lat = coord("lat"), lon = coord("lon");

  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  if (!hogar) return { error: "Primero crea tu hogar o únete a uno." };

  let punto: Punto, lugar: string | null;
  try {
    if (cp) {
      if (!codigoPostalValido(cp)) return { error: "Código postal no válido (5 cifras)." };
      const r = await buscarCodigoPostal(cp);
      if (!r) return { error: "No encontramos ese código postal." };
      punto = r; lugar = r.lugar;
    } else if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      punto = { lat, lon };
      lugar = await nombreDelSitio(punto).catch(() => null);
    } else return { error: "Activa la ubicación o escribe tu código postal." };

    const { tiendas, cadenas } = await supermercadosCerca(punto, radio);
    const { error } = await supabase.rpc("fijar_ubicacion", {
      p_grupo_id: hogar.id, p_lat: punto.lat, p_lon: punto.lon, p_lugar: lugar ?? "Tu zona",
      p_radio_km: radio, p_cadenas: cadenas, p_tiendas: tiendas,
    });
    if (error) return { error: "No se pudo guardar la ubicación." };
  } catch {
    return { error: "El servicio de mapas no responde ahora. Inténtalo en un momento." };
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}
