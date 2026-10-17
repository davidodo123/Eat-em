import type { Metadata } from "next";
import { rutaInterna } from "@/lib/rutas";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = {
  title: "Entrar · Eat-em",
  description: "Tu lista de la compra, tu despensa y tu dieta, con los precios de los supermercados que tienes cerca.",
};

const PUNTOS = [
  ["🛒", "Lista", "Lo que te falta, solo. Y lo que añadas a mano, con su precio en tus supermercados."],
  ["🥫", "Despensa", "Todo lo que tenéis en casa, con lo que caduca pronto arriba."],
  ["🗓️", "Dieta", "Tus comidas de la semana o del mes, a mano o con ayuda de la IA."],
] as const;

export default async function Entrar({ searchParams }: { searchParams: Promise<{ siguiente?: string; error?: string }> }) {
  const { siguiente, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),2.5rem)]">
      <div className="flex-1">
        <div className="mb-8 flex items-center gap-3">
          <span aria-hidden className="grid h-12 w-12 place-items-center rounded-2xl bg-marca text-2xl text-marca-texto shadow-sm">🥕</span>
          <span className="text-2xl font-bold tracking-tight">Eat-em</span>
        </div>
        <h1 className="text-[2.1rem] font-bold leading-[1.1] tracking-tight">La compra, la despensa y la dieta, en el bolsillo.</h1>
        <p className="mt-3 text-texto-suave">Con los productos y precios de los supermercados que tienes cerca, y compartido con quien vive contigo.</p>

        <ul className="mt-8 space-y-4">
          {PUNTOS.map(([icono, titulo, texto]) => (
            <li key={titulo} className="flex gap-3">
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-superficie text-lg shadow-[0_1px_0_var(--borde)]">{icono}</span>
              <span><b className="block">{titulo}</b><span className="text-sm text-texto-suave">{texto}</span></span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10">
        {error && <p className="mb-3 rounded-xl bg-urgente/10 p-3 text-sm text-urgente" role="alert">El enlace no vale o ha caducado. Pide uno nuevo.</p>}
        <FormularioEntrar siguiente={rutaInterna(siguiente)} />
        <p className="mt-4 text-center text-xs text-texto-suave">Sin contraseñas: te llega un enlace al correo. Eat-em no sustituye a un profesional sanitario.</p>
      </div>
    </main>
  );
}
