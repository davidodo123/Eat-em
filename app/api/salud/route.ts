import { NextResponse } from "next/server";
import { supabaseConfigurado } from "@/lib/env";
import { crearClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Comprobacion de despliegue: GET /api/salud
export async function GET() {
  const estado: Record<string, unknown> = {
    app: "ok",
    supabase_configurado: supabaseConfigurado,
    openai_configurado: Boolean(process.env.OPENAI_API_KEY),
  };
  if (supabaseConfigurado) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.from("supermercados").select("id", { head: true, count: "exact" });
    // Sin sesion, RLS devuelve 0 filas pero la conexion y el esquema se validan igual
    estado.base_de_datos = error ? "error: " + error.message : "ok";
  }
  return NextResponse.json(estado);
}
