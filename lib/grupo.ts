import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Hogar {
  id: string;
  nombre: string;
  codigo_invitacion: string;
}

// Hogar (grupo) del usuario actual. De momento uno por persona: el primero al que se unio.
export async function hogarActual(supabase: SupabaseClient): Promise<Hogar | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from("grupo_miembros")
    .select("unido_en, grupos (id, nombre, codigo_invitacion)")
    .eq("usuario_id", u.user.id)
    .order("unido_en")
    .limit(1)
    .maybeSingle();
  const g = data?.grupos as unknown as Hogar | Hogar[] | null | undefined;
  return (Array.isArray(g) ? g[0] : g) ?? null;
}
