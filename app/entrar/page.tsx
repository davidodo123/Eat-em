import type { Metadata } from "next";
import { rutaInterna } from "@/lib/rutas";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = { title: "Entrar · Eat-em" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ siguiente?: string; error?: string }> }) {
  const { siguiente, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-bold text-marca">Eat-em</h1>
      <p className="mt-1 mb-6 text-texto-suave">Entra con tu email. Te mandamos un enlace, sin contraseñas.</p>
      {error && (
        <p className="mb-4 rounded-xl border border-urgente/40 px-4 py-3 text-sm text-urgente" role="alert">
          El enlace no es válido o ha caducado. Pide uno nuevo.
        </p>
      )}
      <FormularioEntrar siguiente={rutaInterna(siguiente)} />
      <p className="mt-8 text-xs text-texto-suave">Eat-em no sustituye a un profesional sanitario.</p>
    </main>
  );
}
