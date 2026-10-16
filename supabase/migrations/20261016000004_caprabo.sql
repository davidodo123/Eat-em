-- Fase 2: Caprabo (scraper nuevo). El seed hace lo mismo; esto es para bases ya sembradas.
INSERT INTO supermercados (id, nombre, web, activo, orden) VALUES
  ('caprabo', 'Caprabo', 'https://www.capraboacasa.com', true, 8)
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, web = EXCLUDED.web, activo = EXCLUDED.activo, orden = EXCLUDED.orden;
