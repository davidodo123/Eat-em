import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usuarioActual } from "@/lib/supabase/server";

export interface Hogar {
  id: string;
  nombre: string;
  codigo_invitacion: string;
  dias_planificacion: number;
  // Ubicacion (migracion 10); pueden faltar si aun no esta aplicada
  lugar?: string | null;
  radio_km?: number;
  cadenas_cerca?: string[];
  tiendas_cerca?: unknown;
}

// Hogar (grupo) del usuario actual. De momento uno por persona: el primero al que se unio.
// Trae todo el grupo (tambien la ubicacion) para no repetir viajes a la base de datos.
// cache(): una sola consulta por peticion (el cliente de Supabase tambien se reutiliza).
export const hogarActual = cache(async (supabase: SupabaseClient): Promise<Hogar | null> => {
  const { data: u } = await usuarioActual();
  if (!u.user) return null;
  const { data } = await supabase
    .from("grupo_miembros")
    .select("unido_en, grupos (*)")
    .eq("usuario_id", u.user.id)
    .order("unido_en")
    .limit(1)
    .maybeSingle();
  const g = data?.grupos as unknown as Hogar | Hogar[] | null | undefined;
  return (Array.isArray(g) ? g[0] : g) ?? null;
});
