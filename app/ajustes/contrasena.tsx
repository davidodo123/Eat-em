"use client";
import { useActionState } from "react";
import { ponerContrasena } from "./acciones";

export function Contrasena() {
  const [estado, accion, guardando] = useActionState(ponerContrasena, {});
  return (
    <form action={accion} className="space-y-2">
      <input name="contrasena" type="password" minLength={8} required autoComplete="new-password" placeholder="Contraseña nueva" aria-label="Contraseña nueva" className="block w-full px-3.5 py-3 text-base" />
      <input name="repetir" type="password" minLength={8} required autoComplete="new-password" placeholder="Repítela" aria-label="Repite la contraseña" className="block w-full px-3.5 py-3 text-base" />
      <button type="submit" disabled={guardando} className="rounded-xl border border-borde px-4 py-2.5 font-semibold disabled:opacity-60">
        {guardando ? "Guardando…" : "Guardar contraseña"}
      </button>
      {estado.ok && <span className="ml-3 text-sm font-semibold text-marca" role="status">Guardada</span>}
      {estado.error && <p className="text-sm text-urgente" role="alert">{estado.error}</p>}
    </form>
  );
}
