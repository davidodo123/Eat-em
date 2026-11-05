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
    // Sin el token de la sesion el canal entra como anonimo: Supabase acepta la suscripcion
    // pero RLS descarta todos los eventos, sin ningun error
    let cerrado = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cerrado) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (!cerrado) canal.subscribe();
    });
    return () => { cerrado = true; clearTimeout(espera); supabase.removeChannel(canal); };
  }, [grupoId, tablas.join(","), router]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
