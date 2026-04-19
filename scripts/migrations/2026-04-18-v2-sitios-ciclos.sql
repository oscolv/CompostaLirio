-- =====================================================================
-- Migración v2: jerarquía Sitio → Compostera → Ciclo → Medición
-- Fecha: 2026-04-18
-- Autor: refactor CompostaLirio
--
-- IDEMPOTENTE y SEGURA: se puede ejecutar múltiples veces sin dañar datos.
-- Aditiva: no elimina columnas ni filas existentes.
-- Conserva 100% del historial: cada compostera con mediciones obtiene un
-- ciclo por defecto ("Ciclo 1") al que se asignan todas sus mediciones.
--
-- Uso: psql "$DATABASE_URL" -f scripts/migrations/2026-04-18-v2-sitios-ciclos.sql
-- Alternativa: el código ejecuta estas mismas sentencias vía ensureSchemaV2()
-- en lib/db.ts al arrancar cualquier endpoint, así que no es estrictamente
-- obligatorio correrlo a mano, pero es la vía recomendada para entornos
-- nuevos donde se quiera controlar el momento del backfill.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) TABLA sitios
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sitios (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  ubicacion   TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 2) ALTER composteras: sitio_id, tipo, capacidad_kg, estado, created_at
-- ---------------------------------------------------------------------
ALTER TABLE composteras
  ADD COLUMN IF NOT EXISTS sitio_id     INTEGER REFERENCES sitios(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS tipo         TEXT,
  ADD COLUMN IF NOT EXISTS capacidad_kg REAL,
  ADD COLUMN IF NOT EXISTS estado       TEXT NOT NULL DEFAULT 'activa',
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- CHECK de estado (se añade por separado con bloque DO para que sea idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'composteras_estado_check'
  ) THEN
    ALTER TABLE composteras
      ADD CONSTRAINT composteras_estado_check
      CHECK (estado IN ('activa','inactiva','retirada'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_composteras_sitio ON composteras(sitio_id);

-- ---------------------------------------------------------------------
-- 3) TABLA ciclos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ciclos (
  id                       SERIAL PRIMARY KEY,
  compostera_id            INTEGER NOT NULL REFERENCES composteras(id) ON DELETE RESTRICT,
  nombre                   TEXT,
  fecha_inicio             DATE NOT NULL,
  fecha_fin                DATE,
  estado                   TEXT NOT NULL DEFAULT 'activo'
                             CHECK (estado IN ('activo','cerrado','descartado')),
  formulacion_id           INTEGER REFERENCES formulaciones(id) ON DELETE RESTRICT,
  peso_inicial_kg          REAL,
  objetivo                 TEXT,
  observaciones_generales  TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_ciclos_compostera ON ciclos(compostera_id);

-- Un solo ciclo activo por compostera
CREATE UNIQUE INDEX IF NOT EXISTS uq_ciclos_un_activo_por_compostera
  ON ciclos(compostera_id) WHERE estado = 'activo';

-- ---------------------------------------------------------------------
-- 4) ALTER mediciones: ciclo_id (nullable durante la migración)
-- ---------------------------------------------------------------------
ALTER TABLE mediciones
  ADD COLUMN IF NOT EXISTS ciclo_id INTEGER REFERENCES ciclos(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_mediciones_ciclo ON mediciones(ciclo_id);

-- ---------------------------------------------------------------------
-- 5) ALTER consultas: ciclo_id opcional (permite anclar preguntas al ciclo)
-- ---------------------------------------------------------------------
ALTER TABLE consultas
  ADD COLUMN IF NOT EXISTS ciclo_id INTEGER REFERENCES ciclos(id) ON DELETE SET NULL;

-- =====================================================================
-- BACKFILL DE DATOS EXISTENTES
-- =====================================================================

-- A) Sitio por defecto "San Francisco Bojay"
INSERT INTO sitios (nombre, descripcion, ubicacion)
VALUES ('San Francisco Bojay', 'Sitio inicial (seed de migración v2).', 'Bojay, Hidalgo')
ON CONFLICT (nombre) DO NOTHING;

-- B) Asignar sitio_id a composteras sin sitio
UPDATE composteras
SET sitio_id = (SELECT id FROM sitios WHERE nombre = 'San Francisco Bojay')
WHERE sitio_id IS NULL;

-- C) Crear un ciclo activo por cada compostera con historial o fecha_inicio,
--    heredando masa_inicial como peso_inicial_kg y formulación actual si existe.
WITH fuentes AS (
  SELECT
    c.id AS compostera_id,
    COALESCE(
      c.fecha_inicio,
      (SELECT MIN(m.created_at)::date FROM mediciones m WHERE m.compostera = c.id),
      CURRENT_DATE
    ) AS fecha_inicio,
    c.masa_inicial,
    (SELECT cf.formulacion_id
       FROM compostera_formulaciones cf
      WHERE cf.compostera_id = c.id AND cf.es_actual = TRUE
      LIMIT 1) AS formulacion_id
  FROM composteras c
  WHERE NOT EXISTS (SELECT 1 FROM ciclos ci WHERE ci.compostera_id = c.id)
    AND (
      c.fecha_inicio IS NOT NULL
      OR EXISTS (SELECT 1 FROM mediciones m WHERE m.compostera = c.id)
    )
)
INSERT INTO ciclos (
  compostera_id, nombre, fecha_inicio, estado,
  formulacion_id, peso_inicial_kg, observaciones_generales
)
SELECT
  compostera_id,
  'Ciclo 1',
  fecha_inicio,
  'activo',
  formulacion_id,
  masa_inicial,
  'Ciclo creado automáticamente durante la migración a modelo Sitio→Compostera→Ciclo.'
FROM fuentes;

-- D) Asignar ciclo_id a cada medición huérfana usando el ciclo activo de su compostera
UPDATE mediciones m
SET ciclo_id = ci.id
FROM ciclos ci
WHERE ci.compostera_id = m.compostera
  AND ci.estado = 'activo'
  AND m.ciclo_id IS NULL;

COMMIT;

-- =====================================================================
-- VERIFICACIÓN SUGERIDA (ejecutar manualmente tras la migración)
-- =====================================================================
-- SELECT COUNT(*) AS sitios        FROM sitios;
-- SELECT COUNT(*) AS ciclos        FROM ciclos;
-- SELECT COUNT(*) AS mediciones    FROM mediciones;
-- SELECT COUNT(*) AS sin_ciclo     FROM mediciones WHERE ciclo_id IS NULL;
-- -- sin_ciclo debe ser 0 para las composteras con historial; las composteras
-- -- vacías no generan ciclos y no aparecen aquí.
-- SELECT compostera_id, COUNT(*) FILTER (WHERE estado='activo') AS activos
--   FROM ciclos GROUP BY compostera_id HAVING COUNT(*) FILTER (WHERE estado='activo') > 1;
-- -- No debe devolver filas (garantía de "un solo ciclo activo").
