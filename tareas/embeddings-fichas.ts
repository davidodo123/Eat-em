// Calcula los embeddings de las fichas (text-embedding-3-small) y los guarda en fichas.embedding,
// para la busqueda hibrida buscar_fichas(). Repetir cuando cambien las fichas.
//
//   npm run ia:embeddings            solo las que no tienen embedding
//   npm run ia:embeddings -- --todas  recalcula todas
import { createClient } from "@supabase/supabase-js";
import { embeddings } from "../lib/ia/proveedor.ts";

const todas = process.argv.includes("--todas");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

let q = db.from("fichas").select("id, tema, regla, por_que");
if (!todas) q = q.is("embedding", null);
const { data: fichas, error } = await q;
if (error) throw error;
if (!fichas.length) {
  console.log("Todas las fichas tienen embedding.");
} else {
  // Texto de la ficha: tema + regla + por que (lo que se busca en el chat)
  const vectores = await embeddings(fichas.map((f) => `${f.tema}. ${f.regla} ${f.por_que ?? ""}`.trim()));
  for (const [i, f] of fichas.entries()) {
    const { error: e } = await db.from("fichas").update({ embedding: JSON.stringify(vectores[i]) }).eq("id", f.id);
    if (e) throw e;
  }
  console.log(`Embeddings guardados: ${fichas.length} fichas (${vectores[0].length} dimensiones).`);
}
