import { neon } from "@neondatabase/serverless";

function getSQL() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

export async function ensureTable() {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS mediciones (
      id SERIAL PRIMARY KEY,
      compostera INTEGER NOT NULL,
      dia INTEGER,
      temperatura REAL NOT NULL,
      ph REAL NOT NULL,
      humedad REAL NOT NULL,
      observaciones TEXT,
      estado TEXT NOT NULL DEFAULT 'good',
      foto_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Migration: add foto_url column if missing
  await sql`ALTER TABLE mediciones ADD COLUMN IF NOT EXISTS foto_url TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS composteras (
      id INTEGER PRIMARY KEY,
      nombre TEXT,
      fecha_inicio DATE,
      activa BOOLEAN NOT NULL DEFAULT TRUE,
      masa_inicial REAL
    )
  `;
  await sql`ALTER TABLE composteras ADD COLUMN IF NOT EXISTS masa_inicial REAL`;
  await sql`
    CREATE TABLE IF NOT EXISTS consultas (
      id SERIAL PRIMARY KEY,
      tipo TEXT NOT NULL DEFAULT 'pregunta',
      compostera INTEGER,
      pregunta TEXT NOT NULL,
      respuesta TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // --- Formulaciones ---
  await sql`
    CREATE TABLE IF NOT EXISTS formulaciones (
      id                         SERIAL PRIMARY KEY,
      nombre                     TEXT NOT NULL,
      descripcion                TEXT,
      base_calculo               TEXT NOT NULL
                                   CHECK (base_calculo IN ('humeda','seca')),
      lirio_acuatico_pct         REAL,
      excreta_pct                REAL,
      tipo_excreta               TEXT
                                   CHECK (tipo_excreta IS NULL OR tipo_excreta IN
                                     ('bovina','ovina','equina','gallinaza','mixta')),
      hojarasca_pct              REAL,
      residuos_vegetales_pct     REAL,
      material_estructurante_pct REAL,
      relacion_cn_estimada       REAL,
      humedad_inicial_estimada   REAL,
      nivel_estructura           TEXT
                                   CHECK (nivel_estructura IS NULL OR nivel_estructura IN
                                     ('baja','media','alta')),
      notas                      TEXT,
      activa                     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (lirio_acuatico_pct         IS NULL OR (lirio_acuatico_pct         BETWEEN 0 AND 100)),
      CHECK (excreta_pct                IS NULL OR (excreta_pct                BETWEEN 0 AND 100)),
      CHECK (hojarasca_pct              IS NULL OR (hojarasca_pct              BETWEEN 0 AND 100)),
      CHECK (residuos_vegetales_pct     IS NULL OR (residuos_vegetales_pct     BETWEEN 0 AND 100)),
      CHECK (material_estructurante_pct IS NULL OR (material_estructurante_pct BETWEEN 0 AND 100)),
      CHECK (humedad_inicial_estimada   IS NULL OR (humedad_inicial_estimada   BETWEEN 0 AND 100))
    )
  `;

  await sql`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `;
  await sql`DROP TRIGGER IF EXISTS trg_formulaciones_updated_at ON formulaciones`;
  await sql`
    CREATE TRIGGER trg_formulaciones_updated_at
    BEFORE UPDATE ON formulaciones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS compostera_formulaciones (
      id                SERIAL PRIMARY KEY,
      compostera_id     INTEGER NOT NULL REFERENCES composteras(id) ON DELETE CASCADE,
      formulacion_id    INTEGER NOT NULL REFERENCES formulaciones(id) ON DELETE RESTRICT,
      fecha_asociacion  DATE NOT NULL DEFAULT CURRENT_DATE,
      es_actual         BOOLEAN NOT NULL DEFAULT FALSE,
      notas             TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_cf_compostera  ON compostera_formulaciones (compostera_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cf_formulacion ON compostera_formulaciones (formulacion_id)`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_cf_una_actual_por_compostera
      ON compostera_formulaciones (compostera_id)
      WHERE es_actual = TRUE
  `;
}

export async function insertMedicion(data: {
  compostera: number;
  dia: number | null;
  temperatura: number;
  ph: number;
  humedad: number;
  observaciones: string | null;
  estado: string;
  foto_url: string | null;
  created_at?: string | null;
}) {
  const sql = getSQL();
  if (data.created_at) {
    const result = await sql`
      INSERT INTO mediciones (compostera, dia, temperatura, ph, humedad, observaciones, estado, foto_url, created_at)
      VALUES (${data.compostera}, ${data.dia}, ${data.temperatura}, ${data.ph}, ${data.humedad}, ${data.observaciones}, ${data.estado}, ${data.foto_url}, ${data.created_at})
      RETURNING id, created_at
    `;
    return result[0];
  }
  const result = await sql`
    INSERT INTO mediciones (compostera, dia, temperatura, ph, humedad, observaciones, estado, foto_url)
    VALUES (${data.compostera}, ${data.dia}, ${data.temperatura}, ${data.ph}, ${data.humedad}, ${data.observaciones}, ${data.estado}, ${data.foto_url})
    RETURNING id, created_at
  `;
  return result[0];
}

export async function getMediciones(compostera?: number) {
  const sql = getSQL();
  if (compostera) {
    return sql`
      SELECT * FROM mediciones
      WHERE compostera = ${compostera}
      ORDER BY created_at DESC
      LIMIT 100
    `;
  }
  return sql`SELECT * FROM mediciones ORDER BY created_at DESC LIMIT 100`;
}

export async function getMedicionesExport(compostera?: number) {
  const sql = getSQL();
  if (compostera) {
    return sql`
      SELECT * FROM mediciones
      WHERE compostera = ${compostera}
      ORDER BY created_at ASC
    `;
  }
  return sql`SELECT * FROM mediciones ORDER BY created_at ASC`;
}

export async function getComposteras() {
  const sql = getSQL();
  return sql`SELECT * FROM composteras ORDER BY id`;
}

export async function insertConsulta(data: {
  tipo: string;
  compostera: number | null;
  pregunta: string;
  respuesta: string | null;
}) {
  const sql = getSQL();
  const result = await sql`
    INSERT INTO consultas (tipo, compostera, pregunta, respuesta)
    VALUES (${data.tipo}, ${data.compostera}, ${data.pregunta}, ${data.respuesta})
    RETURNING id
  `;
  return result[0];
}

export async function getMedicionById(id: number) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM mediciones WHERE id = ${id}`;
  return rows[0] || null;
}

export async function updateMedicion(id: number, data: {
  compostera: number;
  dia: number | null;
  temperatura: number;
  ph: number;
  humedad: number;
  observaciones: string | null;
  estado: string;
  foto_url?: string | null;
}) {
  const sql = getSQL();
  if (data.foto_url !== undefined) {
    await sql`
      UPDATE mediciones SET
        compostera = ${data.compostera},
        dia = ${data.dia},
        temperatura = ${data.temperatura},
        ph = ${data.ph},
        humedad = ${data.humedad},
        observaciones = ${data.observaciones},
        estado = ${data.estado},
        foto_url = ${data.foto_url}
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE mediciones SET
        compostera = ${data.compostera},
        dia = ${data.dia},
        temperatura = ${data.temperatura},
        ph = ${data.ph},
        humedad = ${data.humedad},
        observaciones = ${data.observaciones},
        estado = ${data.estado}
      WHERE id = ${id}
    `;
  }
  const rows = await sql`SELECT * FROM mediciones WHERE id = ${id}`;
  return rows[0] || null;
}

export async function deleteMedicion(id: number) {
  const sql = getSQL();
  await sql`DELETE FROM mediciones WHERE id = ${id}`;
}

export async function deleteConsulta(id: number) {
  const sql = getSQL();
  await sql`DELETE FROM consultas WHERE id = ${id}`;
}

export async function getConsultas(tipo?: string) {
  const sql = getSQL();
  if (tipo) {
    return sql`SELECT * FROM consultas WHERE tipo = ${tipo} ORDER BY created_at DESC LIMIT 200`;
  }
  return sql`SELECT * FROM consultas ORDER BY created_at DESC LIMIT 200`;
}

export async function upsertCompostera(data: {
  id: number;
  nombre: string | null;
  fecha_inicio: string | null;
  activa: boolean;
  masa_inicial: number | null;
}) {
  const sql = getSQL();
  await sql`
    INSERT INTO composteras (id, nombre, fecha_inicio, activa, masa_inicial)
    VALUES (${data.id}, ${data.nombre}, ${data.fecha_inicio}, ${data.activa}, ${data.masa_inicial})
    ON CONFLICT (id) DO UPDATE SET
      nombre = ${data.nombre},
      fecha_inicio = ${data.fecha_inicio},
      activa = ${data.activa},
      masa_inicial = ${data.masa_inicial}
  `;
}

/* ============================================================
 * FORMULACIONES
 * ============================================================ */

export type FormulacionInput = {
  nombre: string;
  descripcion?: string | null;
  base_calculo: "humeda" | "seca";
  lirio_acuatico_pct?: number | null;
  excreta_pct?: number | null;
  tipo_excreta?: "bovina" | "ovina" | "equina" | "gallinaza" | "mixta" | null;
  hojarasca_pct?: number | null;
  residuos_vegetales_pct?: number | null;
  material_estructurante_pct?: number | null;
  relacion_cn_estimada?: number | null;
  humedad_inicial_estimada?: number | null;
  nivel_estructura?: "baja" | "media" | "alta" | null;
  notas?: string | null;
  activa?: boolean;
};

export async function createFormulacion(data: FormulacionInput) {
  const sql = getSQL();
  const rows = await sql`
    INSERT INTO formulaciones (
      nombre, descripcion, base_calculo,
      lirio_acuatico_pct, excreta_pct, tipo_excreta,
      hojarasca_pct, residuos_vegetales_pct, material_estructurante_pct,
      relacion_cn_estimada, humedad_inicial_estimada, nivel_estructura,
      notas, activa
    ) VALUES (
      ${data.nombre},
      ${data.descripcion ?? null},
      ${data.base_calculo},
      ${data.lirio_acuatico_pct ?? null},
      ${data.excreta_pct ?? null},
      ${data.tipo_excreta ?? null},
      ${data.hojarasca_pct ?? null},
      ${data.residuos_vegetales_pct ?? null},
      ${data.material_estructurante_pct ?? null},
      ${data.relacion_cn_estimada ?? null},
      ${data.humedad_inicial_estimada ?? null},
      ${data.nivel_estructura ?? null},
      ${data.notas ?? null},
      ${data.activa ?? true}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function getFormulaciones() {
  const sql = getSQL();
  return sql`
    SELECT * FROM formulaciones
    WHERE activa = TRUE
    ORDER BY created_at DESC
  `;
}

export async function getFormulacionById(id: number) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM formulaciones WHERE id = ${id}`;
  return rows[0] || null;
}

// Marca la nueva formulación como actual y desactiva la previa.
// El índice único parcial uq_cf_una_actual_por_compostera garantiza
// que siempre quede exactamente una actual por compostera.
export async function asociarFormulacionACompostera(
  compostera_id: number,
  formulacion_id: number,
  fecha?: string | null,
  notas?: string | null,
) {
  const sql = getSQL();

  // Garantiza que la fila de la compostera exista (FK). El usuario puede
  // abrir la pantalla de una compostera cuya config aún no se guardó.
  await sql`
    INSERT INTO composteras (id) VALUES (${compostera_id})
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    UPDATE compostera_formulaciones
    SET es_actual = FALSE
    WHERE compostera_id = ${compostera_id} AND es_actual = TRUE
  `;
  // Si no viene fecha, usar CURRENT_DATE del servidor (la columna es NOT NULL).
  const rows = fecha
    ? await sql`
        INSERT INTO compostera_formulaciones (
          compostera_id, formulacion_id, fecha_asociacion, es_actual, notas
        ) VALUES (
          ${compostera_id},
          ${formulacion_id},
          ${fecha}::date,
          TRUE,
          ${notas ?? null}
        )
        RETURNING *
      `
    : await sql`
        INSERT INTO compostera_formulaciones (
          compostera_id, formulacion_id, es_actual, notas
        ) VALUES (
          ${compostera_id},
          ${formulacion_id},
          TRUE,
          ${notas ?? null}
        )
        RETURNING *
      `;
  return rows[0];
}

export async function getFormulacionesDeCompostera(compostera_id: number) {
  const sql = getSQL();
  return sql`
    SELECT
      cf.id                 AS asociacion_id,
      cf.compostera_id,
      cf.formulacion_id,
      cf.fecha_asociacion,
      cf.es_actual,
      cf.notas              AS asociacion_notas,
      cf.created_at         AS asociacion_created_at,
      f.*
    FROM compostera_formulaciones cf
    JOIN formulaciones f ON f.id = cf.formulacion_id
    WHERE cf.compostera_id = ${compostera_id}
    ORDER BY cf.fecha_asociacion DESC, cf.created_at DESC
  `;
}

// Devuelve todas las formulaciones (activas e inactivas), útil para análisis.
export async function getAllFormulaciones() {
  const sql = getSQL();
  return sql`SELECT * FROM formulaciones ORDER BY id`;
}

// Devuelve todas las asociaciones compostera-formulación.
export async function getAllAsociacionesFormulacion() {
  const sql = getSQL();
  return sql`
    SELECT compostera_id, formulacion_id, es_actual, fecha_asociacion
    FROM compostera_formulaciones
    ORDER BY fecha_asociacion DESC, created_at DESC
  `;
}

export async function getFormulacionActual(compostera_id: number) {
  const sql = getSQL();
  const rows = await sql`
    SELECT
      cf.id                 AS asociacion_id,
      cf.compostera_id,
      cf.formulacion_id,
      cf.fecha_asociacion,
      cf.es_actual,
      cf.notas              AS asociacion_notas,
      cf.created_at         AS asociacion_created_at,
      f.*
    FROM compostera_formulaciones cf
    JOIN formulaciones f ON f.id = cf.formulacion_id
    WHERE cf.compostera_id = ${compostera_id} AND cf.es_actual = TRUE
    LIMIT 1
  `;
  return rows[0] || null;
}
