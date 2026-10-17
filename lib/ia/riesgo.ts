// Senales de riesgo en lo que escribe el usuario (salvaguardas 014-016). Si el texto tiene
// alguna, la derivacion del modelo se respeta siempre. Si no la tiene y el perfil ya paso el
// prefiltro, una derivacion es una "salida facil" del modelo y se le pide que genere el plan.
// La lista es amplia a proposito: ante la duda, se respeta la derivacion.
const SENALES = [
  /\b(1[0-7]|[1-9])\s*a(ñ|n)os\b/, /\bmenor de edad\b/, /\binstituto\b/,
  /embaraz/, /lactan|dando el pecho|amamant/,
  /diabet|insulina|renal|ri(ñ|n)(o|ó)n|di(a|á)lisis|hep(a|á)tic|h(i|í)gado|cirrosis|card(i|í)ac|coraz(o|ó)n|infarto|hipertens|tensi(o|ó)n alta|colesterol|anticoagul|sintrom|tiroides|c(a|á)ncer|quimio|medicaci|pastillas|f(a|á)rmaco|enfermedad|operaci(o|ó)n/,
  /anorex|bulimi|purg|v(o|ó)mit|atrac(o|ó)n|atracones|laxante|ayuno|no como nada|dejar de comer|me odio|culpa|asco de m(i|í)|obsesi|miedo a engordar|tca\b|trastorno/,
  /\b[1-9]\d{2}\s*kcal|\b[1-9]\d{2}\s*calor/, // dietas muy bajas
];

export function hayRiesgoEnTexto(texto: string): boolean {
  const t = texto.toLowerCase();
  return SENALES.some((re) => re.test(t));
}
