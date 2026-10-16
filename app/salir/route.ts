import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

// Cerrar sesion (POST para que un enlace o una precarga no cierren la sesion sin querer)
export async function POST(request: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/entrar", request.url), { status: 303 });
}
