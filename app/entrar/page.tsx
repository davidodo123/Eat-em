import type { Metadata } from "next";
import { rutaInterna } from "@/lib/rutas";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = {
  title: "Entrar · Eat-em",
  description: "Tu lista de la compra, tu despensa y tu dieta, con los precios de los supermercados que tienes cerca.",
};

const PUNTOS = [
  ["01", "Lista", "Lo que te falta, solo. Y lo que añadas a mano, con su precio en tus supermercados."],
  ["02", "Despensa", "Todo lo que tenéis en casa, con lo que caduca pronto arriba."],
  ["03", "Dieta", "Tus comidas de la semana o del mes, a mano o con ayuda de la IA."],
] as const;

export default async function Entrar({ searchParams }: { searchParams: Promise<{ siguiente?: string; error?: string }> }) {
  const { siguiente, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),2.5rem)]">
      <div className="flex-1">
        <p className="mb-10 font-titulo text-xl font-bold tracking-tight text-marca">Eat-em</p>
        <h1 className="font-titulo text-[2.5rem] font-bold leading-[1.02] tracking-[-0.035em]">La compra, la despensa y la dieta, en el bolsillo.</h1>
        <p className="mt-3 text-texto-suave">Con los productos y precios de los supermercados que tienes cerca, y compartido con quien vive contigo.</p>

        <ul className="mt-10 space-y-4">
          {PUNTOS.map(([numero, titulo, texto]) => (
            <li key={titulo} className="flex gap-4 border-t border-borde pt-4">
              <span aria-hidden className="w-6 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-texto-suave">{numero}</span>
              <span><b className="block">{titulo}</b><span className="text-sm text-texto-suave">{texto}</span></span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10">
        {error && <p className="mb-3 rounded-xl bg-urgente/10 p-3 text-sm text-urgente" role="alert">Ese enlace ya no vale. Entra con tu email y contraseña.</p>}
        <FormularioEntrar siguiente={rutaInterna(siguiente)} />
        <p className="mt-4 text-center text-xs text-texto-suave">Eat-em no sustituye a un profesional sanitario.</p>
      </div>
    </main>
  );
}
