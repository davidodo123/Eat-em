import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection, type NextRequest } from "next/server";
import { COOKIE_GOOGLE, aleatorio, googleAuthorizeUrl, googleConfig } from "@/lib/google";
import { rutaInterna } from "@/lib/rutas";

// Empieza el inicio de sesion con Google: estado y nonce de un solo uso en una cookie
export async function GET(req: NextRequest) {
  await connection();
  if (!googleConfig().configurado) redirect("/entrar?error=google");
  const estado = aleatorio(), nonce = aleatorio();
  const siguiente = rutaInterna(req.nextUrl.searchParams.get("siguiente"));
  (await cookies()).set(COOKIE_GOOGLE, JSON.stringify({ estado, nonce, siguiente }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/api/auth/google",
  });
  redirect(googleAuthorizeUrl(req.nextUrl.origin, estado, nonce));
}
