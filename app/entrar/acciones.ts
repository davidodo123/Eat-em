"use server";
import { headers } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/server";
import { rutaInterna } from "@/lib/rutas";

export interface EstadoEntrar {
  estado: "inicial" | "enviado" | "error";
  mensaje?: string;
  email?: string;
}

// Envia un enlace magico al email. Sin contrasenas: el enlace abre la sesion.
export async function enviarEnlace(_previo: EstadoEntrar, datos: FormData): Promise<EstadoEntrar> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { estado: "error", mensaje: "Escribe un email válido.", email };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocolo = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const siguiente = rutaInterna(String(datos.get("siguiente") ?? ""));
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${protocolo}://${host}/auth/confirmar?siguiente=${encodeURIComponent(siguiente)}` },
  });
  if (error) {
    const limite = error.status === 429 || /rate limit/i.test(error.message);
    return {
      estado: "error",
      email,
      mensaje: limite ? "Has pedido demasiados enlaces. Espera un minuto y vuelve a intentarlo." : "No se pudo enviar el enlace. Inténtalo de nuevo.",
    };
  }
  return { estado: "enviado", email };
}
