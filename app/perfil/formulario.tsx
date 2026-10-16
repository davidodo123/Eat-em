"use client";
import { useActionState, useState, useTransition } from "react";
import { guardarPerfil, retirarConsentimiento, type EstadoPerfil } from "./acciones";
import { CONDICIONES_MEDICAS } from "@/lib/ia/perfil";
import { ALERGENOS } from "@/lib/dominio/alergenos";

export interface ValoresPerfil {
  nombre: string;
  sexo: string | null; fecha_nacimiento: string | null; altura_cm: number | null; peso_kg: number | null;
  actividad: string | null; objetivo: string | null; comidas_dia: number; alergias: string[]; dieta_tipo: string;
  condiciones_medicas: string[]; embarazo: boolean; lactancia: boolean; consentimiento: boolean;
}

const campo = "mt-1 block w-full rounded-xl border border-borde bg-superficie px-3 py-2.5 text-base outline-none focus:border-marca";
const NOMBRE_ALERGENO: Record<string, string> = {
  gluten: "Gluten", crustaceos: "Crustáceos", huevo: "Huevo", pescado: "Pescado", cacahuetes: "Cacahuetes", soja: "Soja",
  leche: "Leche", frutos_cascara: "Frutos de cáscara", apio: "Apio", mostaza: "Mostaza", sesamo: "Sésamo",
  sulfitos: "Sulfitos", altramuces: "Altramuces", moluscos: "Moluscos",
};

export function FormularioPerfil({ v }: { v: ValoresPerfil }) {
  const [estado, accion, guardando] = useActionState<EstadoPerfil, FormData>(guardarPerfil, {});
  const [sexo, setSexo] = useState(v.sexo ?? "");
  const [retirando, empezar] = useTransition();
  const [retirado, setRetirado] = useState(false);

  return (
    <form action={accion} className="space-y-5">
      <label className="block"><span className="text-sm font-medium">Nombre</span>
        <input name="nombre" required maxLength={60} defaultValue={v.nombre} className={campo} /></label>

      <fieldset className="space-y-3 rounded-xl border border-borde bg-superficie p-4">
        <legend className="px-1 font-semibold">Datos de salud</legend>
        <p className="text-sm text-texto-suave">Sirven para calcular tus objetivos y comprobar que es seguro proponerte una dieta. Solo los ves tú.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-sm font-medium">Fórmula</span>
            <select name="sexo" value={sexo} onChange={(e) => setSexo(e.target.value)} className={campo}>
              <option value="">—</option><option value="mujer">Mujer</option><option value="hombre">Hombre</option>
            </select></label>
          <label className="block"><span className="text-sm font-medium">Nacimiento</span>
            <input type="date" name="fecha_nacimiento" defaultValue={v.fecha_nacimiento ?? ""} className={campo} /></label>
          <label className="block"><span className="text-sm font-medium">Altura (cm)</span>
            <input name="altura_cm" inputMode="decimal" defaultValue={v.altura_cm ?? ""} className={campo} /></label>
          <label className="block"><span className="text-sm font-medium">Peso (kg)</span>
            <input name="peso_kg" inputMode="decimal" defaultValue={v.peso_kg ?? ""} className={campo} /></label>
        </div>
        <label className="block"><span className="text-sm font-medium">Actividad</span>
          <select name="actividad" defaultValue={v.actividad ?? ""} className={campo}>
            <option value="">—</option>
            <option value="sedentario">Sedentaria (casi siempre sentado)</option>
            <option value="ligero">Ligera (caminar, 1-3 días de ejercicio)</option>
            <option value="moderado">Moderada (3-5 días de ejercicio)</option>
            <option value="alto">Alta (ejercicio intenso casi a diario)</option>
          </select></label>
        <label className="block"><span className="text-sm font-medium">Objetivo</span>
          <select name="objetivo" defaultValue={v.objetivo ?? ""} className={campo}>
            <option value="">—</option><option value="perder_grasa">Perder grasa</option>
            <option value="mantenimiento">Mantenerme</option><option value="ganar_musculo">Ganar músculo</option>
          </select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-sm font-medium">Comidas al día</span>
            <select name="comidas_dia" defaultValue={String(v.comidas_dia)} className={campo}>
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select></label>
          <label className="block"><span className="text-sm font-medium">Tipo de dieta</span>
            <select name="dieta_tipo" defaultValue={v.dieta_tipo} className={campo}>
              <option value="omnivora">Omnívora</option><option value="vegetariana">Vegetariana</option>
              <option value="pescetariana">Pescetariana</option><option value="vegana">Vegana</option>
            </select></label>
        </div>

        <details className="rounded-lg border border-borde p-3" open={v.alergias.length > 0}>
          <summary className="cursor-pointer text-sm font-medium">Alergias e intolerancias</summary>
          <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
            {ALERGENOS.map((a) => (
              <label key={a} className="flex items-center gap-2"><input type="checkbox" name="alergias" value={a} defaultChecked={v.alergias.includes(a)} className="h-4 w-4" />{NOMBRE_ALERGENO[a]}</label>
            ))}
          </div>
        </details>

        <details className="rounded-lg border border-borde p-3" open={v.condiciones_medicas.length > 0 || v.embarazo || v.lactancia}>
          <summary className="cursor-pointer text-sm font-medium">Situaciones médicas</summary>
          <p className="mt-1 text-xs text-texto-suave">Si marcas alguna, Eat-em no te propondrá dieta y te recomendará un profesional.</p>
          <div className="mt-2 space-y-1 text-sm">
            {Object.entries(CONDICIONES_MEDICAS).map(([k, t]) => (
              <label key={k} className="flex items-center gap-2"><input type="checkbox" name="condiciones_medicas" value={k} defaultChecked={v.condiciones_medicas.includes(k)} className="h-4 w-4" />{t}</label>
            ))}
            {sexo === "mujer" && <>
              <label className="flex items-center gap-2"><input type="checkbox" name="embarazo" defaultChecked={v.embarazo} className="h-4 w-4" />Embarazo</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="lactancia" defaultChecked={v.lactancia} className="h-4 w-4" />Lactancia</label>
            </>}
          </div>
        </details>

        <label className="flex items-start gap-2 rounded-lg bg-fondo p-3 text-sm">
          <input type="checkbox" name="consentimiento" defaultChecked={v.consentimiento} className="mt-0.5 h-5 w-5 shrink-0" />
          <span>Doy mi <strong>consentimiento explícito</strong> para que Eat-em trate estos datos de salud con el único fin de calcular mis objetivos y proponerme una dieta. Puedo retirarlo cuando quiera y se borrarán.</span>
        </label>
      </fieldset>

      {estado.errores?.map((e) => <p key={e} className="text-sm text-urgente" role="alert">{e}</p>)}
      {estado.ok && !estado.errores && <p className="text-sm text-marca" role="status">✓ Guardado</p>}
      <button type="submit" disabled={guardando} className="w-full rounded-xl bg-marca px-4 py-3 font-semibold text-marca-texto disabled:opacity-60">
        {guardando ? "Guardando…" : "Guardar"}
      </button>
      {v.consentimiento && !retirado && (
        <button type="button" disabled={retirando}
          onClick={() => { if (confirm("Se borrarán tus datos de salud y tu historial de peso. ¿Seguro?")) empezar(async () => { const r = await retirarConsentimiento(); if (r.ok) setRetirado(true); }); }}
          className="w-full rounded-xl border border-urgente/50 px-4 py-3 text-sm font-medium text-urgente">
          Retirar consentimiento y borrar mis datos de salud
        </button>
      )}
    </form>
  );
}
