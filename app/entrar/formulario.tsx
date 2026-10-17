"use client";
import { useActionState } from "react";
import { enviarEnlace, type EstadoEntrar } from "./acciones";

// La tira que se arranca al final de la carta: email y enlace magico, sin contrasenas
export function FormularioEntrar({ siguiente }: { siguiente: string }) {
  const [estado, accion, enviando] = useActionState<EstadoEntrar, FormData>(enviarEnlace, { estado: "inicial" });

  if (estado.estado === "enviado") {
    return (
      <p className="estado" role="status">
        Te hemos enviado un enlace a <b>{estado.email}</b>. Ábrelo en este mismo navegador para entrar.
      </p>
    );
  }
  return (
    <form action={accion}>
      <input type="hidden" name="siguiente" value={siguiente} />
      <label className="solo-lector" htmlFor="email">Tu email</label>
      <input id="email" name="email" type="email" required autoComplete="email" inputMode="email"
        defaultValue={estado.email} placeholder="tu@email.com" />
      <button type="submit" disabled={enviando} className="boton">{enviando ? "Enviando…" : "Entrar"}</button>
      {estado.estado === "error" && <p className="estado error" role="alert">{estado.mensaje}</p>}
    </form>
  );
}
