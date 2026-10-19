"use server";
import { redirect } from "next/navigation";
import { crearClienteAdmin, crearClienteServidor } from "@/lib/supabase/server";
import { rutaInterna } from "@/lib/rutas";

// Inicio de sesion normal con email y contrasena. Sin correos: la cuenta se crea ya
// confirmada desde el servidor y se entra al momento.

export interface EstadoAcceso { error?: string; email?: string }

const emailValido = (e: string) => /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;

export async function entrar(_previo: EstadoAcceso, datos: FormData): Promise<EstadoAcceso> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  const contrasena = String(datos.get("contrasena") ?? "");
  if (!emailValido(email) || !contrasena) return { error: "Escribe tu email y tu contraseña.", email };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  if (error) {
    const limite = error.status === 429 || /rate limit/i.test(error.message);
    return { email, error: limite ? "Demasiados intentos. Espera un minuto." : "Email o contraseña incorrectos." };
  }
  redirect(rutaInterna(String(datos.get("siguiente") ?? "")));
}

export async function crearCuenta(_previo: EstadoAcceso, datos: FormData): Promise<EstadoAcceso> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  const contrasena = String(datos.get("contrasena") ?? "");
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 60);
  if (!nombre) return { error: "Escribe tu nombre.", email };
  if (!emailValido(email)) return { error: "Escribe un email válido.", email };
  if (contrasena.length < 8) return { error: "La contraseña necesita al menos 8 caracteres.", email };
  if (contrasena.length > 72) return { error: "La contraseña es demasiado larga (máximo 72 caracteres).", email };

  const { error: e1 } = await crearClienteAdmin().auth.admin.createUser({
    email, password: contrasena, email_confirm: true, user_metadata: { name: nombre },
  });
  if (e1) {
    const existe = /already|registered|exists/i.test(e1.message);
    return { email, error: existe ? "Ya hay una cuenta con ese email: entra con tu contraseña." : "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }
  const supabase = await crearClienteServidor();
  const { error: e2 } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  if (e2) return { email, error: "Cuenta creada. Ya puedes entrar con tu email y contraseña." };
  redirect("/grupo");   // lo primero: crear su hogar o unirse al de alguien
}
