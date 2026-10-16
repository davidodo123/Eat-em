"use server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { consultaFichas, responderChat } from "@/lib/ia/chat";
import { modeloOpenAI, type Mensaje } from "@/lib/ia/generar";

export async function preguntar(pregunta: string, historial: Mensaje[]): Promise<{ respuesta?: string; error?: string }> {
  const texto = pregunta.trim();
  if (!texto) return { error: "Escribe tu pregunta." };
  if (!process.env.OPENAI_API_KEY) return { error: "Nutri-em aún no está configurado (falta la clave de la IA)." };
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Tu sesión ha caducado." };

  // RAG: las de salvaguarda siempre + las 3 mas relevantes por texto completo
  const q = consultaFichas(texto);
  const [{ data: siempre }, { data: relevantes }] = await Promise.all([
    supabase.from("fichas").select("id, regla").eq("prioridad", true),
    q ? supabase.from("fichas").select("id, regla").eq("prioridad", false)
      .textSearch("tsv", q, { config: "public.es_unaccent", type: "websearch" }).limit(3) : Promise.resolve({ data: [] }),
  ]);
  const historialSeguro = historial.filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 1500) }));
  try {
    const respuesta = await responderChat(modeloOpenAI({ formato: "texto", temperatura: 0.4 }), texto, [...(siempre ?? []), ...(relevantes ?? [])], historialSeguro);
    return { respuesta };
  } catch {
    return { error: "Nutri-em no ha podido responder ahora. Inténtalo en un momento." };
  }
}
