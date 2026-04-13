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
      activa BOOLEAN NOT NULL DEFAULT TRUE
    )
  `;
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
}) {
  const sql = getSQL();
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
}) {
  const sql = getSQL();
  await sql`
    INSERT INTO composteras (id, nombre, fecha_inicio, activa)
    VALUES (${data.id}, ${data.nombre}, ${data.fecha_inicio}, ${data.activa})
    ON CONFLICT (id) DO UPDATE SET
      nombre = ${data.nombre},
      fecha_inicio = ${data.fecha_inicio},
      activa = ${data.activa}
  `;
}
