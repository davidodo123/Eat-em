-- =====================================================================
-- Eat-em | Migracion inicial (Fase 1)
-- Destino: Supabase (PostgreSQL 15+). Requiere: vector, pg_trgm, unaccent.
-- Unidades internas: todas las cantidades se guardan en la unidad base
-- del ingrediente/producto: 'g', 'ml' o 'unidad'.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Configuracion de texto completo en espanol que ignora acentos
-- ("platano" encuentra "platano" y "plátano").
DO $$ BEGIN
  CREATE TEXT SEARCH CONFIGURATION public.es_unaccent (COPY = pg_catalog.spanish);
  ALTER TEXT SEARCH CONFIGURATION public.es_unaccent
    ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;
EXCEPTION WHEN unique_violation OR duplicate_object THEN NULL;
END $$;

-- unaccent() no es IMMUTABLE; este envoltorio permite usarla en indices.
CREATE OR REPLACE FUNCTION public.f_unaccent(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, t) $$;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
CREATE TYPE unidad_base   AS ENUM ('g', 'ml', 'unidad');
CREATE TYPE tipo_comida   AS ENUM ('desayuno','media_manana','comida','merienda','cena','extra');
CREATE TYPE dia_semana    AS ENUM ('lunes','martes','miercoles','jueves','viernes','sabado','domingo');
CREATE TYPE rol_grupo     AS ENUM ('admin', 'miembro');
CREATE TYPE origen_producto AS ENUM ('scraping', 'off', 'usuario');
CREATE TYPE tipo_movimiento AS ENUM ('compra', 'consumo', 'ajuste', 'desperdicio');
CREATE TYPE estado_consumo  AS ENUM ('hecha', 'saltada', 'extra');

-- Trigger generico para updated_at
CREATE OR REPLACE FUNCTION public.tg_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

-- =====================================================================
-- 1. USUARIOS Y GRUPOS
-- =====================================================================

-- Datos visibles por los miembros de los grupos del usuario.
CREATE TABLE perfiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,
  idioma      TEXT NOT NULL DEFAULT 'es',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Datos de salud: categoria especial RGPD (art. 9). Solo los ve su dueno.
CREATE TABLE perfiles_salud (
  usuario_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sexo                TEXT CHECK (sexo IN ('hombre','mujer')),
  fecha_nacimiento    DATE,
  altura_cm           NUMERIC(5,1) CHECK (altura_cm BETWEEN 100 AND 250),
  peso_kg             NUMERIC(5,1) CHECK (peso_kg BETWEEN 30 AND 300),
  actividad           TEXT CHECK (actividad IN ('sedentario','ligero','moderado','alto')),
  objetivo            TEXT CHECK (objetivo IN ('perder_grasa','ganar_musculo','mantenimiento')),
  comidas_dia         SMALLINT NOT NULL DEFAULT 4 CHECK (comidas_dia BETWEEN 2 AND 6),
  alergias            TEXT[] NOT NULL DEFAULT '{}',   -- codigos de alergeno UE (ver ingredientes.alergenos)
  exclusiones         TEXT[] NOT NULL DEFAULT '{}',   -- ids de ingrediente que no le gustan
  dieta_tipo          TEXT NOT NULL DEFAULT 'omnivora'
                      CHECK (dieta_tipo IN ('omnivora','vegetariana','vegana','pescetariana')),
  condiciones_medicas TEXT[] NOT NULL DEFAULT '{}',
  embarazo            BOOLEAN NOT NULL DEFAULT false,
  lactancia           BOOLEAN NOT NULL DEFAULT false,
  tiempo_cocina_min   SMALLINT,
  presupuesto_semana  NUMERIC(7,2),
  consentimiento_salud_en TIMESTAMPTZ,              -- consentimiento explicito RGPD
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historico de peso (para ajustes por tendencia semanal, ficha 005)
CREATE TABLE pesajes (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha       DATE NOT NULL DEFAULT current_date,
  peso_kg     NUMERIC(5,1) NOT NULL CHECK (peso_kg BETWEEN 30 AND 300),
  UNIQUE (usuario_id, fecha)
);

CREATE TABLE grupos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             TEXT NOT NULL,
  codigo_invitacion  TEXT NOT NULL UNIQUE
                     DEFAULT upper(substr(md5(random()::text), 1, 8)),
  dias_planificacion SMALLINT NOT NULL DEFAULT 7 CHECK (dias_planificacion IN (3, 7, 14)),
  agrupar_lista_por  TEXT NOT NULL DEFAULT 'categoria' CHECK (agrupar_lista_por IN ('categoria','supermercado')),
  codigo_postal      TEXT,                 -- determina el almacen de Mercadona, etc.
  creado_por         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE grupo_miembros (
  grupo_id    UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol         rol_grupo NOT NULL DEFAULT 'miembro',
  unido_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (grupo_id, usuario_id)
);
CREATE INDEX grupo_miembros_usuario_idx ON grupo_miembros (usuario_id);

-- =====================================================================
-- 2. CATALOGO DE PRODUCTOS (supermercados)
-- =====================================================================

CREATE TABLE supermercados (
  id      TEXT PRIMARY KEY,               -- 'mercadona', 'dia', ...
  nombre  TEXT NOT NULL,
  web     TEXT,
  activo  BOOLEAN NOT NULL DEFAULT true,
  orden   SMALLINT NOT NULL DEFAULT 100
);

-- Categorias normalizadas propias (no las de cada supermercado)
CREATE TABLE categorias (
  id        SERIAL PRIMARY KEY,
  slug      TEXT NOT NULL UNIQUE,
  nombre    TEXT NOT NULL,
  padre_id  INT REFERENCES categorias(id) ON DELETE SET NULL,
  orden     SMALLINT NOT NULL DEFAULT 100
);

-- Grupo de productos equivalentes entre supermercados (mismo EAN o
-- emparejados por nombre + marca + formato). Se rellena en la Fase 3.
CREATE TABLE producto_clusters (
  id          BIGSERIAL PRIMARY KEY,
  ean         TEXT UNIQUE,
  metodo      TEXT NOT NULL DEFAULT 'ean' CHECK (metodo IN ('ean','similitud','manual')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE productos (
  id                 BIGSERIAL PRIMARY KEY,
  supermercado_id    TEXT REFERENCES supermercados(id),     -- NULL si viene de OFF/usuario sin tienda
  id_origen          TEXT,                                 -- id en la tienda de origen
  url_origen         TEXT,
  nombre             TEXT NOT NULL,
  marca              TEXT,
  categoria_id       INT REFERENCES categorias(id) ON DELETE SET NULL,
  categoria_origen   TEXT,                                 -- ruta de categoria tal como la da la tienda
  -- Formato normalizado ("6 x 125 g" -> cantidad_neta 750, unidad g, unidades_pack 6)
  formato_texto      TEXT,
  cantidad_neta      NUMERIC(10,2) CHECK (cantidad_neta > 0),
  unidad             unidad_base,
  unidades_pack      INT NOT NULL DEFAULT 1 CHECK (unidades_pack > 0),
  -- Precio vigente (historico en precios_historico)
  precio             NUMERIC(8,2) CHECK (precio >= 0),
  precio_por_unidad  NUMERIC(10,4),                        -- EUR/kg, EUR/l o EUR/unidad
  unidad_precio      TEXT CHECK (unidad_precio IN ('kg','l','unidad')),
  precio_oferta      NUMERIC(8,2),
  oferta_hasta       DATE,
  imagen_url         TEXT,
  ean                TEXT CHECK (ean ~ '^[0-9]{8}$|^[0-9]{13}$'),
  -- Composicion y nutricion por 100 g/ml
  ingredientes_texto TEXT,
  alergenos          TEXT[] NOT NULL DEFAULT '{}',
  trazas             TEXT[] NOT NULL DEFAULT '{}',
  kcal_100           NUMERIC(6,1),
  grasas_100         NUMERIC(6,2),
  saturadas_100      NUMERIC(6,2),
  hidratos_100       NUMERIC(6,2),
  azucares_100       NUMERIC(6,2),
  fibra_100          NUMERIC(6,2),
  proteinas_100      NUMERIC(6,2),
  sal_100            NUMERIC(6,3),
  nutricion_origen   TEXT CHECK (nutricion_origen IN ('tienda','off','usuario','manual')),
  -- Estado
  disponible         BOOLEAN NOT NULL DEFAULT true,
  descatalogado_en   TIMESTAMPTZ,                          -- se marca, nunca se borra
  origen             origen_producto NOT NULL DEFAULT 'scraping',
  verificado         BOOLEAN NOT NULL DEFAULT false,
  cluster_id         BIGINT REFERENCES producto_clusters(id) ON DELETE SET NULL,
  visto_primera_vez  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Busqueda
  busqueda tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('public.es_unaccent', coalesce(nombre, '')), 'A') ||
    setweight(to_tsvector('public.es_unaccent', coalesce(marca, '')), 'B') ||
    setweight(to_tsvector('public.es_unaccent', coalesce(categoria_origen, '')), 'C')
  ) STORED
);
CREATE UNIQUE INDEX productos_origen_uidx ON productos (supermercado_id, id_origen)
  WHERE supermercado_id IS NOT NULL AND id_origen IS NOT NULL;
CREATE INDEX productos_ean_idx       ON productos (ean);
CREATE INDEX productos_busqueda_idx  ON productos USING gin (busqueda);
CREATE INDEX productos_nombre_trgm   ON productos USING gin (public.f_unaccent(lower(nombre)) gin_trgm_ops);
CREATE INDEX productos_categoria_idx ON productos (categoria_id);
CREATE INDEX productos_cluster_idx   ON productos (cluster_id);

-- Historico de precios: una fila por producto y dia en que se observa
CREATE TABLE precios_historico (
  producto_id    BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  fecha          DATE NOT NULL DEFAULT current_date,
  precio         NUMERIC(8,2) NOT NULL,
  precio_oferta  NUMERIC(8,2),
  PRIMARY KEY (producto_id, fecha)
);

-- Precios aportados por usuarios al escanear (base de precios propia)
CREATE TABLE precios_usuario (
  id               BIGSERIAL PRIMARY KEY,
  ean              TEXT NOT NULL,
  supermercado     TEXT NOT NULL REFERENCES supermercados(id),
  precio           NUMERIC(8,2) NOT NULL CHECK (precio > 0),
  usuario_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  producto_id      BIGINT REFERENCES productos(id) ON DELETE SET NULL,
  fecha            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX precios_usuario_ean_idx ON precios_usuario (ean, supermercado, fecha DESC);

-- Cola de revision: productos creados por usuarios y reportes de errores
CREATE TABLE revision_productos (
  id            BIGSERIAL PRIMARY KEY,
  producto_id   BIGINT REFERENCES productos(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('producto_nuevo','reporte_error')),
  descripcion   TEXT,
  foto_path     TEXT,                    -- ruta en Supabase Storage (bucket "etiquetas")
  estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado')),
  reportado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelto_en   TIMESTAMPTZ
);

-- Ejecuciones de scrapers + informe de calidad
CREATE TABLE scraper_ejecuciones (
  id               BIGSERIAL PRIMARY KEY,
  supermercado_id  TEXT NOT NULL REFERENCES supermercados(id),
  inicio           TIMESTAMPTZ NOT NULL DEFAULT now(),
  fin              TIMESTAMPTZ,
  estado           TEXT NOT NULL DEFAULT 'en_curso' CHECK (estado IN ('en_curso','ok','error','alerta')),
  parametros       JSONB NOT NULL DEFAULT '{}',     -- codigo postal, almacen...
  n_productos      INT,
  n_nuevos         INT,
  n_descatalogados INT,
  n_errores        INT,
  raw_path         TEXT,                            -- carpeta del dato bruto en Storage
  informe_calidad  JSONB,
  error            TEXT
);
CREATE INDEX scraper_ejecuciones_idx ON scraper_ejecuciones (supermercado_id, inicio DESC);

-- =====================================================================
-- 3. INGREDIENTES GENERICOS (conectan dieta <-> compra)
-- =====================================================================

CREATE TABLE ingredientes (
  id                 TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9_]+$'),  -- 'arroz_blanco'
  nombre             TEXT NOT NULL,
  categoria_id       INT REFERENCES categorias(id) ON DELETE SET NULL,
  unidad             unidad_base NOT NULL DEFAULT 'g',
  gramos_por_unidad  NUMERIC(7,2),          -- huevo = 60 g; para nutricion de 'unidad'
  sinonimos          TEXT[] NOT NULL DEFAULT '{}',
  etiquetas          TEXT[] NOT NULL DEFAULT '{}',   -- 'carne','pescado','vegano','perecedero',...
  alergenos          TEXT[] NOT NULL DEFAULT '{}',
  perecedero         BOOLEAN NOT NULL DEFAULT false,
  dias_conservacion  SMALLINT,
  -- Nutricion de referencia por 100 g/ml (la usa el codigo para validar los planes)
  kcal_100           NUMERIC(6,1),
  proteinas_100      NUMERIC(6,2),
  grasas_100         NUMERIC(6,2),
  hidratos_100       NUMERIC(6,2),
  fibra_100          NUMERIC(6,2),
  nutricion_fuente   TEXT,                   -- 'BEDCA', 'media_productos', ...
  activo             BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX ingredientes_nombre_trgm ON ingredientes USING gin (public.f_unaccent(lower(nombre)) gin_trgm_ops);

CREATE TABLE ingrediente_productos (
  ingrediente_id  TEXT NOT NULL REFERENCES ingredientes(id) ON DELETE CASCADE,
  producto_id     BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  confianza       NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  metodo          TEXT NOT NULL DEFAULT 'manual' CHECK (metodo IN ('manual','auto','usuario')),
  PRIMARY KEY (ingrediente_id, producto_id)
);
CREATE INDEX ingrediente_productos_prod_idx ON ingrediente_productos (producto_id);

-- =====================================================================
-- 4. INVENTARIO (compartido por grupo)
-- =====================================================================

CREATE TABLE inventario (
  grupo_id              UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  ingrediente_id        TEXT NOT NULL REFERENCES ingredientes(id),
  cantidad              NUMERIC(10,2) NOT NULL DEFAULT 0,    -- en ingredientes.unidad
  -- Umbral: cantidad fija o "lo necesario para las proximas N comidas"
  umbral_cantidad       NUMERIC(10,2),
  umbral_comidas        SMALLINT NOT NULL DEFAULT 1 CHECK (umbral_comidas >= 0),
  producto_preferido_id BIGINT REFERENCES productos(id) ON DELETE SET NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (grupo_id, ingrediente_id)
);

-- Libro de movimientos: fuente de verdad e historial de quien hizo que.
CREATE TABLE inventario_movimientos (
  id              BIGSERIAL PRIMARY KEY,
  grupo_id        UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  ingrediente_id  TEXT NOT NULL REFERENCES ingredientes(id),
  tipo            tipo_movimiento NOT NULL,
  delta           NUMERIC(10,2) NOT NULL CHECK (delta <> 0),  -- + entra, - sale
  usuario_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  producto_id     BIGINT REFERENCES productos(id) ON DELETE SET NULL,
  precio_pagado   NUMERIC(8,2),
  supermercado_id TEXT REFERENCES supermercados(id),
  consumo_id      BIGINT,                 -- FK se anade tras crear consumos
  caduca_el       DATE,                   -- fase posterior
  nota            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inventario_mov_idx ON inventario_movimientos (grupo_id, created_at DESC);

-- Cada movimiento actualiza el stock. El stock no baja de 0 (si se consume
-- mas de lo registrado, el inventario estaba mal; se queda en 0).
CREATE OR REPLACE FUNCTION public.tg_aplicar_movimiento() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO inventario (grupo_id, ingrediente_id, cantidad)
  VALUES (NEW.grupo_id, NEW.ingrediente_id, greatest(NEW.delta, 0))
  ON CONFLICT (grupo_id, ingrediente_id)
  DO UPDATE SET cantidad = greatest(inventario.cantidad + NEW.delta, 0), updated_at = now();
  RETURN NEW;
END $$;
CREATE TRIGGER inventario_movimientos_aplicar
  AFTER INSERT ON inventario_movimientos
  FOR EACH ROW EXECUTE FUNCTION public.tg_aplicar_movimiento();

-- =====================================================================
-- 5. DIETAS Y CONSUMO (individuales)
-- =====================================================================

CREATE TABLE dietas (
  id             BIGSERIAL PRIMARY KEY,
  usuario_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grupo_id       UUID REFERENCES grupos(id) ON DELETE SET NULL,
  semana_inicio  DATE NOT NULL,               -- lunes de la semana
  estado         TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','activa','archivada')),
  objetivos      JSONB,                       -- {kcal, proteina_g, grasa_g, hidratos_g} calculados por codigo
  generada_por   TEXT NOT NULL DEFAULT 'manual' CHECK (generada_por IN ('ia','manual')),
  modelo_ia      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Solo una dieta activa por usuario y semana
CREATE UNIQUE INDEX dietas_activa_uidx ON dietas (usuario_id, semana_inicio) WHERE estado = 'activa';

CREATE TABLE dieta_comidas (
  id           BIGSERIAL PRIMARY KEY,
  dieta_id     BIGINT NOT NULL REFERENCES dietas(id) ON DELETE CASCADE,
  dia          dia_semana NOT NULL,
  tipo         tipo_comida NOT NULL,
  orden        SMALLINT NOT NULL DEFAULT 0,
  nombre       TEXT NOT NULL,
  preparacion  TEXT,
  nota_dia     TEXT
);
CREATE INDEX dieta_comidas_dieta_idx ON dieta_comidas (dieta_id, dia, orden);

CREATE TABLE dieta_comida_ingredientes (
  comida_id       BIGINT NOT NULL REFERENCES dieta_comidas(id) ON DELETE CASCADE,
  ingrediente_id  TEXT NOT NULL REFERENCES ingredientes(id),
  cantidad        NUMERIC(8,2) NOT NULL CHECK (cantidad > 0 AND cantidad <= 1000),
  PRIMARY KEY (comida_id, ingrediente_id)
);

-- Consumo real (hecha / saltada / extra no planificada)
CREATE TABLE consumos (
  id               BIGSERIAL PRIMARY KEY,
  usuario_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grupo_id         UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  dieta_comida_id  BIGINT REFERENCES dieta_comidas(id) ON DELETE SET NULL,  -- NULL = extra
  fecha            DATE NOT NULL DEFAULT current_date,
  tipo             tipo_comida NOT NULL,
  estado           estado_consumo NOT NULL,
  nombre           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (estado = 'extra' OR dieta_comida_id IS NOT NULL)
);
CREATE UNIQUE INDEX consumos_planificada_uidx ON consumos (usuario_id, dieta_comida_id, fecha)
  WHERE dieta_comida_id IS NOT NULL;
CREATE INDEX consumos_usuario_fecha_idx ON consumos (usuario_id, fecha DESC);

CREATE TABLE consumo_ingredientes (
  consumo_id            BIGINT NOT NULL REFERENCES consumos(id) ON DELETE CASCADE,
  ingrediente_id        TEXT NOT NULL REFERENCES ingredientes(id),
  cantidad_planificada  NUMERIC(8,2),
  cantidad_real         NUMERIC(8,2) NOT NULL CHECK (cantidad_real >= 0),
  PRIMARY KEY (consumo_id, ingrediente_id)
);

ALTER TABLE inventario_movimientos
  ADD CONSTRAINT inventario_mov_consumo_fk FOREIGN KEY (consumo_id) REFERENCES consumos(id) ON DELETE SET NULL;

-- =====================================================================
-- 6. LISTA DE LA COMPRA (compartida por grupo)
-- =====================================================================

CREATE TABLE lista_items (
  id               BIGSERIAL PRIMARY KEY,
  grupo_id         UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  ingrediente_id   TEXT REFERENCES ingredientes(id),
  producto_id      BIGINT REFERENCES productos(id) ON DELETE SET NULL,  -- producto propuesto
  texto_libre      TEXT,                          -- para items manuales sin ingrediente
  cantidad         NUMERIC(10,2),                 -- necesidad en unidad base
  paquetes         SMALLINT,                      -- formatos reales propuestos
  origen           TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('auto','manual')),
  urgente          BOOLEAN NOT NULL DEFAULT false,
  comprado         BOOLEAN NOT NULL DEFAULT false,
  comprado_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  comprado_en      TIMESTAMPTZ,
  anadido_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ingrediente_id IS NOT NULL OR texto_libre IS NOT NULL)
);
-- Un ingrediente solo aparece una vez pendiente en la lista del grupo
CREATE UNIQUE INDEX lista_items_pendiente_uidx ON lista_items (grupo_id, ingrediente_id)
  WHERE comprado = false AND ingrediente_id IS NOT NULL;

-- =====================================================================
-- 7. NOTIFICACIONES (Web Push)
-- =====================================================================

CREATE TABLE push_suscripciones (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notificacion_prefs (
  usuario_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_bajo            BOOLEAN NOT NULL DEFAULT true,
  item_anadido          BOOLEAN NOT NULL DEFAULT true,
  recordatorio_comidas  BOOLEAN NOT NULL DEFAULT false,
  recordatorio_compra   BOOLEAN NOT NULL DEFAULT false,
  dia_compra            dia_semana,
  hora_recordatorio     TIME,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notificaciones (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grupo_id    UUID REFERENCES grupos(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,     -- 'stock_bajo','item_anadido','recordatorio_comida',...
  titulo      TEXT NOT NULL,
  cuerpo      TEXT,
  datos       JSONB,
  leida       BOOLEAN NOT NULL DEFAULT false,
  enviada_en  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notificaciones_usuario_idx ON notificaciones (usuario_id, created_at DESC);

-- =====================================================================
-- 8. IA: base de conocimiento (RAG) y registro de llamadas
-- =====================================================================

CREATE TABLE fichas (
  id         TEXT PRIMARY KEY,
  tema       TEXT NOT NULL,
  regla      TEXT NOT NULL,
  por_que    TEXT,
  evidencia  TEXT CHECK (evidencia IN ('alto','medio','bajo')),
  fuente     TEXT,
  revision   TEXT,
  prioridad  BOOLEAN NOT NULL DEFAULT false,   -- salvaguarda: se envia siempre
  visible_consejos BOOLEAN NOT NULL DEFAULT true,  -- seccion "Consejos de psicologia de la dieta"
  embedding  vector(1536),                     -- text-embedding-3-small
  tsv        tsvector GENERATED ALWAYS AS
             (to_tsvector('public.es_unaccent', tema || ' ' || regla)) STORED
);
CREATE INDEX fichas_emb_idx ON fichas USING hnsw (embedding vector_cosine_ops);
CREATE INDEX fichas_tsv_idx ON fichas USING gin (tsv);

CREATE TABLE ia_llamadas (
  id             BIGSERIAL PRIMARY KEY,
  usuario_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  modo           TEXT NOT NULL CHECK (modo IN ('plan','chat','eval')),
  modelo         TEXT NOT NULL,
  estado         TEXT,                  -- ok / falta_dato / derivar_profesional / prefiltro / error
  intento        SMALLINT NOT NULL DEFAULT 1,
  fichas_usadas  TEXT[],
  errores        TEXT[],
  tokens_entrada INT,
  tokens_salida  INT,
  latencia_ms    INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 9. FUNCIONES DE NEGOCIO
-- =====================================================================

-- ?Es el usuario actual miembro del grupo? (SECURITY DEFINER para evitar
-- recursion de RLS en grupo_miembros)
CREATE OR REPLACE FUNCTION public.es_miembro(g UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM grupo_miembros WHERE grupo_id = g AND usuario_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.es_admin(g UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM grupo_miembros
                 WHERE grupo_id = g AND usuario_id = auth.uid() AND rol = 'admin')
$$;

-- ?Comparte el usuario actual algun grupo con u?
CREATE OR REPLACE FUNCTION public.comparte_grupo(u UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM grupo_miembros a JOIN grupo_miembros b USING (grupo_id)
                 WHERE a.usuario_id = auth.uid() AND b.usuario_id = u)
$$;

-- Crear grupo: el creador queda como admin
CREATE OR REPLACE FUNCTION public.crear_grupo(p_nombre TEXT) RETURNS grupos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g grupos;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'no autenticado'; END IF;
  INSERT INTO grupos (nombre, creado_por) VALUES (p_nombre, auth.uid()) RETURNING * INTO g;
  INSERT INTO grupo_miembros (grupo_id, usuario_id, rol) VALUES (g.id, auth.uid(), 'admin');
  RETURN g;
END $$;

-- Unirse por codigo de invitacion
CREATE OR REPLACE FUNCTION public.unirse_grupo(p_codigo TEXT) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gid UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'no autenticado'; END IF;
  SELECT id INTO gid FROM grupos WHERE codigo_invitacion = upper(trim(p_codigo));
  IF gid IS NULL THEN RAISE EXCEPTION 'codigo no valido'; END IF;
  INSERT INTO grupo_miembros (grupo_id, usuario_id) VALUES (gid, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN gid;
END $$;

-- Registrar una comida: hecha (con cantidades reales), saltada o extra.
-- p_ingredientes: [{"ingrediente_id":"arroz_blanco","cantidad":110}, ...]
-- Si es 'hecha' y no se pasan ingredientes, se usan los planificados.
-- Descuenta del inventario del grupo en la misma transaccion.
CREATE OR REPLACE FUNCTION public.registrar_consumo(
  p_grupo_id UUID,
  p_estado estado_consumo,
  p_dieta_comida_id BIGINT DEFAULT NULL,
  p_tipo tipo_comida DEFAULT NULL,
  p_fecha DATE DEFAULT current_date,
  p_ingredientes JSONB DEFAULT NULL,
  p_nombre TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_consumo BIGINT;
  v_tipo tipo_comida := p_tipo;
  r RECORD;
BEGIN
  IF NOT es_miembro(p_grupo_id) THEN RAISE EXCEPTION 'no eres miembro del grupo'; END IF;

  IF p_dieta_comida_id IS NOT NULL THEN
    SELECT dc.tipo INTO v_tipo
    FROM dieta_comidas dc JOIN dietas d ON d.id = dc.dieta_id
    WHERE dc.id = p_dieta_comida_id AND d.usuario_id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'comida no encontrada'; END IF;
  END IF;
  IF v_tipo IS NULL THEN RAISE EXCEPTION 'falta el tipo de comida'; END IF;

  -- Re-registrar la misma comida (p. ej. corregir cantidades): revierte lo anterior
  IF p_dieta_comida_id IS NOT NULL THEN
    PERFORM deshacer_consumo(c.id) FROM consumos c
    WHERE c.usuario_id = auth.uid() AND c.dieta_comida_id = p_dieta_comida_id AND c.fecha = p_fecha;
  END IF;

  INSERT INTO consumos (usuario_id, grupo_id, dieta_comida_id, fecha, tipo, estado, nombre)
  VALUES (auth.uid(), p_grupo_id, p_dieta_comida_id, p_fecha, v_tipo, p_estado, p_nombre)
  RETURNING id INTO v_consumo;

  IF p_estado = 'saltada' THEN RETURN v_consumo; END IF;

  FOR r IN
    SELECT coalesce(x.ingrediente_id, pl.ingrediente_id) AS ingrediente_id,
           pl.cantidad AS planificada,
           coalesce(x.cantidad, pl.cantidad) AS cant_real
    FROM (SELECT dci.ingrediente_id, dci.cantidad
          FROM dieta_comida_ingredientes dci WHERE dci.comida_id = p_dieta_comida_id) pl
    FULL JOIN (SELECT e->>'ingrediente_id' AS ingrediente_id, (e->>'cantidad')::numeric AS cantidad
               FROM jsonb_array_elements(coalesce(p_ingredientes, '[]'::jsonb)) e) x
      ON x.ingrediente_id = pl.ingrediente_id
    -- si se pasan ingredientes, mandan ellos (los no enviados se consideran no consumidos)
    WHERE p_ingredientes IS NULL OR x.ingrediente_id IS NOT NULL
  LOOP
    INSERT INTO consumo_ingredientes (consumo_id, ingrediente_id, cantidad_planificada, cantidad_real)
    VALUES (v_consumo, r.ingrediente_id, r.planificada, r.cant_real);
    IF r.cant_real > 0 THEN
      INSERT INTO inventario_movimientos (grupo_id, ingrediente_id, tipo, delta, usuario_id, consumo_id)
      VALUES (p_grupo_id, r.ingrediente_id, 'consumo', -r.cant_real, auth.uid(), v_consumo);
    END IF;
  END LOOP;

  RETURN v_consumo;
END $$;

-- Deshacer un consumo: devuelve al inventario lo descontado y lo borra
CREATE OR REPLACE FUNCTION public.deshacer_consumo(p_consumo_id BIGINT) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE c consumos;
BEGIN
  SELECT * INTO c FROM consumos WHERE id = p_consumo_id AND usuario_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'consumo no encontrado'; END IF;
  INSERT INTO inventario_movimientos (grupo_id, ingrediente_id, tipo, delta, usuario_id, nota)
  SELECT m.grupo_id, m.ingrediente_id, 'ajuste', -m.delta, auth.uid(), 'deshacer consumo ' || p_consumo_id
  FROM inventario_movimientos m WHERE m.consumo_id = p_consumo_id;
  DELETE FROM consumos WHERE id = p_consumo_id;
END $$;

-- Marcar un item de la lista como comprado: pasa al inventario
CREATE OR REPLACE FUNCTION public.marcar_comprado(
  p_item_id BIGINT,
  p_cantidad NUMERIC DEFAULT NULL,      -- cantidad real comprada (unidad base)
  p_precio NUMERIC DEFAULT NULL,
  p_supermercado TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE i lista_items; v_cant NUMERIC;
BEGIN
  SELECT * INTO i FROM lista_items WHERE id = p_item_id;
  IF NOT FOUND OR NOT es_miembro(i.grupo_id) THEN RAISE EXCEPTION 'item no encontrado'; END IF;
  IF i.comprado THEN RETURN; END IF;

  UPDATE lista_items SET comprado = true, comprado_por = auth.uid(), comprado_en = now()
  WHERE id = p_item_id;

  IF i.ingrediente_id IS NOT NULL THEN
    v_cant := coalesce(p_cantidad,
                (SELECT p.cantidad_neta * i.paquetes FROM productos p WHERE p.id = i.producto_id),
                i.cantidad);
    IF coalesce(v_cant, 0) > 0 THEN
      INSERT INTO inventario_movimientos (grupo_id, ingrediente_id, tipo, delta, usuario_id,
                                          producto_id, precio_pagado, supermercado_id)
      VALUES (i.grupo_id, i.ingrediente_id, 'compra', v_cant, auth.uid(),
              i.producto_id, p_precio, p_supermercado);
    END IF;
  END IF;
END $$;

-- Busqueda tolerante de productos: texto completo + similitud trigram.
CREATE OR REPLACE FUNCTION public.buscar_productos(
  q TEXT, p_supermercado TEXT DEFAULT NULL, p_limite INT DEFAULT 30
) RETURNS SETOF productos
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p.* FROM productos p
  WHERE (p_supermercado IS NULL OR p.supermercado_id = p_supermercado)
    AND (p.busqueda @@ websearch_to_tsquery('public.es_unaccent', q)
         OR f_unaccent(lower(p.nombre)) % f_unaccent(lower(q)))
  ORDER BY p.descatalogado_en IS NOT NULL,
           ts_rank(p.busqueda, websearch_to_tsquery('public.es_unaccent', q)) DESC,
           similarity(f_unaccent(lower(p.nombre)), f_unaccent(lower(q))) DESC
  LIMIT p_limite
$$;

-- Busqueda hibrida de fichas (semantica + palabras clave, RRF). Las de
-- prioridad se anaden siempre en el codigo de la aplicacion.
CREATE OR REPLACE FUNCTION public.buscar_fichas(
  p_embedding vector(1536), p_consulta TEXT, p_k INT DEFAULT 4
) RETURNS TABLE (id TEXT, tema TEXT, regla TEXT, score DOUBLE PRECISION)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH sem AS (
    SELECT f.id, row_number() OVER (ORDER BY f.embedding <=> p_embedding) AS r
    FROM fichas f WHERE f.embedding IS NOT NULL
    ORDER BY f.embedding <=> p_embedding LIMIT 20
  ), kw AS (
    SELECT f.id, row_number() OVER (ORDER BY ts_rank(f.tsv, q) DESC) AS r
    FROM fichas f, websearch_to_tsquery('public.es_unaccent', p_consulta) q
    WHERE f.tsv @@ q
    ORDER BY ts_rank(f.tsv, q) DESC LIMIT 20
  )
  SELECT f.id, f.tema, f.regla,
         coalesce(1.0 / (60 + sem.r), 0) + coalesce(1.0 / (60 + kw.r), 0) AS score
  FROM fichas f
  LEFT JOIN sem ON sem.id = f.id
  LEFT JOIN kw  ON kw.id  = f.id
  WHERE sem.id IS NOT NULL OR kw.id IS NOT NULL
  ORDER BY score DESC
  LIMIT p_k
$$;

-- Crear perfil vacio al registrarse
CREATE OR REPLACE FUNCTION public.tg_nuevo_usuario() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO perfiles (id, nombre)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), ''));
  INSERT INTO perfiles_salud (usuario_id) VALUES (NEW.id);
  INSERT INTO notificacion_prefs (usuario_id) VALUES (NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.tg_nuevo_usuario();

CREATE TRIGGER perfiles_updated BEFORE UPDATE ON perfiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER perfiles_salud_updated BEFORE UPDATE ON perfiles_salud
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER inventario_updated BEFORE UPDATE ON inventario
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- =====================================================================
-- 10. SEGURIDAD (Row Level Security)
-- Catalogo: lectura para usuarios autenticados; escritura solo con la
-- service role (scrapers y backend), que se salta RLS.
-- =====================================================================

ALTER TABLE perfiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles_salud             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesajes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupo_miembros             ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermercados              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_clusters          ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_historico          ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_usuario            ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_productos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_ejecuciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredientes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingrediente_productos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_movimientos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dietas                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dieta_comidas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE dieta_comida_ingredientes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumo_ingredientes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_suscripciones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacion_prefs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichas                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_llamadas                ENABLE ROW LEVEL SECURITY;

-- Perfiles: el propio y los de quien comparte grupo (solo nombre/avatar)
CREATE POLICY perfiles_select ON perfiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR comparte_grupo(id));
CREATE POLICY perfiles_update ON perfiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Salud y pesajes: solo el dueno
CREATE POLICY salud_all ON perfiles_salud FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY pesajes_all ON pesajes FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- Grupos (se crean con crear_grupo / unirse_grupo)
CREATE POLICY grupos_select ON grupos FOR SELECT TO authenticated USING (es_miembro(id));
CREATE POLICY grupos_update ON grupos FOR UPDATE TO authenticated
  USING (es_admin(id)) WITH CHECK (es_admin(id));
CREATE POLICY grupos_delete ON grupos FOR DELETE TO authenticated USING (es_admin(id));

CREATE POLICY miembros_select ON grupo_miembros FOR SELECT TO authenticated USING (es_miembro(grupo_id));
-- El admin gestiona miembros; cualquiera puede salir del grupo
CREATE POLICY miembros_update ON grupo_miembros FOR UPDATE TO authenticated
  USING (es_admin(grupo_id)) WITH CHECK (es_admin(grupo_id));
CREATE POLICY miembros_delete ON grupo_miembros FOR DELETE TO authenticated
  USING (usuario_id = auth.uid() OR es_admin(grupo_id));

-- Catalogo: solo lectura
CREATE POLICY lectura ON supermercados         FOR SELECT TO authenticated USING (true);
CREATE POLICY lectura ON categorias            FOR SELECT TO authenticated USING (true);
CREATE POLICY lectura ON producto_clusters     FOR SELECT TO authenticated USING (true);
CREATE POLICY lectura ON productos             FOR SELECT TO authenticated USING (true);
CREATE POLICY lectura ON precios_historico     FOR SELECT TO authenticated USING (true);
CREATE POLICY lectura ON ingredientes          FOR SELECT TO authenticated USING (true);
CREATE POLICY lectura ON ingrediente_productos FOR SELECT TO authenticated USING (true);
CREATE POLICY lectura ON fichas                FOR SELECT TO authenticated USING (true);

-- Precios de usuario: todos leen, cada uno inserta los suyos
CREATE POLICY precios_usuario_select ON precios_usuario FOR SELECT TO authenticated USING (true);
CREATE POLICY precios_usuario_insert ON precios_usuario FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- Revision: el usuario crea reportes y ve los suyos
CREATE POLICY revision_insert ON revision_productos FOR INSERT TO authenticated
  WITH CHECK (reportado_por = auth.uid());
CREATE POLICY revision_select ON revision_productos FOR SELECT TO authenticated
  USING (reportado_por = auth.uid());

-- Inventario y lista: compartidos por el grupo
CREATE POLICY inventario_all ON inventario FOR ALL TO authenticated
  USING (es_miembro(grupo_id)) WITH CHECK (es_miembro(grupo_id));
CREATE POLICY movimientos_select ON inventario_movimientos FOR SELECT TO authenticated
  USING (es_miembro(grupo_id));
CREATE POLICY movimientos_insert ON inventario_movimientos FOR INSERT TO authenticated
  WITH CHECK (es_miembro(grupo_id) AND usuario_id = auth.uid());
CREATE POLICY lista_all ON lista_items FOR ALL TO authenticated
  USING (es_miembro(grupo_id)) WITH CHECK (es_miembro(grupo_id));

-- Dietas: el dueno gestiona; los miembros del grupo pueden VER (para
-- calcular necesidades comunes y proponer recetas base de pareja)
CREATE POLICY dietas_select ON dietas FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR (grupo_id IS NOT NULL AND es_miembro(grupo_id)));
CREATE POLICY dietas_write ON dietas FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE POLICY comidas_select ON dieta_comidas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM dietas d WHERE d.id = dieta_id
                 AND (d.usuario_id = auth.uid() OR (d.grupo_id IS NOT NULL AND es_miembro(d.grupo_id)))));
CREATE POLICY comidas_write ON dieta_comidas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM dietas d WHERE d.id = dieta_id AND d.usuario_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM dietas d WHERE d.id = dieta_id AND d.usuario_id = auth.uid()));

CREATE POLICY comida_ing_select ON dieta_comida_ingredientes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM dieta_comidas c JOIN dietas d ON d.id = c.dieta_id WHERE c.id = comida_id
                 AND (d.usuario_id = auth.uid() OR (d.grupo_id IS NOT NULL AND es_miembro(d.grupo_id)))));
CREATE POLICY comida_ing_write ON dieta_comida_ingredientes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM dieta_comidas c JOIN dietas d ON d.id = c.dieta_id
                 WHERE c.id = comida_id AND d.usuario_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM dieta_comidas c JOIN dietas d ON d.id = c.dieta_id
                 WHERE c.id = comida_id AND d.usuario_id = auth.uid()));

-- Consumos: el dueno escribe; el grupo puede ver el historial
CREATE POLICY consumos_select ON consumos FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR es_miembro(grupo_id));
CREATE POLICY consumos_write ON consumos FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid() AND es_miembro(grupo_id));
CREATE POLICY consumo_ing_select ON consumo_ingredientes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM consumos c WHERE c.id = consumo_id
                 AND (c.usuario_id = auth.uid() OR es_miembro(c.grupo_id))));
CREATE POLICY consumo_ing_write ON consumo_ingredientes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM consumos c WHERE c.id = consumo_id AND c.usuario_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM consumos c WHERE c.id = consumo_id AND c.usuario_id = auth.uid()));

-- Notificaciones: solo el dueno
CREATE POLICY push_all ON push_suscripciones FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY prefs_all ON notificacion_prefs FOR ALL TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY notif_select ON notificaciones FOR SELECT TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY notif_update ON notificaciones FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- scraper_ejecuciones e ia_llamadas: sin politicas => solo service role.

-- =====================================================================
-- 11. TIEMPO REAL (Supabase Realtime) para el grupo
-- =====================================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE inventario, inventario_movimientos, lista_items, consumos, grupo_miembros;
  END IF;
END $$;
