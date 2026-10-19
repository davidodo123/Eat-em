"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { entrar, entrarConGoogle, type EstadoAcceso } from "./acciones";

const campo = "block w-full px-4 py-3.5 text-base";

function BotonGoogle() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-borde bg-superficie px-4 py-3.5 font-semibold active:bg-fondo disabled:opacity-60">
      {/* Logotipo oficial de Google (obligatorio en el boton de "Continuar con Google") */}
      <svg viewBox="0 0 48 48" aria-hidden className="h-5 w-5">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {pending ? "Abriendo Google…" : "Continuar con Google"}
    </button>
  );
}

export function FormularioEntrar({ siguiente }: { siguiente: string }) {
  const [conContrasena, setConContrasena] = useState(false);
  return (
    <div>
      <form action={entrarConGoogle}>
        <input type="hidden" name="siguiente" value={siguiente} />
        <BotonGoogle />
      </form>
      <p className="mt-3 text-center text-xs text-texto-suave">La primera vez se crea tu cuenta con tu email de Google.</p>
      {conContrasena ? <ConContrasena siguiente={siguiente} /> : (
        <button type="button" onClick={() => setConContrasena(true)}
          className="mt-5 w-full text-center text-sm font-medium text-texto-suave underline underline-offset-4">
          Ya tengo contraseña
        </button>
      )}
    </div>
  );
}

function ConContrasena({ siguiente }: { siguiente: string }) {
  const [estado, accion, enviando] = useActionState<EstadoAcceso, FormData>(entrar, {});
  return (
    <form action={accion} className="mt-5 space-y-3 border-t border-borde pt-5">
      <input type="hidden" name="siguiente" value={siguiente} />
      <label className="sr-only" htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={estado.email} placeholder="tu@email.com" className={campo} />
      <label className="sr-only" htmlFor="contrasena">Contraseña</label>
      <input id="contrasena" name="contrasena" type="password" required autoComplete="current-password" placeholder="Contraseña" className={campo} />
      <button type="submit" disabled={enviando}
        className="w-full rounded-xl bg-marca px-4 py-3.5 font-semibold text-marca-texto active:opacity-85 disabled:opacity-60">
        {enviando ? "Entrando…" : "Entrar"}
      </button>
      {estado.error && <p className="text-sm text-urgente" role="alert">{estado.error}</p>}
    </form>
  );
}
