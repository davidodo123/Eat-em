"use client";
import { useActionState } from "react";
import { enviarEnlace, type EstadoEntrar } from "./acciones";

export function FormularioEntrar({ siguiente }: { siguiente: string }) {
  const [estado, accion, enviando] = useActionState<EstadoEntrar, FormData>(enviarEnlace, { estado: "inicial" });

  if (estado.estado === "enviado") {
    return (
      <div className="rounded-xl border border-borde bg-superficie p-4" role="status">
        <p className="font-semibold">Revisa tu correo</p>
        <p className="mt-1 text-sm text-texto-suave">
          Te hemos enviado un enlace a <strong className="text-texto">{estado.email}</strong>. Ábrelo en este mismo
          dispositivo para entrar.
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="siguiente" value={siguiente} />
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={estado.email}
          placeholder="tu@email.com"
          className="mt-1 block w-full rounded-xl border border-borde bg-superficie px-4 py-3 text-base outline-none focus:border-marca"
        />
      </label>
      {estado.estado === "error" && <p className="text-sm text-urgente" role="alert">{estado.mensaje}</p>}
      <button
        type="submit" disabled={enviando}
        className="w-full rounded-xl bg-marca px-4 py-3 font-semibold text-marca-texto disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Enviarme un enlace"}
      </button>
    </form>
  );
}
