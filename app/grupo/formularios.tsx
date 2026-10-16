"use client";
import { useActionState } from "react";
import { crearHogar, unirseHogar, type EstadoGrupo } from "./acciones";

const campo = "mt-1 block w-full rounded-xl border border-borde bg-superficie px-4 py-3 text-base outline-none focus:border-marca";
const boton = "w-full rounded-xl bg-marca px-4 py-3 font-semibold text-marca-texto disabled:opacity-60";

export function FormulariosHogar() {
  const [crear, accionCrear, creando] = useActionState<EstadoGrupo, FormData>(crearHogar, {});
  const [unir, accionUnir, uniendo] = useActionState<EstadoGrupo, FormData>(unirseHogar, {});
  return (
    <div className="space-y-6">
      <form action={accionCrear} className="space-y-3 rounded-xl border border-borde bg-superficie p-4">
        <p className="font-semibold">Crear un hogar</p>
        <label className="block">
          <span className="text-sm text-texto-suave">Nombre</span>
          <input name="nombre" required maxLength={60} placeholder="Casa" className={campo} />
        </label>
        {crear.error && <p className="text-sm text-urgente" role="alert">{crear.error}</p>}
        <button type="submit" disabled={creando} className={boton}>{creando ? "Creando…" : "Crear hogar"}</button>
      </form>

      <form action={accionUnir} className="space-y-3 rounded-xl border border-borde bg-superficie p-4">
        <p className="font-semibold">Unirme a un hogar</p>
        <label className="block">
          <span className="text-sm text-texto-suave">Código de invitación</span>
          <input name="codigo" required maxLength={8} autoCapitalize="characters" placeholder="A1B2C3D4"
            className={`${campo} font-mono uppercase tracking-widest`} />
        </label>
        {unir.error && <p className="text-sm text-urgente" role="alert">{unir.error}</p>}
        <button type="submit" disabled={uniendo} className={boton}>{uniendo ? "Uniendo…" : "Unirme"}</button>
      </form>
    </div>
  );
}
