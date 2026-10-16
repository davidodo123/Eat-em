"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

// Refresca la pantalla cuando otro miembro del hogar cambia estas tablas.
// Supabase Realtime aplica RLS: solo llegan los cambios del propio hogar.
export function TiempoReal({ grupoId, tablas }: { grupoId: string; tablas: string[] }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = crearClienteNavegador();
    let espera: ReturnType<typeof setTimeout> | undefined;
    const refrescar = () => { clearTimeout(espera); espera = setTimeout(() => router.refresh(), 400); };
    const canal = supabase.channel(`hogar-${grupoId}-${tablas.join("-")}`);
    for (const tabla of tablas) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: tabla, filter: `grupo_id=eq.${grupoId}` }, refrescar);
    }
    canal.subscribe();
    return () => { clearTimeout(espera); supabase.removeChannel(canal); };
  }, [grupoId, tablas.join(","), router]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
