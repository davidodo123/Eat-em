"use client";
import { useActionState } from "react";
import { enviarEnlace, type EstadoEntrar } from "./acciones";

// Email y enlace magico, sin contrasenas
export function FormularioEntrar({ siguiente }: { siguiente: string }) {
  const [estado, accion, enviando] = useActionState<EstadoEntrar, FormData>(enviarEnlace, { estado: "inicial" });

  if (estado.estado === "enviado") {
    return (
      <div className="rounded-2xl bg-marca/10 p-4 text-center" role="status">
        <p className="text-3xl" aria-hidden>📬</p>
        <p className="mt-1 font-semibold">Mira tu correo</p>
        <p className="text-sm text-texto-suave">Te hemos enviado un enlace a <b>{estado.email}</b>. Ábrelo en este mismo móvil para entrar.</p>
      </div>
    );
  }
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="siguiente" value={siguiente} />
      <label className="sr-only" htmlFor="email">Tu email</label>
      <input id="email" name="email" type="email" required autoComplete="email" inputMode="email"
        defaultValue={estado.email} placeholder="tu@email.com"
        className="block w-full rounded-2xl border border-borde bg-superficie px-4 py-3.5 text-base outline-none focus:border-marca" />
      <button type="submit" disabled={enviando}
        className="w-full rounded-2xl bg-marca px-4 py-3.5 font-semibold text-marca-texto active:opacity-80 disabled:opacity-60">
        {enviando ? "Enviando…" : "Entrar con mi email"}
      </button>
      {estado.estado === "error" && <p className="text-sm text-urgente" role="alert">{estado.mensaje}</p>}
    </form>
  );
}
