// Proveedor de la IA: OpenAI directamente o OpenRouter (API compatible con OpenAI).
// Se detecta por la clave: las de OpenRouter empiezan por "sk-or-". OPENAI_BASE_URL fuerza otra URL.
export interface Proveedor { url: string; clave: string; modelo: (m: string) => string; cabeceras: Record<string, string> }

export function proveedorIA(clave = process.env.OPENAI_API_KEY): Proveedor {
  if (!clave) throw new Error("Falta OPENAI_API_KEY");
  const openrouter = clave.startsWith("sk-or-");
  return {
    url: (process.env.OPENAI_BASE_URL || (openrouter ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1")).replace(/\/$/, ""),
    clave,
    // En OpenRouter los modelos llevan el proveedor delante: "openai/gpt-4o-mini"
    modelo: (m) => (openrouter && !m.includes("/") ? `openai/${m}` : m),
    cabeceras: openrouter ? { "X-Title": "Eat-em" } : {},
  };
}

// Embeddings (text-embedding-3-small, 1536 dimensiones) para el RAG de fichas
export async function embeddings(textos: string[], p = proveedorIA()): Promise<number[][]> {
  const r = await fetch(`${p.url}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.clave}`, "Content-Type": "application/json", ...p.cabeceras },
    body: JSON.stringify({ model: p.modelo(process.env.OPENAI_MODELO_EMBEDDINGS ?? "text-embedding-3-small"), input: textos }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`Embeddings ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return (j.data as { index: number; embedding: number[] }[]).sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
