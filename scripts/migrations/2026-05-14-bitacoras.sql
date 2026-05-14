-- Migración: bitácoras por sitio (cuaderno de campo libre)
-- Cada bitácora pertenece a un sitio, NO a una compostera concreta.
-- Hasta 10 fotos por entrada, guardadas como array JSONB de URLs de Vercel Blob.
--
-- Idempotente — coincide con el bloque añadido en lib/db.ts > ensureSchemaV2().

CREATE TABLE IF NOT EXISTS bitacoras (
  id            SERIAL PRIMARY KEY,
  sitio_id      INTEGER NOT NULL REFERENCES sitios(id) ON DELETE RESTRICT,
  fecha         DATE NOT NULL,
  hora          TIME NOT NULL,
  observaciones TEXT NOT NULL,
  fotos         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bitacoras_sitio_fecha_idx
  ON bitacoras (sitio_id, fecha DESC, hora DESC);
