-- Fase 5: comparador de precios por ingrediente generico.
--
-- Para cada tienda, el producto enlazado al ingrediente (confianza >= p_confianza) con
-- menor precio por kg / l / unidad, en la unidad que corresponde al ingrediente
-- (g -> kg, ml -> l, unidad -> unidad). Precio vigente = oferta si la hay.
-- Si la tienda no publica precios (Mercadona), se usa el ultimo precio apuntado por los
-- usuarios con el escaner en los ultimos 90 dias (precios_usuario).
CREATE OR REPLACE FUNCTION public.comparar_precios(p_ingrediente TEXT, p_confianza NUMERIC DEFAULT 0.8)
RETURNS TABLE (
  supermercado_id TEXT, producto_id BIGINT, nombre TEXT, marca TEXT, imagen_url TEXT,
  precio NUMERIC, precio_por_unidad NUMERIC, unidad_precio TEXT, cantidad_neta NUMERIC, unidad unidad_base,
  fuente TEXT, fecha TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH ing AS (
    SELECT CASE unidad WHEN 'g' THEN 'kg' WHEN 'ml' THEN 'l' ELSE 'unidad' END AS u FROM ingredientes WHERE id = p_ingrediente
  ),
  candidatos AS (
    SELECT p.*, ip.confianza
    FROM ingrediente_productos ip JOIN productos p ON p.id = ip.producto_id
    WHERE ip.ingrediente_id = p_ingrediente AND ip.confianza >= p_confianza
      AND p.supermercado_id IS NOT NULL AND p.disponible AND p.descatalogado_en IS NULL
  ),
  -- Precio de la web de la tienda
  web AS (
    SELECT c.supermercado_id, c.id AS producto_id, c.nombre, c.marca, c.imagen_url,
           coalesce(c.precio_oferta, c.precio) AS precio, c.precio_por_unidad, c.unidad_precio,
           c.cantidad_neta, c.unidad, 'web'::text AS fuente, c.actualizado_en AS fecha
    FROM candidatos c
    WHERE c.precio IS NOT NULL AND c.precio_por_unidad IS NOT NULL
  ),
  -- Ultimo precio apuntado por usuarios (tiendas sin precios en la web)
  usuario AS (
    SELECT DISTINCT ON (c.id) c.supermercado_id, c.id, c.nombre, c.marca, c.imagen_url, pu.precio,
           CASE WHEN c.unidad = 'unidad' THEN pu.precio / c.cantidad_neta ELSE pu.precio / c.cantidad_neta * 1000 END,
           CASE c.unidad WHEN 'g' THEN 'kg' WHEN 'ml' THEN 'l' ELSE 'unidad' END,
           c.cantidad_neta, c.unidad, 'usuario', pu.fecha
    FROM candidatos c
    JOIN precios_usuario pu ON pu.producto_id = c.id AND pu.supermercado = c.supermercado_id
    WHERE c.precio IS NULL AND c.cantidad_neta IS NOT NULL AND pu.fecha > now() - interval '90 days'
    ORDER BY c.id, pu.fecha DESC
  ),
  todos AS (SELECT * FROM web UNION ALL SELECT * FROM usuario)
  SELECT DISTINCT ON (t.supermercado_id)
         t.supermercado_id, t.producto_id, t.nombre, t.marca, t.imagen_url,
         round(t.precio, 2), round(t.precio_por_unidad, 2), t.unidad_precio, t.cantidad_neta, t.unidad, t.fuente, t.fecha
  FROM todos t, ing
  WHERE t.unidad_precio = ing.u
  ORDER BY t.supermercado_id, t.precio_por_unidad, t.precio
$$;
