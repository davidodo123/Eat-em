-- Fase 3: emparejar por nombre los productos sin EAN (Mercadona, Ahorramas, Gadis,
-- Caprabo) con un producto que si lo tiene: primero Open Food Facts (marcas blancas,
-- ver scrapers/off/importar.ts) y despues las tiendas con EAN (Carrefour).
--
-- Candidato valido:
--  - misma marca (si la tienda la da),
--  - formato compatible (misma unidad y +-3 % de cantidad; si falta en uno, se acepta), y
--  - las mismas palabras significativas en el nombre (sin marca, cantidades, envases ni
--    palabras vacias, en cualquier orden), o una similitud de trigramas >= p_umbral para
--    tolerar erratas. La similitud sola no basta: "leche desnatada" y "leche semidesnatada"
--    dan 0,56 y "yogur natural" contra "yogur natural azucarado", 0,58.
-- El producto entra en el cluster del EAN encontrado (metodo 'similitud' si el cluster
-- es nuevo); su EAN propio sigue vacio porque no esta verificado. aplicar_off() le pasa
-- despues la nutricion a traves del cluster.

-- Nombre en minusculas, sin tildes, sin signos y sin la marca
-- ("Leche entera Hacendado 1 L" -> "leche entera 1 l")
CREATE OR REPLACE FUNCTION public.nombre_comparable(p_nombre TEXT, p_marca TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT btrim(regexp_replace(
    replace(f_unaccent(lower(coalesce(p_nombre, ''))), coalesce(nullif(f_unaccent(lower(btrim(p_marca))), ''), chr(1)), ' '),
    '[^a-z0-9]+', ' ', 'g'))
$$;

-- Palabras que distinguen el producto, ordenadas y sin repetir
CREATE OR REPLACE FUNCTION public.palabras_clave(p_nombre TEXT, p_marca TEXT) RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT w ORDER BY w), '{}')
  FROM regexp_split_to_table(nombre_comparable(p_nombre, p_marca), ' ') w
  WHERE w <> ''
    AND w !~ '^[0-9]+([.,][0-9]+)?(x[0-9]+([.,][0-9]+)?)?(g|gr|grs|kg|ml|cl|l|lt|ud|uds|u)?$'
    AND w NOT IN ('g','gr','grs','kg','ml','cl','l','lt','ud','uds','u','x','de','del','la','el','los','las',
                  'en','con','y','a','al','para','pack','bandeja','botella','botellas','lata','latas','brick','bricks',
                  'bolsa','tarro','frasco','paquete','caja','unidad','unidades','envase','malla','pieza','aprox',
                  'estuche','sobre','sobres','tarrina','tarrinas','blister','granel')
$$;

CREATE OR REPLACE FUNCTION public.agrupar_por_similitud(
  p_supermercado TEXT, p_desde BIGINT, p_hasta BIGINT, p_umbral REAL DEFAULT 0.85
) RETURNS INT
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_ean TEXT;
  v_cluster BIGINT;
  n INT := 0;
BEGIN
  -- Preseleccion con el indice de trigramas; el filtro fino va despues
  PERFORM set_config('pg_trgm.similarity_threshold', '0.4', true);

  FOR r IN
    SELECT p.id, p.marca, p.cantidad_neta, p.unidad, f_unaccent(lower(p.nombre)) AS bruto,
           nombre_comparable(p.nombre, p.marca) AS nom, palabras_clave(p.nombre, p.marca) AS clave
    FROM productos p
    WHERE p.supermercado_id = p_supermercado AND p.id BETWEEN p_desde AND p_hasta
      AND p.ean IS NULL AND p.cluster_id IS NULL AND p.descatalogado_en IS NULL
  LOOP
    CONTINUE WHEN cardinality(r.clave) = 0;

    -- 1) Open Food Facts
    SELECT o.ean INTO v_ean
    FROM off_productos o
    WHERE f_unaccent(lower(o.nombre)) % r.bruto
      AND (r.marca IS NULL OR f_unaccent(lower(o.marca)) = f_unaccent(lower(r.marca)))
      AND (r.cantidad_neta IS NULL OR o.cantidad_neta IS NULL
           OR (o.unidad = r.unidad AND abs(o.cantidad_neta - r.cantidad_neta) <= 0.03 * r.cantidad_neta))
      AND (palabras_clave(o.nombre, o.marca) = r.clave OR similarity(nombre_comparable(o.nombre, o.marca), r.nom) >= p_umbral)
    ORDER BY palabras_clave(o.nombre, o.marca) = r.clave DESC, similarity(nombre_comparable(o.nombre, o.marca), r.nom) DESC
    LIMIT 1;

    -- 2) Tiendas que publican EAN
    IF v_ean IS NULL THEN
      SELECT q.ean INTO v_ean
      FROM productos q
      WHERE q.ean IS NOT NULL AND q.supermercado_id IS DISTINCT FROM p_supermercado
        AND f_unaccent(lower(q.nombre)) % r.bruto
        AND (r.marca IS NULL OR f_unaccent(lower(q.marca)) = f_unaccent(lower(r.marca)))
        AND (r.cantidad_neta IS NULL OR q.cantidad_neta IS NULL
             OR (q.unidad = r.unidad AND abs(q.cantidad_neta - r.cantidad_neta) <= 0.03 * r.cantidad_neta))
        AND (palabras_clave(q.nombre, q.marca) = r.clave OR similarity(nombre_comparable(q.nombre, q.marca), r.nom) >= p_umbral)
      ORDER BY palabras_clave(q.nombre, q.marca) = r.clave DESC, similarity(nombre_comparable(q.nombre, q.marca), r.nom) DESC
      LIMIT 1;
    END IF;

    CONTINUE WHEN v_ean IS NULL;
    INSERT INTO producto_clusters (ean, metodo) VALUES (v_ean, 'similitud')
    ON CONFLICT (ean) DO UPDATE SET ean = EXCLUDED.ean
    RETURNING id INTO v_cluster;
    UPDATE productos SET cluster_id = v_cluster WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.agrupar_por_similitud(TEXT, BIGINT, BIGINT, REAL) FROM PUBLIC, anon, authenticated;
