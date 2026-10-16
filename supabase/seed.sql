-- GENERADO por scripts/generar-seed.mjs. No editar a mano.

INSERT INTO supermercados (id, nombre, web, activo, orden) VALUES
('mercadona', 'Mercadona', 'https://tienda.mercadona.es', true, 1),
('dia', 'Dia', 'https://www.dia.es', true, 2),
('carrefour', 'Carrefour', 'https://www.carrefour.es', true, 3),
('alcampo', 'Alcampo', 'https://www.compraonline.alcampo.es', true, 4),
('lidl', 'Lidl', 'https://www.lidl.es', true, 5),
('eroski', 'Eroski', 'https://supermercado.eroski.es', false, 10),
('ahorramas', 'Ahorramas', 'https://www.ahorramas.com', true, 6),
('gadis', 'Gadis', 'https://www.gadisline.com', true, 7),
('caprabo', 'Caprabo', 'https://www.capraboacasa.com', true, 8),
('consum', 'Consum', 'https://tienda.consum.es', false, 11),
('aldi', 'Aldi', 'https://www.aldi.es', false, 12),
('otro', 'Otro', NULL, true, 99)
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, web = EXCLUDED.web, activo = EXCLUDED.activo, orden = EXCLUDED.orden;

INSERT INTO categorias (slug, nombre, orden) VALUES
('fruta', 'Fruta', 1),
('verdura', 'Verdura y hortalizas', 2),
('carne', 'Carne', 3),
('pescado', 'Pescado y marisco', 4),
('huevos', 'Huevos', 5),
('lacteos', 'Lacteos', 6),
('cereales', 'Arroz, pasta y cereales', 7),
('legumbres', 'Legumbres', 8),
('panaderia', 'Pan y panaderia', 9),
('aceites', 'Aceites, salsas y condimentos', 10),
('conservas', 'Conservas', 11),
('frutos_secos', 'Frutos secos y semillas', 12),
('proteina_vegetal', 'Proteina vegetal', 13),
('congelados', 'Congelados', 14),
('bebidas', 'Bebidas', 15),
('despensa', 'Despensa', 16),
('otros', 'Otros', 99)
ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden;

INSERT INTO ingredientes (id, nombre, categoria_id, unidad, gramos_por_unidad, sinonimos, etiquetas, alergenos,
  perecedero, dias_conservacion, kcal_100, proteinas_100, grasas_100, hidratos_100, fibra_100, nutricion_fuente)
VALUES
('arroz_blanco', 'Arroz blanco', (SELECT id FROM categorias WHERE slug = 'cereales'), 'g'::unidad_base, NULL, ARRAY['arroz','arroz redondo','arroz largo']::text[], ARRAY['vegano']::text[], ARRAY[]::text[], false, NULL, 354, 7, 0.6, 78, 1.4, 'aprox_referencia'),
('pasta', 'Pasta seca', (SELECT id FROM categorias WHERE slug = 'cereales'), 'g'::unidad_base, NULL, ARRAY['macarrones','espaguetis','fideos']::text[], ARRAY['vegano']::text[], ARRAY['gluten']::text[], false, NULL, 355, 12.5, 1.5, 71, 3, 'aprox_referencia'),
('avena', 'Copos de avena', (SELECT id FROM categorias WHERE slug = 'cereales'), 'g'::unidad_base, NULL, ARRAY['avena','copos']::text[], ARRAY['vegano']::text[], ARRAY['gluten']::text[], false, NULL, 372, 13.5, 7, 59, 10, 'aprox_referencia'),
('pan_integral', 'Pan integral', (SELECT id FROM categorias WHERE slug = 'panaderia'), 'g'::unidad_base, NULL, ARRAY['pan','pan de molde integral']::text[], ARRAY['vegano']::text[], ARRAY['gluten']::text[], true, 5, 240, 9, 3, 41, 7, 'aprox_referencia'),
('patata', 'Patata', (SELECT id FROM categorias WHERE slug = 'verdura'), 'g'::unidad_base, NULL, ARRAY['patatas']::text[], ARRAY['vegano']::text[], ARRAY[]::text[], false, 30, 77, 2, 0.1, 17, 2, 'aprox_referencia'),
('pechuga_pollo', 'Pechuga de pollo', (SELECT id FROM categorias WHERE slug = 'carne'), 'g'::unidad_base, NULL, ARRAY['pollo','filetes de pollo']::text[], ARRAY['carne']::text[], ARRAY[]::text[], true, 3, 110, 23, 1.5, 0, 0, 'aprox_referencia'),
('ternera_magra', 'Ternera magra', (SELECT id FROM categorias WHERE slug = 'carne'), 'g'::unidad_base, NULL, ARRAY['ternera','filete de ternera']::text[], ARRAY['carne']::text[], ARRAY[]::text[], true, 3, 130, 21, 5, 0, 0, 'aprox_referencia'),
('salmon', 'Salmon', (SELECT id FROM categorias WHERE slug = 'pescado'), 'g'::unidad_base, NULL, ARRAY['lomo de salmon']::text[], ARRAY['pescado']::text[], ARRAY['pescado']::text[], true, 2, 182, 20, 11, 0, 0, 'aprox_referencia'),
('atun_natural', 'Atun al natural (lata, escurrido)', (SELECT id FROM categorias WHERE slug = 'conservas'), 'g'::unidad_base, NULL, ARRAY['atun','atun en lata']::text[], ARRAY['pescado']::text[], ARRAY['pescado']::text[], false, NULL, 110, 25, 1, 0, 0, 'aprox_referencia'),
('huevo', 'Huevo', (SELECT id FROM categorias WHERE slug = 'huevos'), 'unidad'::unidad_base, 55, ARRAY['huevos']::text[], ARRAY['vegetariano']::text[], ARRAY['huevo']::text[], true, 21, 141, 12.5, 9.7, 0.7, 0, 'aprox_referencia'),
('leche_semidesnatada', 'Leche semidesnatada', (SELECT id FROM categorias WHERE slug = 'lacteos'), 'ml'::unidad_base, NULL, ARRAY['leche']::text[], ARRAY['vegetariano']::text[], ARRAY['leche']::text[], false, NULL, 46, 3.3, 1.6, 4.8, 0, 'aprox_referencia'),
('yogur_natural', 'Yogur natural', (SELECT id FROM categorias WHERE slug = 'lacteos'), 'g'::unidad_base, NULL, ARRAY['yogur']::text[], ARRAY['vegetariano']::text[], ARRAY['leche']::text[], true, 20, 61, 3.5, 3.2, 4.7, 0, 'aprox_referencia'),
('queso_fresco_batido', 'Queso fresco batido 0 %', (SELECT id FROM categorias WHERE slug = 'lacteos'), 'g'::unidad_base, NULL, ARRAY['queso batido','skyr']::text[], ARRAY['vegetariano']::text[], ARRAY['leche']::text[], true, 20, 46, 8, 0.2, 3.5, 0, 'aprox_referencia'),
('lentejas_cocidas', 'Lentejas cocidas (bote)', (SELECT id FROM categorias WHERE slug = 'legumbres'), 'g'::unidad_base, NULL, ARRAY['lentejas']::text[], ARRAY['vegano']::text[], ARRAY[]::text[], false, NULL, 105, 8, 0.5, 14, 5, 'aprox_referencia'),
('garbanzos_cocidos', 'Garbanzos cocidos (bote)', (SELECT id FROM categorias WHERE slug = 'legumbres'), 'g'::unidad_base, NULL, ARRAY['garbanzos']::text[], ARRAY['vegano']::text[], ARRAY[]::text[], false, NULL, 120, 7, 2, 15, 6, 'aprox_referencia'),
('tofu', 'Tofu', (SELECT id FROM categorias WHERE slug = 'proteina_vegetal'), 'g'::unidad_base, NULL, ARRAY[]::text[], ARRAY['vegano']::text[], ARRAY['soja']::text[], true, 7, 120, 12.5, 7, 1.5, 1, 'aprox_referencia'),
('brocoli', 'Brocoli', (SELECT id FROM categorias WHERE slug = 'verdura'), 'g'::unidad_base, NULL, ARRAY['brecol']::text[], ARRAY['vegano']::text[], ARRAY[]::text[], true, 5, 34, 2.8, 0.4, 4, 2.6, 'aprox_referencia'),
('espinacas', 'Espinacas', (SELECT id FROM categorias WHERE slug = 'verdura'), 'g'::unidad_base, NULL, ARRAY[]::text[], ARRAY['vegano']::text[], ARRAY[]::text[], true, 4, 22, 2.9, 0.4, 1.4, 2.2, 'aprox_referencia'),
('tomate', 'Tomate', (SELECT id FROM categorias WHERE slug = 'verdura'), 'g'::unidad_base, NULL, ARRAY['tomates']::text[], ARRAY['vegano']::text[], ARRAY[]::text[], true, 7, 19, 0.9, 0.2, 3.5, 1.2, 'aprox_referencia'),
('cebolla', 'Cebolla', (SELECT id FROM categorias WHERE slug = 'verdura'), 'g'::unidad_base, NULL, ARRAY['cebollas']::text[], ARRAY['vegano']::text[], ARRAY[]::text[], false, 30, 34, 1.2, 0.1, 6, 1.7, 'aprox_referencia'),
('platano', 'Platano', (SELECT id FROM categorias WHERE slug = 'fruta'), 'unidad'::unidad_base, 120, ARRAY['platanos','banana']::text[], ARRAY['vegano']::text[], ARRAY[]::text[], true, 6, 94, 1.2, 0.3, 20, 2.6, 'aprox_referencia'),
('manzana', 'Manzana', (SELECT id FROM categorias WHERE slug = 'fruta'), 'unidad'::unidad_base, 180, ARRAY['manzanas']::text[], ARRAY['vegano']::text[], ARRAY[]::text[], true, 20, 52, 0.3, 0.2, 12, 2.4, 'aprox_referencia'),
('aceite_oliva', 'Aceite de oliva virgen extra', (SELECT id FROM categorias WHERE slug = 'aceites'), 'ml'::unidad_base, NULL, ARRAY['aceite','aove']::text[], ARRAY['vegano']::text[], ARRAY[]::text[], false, NULL, 820, 0, 91, 0, 0, 'aprox_referencia'),
('nueces', 'Nueces', (SELECT id FROM categorias WHERE slug = 'frutos_secos'), 'g'::unidad_base, NULL, ARRAY['nuez']::text[], ARRAY['vegano']::text[], ARRAY['frutos_cascara']::text[], false, NULL, 654, 15, 65, 7, 6.7, 'aprox_referencia')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, categoria_id = EXCLUDED.categoria_id, unidad = EXCLUDED.unidad,
  gramos_por_unidad = EXCLUDED.gramos_por_unidad, sinonimos = EXCLUDED.sinonimos, etiquetas = EXCLUDED.etiquetas,
  alergenos = EXCLUDED.alergenos, perecedero = EXCLUDED.perecedero, dias_conservacion = EXCLUDED.dias_conservacion,
  kcal_100 = EXCLUDED.kcal_100, proteinas_100 = EXCLUDED.proteinas_100, grasas_100 = EXCLUDED.grasas_100,
  hidratos_100 = EXCLUDED.hidratos_100, fibra_100 = EXCLUDED.fibra_100;

INSERT INTO fichas (id, tema, regla, por_que, evidencia, fuente, revision, prioridad) VALUES
('FICHA-001', 'Deficit moderado', 'Si el objetivo es perder grasa, usa un deficit del 10-20 % sobre el gasto. Nunca mas del 25 %.', 'Los deficits agresivos aumentan la perdida de musculo, el hambre y los abandonos.', 'alto', 'Revisiones sobre perdida de peso y composicion corporal', '2026-10', false),
('FICHA-002', 'Superavit pequeno', 'Si el objetivo es ganar musculo, usa un superavit del 5-10 %.', 'Mas superavit anade sobre todo grasa, no mas musculo.', 'medio', 'Revisiones sobre hipertrofia y nutricion deportiva', '2026-10', false),
('FICHA-003', 'Proteina', 'Si la persona entrena o esta en deficit, reparte la proteina en todas las comidas y prioriza fuentes magras, huevos, lacteos y legumbres.', 'Mejora la saciedad y ayuda a conservar musculo.', 'alto', 'Posicionamientos de sociedades de nutricion deportiva', '2026-10', false),
('FICHA-004', 'Saciedad', 'Si el usuario reporta hambre entre comidas, aumenta fibra y volumen (verdura, legumbres, fruta entera, cereales integrales) antes de bajar calorias.', 'Los alimentos voluminosos y ricos en fibra sacian mas por caloria.', 'medio', 'Revisiones sobre saciedad y densidad energetica', '2026-10', false),
('FICHA-005', 'Ajuste por tendencia', 'Si el peso no cambia, no modifiques el plan hasta tener 2 semanas de media semanal. Si hay que ajustar, cambia como maximo 100-150 kcal.', 'El peso diario fluctua por agua y digestion.', 'medio', 'Guias de seguimiento de composicion corporal', '2026-10', false),
('FICHA-006', 'Flexibilidad', 'Si el usuario se salta la dieta un dia, responde sin culpa y propon retomar en la siguiente comida, sin compensar con ayuno ni restriccion.', 'El enfoque rigido todo o nada se asocia a mas atracones.', 'medio', 'Estudios sobre restriccion flexible frente a rigida', '2026-10', false),
('FICHA-007', 'Hambre emocional', 'Si el usuario dice que come por estres, aburrimiento o ansiedad, pregunta cuando ocurre y propon una pausa de 10 minutos y una alternativa no alimentaria. No des consejos de restriccion.', 'Identificar el desencadenante reduce la comida automatica.', 'medio', 'Literatura sobre alimentacion emocional y mindful eating', '2026-10', false),
('FICHA-008', 'Alimentos prohibidos', 'Si el usuario quiere incluir un capricho, incluyelo en pequena cantidad dentro del plan (hasta el 10-15 % de las kcal).', 'Prohibir un alimento aumenta el deseo y los atracones.', 'medio', 'Estudios sobre restriccion alimentaria y antojos', '2026-10', false),
('FICHA-009', 'Habitos pequenos', 'Si el usuario quiere cambiar varias cosas a la vez, propon un solo cambio por semana, anclado a una rutina existente.', 'Los cambios pequenos se sostienen mas que los drasticos.', 'medio', 'Literatura sobre formacion de habitos', '2026-10', false),
('FICHA-010', 'Entorno', 'Si el usuario pica entre horas, sugiere tener a la vista fruta y snacks del plan y fuera de la vista los ultraprocesados.', 'El entorno condiciona lo que se come.', 'medio', 'Estudios sobre entorno alimentario', '2026-10', false),
('FICHA-011', 'Comer despacio', 'Si el usuario come muy rapido o frente a una pantalla, sugiere una comida al dia sin pantallas y parar a mitad del plato para notar la saciedad.', 'Mejora la percepcion de saciedad.', 'bajo', 'Estudios pequenos sobre mindful eating', '2026-10', false),
('FICHA-012', 'Pareja', 'En grupos, genera una receta base comun y ajusta solo las cantidades por persona.', 'Se cocina una vez y se reduce la compra.', 'bajo', 'Practica de planificacion, sin estudio concreto', '2026-10', false),
('FICHA-013', 'Reutilizar ingredientes', 'Cada ingrediente perecedero debe aparecer al menos en 2-3 comidas de la semana. Evita ingredientes que solo se usan una vez.', 'Reduce el desperdicio y el coste.', 'bajo', 'Practica de planificacion', '2026-10', false),
('FICHA-014', 'Senales de TCA', 'Si el usuario menciona purgas, ayunos extremos, miedo intenso a engordar, culpa intensa tras comer o atracones frecuentes, devuelve derivar_profesional, sin cifras ni planes. Responde con empatia y sin diagnosticar.', 'Un plan restrictivo puede empeorar un trastorno de la conducta alimentaria.', 'alto', 'Guias clinicas sobre trastornos de la conducta alimentaria', '2026-10', true),
('FICHA-015', 'Condiciones medicas y edad', 'Si el usuario es menor de 18, esta embarazada o en lactancia, o tiene diabetes u otra enfermedad cronica o toma medicacion relevante, devuelve derivar_profesional.', 'Sus necesidades requieren supervision sanitaria.', 'alto', 'Guias oficiales de nutricion (OMS, AESAN)', '2026-10', true),
('FICHA-016', 'Peticiones extremas', 'Si el usuario pide perder mas de 1 kg por semana, ayunar varios dias o comer menos de los minimos, rechaza amablemente y ofrece un ritmo seguro (0,25-0,75 kg/semana).', 'Los ritmos extremos dan problemas de salud y rebote.', 'alto', 'Guias oficiales y revisiones sobre perdida de peso', '2026-10', true)
ON CONFLICT (id) DO UPDATE SET tema = EXCLUDED.tema, regla = EXCLUDED.regla, por_que = EXCLUDED.por_que,
  evidencia = EXCLUDED.evidencia, fuente = EXCLUDED.fuente, revision = EXCLUDED.revision, prioridad = EXCLUDED.prioridad;
