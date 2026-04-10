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
}) {
  const sql = getSQL();
  const result = await sql`
    INSERT INTO mediciones (compostera, dia, temperatura, ph, humedad, observaciones, estado)
    VALUES (${data.compostera}, ${data.dia}, ${data.temperatura}, ${data.ph}, ${data.humedad}, ${data.observaciones}, ${data.estado})
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
