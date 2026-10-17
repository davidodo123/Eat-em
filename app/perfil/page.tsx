import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor, usuarioActual } from "@/lib/supabase/server";
import { prefiltro } from "@/lib/ia/prefiltro";
import { calcularObjetivos } from "@/lib/ia/objetivos";
import type { PerfilSalud } from "@/lib/ia/perfil";
import { FormularioPerfil } from "./formulario";

export const metadata: Metadata = { title: "Perfil · Eat-em" };

export default async function Perfil() {
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  const [{ data: perfil }, { data: salud }] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", u.user!.id).single(),
    supabase.from("perfiles_salud").select("*").eq("usuario_id", u.user!.id).single(),
  ]);
  const consentimiento = Boolean(salud?.consentimiento_salud_en);
  const p: PerfilSalud | null = salud && consentimiento ? {
    sexo: salud.sexo, fecha_nacimiento: salud.fecha_nacimiento, altura_cm: salud.altura_cm && Number(salud.altura_cm),
    peso_kg: salud.peso_kg && Number(salud.peso_kg), actividad: salud.actividad, objetivo: salud.objetivo,
    embarazo: salud.embarazo, lactancia: salud.lactancia, condiciones_medicas: salud.condiciones_medicas ?? [],
  } : null;
  const filtro = p ? prefiltro(p) : null;
  const objetivos = p && filtro?.estado === "ok"
    ? calcularObjetivos({ sexo: p.sexo!, edad: filtro.edad, altura_cm: p.altura_cm!, peso_kg: p.peso_kg!, actividad: p.actividad!, objetivo: p.objetivo! })
    : null;

  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10">
      <Link href="/" className="text-sm text-texto-suave">← Inicio</Link>
      <h1 className="mt-2 mb-4 text-2xl font-bold">Perfil</h1>

      {objetivos && (
        <div className="mb-5 rounded-xl border border-marca/40 bg-superficie p-4">
          <p className="text-sm text-texto-suave">Tu objetivo diario estimado</p>
          <p className="text-3xl font-bold text-marca">{objetivos.kcal.toLocaleString("es-ES")} kcal</p>
          <p className="mt-1 text-sm">Proteína {objetivos.proteina_g} g · Grasa {objetivos.grasa_g} g · Hidratos {objetivos.hidratos_g} g</p>
          {objetivos.minimo_aplicado && <p className="mt-1 text-xs text-texto-suave">Se aplica el mínimo de seguridad de energía.</p>}
        </div>
      )}
      {filtro?.estado === "derivar_profesional" && (
        <p className="mb-5 rounded-xl border border-aviso/50 bg-superficie p-4 text-sm">{filtro.mensaje}</p>
      )}
      {filtro?.estado === "falta_dato" && (
        <p className="mb-5 rounded-xl border border-borde bg-superficie p-4 text-sm">Para calcular tus objetivos nos falta un dato: {filtro.pregunta}</p>
      )}

      <FormularioPerfil v={{
        nombre: perfil?.nombre ?? "",
        sexo: salud?.sexo ?? null, fecha_nacimiento: salud?.fecha_nacimiento ?? null,
        altura_cm: salud?.altura_cm ?? null, peso_kg: salud?.peso_kg ?? null, actividad: salud?.actividad ?? null,
        objetivo: salud?.objetivo ?? null, comidas_dia: salud?.comidas_dia ?? 4, alergias: salud?.alergias ?? [],
        dieta_tipo: salud?.dieta_tipo ?? "omnivora", condiciones_medicas: salud?.condiciones_medicas ?? [],
        embarazo: salud?.embarazo ?? false, lactancia: salud?.lactancia ?? false, consentimiento,
      }} />
      <p className="mt-8 text-xs text-texto-suave">Eat-em no sustituye a un profesional sanitario.</p>
    </main>
  );
}
