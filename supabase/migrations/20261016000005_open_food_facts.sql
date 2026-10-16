-- Fase 3: Open Food Facts (licencia ODbL, https://world.openfoodfacts.org).
-- Copia reducida del volcado: productos vendidos en Espana y los que comparten EAN
-- con alguna tienda. Sirve para rellenar la nutricion y los alergenos de `productos`
-- y, mas adelante, para emparejar por nombre los que no tienen EAN (Mercadona...).

CREATE TABLE off_productos (
  ean                TEXT PRIMARY KEY CHECK (ean ~ '^[0-9]{8}$|^[0-9]{13}$'),
  nombre             TEXT,
  marca              TEXT,
  cantidad_texto     TEXT,
  categorias         TEXT[] NOT NULL DEFAULT '{}',   -- categories_tags de OFF ("en:yogurts")
  ingredientes_texto TEXT,
  alergenos          TEXT[] NOT NULL DEFAULT '{}',   -- vocabulario propio (lib/dominio/alergenos.ts)
  trazas             TEXT[] NOT NULL DEFAULT '{}',
  kcal_100           NUMERIC(6,1),
  grasas_100         NUMERIC(6,2),
  saturadas_100      NUMERIC(6,2),
  hidratos_100       NUMERIC(6,2),
  azucares_100       NUMERIC(6,2),
  fibra_100          NUMERIC(6,2),
  proteinas_100      NUMERIC(6,2),
  sal_100            NUMERIC(6,3),
  nutriscore         CHAR(1) CHECK (nutriscore IN ('a','b','c','d','e')),
  nova               SMALLINT CHECK (nova BETWEEN 1 AND 4),
  imagen_url         TEXT,
  en_espana          BOOLEAN NOT NULL DEFAULT false,
  modificado_off     TIMESTAMPTZ,                     -- last_modified_t
  importado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX off_productos_nombre_trgm ON off_productos USING gin (public.f_unaccent(lower(nombre)) gin_trgm_ops);
CREATE INDEX off_productos_marca_idx ON off_productos (lower(marca));
ALTER TABLE off_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY lectura ON off_productos FOR SELECT TO authenticated USING (true);

-- Copia la nutricion, los alergenos y los ingredientes de OFF a los productos con el
-- mismo EAN. No pisa datos de mejor origen (tienda, usuario, manual). Por tramos de id
-- para no superar el statement_timeout de la API.
CREATE OR REPLACE FUNCTION public.aplicar_off(p_desde BIGINT, p_hasta BIGINT) RETURNS INT
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  UPDATE productos p SET
    kcal_100 = o.kcal_100, grasas_100 = o.grasas_100, saturadas_100 = o.saturadas_100,
    hidratos_100 = o.hidratos_100, azucares_100 = o.azucares_100, fibra_100 = o.fibra_100,
    proteinas_100 = o.proteinas_100, sal_100 = o.sal_100,
    alergenos = o.alergenos, trazas = o.trazas,
    ingredientes_texto = coalesce(o.ingredientes_texto, p.ingredientes_texto),
    nutricion_origen = 'off'
  FROM off_productos o
  WHERE p.ean = o.ean
    AND p.id BETWEEN p_desde AND p_hasta
    AND (p.nutricion_origen IS NULL OR p.nutricion_origen = 'off')
    AND (o.kcal_100 IS NOT NULL OR o.ingredientes_texto IS NOT NULL OR cardinality(o.alergenos) > 0)
    AND (p.kcal_100, p.grasas_100, p.saturadas_100, p.hidratos_100, p.azucares_100, p.fibra_100,
         p.proteinas_100, p.sal_100, p.alergenos, p.trazas, p.ingredientes_texto, p.nutricion_origen)
        IS DISTINCT FROM
        (o.kcal_100, o.grasas_100, o.saturadas_100, o.hidratos_100, o.azucares_100, o.fibra_100,
         o.proteinas_100, o.sal_100, o.alergenos, o.trazas, coalesce(o.ingredientes_texto, p.ingredientes_texto), 'off');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Un cluster por EAN: agrupa la ficha de cada tienda del mismo producto
CREATE OR REPLACE FUNCTION public.agrupar_por_ean(p_desde BIGINT, p_hasta BIGINT) RETURNS INT
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  INSERT INTO producto_clusters (ean, metodo)
  SELECT DISTINCT ean, 'ean' FROM productos
  WHERE ean IS NOT NULL AND id BETWEEN p_desde AND p_hasta
  ON CONFLICT (ean) DO NOTHING;

  UPDATE productos p SET cluster_id = c.id
  FROM producto_clusters c
  WHERE p.ean = c.ean AND p.id BETWEEN p_desde AND p_hasta AND p.cluster_id IS DISTINCT FROM c.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.aplicar_off(BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agrupar_por_ean(BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
