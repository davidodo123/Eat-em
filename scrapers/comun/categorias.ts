// Adivina la categoria propia (slug de data/catalogo-base.json) a partir de la ruta
// de categorias de la tienda ("Congelados > Verduras > Guisantes"). Sirve para votar
// el mapeo categoria de origen -> propia en las tiendas que, a diferencia de Carrefour,
// se recorren por sus propias categorias. Las correcciones finas se hacen a mano en
// categorias_origen (metodo = 'manual').
import { plano } from "./texto.ts";

// Se miran en toda la ruta: mandan sobre la subcategoria
// ("Mascotas > Comida > Carne" es "otros"; "Congelados > Verduras" es "congelados")
const POR_RUTA: [string, RegExp][] = [
  ["otros", /\b(limpieza|drogueria|higiene|cuidado personal|perfumeria|belleza|parafarmacia|mascotas?|animales|hogar|menaje|bazar|textil|electro|papel higienico|celulosa|bebes?)\b/],
  ["congelados", /\bcongelad|\bhelados?\b/],
];

// Se miran de la subcategoria hacia arriba: gana la primera que case
const POR_NIVEL: [string, RegExp][] = [
  ["panaderia", /\bpan\b|panaderia|bolleria|pasteleria|tostadas|picos/],
  ["frutos_secos", /frutos secos|semillas|\bpipas\b|fruta desecada|frutas desecadas|almendra|anacardo|avellana|cacahuete|pistacho|\bnuez\b|nueces/],
  ["lacteos", /lacteo|\bleches?\b|yogur|\bquesos?\b|mantequilla|\bnatas?\b|kefir|batidos?|postres lacteos|natillas|flanes/],
  ["huevos", /\bhuevos?\b|\bclaras\b/],
  ["conservas", /conserva|encurtido|aceitunas?|\batun\b|bonito|caballa|sardina|berberecho|mejillon|anchoa|ventresca|banderilla|\bmelva\b/],
  ["aceites", /aceite|tomate frito|vinagre|\bsalsas?\b|especia|condimento|sazonador|\bsal\b|caldos?\b|mayonesa|ketchup|mostaza/],
  ["bebidas", /bebida|\baguas?\b|refresco|zumo|cerveza|\bvinos?\b|licor|\bcafes?\b|infusion|\btes?\b|cava|sidra|bodega|isotonic/],
  ["pescado", /pescad|marisco|ahumados?|surimi|pulpo|calamar|sepia|gamba|langostino|merluza|salmon|bacalao|lubina|dorada/],
  ["carne", /\bcarnes?\b|charcuteria|embutido|jamon|\bpollo|\baves\b|cerdo|vacuno|ternera|cordero|salchich|fiambre|carniceria|\blomo\b|chorizo|sobrasada|casqueria|empanados|\bpates?\b|hamburguesa/],
  ["fruta", /\bfrutas?\b|fruteria|naranja|limon|citrico|manzana|\bperas?\b|melon|sandia|platano|\buvas?\b|kiwi|frutos rojos|fresas?\b/],
  ["verdura", /verdura|hortaliza|ensalada|patatas?\b|\bsetas\b|champinon|tomate|pepino|pimiento|calabacin|berenjena|judias verdes|zanahoria|hierbas aromaticas|brocoli|coliflor|repollo|cebolla|\bajos?\b|lechuga|alcachofa/],
  ["legumbres", /legumbre|garbanzo|lenteja|alubia/],
  ["proteina_vegetal", /\btofu\b|seitan|tempeh|vegetariano|vegano|\bveggie\b/],
  ["cereales", /\barroz\b|\bpastas?\b|harinas?|cereales|\bavena\b/],
  ["despensa", /despensa|alimentacion|dulces?|desayuno|chocolate|galleta|snack|aperitivo|azucar|\bmiel\b|mermelada|preparados?|sopas?|cacao|golosinas|gazpacho|salmorejo/],
];

export function adivinarCategoria(ruta: (string | null | undefined)[]): string | null {
  const niveles = ruta.filter((n): n is string => !!n?.trim()).map(plano);
  if (!niveles.length) return null;
  const todo = niveles.join(" > ");
  for (const [slug, re] of POR_RUTA) if (re.test(todo)) return slug;
  for (const nivel of [...niveles].reverse()) {
    for (const [slug, re] of POR_NIVEL) if (re.test(nivel)) return slug;
  }
  return null;
}

// Suma un voto categoria de origen -> slug propio
export function votar(votos: Map<string, Map<string, number>>, origen: string | null, slug: string | null) {
  if (!origen || !slug) return;
  const v = votos.get(origen) ?? new Map<string, number>();
  v.set(slug, (v.get(slug) ?? 0) + 1);
  votos.set(origen, v);
}
