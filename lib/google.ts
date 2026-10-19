import "server-only";
// Inicio de sesion con Google hecho por la app (como en StatsRun), para que Google muestre
// "Ir a eat-em.vercel.app" y no el dominio de Supabase. El id_token de Google se entrega a
// Supabase (signInWithIdToken), que crea o enlaza la cuenta y abre la sesion de siempre.
// Docs: https://developers.google.com/identity/protocols/oauth2/web-server
import { createHash, randomBytes } from "node:crypto";

export const COOKIE_GOOGLE = "eatem_google";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return { clientId, clientSecret, configurado: Boolean(clientId && clientSecret) };
}

// La vuelta sale del dominio de la peticion: vale en local y en produccion (las dos dadas de alta en Google Cloud)
export const googleRedirectUri = (origen: string) => `${origen}/api/auth/google/callback`;

export const aleatorio = () => randomBytes(24).toString("base64url");

// Google recibe el nonce con hash SHA-256; a Supabase se le pasa el original y lo comprueba
export function googleAuthorizeUrl(origen: string, estado: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: googleConfig().clientId ?? "",
    redirect_uri: googleRedirectUri(origen),
    response_type: "code",
    scope: "openid email profile",
    state: estado,
    nonce: createHash("sha256").update(nonce).digest("hex"),
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

/** Cambia el codigo de vuelta por el id_token de Google. */
export async function googleIdToken(codigo: string, origen: string): Promise<string> {
  const { clientId, clientSecret } = googleConfig();
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo, client_id: clientId ?? "", client_secret: clientSecret ?? "",
      redirect_uri: googleRedirectUri(origen), grant_type: "authorization_code",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const { id_token } = (await r.json()) as { id_token?: string };
  if (!id_token) throw new Error("Google no devolvio id_token");
  return id_token;
}
