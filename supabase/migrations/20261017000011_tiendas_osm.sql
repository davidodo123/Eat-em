-- Supermercados de Espana sacados de OpenStreetMap (ODbL), cargados con `npm run tiendas`.
-- Buscar los cercanos en nuestra base de datos es instantaneo; la API publica de Overpass
-- tarda de 10 a 40 s o falla cuando esta saturada.
CREATE TABLE IF NOT EXISTS tiendas_osm (
  osm_id      TEXT PRIMARY KEY,                 -- 'n123', 'w456', 'r789'
  cadena      TEXT,                             -- id de supermercados si la reconocemos
  nombre      TEXT NOT NULL,
  lat         DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon         DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN -180 AND 180),
  actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tiendas_osm_lat_lon_idx ON tiendas_osm (lat, lon);

-- Datos publicos: cualquiera con sesion puede leerlos; escribe solo la service role
ALTER TABLE tiendas_osm ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tiendas_osm_select ON tiendas_osm;
CREATE POLICY tiendas_osm_select ON tiendas_osm FOR SELECT TO authenticated USING (true);

-- Tiendas a menos de p_km del punto, de la mas cercana a la mas lejana
CREATE OR REPLACE FUNCTION public.tiendas_cerca(p_lat DOUBLE PRECISION, p_lon DOUBLE PRECISION, p_km DOUBLE PRECISION, p_limite INT DEFAULT 200)
RETURNS TABLE (cadena TEXT, nombre TEXT, km NUMERIC)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH caja AS (
    SELECT p_km / 111.0 AS dlat, p_km / (111.0 * greatest(cos(radians(p_lat)), 0.01)) AS dlon
  ), cerca AS (
    SELECT t.cadena, t.nombre,
           2 * 6371 * asin(sqrt(power(sin(radians(t.lat - p_lat) / 2), 2)
             + cos(radians(p_lat)) * cos(radians(t.lat)) * power(sin(radians(t.lon - p_lon) / 2), 2))) AS d
    FROM tiendas_osm t, caja
    WHERE t.lat BETWEEN p_lat - caja.dlat AND p_lat + caja.dlat
      AND t.lon BETWEEN p_lon - caja.dlon AND p_lon + caja.dlon
  )
  SELECT cadena, nombre, round(d::numeric, 1) FROM cerca WHERE d <= p_km ORDER BY d LIMIT least(greatest(p_limite, 1), 500)
$$;
GRANT EXECUTE ON FUNCTION public.tiendas_cerca(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT) TO authenticated;
