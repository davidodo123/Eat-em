import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import { Chat } from "./chat";
import { Cabecera, Pantalla } from "../ui";

export const metadata: Metadata = { title: "Nutri-em · Eat-em" };

const EVIDENCIA: Record<string, string> = { alto: "Evidencia alta", medio: "Evidencia media", bajo: "Evidencia baja" };

export default async function Nutriem() {
  const supabase = await crearClienteServidor();
  const { data: fichas } = await supabase.from("fichas").select("id, tema, regla, por_que, evidencia")
    .eq("visible_consejos", true).eq("prioridad", false).order("id");

  return (
    <Pantalla>
      <Cabecera titulo="Nutri-em" volver={{ href: "/ajustes", texto: "Ajustes" }} />
      <Chat disponible={Boolean(process.env.OPENAI_API_KEY)} />

      <h2 className="mt-8 mb-2 text-lg font-bold">Consejos de psicología de la dieta</h2>
      <ul className="space-y-2">
        {(fichas ?? []).map((f) => (
          <li key={f.id}>
            <details className="caja px-4 py-3">
              <summary className="cursor-pointer font-medium">{f.tema}</summary>
              <p className="mt-2 text-sm">{f.regla}</p>
              {f.por_que && <p className="mt-1 text-sm text-texto-suave">{f.por_que}</p>}
              {f.evidencia && <p className="mt-2 text-xs text-texto-suave">{EVIDENCIA[f.evidencia]}</p>}
            </details>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs text-texto-suave">Nutri-em es una IA: puede equivocarse. Eat-em no sustituye a un profesional sanitario.</p>
    </Pantalla>
  );
}
