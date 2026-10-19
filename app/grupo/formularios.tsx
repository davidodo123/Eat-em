"use client";
import { useActionState } from "react";
import { cambiarDias, crearHogar, unirseHogar, type EstadoGrupo } from "./acciones";

const campo = "mt-1.5 block w-full px-4 py-3 text-base";
const boton = "w-full rounded-xl bg-marca px-4 py-3 font-semibold text-marca-texto disabled:opacity-60";

export function FormulariosHogar() {
  const [crear, accionCrear, creando] = useActionState<EstadoGrupo, FormData>(crearHogar, {});
  const [unir, accionUnir, uniendo] = useActionState<EstadoGrupo, FormData>(unirseHogar, {});
  return (
    <div className="space-y-6">
      <form action={accionCrear} className="space-y-3 caja p-4">
        <p className="font-semibold">Crear un hogar</p>
        <label className="block">
          <span className="text-sm text-texto-suave">Nombre</span>
          <input name="nombre" required maxLength={60} placeholder="Casa" className={campo} />
        </label>
        {crear.error && <p className="text-sm text-urgente" role="alert">{crear.error}</p>}
        <button type="submit" disabled={creando} className={boton}>{creando ? "Creando…" : "Crear hogar"}</button>
      </form>

      <form action={accionUnir} className="space-y-3 caja p-4">
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

export function DiasLista({ dias }: { dias: number }) {
  const [estado, accion, guardando] = useActionState<EstadoGrupo, FormData>(cambiarDias, {});
  return (
    <form action={accion} className="flex flex-wrap items-center gap-2 text-sm">
      <span>La lista automática cubre</span>
      <select name="dias" defaultValue={String(dias)} className="px-3 py-2.5 text-base">
        <option value="3">3 días</option><option value="7">7 días</option><option value="14">14 días</option>
      </select>
      <button type="submit" disabled={guardando} className="rounded-lg border border-borde px-3 py-1.5 font-medium">Guardar</button>
      {estado.error && <span className="w-full text-urgente" role="alert">{estado.error}</span>}
    </form>
  );
}
