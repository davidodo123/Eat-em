"use client";
import { useActionState } from "react";
import { generarSemana, type EstadoDieta } from "./acciones";

export function BotonGenerar({ hayPlan, iaLista }: { hayPlan: boolean; iaLista: boolean }) {
  const [estado, accion, generando] = useActionState<EstadoDieta>(generarSemana, {});
  return (
    <form action={accion} className="space-y-2">
      <button type="submit" disabled={generando || !iaLista}
        className="w-full rounded-xl bg-marca px-4 py-3 font-semibold text-marca-texto disabled:opacity-60">
        {generando ? "Generando tu semana… (alrededor de un minuto)" : hayPlan ? "Volver a generar la semana" : "Generar mi semana"}
      </button>
      {!iaLista && <p className="text-sm text-texto-suave">La IA aún no está configurada.</p>}
      {estado.error && <p className="text-sm text-urgente" role="alert">{estado.error}</p>}
      {estado.aviso && <p className="rounded-xl border border-aviso/50 bg-superficie p-3 text-sm" role="status">{estado.aviso}</p>}
    </form>
  );
}
