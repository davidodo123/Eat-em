"use server";
import { revalidatePath } from "next/cache";
import { meterEnDespensa } from "@/lib/despensa";
import { crearClienteAdmin, crearClienteServidor, usuarioActual } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { normalizarEan } from "@/lib/dominio/ean";
import { parsearFormato, type UnidadBase } from "@/lib/dominio/formato";
import { alergenosDesdeOff } from "@/lib/dominio/alergenos";

export interface ProductoEscaneado {
  id: number;
  nombre: string;
  marca: string | null;
  supermercado_id: string | null;
  precio: number | null;
  imagen_url: string | null;
  cantidad_neta: number | null;
  unidad: UnidadBase | null;
  unidades_pack: number;
  kcal_100: number | null;
  alergenos: string[];
  origen: string;
}

export interface Candidato { ingrediente_id: string; confianza: number }

export type ResultadoBusqueda =
  | { estado: "encontrado"; ean: string; productos: ProductoEscaneado[]; candidatos: Candidato[]; ultimoPrecio: { precio: number; supermercado: string } | null }
  | { estado: "desconocido"; ean: string }
  | { estado: "error"; mensaje: string };

const CAMPOS = "id, nombre, marca, supermercado_id, precio, imagen_url, cantidad_neta, unidad, unidades_pack, kcal_100, alergenos, origen";

export async function buscarCodigo(codigo: string): Promise<ResultadoBusqueda> {
  const ean = normalizarEan(codigo);
  if (!ean) return { estado: "error", mensaje: "Ese código no es un EAN válido. Revisa los números." };
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  if (!u.user) return { estado: "error", mensaje: "Tu sesión ha caducado. Vuelve a entrar." };

  let { data: productos } = await supabase.from("productos").select(CAMPOS).eq("ean", ean).limit(20);
  if (!productos?.length) {
    const nuevo = await altaDesdeOff(ean);
    if (!nuevo) return { estado: "desconocido", ean };
    productos = [nuevo];
  }

  const ids = productos.map((p) => p.id);
  const [{ data: enlaces }, { data: precios }] = await Promise.all([
    supabase.from("ingrediente_productos").select("ingrediente_id, confianza").in("producto_id", ids),
    supabase.from("precios_usuario").select("precio, supermercado").eq("ean", ean).order("fecha", { ascending: false }).limit(1),
  ]);
  const mejor = new Map<string, number>();
  for (const e of enlaces ?? []) mejor.set(e.ingrediente_id, Math.max(mejor.get(e.ingrediente_id) ?? 0, Number(e.confianza)));
  return {
    estado: "encontrado",
    ean,
    productos: productos as ProductoEscaneado[],
    candidatos: [...mejor].map(([ingrediente_id, confianza]) => ({ ingrediente_id, confianza })).sort((a, b) => b.confianza - a.confianza),
    ultimoPrecio: precios?.[0] ? { precio: Number(precios[0].precio), supermercado: precios[0].supermercado } : null,
  };
}

// Busca el EAN en Open Food Facts (copia local y, si no, su API) y lo da de alta como
// producto sin tienda (origen 'off', sin verificar). Licencia ODbL.
async function altaDesdeOff(ean: string): Promise<ProductoEscaneado | null> {
  const admin = crearClienteAdmin();
  const local = await admin.from("off_productos").select("*").eq("ean", ean).maybeSingle();
  let datos: Record<string, unknown> | null = local.error ? null : local.data;

  if (!datos) {
    try {
      const r = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${ean}?fields=product_name,brands,quantity,image_front_url,nutriments,allergens_tags,traces_tags,ingredients_text`,
        { headers: { "User-Agent": process.env.SCRAPER_USER_AGENT || "Eat-em/0.1 (uso personal)" }, signal: AbortSignal.timeout(8000) },
      );
      const j = r.ok ? await r.json() : null;
      const p = j?.status === 1 ? j.product : null;
      if (p?.product_name) {
        const n = p.nutriments ?? {};
        datos = {
          nombre: p.product_name, marca: String(p.brands ?? "").split(",")[0]?.trim() || null, cantidad_texto: p.quantity ?? null,
          imagen_url: p.image_front_url ?? null, ingredientes_texto: p.ingredients_text || null,
          alergenos: alergenosDesdeOff((p.allergens_tags ?? []).join(",")), trazas: alergenosDesdeOff((p.traces_tags ?? []).join(",")),
          kcal_100: n["energy-kcal_100g"] ?? null, grasas_100: n.fat_100g ?? null, saturadas_100: n["saturated-fat_100g"] ?? null,
          hidratos_100: n.carbohydrates_100g ?? null, azucares_100: n.sugars_100g ?? null, fibra_100: n.fiber_100g ?? null,
          proteinas_100: n.proteins_100g ?? null, sal_100: n.salt_100g ?? null,
        };
      }
    } catch {
      // OFF caido o lento: se ofrece el alta manual
    }
  }
  if (!datos?.nombre) return null;

  const f = parsearFormato(String(datos.cantidad_texto ?? "")) ?? parsearFormato(String(datos.nombre));
  const nutricion = ["kcal_100", "grasas_100", "saturadas_100", "hidratos_100", "azucares_100", "fibra_100", "proteinas_100", "sal_100"];
  const { data, error } = await admin.from("productos").insert({
    supermercado_id: null, nombre: String(datos.nombre).slice(0, 300), marca: datos.marca ?? null, ean,
    formato_texto: datos.cantidad_texto ?? null, cantidad_neta: f?.cantidad ?? null, unidad: f?.unidad ?? null, unidades_pack: f?.pack ?? 1,
    imagen_url: datos.imagen_url ?? null, ingredientes_texto: datos.ingredientes_texto ?? null,
    alergenos: datos.alergenos ?? [], trazas: datos.trazas ?? [],
    ...Object.fromEntries(nutricion.map((k) => [k, nutriente(datos![k])])),
    nutricion_origen: nutriente(datos.kcal_100) !== null ? "off" : null,
    origen: "off", verificado: false,
  }).select(CAMPOS).single();
  return error ? null : (data as ProductoEscaneado);
}

export type ResultadoGuardar = { ok: true; mensaje: string } | { ok: false; mensaje: string };

// Apunta una compra: precio visto (para todos) y entrada en la despensa del hogar
// (y en el inventario por ingrediente si cuenta para la dieta)
export async function registrarCompra(datos: FormData): Promise<ResultadoGuardar> {
  const ean = normalizarEan(String(datos.get("ean") ?? ""));
  const productoId = Number(datos.get("producto_id"));
  const ingredienteId = String(datos.get("ingrediente_id") ?? "");
  const supermercado = String(datos.get("supermercado") ?? "");
  const precio = numero(String(datos.get("precio") ?? "").replace(",", "."));
  const cantidad = numero(String(datos.get("cantidad") ?? "").replace(",", "."));
  const unidades = Math.min(99, Math.max(1, Math.round(Number(datos.get("unidades")) || 1)));
  if (!ean || !productoId) return { ok: false, mensaje: "Falta el producto." };
  if (ingredienteId && !cantidad) return { ok: false, mensaje: "Indica cuánto has comprado." };

  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  if (!u.user) return { ok: false, mensaje: "Tu sesión ha caducado. Vuelve a entrar." };
  const hogar = await hogarActual(supabase);
  if (!hogar) return { ok: false, mensaje: "Primero crea un hogar o únete a uno." };

  if (precio && supermercado) {
    const { error } = await supabase.from("precios_usuario").insert({
      ean, supermercado, precio, usuario_id: u.user.id, producto_id: productoId,
    });
    if (error) return { ok: false, mensaje: "No se pudo guardar el precio." };
  }
  const { data: prod } = await supabase.from("productos").select("nombre").eq("id", productoId).single();
  try {
    await meterEnDespensa(supabase, hogar.id, u.user.id, ingredienteId
      ? { productoId, nombre: prod?.nombre ?? "Producto", unidades, ingredienteId, cantidadPorUnidad: Math.round((cantidad! / unidades) * 100) / 100, apuntarInventario: false }
      : { productoId, nombre: prod?.nombre ?? "Producto", unidades });
  } catch { return { ok: false, mensaje: "No se pudo añadir a la despensa." }; }
  revalidatePath("/despensa");
  if (!ingredienteId) return { ok: true, mensaje: "Guardado en la despensa." };

  const { error } = await supabase.from("inventario_movimientos").insert({
    grupo_id: hogar.id, ingrediente_id: ingredienteId, tipo: "compra", delta: cantidad, usuario_id: u.user.id,
    producto_id: productoId, precio_pagado: precio, supermercado_id: supermercado || null,
  });
  if (error) return { ok: false, mensaje: "No se pudo añadir al inventario." };

  // Lo que elige el usuario mejora el enlace producto -> ingrediente para todos
  // (sin tocar los revisados a mano)
  const admin = crearClienteAdmin();
  const { data: previo } = await admin.from("ingrediente_productos").select("metodo")
    .eq("ingrediente_id", ingredienteId).eq("producto_id", productoId).maybeSingle();
  if (previo?.metodo !== "manual") {
    await admin.from("ingrediente_productos").upsert(
      { ingrediente_id: ingredienteId, producto_id: productoId, confianza: 1, metodo: "usuario" },
      { onConflict: "ingrediente_id,producto_id" },
    );
  }
  return { ok: true, mensaje: "Guardado en la despensa." };
}

// Producto que no esta en ninguna fuente: alta del usuario, pendiente de revision
export async function altaManual(datos: FormData): Promise<ResultadoBusqueda> {
  const ean = normalizarEan(String(datos.get("ean") ?? ""));
  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 300);
  const marca = String(datos.get("marca") ?? "").trim().slice(0, 120) || null;
  const formato = String(datos.get("formato") ?? "").trim().slice(0, 60) || null;
  if (!ean || nombre.length < 3) return { estado: "error", mensaje: "Escribe al menos el nombre del producto." };

  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  if (!u.user) return { estado: "error", mensaje: "Tu sesión ha caducado. Vuelve a entrar." };

  const f = parsearFormato(formato) ?? parsearFormato(nombre);
  const { data, error } = await crearClienteAdmin().from("productos").insert({
    supermercado_id: null, nombre, marca, ean, formato_texto: formato,
    cantidad_neta: f?.cantidad ?? null, unidad: f?.unidad ?? null, unidades_pack: f?.pack ?? 1,
    origen: "usuario", verificado: false,
  }).select("id").single();
  if (error) return { estado: "error", mensaje: "No se pudo guardar el producto." };
  await supabase.from("revision_productos").insert({
    producto_id: data.id, tipo: "producto_nuevo", descripcion: `Alta desde el escaner: ${ean}`, reportado_por: u.user.id,
  });
  return buscarCodigo(ean);
}

// Nutricion por 100 g: el 0 es un valor valido
function nutriente(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
}

function numero(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) && n > 0 ? n : null;
}
