-- Fase 2: cadenas con scraper nuevo (Ahorramas y Gadis).
-- El seed hace lo mismo; esto es para bases ya sembradas.
INSERT INTO supermercados (id, nombre, web, activo, orden) VALUES
  ('ahorramas', 'Ahorramas', 'https://www.ahorramas.com', true, 6),
  ('gadis', 'Gadis', 'https://www.gadisline.com', true, 7)
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, web = EXCLUDED.web, activo = EXCLUDED.activo, orden = EXCLUDED.orden;
