"use server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { consultaFichas, responderChat } from "@/lib/ia/chat";
import { mensajeErrorIA, modeloOpenAI, type Mensaje } from "@/lib/ia/generar";
import { embeddings } from "@/lib/ia/proveedor";

async function fichasRelevantes(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, texto: string) {
  try {
    const [vector] = await embeddings([texto.slice(0, 1000)]);
    const { data, error } = await supabase.rpc("buscar_fichas", { p_embedding: JSON.stringify(vector), p_consulta: texto, p_k: 4 });
    if (!error && data) return (data as { id: string; regla: string }[]).map(({ id, regla }) => ({ id, regla }));
  } catch {
    // sin embeddings: se usa el texto completo
  }
  const q = consultaFichas(texto);
  if (!q) return [];
  const { data } = await supabase.from("fichas").select("id, regla").eq("prioridad", false)
    .textSearch("tsv", q, { config: "public.es_unaccent", type: "websearch" }).limit(3);
  return data ?? [];
}

export async function preguntar(pregunta: string, historial: Mensaje[]): Promise<{ respuesta?: string; error?: string }> {
  const texto = pregunta.trim();
  if (!texto) return { error: "Escribe tu pregunta." };
  if (!process.env.OPENAI_API_KEY) return { error: "Nutri-em aún no está configurado (falta la clave de la IA)." };
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Tu sesión ha caducado." };

  // RAG: las de salvaguarda siempre + las 3-4 mas relevantes (busqueda hibrida con embeddings;
  // si falla, texto completo)
  const [{ data: siempre }, relevantes] = await Promise.all([
    supabase.from("fichas").select("id, regla").eq("prioridad", true),
    fichasRelevantes(supabase, texto),
  ]);
  const historialSeguro = historial.filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 1500) }));
  try {
    const respuesta = await responderChat(modeloOpenAI({ formato: "texto", temperatura: 0.4 }), texto, [...(siempre ?? []), ...relevantes.filter((r) => !(siempre ?? []).some((s) => s.id === r.id))], historialSeguro);
    return { respuesta };
  } catch (e) {
    return { error: mensajeErrorIA(e) };
  }
}
