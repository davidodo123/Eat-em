-- App movil general (revision de 2026-10-17):
--  1. Ubicacion del hogar: las cadenas con tienda cerca (OpenStreetMap) filtran precios y busqueda.
--  2. Despensa por producto real (no solo por ingrediente generico).
--  3. Busqueda sobre todo el catalogo de las tiendas elegidas.

-- 1. Ubicacion. Se guarda redondeada a 2 decimales (~1 km): basta para saber que tiendas hay cerca.
ALTER TABLE grupos
  ADD COLUMN IF NOT EXISTS lat NUMERIC(5,2) CHECK (lat BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS lon NUMERIC(5,2) CHECK (lon BETWEEN -180 AND 180),
  ADD COLUMN IF NOT EXISTS lugar TEXT,                                   -- "Motril, Granada"
  ADD COLUMN IF NOT EXISTS radio_km SMALLINT NOT NULL DEFAULT 5 CHECK (radio_km BETWEEN 1 AND 50),
  ADD COLUMN IF NOT EXISTS cadenas_cerca TEXT[] NOT NULL DEFAULT '{}',  -- ids de supermercados
  ADD COLUMN IF NOT EXISTS tiendas_cerca JSONB NOT NULL DEFAULT '[]',   -- [{cadena, nombre, km}]
  ADD COLUMN IF NOT EXISTS ubicacion_en TIMESTAMPTZ;

-- Cualquier miembro puede cambiar la ubicacion (el resto del hogar sigue siendo cosa del admin)
CREATE OR REPLACE FUNCTION public.fijar_ubicacion(
  p_grupo_id UUID, p_lat NUMERIC, p_lon NUMERIC, p_lugar TEXT, p_radio_km SMALLINT,
  p_cadenas TEXT[], p_tiendas JSONB
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT es_miembro(p_grupo_id) THEN RAISE EXCEPTION 'no eres miembro del grupo'; END IF;
  UPDATE grupos SET lat = round(p_lat, 2), lon = round(p_lon, 2), lugar = left(p_lugar, 120),
    radio_km = p_radio_km, cadenas_cerca = coalesce(p_cadenas, '{}'), tiendas_cerca = coalesce(p_tiendas, '[]'),
    ubicacion_en = now()
  WHERE id = p_grupo_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.fijar_ubicacion(UUID, NUMERIC, NUMERIC, TEXT, SMALLINT, TEXT[], JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fijar_ubicacion(UUID, NUMERIC, NUMERIC, TEXT, SMALLINT, TEXT[], JSONB) TO authenticated;

-- 2. Despensa por producto. Si el producto (o la linea) corresponde a un ingrediente, cada unidad
--    equivale a `cantidad_por_unidad` del ingrediente, y la app apunta el movimiento en el inventario
--    por ingrediente (el que usa la dieta para saber que falta).
CREATE TABLE IF NOT EXISTS despensa (
  id                   BIGSERIAL PRIMARY KEY,
  grupo_id             UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  producto_id          BIGINT REFERENCES productos(id) ON DELETE SET NULL,
  ingrediente_id       TEXT REFERENCES ingredientes(id),
  cantidad_por_unidad  NUMERIC(10,2) CHECK (cantidad_por_unidad > 0),
  nombre               TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 200),
  unidades             NUMERIC(6,2) NOT NULL DEFAULT 1 CHECK (unidades >= 0),
  lugar                TEXT NOT NULL DEFAULT 'despensa' CHECK (lugar IN ('despensa','nevera','congelador')),
  caduca               DATE,
  anadido_por          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS despensa_producto_uidx ON despensa (grupo_id, producto_id) WHERE producto_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS despensa_ingrediente_uidx ON despensa (grupo_id, ingrediente_id)
  WHERE producto_id IS NULL AND ingrediente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS despensa_grupo_idx ON despensa (grupo_id, lugar);

ALTER TABLE despensa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS despensa_all ON despensa;
CREATE POLICY despensa_all ON despensa FOR ALL TO authenticated
  USING (es_miembro(grupo_id)) WITH CHECK (es_miembro(grupo_id));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'despensa') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE despensa;
  END IF;
END $$;

-- 3. Busqueda en el catalogo de unas tiendas (todas si p_tiendas es NULL o vacio).
--    Texto completo con prefijo en la ultima palabra ("lech" encuentra "leche") y, si no hay
--    nada, similitud de trigramas para las faltas de ortografia.
CREATE OR REPLACE FUNCTION public.buscar_en_tiendas(q TEXT, p_tiendas TEXT[] DEFAULT NULL, p_limite INT DEFAULT 40)
RETURNS TABLE (
  id BIGINT, supermercado_id TEXT, nombre TEXT, marca TEXT, formato_texto TEXT, imagen_url TEXT,
  precio NUMERIC, precio_por_unidad NUMERIC, unidad_precio TEXT, cluster_id BIGINT
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  palabras TEXT[] := regexp_split_to_array(trim(regexp_replace(f_unaccent(lower(coalesce(q, ''))), '[^a-z0-9ñ ]+', ' ', 'g')), '\s+');
  consulta tsquery;
  tiendas TEXT[] := CASE WHEN p_tiendas IS NULL OR cardinality(p_tiendas) = 0 THEN NULL ELSE p_tiendas END;
  limite INT := least(greatest(coalesce(p_limite, 40), 1), 100);
BEGIN
  IF length(array_to_string(palabras, '')) < 2 THEN RETURN; END IF;
  consulta := to_tsquery('public.es_unaccent',
    (SELECT string_agg(quote_literal(w) || CASE WHEN o = cardinality(palabras) THEN ':*' ELSE '' END, ' & ' ORDER BY o)
     FROM unnest(palabras) WITH ORDINALITY AS t(w, o) WHERE w <> ''));

  RETURN QUERY
  SELECT p.id, p.supermercado_id, p.nombre, p.marca, p.formato_texto, p.imagen_url,
         CASE WHEN p.precio_oferta IS NOT NULL AND (p.oferta_hasta IS NULL OR p.oferta_hasta >= current_date)
              THEN p.precio_oferta ELSE p.precio END,
         p.precio_por_unidad, p.unidad_precio, p.cluster_id
  FROM productos p
  WHERE p.busqueda @@ consulta
    AND p.supermercado_id IS NOT NULL AND p.descatalogado_en IS NULL
    AND (tiendas IS NULL OR p.supermercado_id = ANY (tiendas))
  ORDER BY ts_rank(p.busqueda, consulta) DESC, length(p.nombre), p.precio_por_unidad NULLS LAST
  LIMIT limite;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id, p.supermercado_id, p.nombre, p.marca, p.formato_texto, p.imagen_url,
         CASE WHEN p.precio_oferta IS NOT NULL AND (p.oferta_hasta IS NULL OR p.oferta_hasta >= current_date)
              THEN p.precio_oferta ELSE p.precio END,
         p.precio_por_unidad, p.unidad_precio, p.cluster_id
  FROM productos p
  WHERE f_unaccent(lower(p.nombre)) % f_unaccent(lower(q))
    AND p.supermercado_id IS NOT NULL AND p.descatalogado_en IS NULL
    AND (tiendas IS NULL OR p.supermercado_id = ANY (tiendas))
  ORDER BY similarity(f_unaccent(lower(p.nombre)), f_unaccent(lower(q))) DESC
  LIMIT limite;
END $$;

GRANT EXECUTE ON FUNCTION public.buscar_en_tiendas(TEXT, TEXT[], INT) TO authenticated;
