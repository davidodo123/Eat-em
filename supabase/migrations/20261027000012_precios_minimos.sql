-- Precio mas barato de varios ingredientes en una sola llamada (pantalla Lista).
-- Antes la Lista llamaba a comparar_precios() una vez por ingrediente: con 20 lineas de la
-- dieta eran 20 viajes a la base de datos (~1,5 s). Mismo criterio que comparar_precios:
-- se elige la tienda con el precio de paquete mas bajo entre las de p_supermercados (todas si es NULL).
CREATE OR REPLACE FUNCTION public.precios_minimos(p_ingredientes TEXT[], p_supermercados TEXT[] DEFAULT NULL)
RETURNS TABLE (ingrediente_id TEXT, supermercado_id TEXT, nombre TEXT, precio NUMERIC)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT DISTINCT ON (i.id) i.id, c.supermercado_id, c.nombre, c.precio
  FROM unnest(p_ingredientes) AS i(id), LATERAL comparar_precios(i.id) c
  WHERE p_supermercados IS NULL OR c.supermercado_id = ANY(p_supermercados)
  ORDER BY i.id, c.precio
$$;

REVOKE EXECUTE ON FUNCTION public.precios_minimos(TEXT[], TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.precios_minimos(TEXT[], TEXT[]) TO authenticated;
