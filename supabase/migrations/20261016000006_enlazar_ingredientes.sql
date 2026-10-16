-- Fase 3: enlace automatico ingrediente generico -> productos de las tiendas.
--
-- Un producto es candidato de un ingrediente si su nombre contiene, como frase y con
-- stemming en espanol, el nombre del ingrediente (confianza 1.0) o uno de sus sinonimos
-- (0.8), y es de la misma categoria propia. Los productos sin categoria (Mercadona) se
-- aceptan con la confianza x 0.7. Nunca toca los enlaces 'manual' ni 'usuario', y borra
-- los 'auto' que ya no casan. Por tienda y tramo de id (statement_timeout de la API).
CREATE OR REPLACE FUNCTION public.enlazar_ingredientes(
  p_supermercado TEXT, p_desde BIGINT, p_hasta BIGINT
) RETURNS INT
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _candidatos (
    ingrediente_id TEXT, producto_id BIGINT, confianza NUMERIC(3,2)
  ) ON COMMIT DROP;
  TRUNCATE _candidatos;

  INSERT INTO _candidatos
  SELECT i.id, p.id,
         max(t.peso * CASE WHEN p.categoria_id IS NULL THEN 0.7 ELSE 1 END)::numeric(3,2)
  FROM ingredientes i
  CROSS JOIN LATERAL (
    SELECT i.nombre AS termino, 1.0 AS peso
    UNION ALL SELECT s, 0.8 FROM unnest(i.sinonimos) s
  ) t
  JOIN productos p
    ON p.busqueda @@ phraseto_tsquery('public.es_unaccent', t.termino)
   AND (p.categoria_id = i.categoria_id OR p.categoria_id IS NULL)
  WHERE i.activo
    AND p.supermercado_id = p_supermercado
    AND p.id BETWEEN p_desde AND p_hasta
    AND p.descatalogado_en IS NULL
  GROUP BY i.id, p.id;

  -- Fuera los automaticos que ya no casan (en este tramo)
  DELETE FROM ingrediente_productos ip
  USING productos p
  WHERE ip.producto_id = p.id AND ip.metodo = 'auto'
    AND p.supermercado_id = p_supermercado AND p.id BETWEEN p_desde AND p_hasta
    AND NOT EXISTS (SELECT 1 FROM _candidatos c WHERE c.ingrediente_id = ip.ingrediente_id AND c.producto_id = ip.producto_id);

  INSERT INTO ingrediente_productos (ingrediente_id, producto_id, confianza, metodo)
  SELECT ingrediente_id, producto_id, confianza, 'auto' FROM _candidatos
  ON CONFLICT (ingrediente_id, producto_id) DO UPDATE SET confianza = EXCLUDED.confianza
    WHERE ingrediente_productos.metodo = 'auto' AND ingrediente_productos.confianza IS DISTINCT FROM EXCLUDED.confianza;

  SELECT count(*) INTO n FROM _candidatos;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.enlazar_ingredientes(TEXT, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
