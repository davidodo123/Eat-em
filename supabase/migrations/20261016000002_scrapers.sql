-- Fase 2: soporte para scrapers.

-- PostgREST (upsert de supabase-js) no admite ON CONFLICT sobre indices
-- parciales: se sustituye por una restriccion unica. Los NULL siguen siendo
-- distintos, asi que los productos de OFF/usuario (sin tienda) no chocan.
DROP INDEX IF EXISTS productos_origen_uidx;
ALTER TABLE productos ADD CONSTRAINT productos_origen_key UNIQUE (supermercado_id, id_origen);

-- Mapeo de categorias de cada tienda a las categorias propias
CREATE TABLE categorias_origen (
  supermercado_id  TEXT NOT NULL REFERENCES supermercados(id),
  id_origen        TEXT NOT NULL,
  nombre_origen    TEXT,
  categoria_id     INT REFERENCES categorias(id) ON DELETE SET NULL,
  metodo           TEXT NOT NULL DEFAULT 'auto' CHECK (metodo IN ('auto','manual')),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (supermercado_id, id_origen)
);
ALTER TABLE categorias_origen ENABLE ROW LEVEL SECURITY;
CREATE POLICY lectura ON categorias_origen FOR SELECT TO authenticated USING (true);

-- Dato bruto de los scrapers (privado: solo service role)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('raw', 'raw', false) ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Limpieza (aviso de db lint): variable no leida en deshacer_consumo
CREATE OR REPLACE FUNCTION public.deshacer_consumo(p_consumo_id BIGINT) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM consumos WHERE id = p_consumo_id AND usuario_id = auth.uid()) THEN
    RAISE EXCEPTION 'consumo no encontrado';
  END IF;
  INSERT INTO inventario_movimientos (grupo_id, ingrediente_id, tipo, delta, usuario_id, nota)
  SELECT m.grupo_id, m.ingrediente_id, 'ajuste', -m.delta, auth.uid(), 'deshacer consumo ' || p_consumo_id
  FROM inventario_movimientos m WHERE m.consumo_id = p_consumo_id;
  DELETE FROM consumos WHERE id = p_consumo_id;
END $$;
