// Utilidades de texto comunes a los scrapers.

const ENTIDADES: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", euro: "€",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
  ordf: "ª", ordm: "º", ccedil: "ç", Ccedil: "Ç", agrave: "à", egrave: "è", ograve: "ò",
};

// "Crema &amp; Caf&eacute; &#39;x&#39;" -> "Crema & Café 'x'"
export function decodificar(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, e) => ENTIDADES[e] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

// "LA CANTARA" -> "La Cantara" (muchas tiendas dan las marcas en mayusculas)
export function tituloMarca(m: string | null | undefined) {
  const t = m?.trim();
  if (!t) return null;
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s\-'.])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase());
}

// Minusculas sin tildes, para comparar nombres
export const plano = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
