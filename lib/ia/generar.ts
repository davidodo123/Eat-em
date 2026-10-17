// Generacion de un dia de plan con reintentos (especificacion §4, puntos 4-6):
// Structured Outputs estricto, temperatura baja y hasta 2 reintentos pasando al modelo
// los errores de validarPlan. El modelo es inyectable para poder probar sin OpenAI.
import { ESQUEMA_PLAN, SYSTEM_PROMPT, type RespuestaPlan } from "./prompt.ts";
import { ajustarAKcal, validarPlan, type ContextoValidacion, type Totales } from "./validar.ts";
import { proveedorIA } from "./proveedor.ts";

export interface Mensaje { role: "system" | "user" | "assistant"; content: string }
export type Modelo = (mensajes: Mensaje[]) => Promise<string>;

export interface ResultadoDia {
  respuesta: RespuestaPlan | null;
  totales: Totales | null;
  errores: string[];   // vacio si el dia es valido
  intentos: number;
}

// sinRiesgo: el perfil paso el prefiltro y el texto del usuario no tiene senales de riesgo
// (lib/ia/riesgo.ts). Entonces una derivacion del modelo es una "salida facil" y se reintenta.
export async function generarDia(
  modelo: Modelo, mensaje: string, ctx: ContextoValidacion, reintentos = 2, op: { sinRiesgo?: boolean } = {},
): Promise<ResultadoDia> {
  const mensajes: Mensaje[] = [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: mensaje }];
  let ultimo: ResultadoDia = { respuesta: null, totales: null, errores: ["sin respuesta"], intentos: 0 };
  for (let intento = 1; intento <= reintentos + 1; intento++) {
    const texto = await modelo(mensajes);
    let respuesta: RespuestaPlan | null = null;
    let errores: string[];
    let totales: Totales | null = null;
    try {
      respuesta = ajustarAKcal(JSON.parse(texto) as RespuestaPlan, ctx);
      ({ errores, totales } = validarPlan(respuesta, ctx));
      if (op.sinRiesgo && respuesta.estado === "derivar_profesional")
        errores = ['No hay ningun riesgo en el PERFIL (ya comprobado) ni en la peticion: genera el plan con estado "ok".'];
    } catch {
      errores = ["La respuesta no es JSON valido."];
    }
    ultimo = { respuesta, totales, errores, intentos: intento };
    if (!errores.length) return ultimo;
    mensajes.push(
      { role: "assistant", content: texto },
      { role: "user", content: `El plan no es valido. Corrige SOLO esto y devuelve el JSON completo:\n- ${errores.join("\n- ")}` },
    );
  }
  return ultimo;
}

// Modelo real: Chat Completions con Structured Outputs (json_schema, strict), en OpenAI o en
// OpenRouter segun la clave (lib/ia/proveedor.ts).
// El nombre del modelo sale de OPENAI_MODELO_CHAT: comprobar el vigente en la documentacion.
// formato "texto" es el MODO CHAT (respuesta libre, sin esquema).
export function modeloOpenAI(op: { clave?: string; modelo?: string; temperatura?: number; formato?: "plan" | "texto" } = {}): Modelo {
  const p = proveedorIA(op.clave);
  const modelo = p.modelo(op.modelo ?? process.env.OPENAI_MODELO_CHAT ?? "gpt-4o-mini");
  return async (mensajes) => {
    const r = await fetch(`${p.url}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.clave}`, "Content-Type": "application/json", ...p.cabeceras },
      body: JSON.stringify({
        model: modelo,
        temperature: op.temperatura ?? 0.3,
        // Sin limite, algunos proveedores reservan 16k tokens por peticion (OpenRouter: 402 sin credito)
        max_tokens: op.formato === "texto" ? 400 : 2000,
        messages: mensajes,
        ...(op.formato === "texto" ? {} : {
          response_format: { type: "json_schema", json_schema: { name: "plan_dia", strict: true, schema: ESQUEMA_PLAN } },
        }),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw new Error(`IA ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    const contenido = j.choices?.[0]?.message;
    if (contenido?.refusal) throw new Error(`OpenAI rechazo la peticion: ${contenido.refusal}`);
    return String(contenido?.content ?? "");
  };
}
