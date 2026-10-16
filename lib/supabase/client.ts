"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

// Cliente para componentes de navegador (RLS aplica con la sesion del usuario)
export function crearClienteNavegador() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
