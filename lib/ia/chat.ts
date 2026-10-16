// MODO CHAT de Nutri-em: respuesta breve en texto con las fichas como contexto.
import { SYSTEM_PROMPT } from "./prompt.ts";
import type { Mensaje, Modelo } from "./generar.ts";

export interface FichaContexto { id: string; regla: string }

export function mensajesChat(pregunta: string, fichas: FichaContexto[], historial: Mensaje[] = []): Mensaje[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...historial.slice(-6),
    { role: "user", content: `MODO CHAT\n\nCONTEXTO\n${fichas.map((f) => `[${f.id}] ${f.regla}`).join("\n")}\n\nPREGUNTA\n${pregunta.slice(0, 1000)}` },
  ];
}

export async function responderChat(modelo: Modelo, pregunta: string, fichas: FichaContexto[], historial: Mensaje[] = []) {
  return (await modelo(mensajesChat(pregunta, fichas, historial))).trim();
}

// Consulta de texto completo (websearch) a partir de la pregunta: palabras de 4+ letras unidas con "or"
export function consultaFichas(pregunta: string): string {
  const palabras = [...new Set(pregunta.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").match(/[a-z]{4,}/g) ?? [])];
  return palabras.slice(0, 12).join(" or ");
}
