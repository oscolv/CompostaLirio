import { neon } from "@neondatabase/serverless";

function getSQL() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

// LEGACY COMPAT: ensureTable crea el esquema v1 (pre-jerarquía).
// Se conserva porque ensureSchemaV2 lo invoca primero y el backfill
// de ciclos depende de mediciones.compostera. Retirar solo cuando
// mediciones.compostera deje de existir.
export async function ensureTable() {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS mediciones (
      id SERIAL PRIMARY KEY,
      compostera INTEGER NOT NULL,  -- LEGACY COMPAT: futura migración a drop (ver ciclo_id)
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

// =====================================================================
// ensureSchemaV2: estructura jerárquica Sitio → Compostera → Ciclo → Medición
// Aditiva e idempotente. Ejecuta el backfill de datos legacy la primera vez.
// Cada endpoint nuevo (sitios, ciclos, mediciones con ciclo, diagnóstico
// por ciclo) la invoca. El patrón imita a ensureTable() existente.
// =====================================================================
let schemaReady: Promise<void> | null = null;

export async function ensureSchemaV2() {
  if (!schemaReady) {
    schemaReady = runEnsureSchemaV2().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

async function runEnsureSchemaV2() {
  await ensureTable();
  const sql = getSQL();

  // 1) sitios
  await sql`
    CREATE TABLE IF NOT EXISTS sitios (
      id          SERIAL PRIMARY KEY,
      nombre      TEXT NOT NULL UNIQUE,
      descripcion TEXT,
      ubicacion   TEXT,
      activo      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 2) composteras: columnas nuevas
  await sql`ALTER TABLE composteras ADD COLUMN IF NOT EXISTS sitio_id     INTEGER REFERENCES sitios(id) ON DELETE RESTRICT`;
  await sql`ALTER TABLE composteras ADD COLUMN IF NOT EXISTS tipo         TEXT`;
  await sql`ALTER TABLE composteras ADD COLUMN IF NOT EXISTS capacidad_kg REAL`;
  await sql`ALTER TABLE composteras ADD COLUMN IF NOT EXISTS estado       TEXT NOT NULL DEFAULT 'activa'`;
  await sql`ALTER TABLE composteras ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'composteras_estado_check') THEN
        ALTER TABLE composteras
          ADD CONSTRAINT composteras_estado_check
          CHECK (estado IN ('activa','inactiva','retirada'));
      END IF;
    END$$
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_composteras_sitio ON composteras(sitio_id)`;

  // 3) ciclos
  await sql`
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
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ciclos_compostera ON ciclos(compostera_id)`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ciclos_un_activo_por_compostera
      ON ciclos(compostera_id) WHERE estado = 'activo'
  `;

  // 4) mediciones.ciclo_id
  await sql`ALTER TABLE mediciones ADD COLUMN IF NOT EXISTS ciclo_id INTEGER REFERENCES ciclos(id) ON DELETE RESTRICT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mediciones_ciclo ON mediciones(ciclo_id)`;

  // 5) consultas.ciclo_id
  await sql`ALTER TABLE consultas ADD COLUMN IF NOT EXISTS ciclo_id INTEGER REFERENCES ciclos(id) ON DELETE SET NULL`;

  // ---------------------------------------------------------------
  // BACKFILL (sólo ejecuta lo que falte; seguro en re-ejecución)
  // ---------------------------------------------------------------
  await sql`
    INSERT INTO sitios (nombre, descripcion, ubicacion)
    VALUES ('San Francisco Bojay', 'Sitio inicial (seed de migración v2).', 'Bojay, Hidalgo')
    ON CONFLICT (nombre) DO NOTHING
  `;

  await sql`
    UPDATE composteras
    SET sitio_id = (SELECT id FROM sitios WHERE nombre = 'San Francisco Bojay')
    WHERE sitio_id IS NULL
  `;

  await sql`
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
      compostera_id, 'Ciclo 1', fecha_inicio, 'activo',
      formulacion_id, masa_inicial,
      'Ciclo creado automáticamente durante la migración a modelo Sitio→Compostera→Ciclo.'
    FROM fuentes
  `;

  await sql`
    UPDATE mediciones m
    SET ciclo_id = ci.id
    FROM ciclos ci
    WHERE ci.compostera_id = m.compostera
      AND ci.estado = 'activo'
      AND m.ciclo_id IS NULL
  `;
}

export async function ensureAnalisisTable() {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS analisis_cache (
      hash TEXT PRIMARY KEY,
      resultado TEXT NOT NULL,
      json JSONB,
      estado TEXT,
      accion TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function getAnalisisByHash(hash: string) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM analisis_cache WHERE hash = ${hash}`;
  return rows[0] || null;
}

export async function insertAnalisis(data: {
  hash: string;
  resultado: string;
  json: unknown;
  estado: string | null;
  accion: string | null;
}) {
  const sql = getSQL();
  const jsonStr = data.json === null || data.json === undefined ? null : JSON.stringify(data.json);
  await sql`
    INSERT INTO analisis_cache (hash, resultado, json, estado, accion)
    VALUES (${data.hash}, ${data.resultado}, ${jsonStr}::jsonb, ${data.estado}, ${data.accion})
    ON CONFLICT (hash) DO NOTHING
  `;
}

export async function insertMedicion(data: {
  compostera: number;
  ciclo_id?: number | null;
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
  const ciclo_id = data.ciclo_id ?? null;
  if (data.created_at) {
    const result = await sql`
      INSERT INTO mediciones (compostera, ciclo_id, dia, temperatura, ph, humedad, observaciones, estado, foto_url, created_at)
      VALUES (${data.compostera}, ${ciclo_id}, ${data.dia}, ${data.temperatura}, ${data.ph}, ${data.humedad}, ${data.observaciones}, ${data.estado}, ${data.foto_url}, ${data.created_at})
      RETURNING id, created_at
    `;
    return result[0];
  }
  const result = await sql`
    INSERT INTO mediciones (compostera, ciclo_id, dia, temperatura, ph, humedad, observaciones, estado, foto_url)
    VALUES (${data.compostera}, ${ciclo_id}, ${data.dia}, ${data.temperatura}, ${data.ph}, ${data.humedad}, ${data.observaciones}, ${data.estado}, ${data.foto_url})
    RETURNING id, created_at
  `;
  return result[0];
}

// LEGACY COMPAT: filtro por compostera cruda. Para el nuevo modelo usar
// getMedicionesByCiclo. Se conserva como fallback histórico y para el
// GET /api/mediciones?compostera= mientras haya composteras sin ciclo.
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

// LEGACY COMPAT: usar getMedicionesExportByCiclo en flujos nuevos.
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

export async function getComposteraById(id: number) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM composteras WHERE id = ${id}`;
  return rows[0] || null;
}

// LEGACY COMPAT: no persiste ciclo_id. Toda ruta nueva debe usar
// insertConsultaConCiclo. Se conserva solo para callers previos.
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
  ciclo_id?: number | null;
  dia: number | null;
  temperatura: number;
  ph: number;
  humedad: number;
  observaciones: string | null;
  estado: string;
  foto_url?: string | null;
  created_at?: string | null;
}) {
  const sql = getSQL();
  const setFoto = data.foto_url !== undefined;
  const setCreated = !!data.created_at;

  // Ciclo se actualiza en una sentencia aparte para no multiplicar ramas.
  if (data.ciclo_id !== undefined) {
    await sql`UPDATE mediciones SET ciclo_id = ${data.ciclo_id} WHERE id = ${id}`;
  }
  if (setFoto && setCreated) {
    await sql`
      UPDATE mediciones SET
        compostera = ${data.compostera},
        dia = ${data.dia},
        temperatura = ${data.temperatura},
        ph = ${data.ph},
        humedad = ${data.humedad},
        observaciones = ${data.observaciones},
        estado = ${data.estado},
        foto_url = ${data.foto_url ?? null},
        created_at = ${data.created_at}
      WHERE id = ${id}
    `;
  } else if (setFoto) {
    await sql`
      UPDATE mediciones SET
        compostera = ${data.compostera},
        dia = ${data.dia},
        temperatura = ${data.temperatura},
        ph = ${data.ph},
        humedad = ${data.humedad},
        observaciones = ${data.observaciones},
        estado = ${data.estado},
        foto_url = ${data.foto_url ?? null}
      WHERE id = ${id}
    `;
  } else if (setCreated) {
    await sql`
      UPDATE mediciones SET
        compostera = ${data.compostera},
        dia = ${data.dia},
        temperatura = ${data.temperatura},
        ph = ${data.ph},
        humedad = ${data.humedad},
        observaciones = ${data.observaciones},
        estado = ${data.estado},
        created_at = ${data.created_at}
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
  sitio_id?: number | null;
  tipo?: string | null;
  capacidad_kg?: number | null;
  estado?: "activa" | "inactiva" | "retirada";
}) {
  const sql = getSQL();
  const sitio_id = data.sitio_id ?? null;
  const tipo = data.tipo ?? null;
  const capacidad_kg = data.capacidad_kg ?? null;
  const estado = data.estado ?? (data.activa ? "activa" : "inactiva");
  await sql`
    INSERT INTO composteras (id, nombre, fecha_inicio, activa, masa_inicial, sitio_id, tipo, capacidad_kg, estado)
    VALUES (${data.id}, ${data.nombre}, ${data.fecha_inicio}, ${data.activa}, ${data.masa_inicial},
            ${sitio_id}, ${tipo}, ${capacidad_kg}, ${estado})
    ON CONFLICT (id) DO UPDATE SET
      nombre = ${data.nombre},
      fecha_inicio = ${data.fecha_inicio},
      activa = ${data.activa},
      masa_inicial = ${data.masa_inicial},
      sitio_id = COALESCE(${sitio_id}, composteras.sitio_id),
      tipo = COALESCE(${tipo}, composteras.tipo),
      capacidad_kg = COALESCE(${capacidad_kg}, composteras.capacidad_kg),
      estado = ${estado}
  `;
}

export async function getComposterasBySitio(sitio_id: number) {
  const sql = getSQL();
  return sql`SELECT * FROM composteras WHERE sitio_id = ${sitio_id} ORDER BY id`;
}

// Lista composteras de un sitio con conteo de ciclos y mediciones asociadas.
// Mediciones se cuentan vía ciclos.id (cadena real), no vía mediciones.compostera
// legacy. Usado por /configuracion para decidir si una compostera se puede borrar.
export async function getComposterasConCountsBySitio(sitio_id: number) {
  const sql = getSQL();
  return sql`
    SELECT
      cp.*,
      COUNT(DISTINCT c.id) AS ciclos_count,
      COUNT(DISTINCT m.id) AS mediciones_count
    FROM composteras cp
    LEFT JOIN ciclos c ON c.compostera_id = cp.id
    LEFT JOIN mediciones m ON m.ciclo_id = c.id
    WHERE cp.sitio_id = ${sitio_id}
    GROUP BY cp.id
    ORDER BY cp.id
  `;
}

// Crea compostera con id auto = MAX+1 en una sola sentencia (Neon HTTP no
// soporta transacciones multi-statement). En caso de race con duplicate key,
// reintentar una vez es suficiente para la escala de esta app.
export async function createCompostera(data: {
  sitio_id: number;
  nombre: string | null;
  fecha_inicio: string | null;
  masa_inicial: number | null;
  tipo?: string | null;
  capacidad_kg?: number | null;
  activa?: boolean;
}) {
  const sql = getSQL();
  const activa = data.activa ?? true;
  const estado = activa ? "activa" : "inactiva";
  const tipo = data.tipo ?? null;
  const capacidad_kg = data.capacidad_kg ?? null;

  async function tryInsert() {
    const rows = await sql`
      INSERT INTO composteras (id, sitio_id, nombre, fecha_inicio, activa, masa_inicial, tipo, capacidad_kg, estado)
      SELECT
        COALESCE(MAX(id), 0) + 1,
        ${data.sitio_id},
        ${data.nombre},
        ${data.fecha_inicio},
        ${activa},
        ${data.masa_inicial},
        ${tipo},
        ${capacidad_kg},
        ${estado}
      FROM composteras
      RETURNING *
    `;
    return rows[0];
  }

  try {
    return await tryInsert();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate key")) {
      return await tryInsert();
    }
    throw e;
  }
}

export async function countDependenciasCompostera(id: number) {
  const sql = getSQL();
  const rows = await sql`
    SELECT
      (SELECT COUNT(*) FROM ciclos WHERE compostera_id = ${id})::int AS ciclos,
      (SELECT COUNT(*) FROM mediciones m
         JOIN ciclos c ON c.id = m.ciclo_id
         WHERE c.compostera_id = ${id})::int AS mediciones
  `;
  const r = rows[0] as { ciclos: number; mediciones: number };
  return { ciclos: r.ciclos, mediciones: r.mediciones };
}

export async function deleteCompostera(id: number) {
  const sql = getSQL();
  await sql`DELETE FROM composteras WHERE id = ${id}`;
}

export async function setEstadoCompostera(id: number, estado: "activa" | "inactiva" | "retirada") {
  const sql = getSQL();
  const activa = estado === "activa";
  const rows = await sql`
    UPDATE composteras
    SET estado = ${estado}, activa = ${activa}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] || null;
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
    SELECT f.*,
      (SELECT COUNT(*)::int FROM compostera_formulaciones cf
        WHERE cf.formulacion_id = f.id) AS n_asociaciones
    FROM formulaciones f
    WHERE f.activa = TRUE
    ORDER BY f.created_at DESC
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
  return sql`
    SELECT f.*,
      (SELECT COUNT(*)::int FROM compostera_formulaciones cf
        WHERE cf.formulacion_id = f.id) AS n_asociaciones
    FROM formulaciones f
    ORDER BY f.id
  `;
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

export async function updateFormulacion(id: number, data: FormulacionInput) {
  const sql = getSQL();
  const rows = await sql`
    UPDATE formulaciones SET
      nombre = ${data.nombre},
      descripcion = ${data.descripcion ?? null},
      base_calculo = ${data.base_calculo},
      lirio_acuatico_pct = ${data.lirio_acuatico_pct ?? null},
      excreta_pct = ${data.excreta_pct ?? null},
      tipo_excreta = ${data.tipo_excreta ?? null},
      hojarasca_pct = ${data.hojarasca_pct ?? null},
      residuos_vegetales_pct = ${data.residuos_vegetales_pct ?? null},
      material_estructurante_pct = ${data.material_estructurante_pct ?? null},
      relacion_cn_estimada = ${data.relacion_cn_estimada ?? null},
      humedad_inicial_estimada = ${data.humedad_inicial_estimada ?? null},
      nivel_estructura = ${data.nivel_estructura ?? null},
      notas = ${data.notas ?? null},
      activa = ${data.activa ?? true}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] || null;
}

export async function deleteFormulacion(id: number) {
  const sql = getSQL();
  await sql`DELETE FROM formulaciones WHERE id = ${id}`;
}

export async function countAsociacionesDeFormulacion(formulacion_id: number) {
  const sql = getSQL();
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM compostera_formulaciones
    WHERE formulacion_id = ${formulacion_id}
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function deleteAsociacionFormulacion(asociacion_id: number) {
  const sql = getSQL();
  await sql`DELETE FROM compostera_formulaciones WHERE id = ${asociacion_id}`;
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

/* ============================================================
 * SITIOS
 * ============================================================ */

export async function getSitios(soloActivos = false) {
  const sql = getSQL();
  if (soloActivos) {
    return sql`SELECT * FROM sitios WHERE activo = TRUE ORDER BY nombre`;
  }
  return sql`SELECT * FROM sitios ORDER BY nombre`;
}

export async function getSitioById(id: number) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM sitios WHERE id = ${id}`;
  return rows[0] || null;
}

export async function createSitio(data: {
  nombre: string;
  descripcion: string | null;
  ubicacion: string | null;
  activo?: boolean;
}) {
  const sql = getSQL();
  const rows = await sql`
    INSERT INTO sitios (nombre, descripcion, ubicacion, activo)
    VALUES (${data.nombre}, ${data.descripcion}, ${data.ubicacion}, ${data.activo ?? true})
    RETURNING *
  `;
  return rows[0];
}

export async function updateSitio(id: number, data: {
  nombre: string;
  descripcion: string | null;
  ubicacion: string | null;
  activo?: boolean;
}) {
  const sql = getSQL();
  const rows = await sql`
    UPDATE sitios SET
      nombre      = ${data.nombre},
      descripcion = ${data.descripcion},
      ubicacion   = ${data.ubicacion},
      activo      = ${data.activo ?? true}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] || null;
}

// Soft-delete: marca como inactivo. Nunca borramos sitios porque composteras
// y ciclos referencian FKs con ON DELETE RESTRICT.
export async function deactivateSitio(id: number) {
  const sql = getSQL();
  await sql`UPDATE sitios SET activo = FALSE WHERE id = ${id}`;
}

/* ============================================================
 * CICLOS
 * ============================================================ */

export async function getCiclosByCompostera(compostera_id: number) {
  const sql = getSQL();
  return sql`
    SELECT * FROM ciclos
    WHERE compostera_id = ${compostera_id}
    ORDER BY fecha_inicio DESC, created_at DESC
  `;
}

export async function getCiclosBySitio(sitio_id: number) {
  const sql = getSQL();
  return sql`
    SELECT ci.*
    FROM ciclos ci
    JOIN composteras c ON c.id = ci.compostera_id
    WHERE c.sitio_id = ${sitio_id}
    ORDER BY ci.fecha_inicio DESC, ci.created_at DESC
  `;
}

export async function getCicloById(id: number) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM ciclos WHERE id = ${id}`;
  return rows[0] || null;
}

export async function getCicloActivo(compostera_id: number) {
  const sql = getSQL();
  const rows = await sql`
    SELECT * FROM ciclos
    WHERE compostera_id = ${compostera_id} AND estado = 'activo'
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function createCiclo(data: {
  compostera_id: number;
  nombre: string | null;
  fecha_inicio: string;
  formulacion_id?: number | null;
  peso_inicial_kg?: number | null;
  objetivo: string | null;
  observaciones_generales: string | null;
}) {
  const sql = getSQL();

  // Garantiza que la compostera exista (FK). El usuario puede iniciar un
  // ciclo para una compostera cuyo registro aún no se haya guardado vía UI.
  await sql`
    INSERT INTO composteras (id) VALUES (${data.compostera_id})
    ON CONFLICT (id) DO NOTHING
  `;

  const rows = await sql`
    INSERT INTO ciclos (
      compostera_id, nombre, fecha_inicio, estado,
      formulacion_id, peso_inicial_kg, objetivo, observaciones_generales
    ) VALUES (
      ${data.compostera_id},
      ${data.nombre},
      ${data.fecha_inicio}::date,
      'activo',
      ${data.formulacion_id ?? null},
      ${data.peso_inicial_kg ?? null},
      ${data.objetivo},
      ${data.observaciones_generales}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function updateCiclo(id: number, data: {
  nombre: string | null;
  formulacion_id?: number | null;
  peso_inicial_kg?: number | null;
  objetivo: string | null;
  observaciones_generales: string | null;
}) {
  const sql = getSQL();
  const rows = await sql`
    UPDATE ciclos SET
      nombre                  = ${data.nombre},
      formulacion_id          = ${data.formulacion_id ?? null},
      peso_inicial_kg         = ${data.peso_inicial_kg ?? null},
      objetivo                = ${data.objetivo},
      observaciones_generales = ${data.observaciones_generales}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] || null;
}

export async function closeCiclo(id: number, fecha_fin?: string | null) {
  const sql = getSQL();
  const rows = fecha_fin
    ? await sql`
        UPDATE ciclos
        SET estado = 'cerrado', fecha_fin = ${fecha_fin}::date
        WHERE id = ${id}
        RETURNING *
      `
    : await sql`
        UPDATE ciclos
        SET estado = 'cerrado', fecha_fin = CURRENT_DATE
        WHERE id = ${id}
        RETURNING *
      `;
  return rows[0] || null;
}

export async function discardCiclo(id: number) {
  const sql = getSQL();
  const rows = await sql`
    UPDATE ciclos SET estado = 'descartado'
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] || null;
}

/* ============================================================
 * MEDICIONES POR CICLO
 * ============================================================ */

export async function getMedicionesByCiclo(ciclo_id: number) {
  const sql = getSQL();
  return sql`
    SELECT * FROM mediciones
    WHERE ciclo_id = ${ciclo_id}
    ORDER BY created_at DESC
    LIMIT 100
  `;
}

export async function getMedicionesExportByCiclo(ciclo_id: number) {
  const sql = getSQL();
  return sql`
    SELECT * FROM mediciones
    WHERE ciclo_id = ${ciclo_id}
    ORDER BY created_at ASC
  `;
}

export async function getMedicionesBySitio(sitio_id: number) {
  const sql = getSQL();
  return sql`
    SELECT m.*
    FROM mediciones m
    JOIN composteras c ON c.id = m.compostera
    WHERE c.sitio_id = ${sitio_id}
    ORDER BY m.created_at DESC
    LIMIT 100
  `;
}

export async function getMedicionesExportBySitio(sitio_id: number) {
  const sql = getSQL();
  return sql`
    SELECT m.*
    FROM mediciones m
    JOIN composteras c ON c.id = m.compostera
    WHERE c.sitio_id = ${sitio_id}
    ORDER BY m.created_at ASC
  `;
}

/* ============================================================
 * CONSULTAS con ciclo_id
 * ============================================================ */

export async function insertConsultaConCiclo(data: {
  tipo: string;
  compostera: number | null;
  ciclo_id: number | null;
  pregunta: string;
  respuesta: string | null;
}) {
  const sql = getSQL();
  const result = await sql`
    INSERT INTO consultas (tipo, compostera, ciclo_id, pregunta, respuesta)
    VALUES (${data.tipo}, ${data.compostera}, ${data.ciclo_id}, ${data.pregunta}, ${data.respuesta})
    RETURNING id
  `;
  return result[0];
}

