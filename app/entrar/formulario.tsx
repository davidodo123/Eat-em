"use client";
import { useActionState } from "react";
import { enviarEnlace, type EstadoEntrar } from "./acciones";

// Email y enlace magico, sin contrasenas
export function FormularioEntrar({ siguiente }: { siguiente: string }) {
  const [estado, accion, enviando] = useActionState<EstadoEntrar, FormData>(enviarEnlace, { estado: "inicial" });

  if (estado.estado === "enviado") {
    return (
      <div className="caja p-5 text-center" role="status">
        <p className="font-titulo text-xl font-bold">Mira tu correo</p>
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
        className="block w-full px-4 py-3.5 text-base" />
      <button type="submit" disabled={enviando}
        className="w-full rounded-xl bg-marca px-4 py-3.5 font-semibold text-marca-texto active:opacity-85 disabled:opacity-60">
        {enviando ? "Enviando…" : "Entrar con mi email"}
      </button>
      {estado.estado === "error" && <p className="text-sm text-urgente" role="alert">{estado.mensaje}</p>}
    </form>
  );
}
