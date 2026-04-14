import {
  getAllFormulaciones,
  getAllAsociacionesFormulacion,
  getMedicionesExport,
} from "./db";

/* ============================================================
 * Análisis de patrones por formulación — 100% determinista, sin IA.
 * ============================================================ */

type FormulacionRow = {
  id: number;
  nombre: string;
  descripcion: string | null;
  base_calculo: string;
  lirio_acuatico_pct: number | null;
  excreta_pct: number | null;
  tipo_excreta: string | null;
  hojarasca_pct: number | null;
  residuos_vegetales_pct: number | null;
  material_estructurante_pct: number | null;
  relacion_cn_estimada: number | null;
  humedad_inicial_estimada: number | null;
  nivel_estructura: string | null;
  activa: boolean;
};

type AsociacionRow = {
  compostera_id: number;
  formulacion_id: number;
  es_actual: boolean;
  fecha_asociacion: string;
};

type MedicionRow = {
  id: number;
  compostera: number;
  dia: number | null;
  temperatura: number;
  ph: number;
  humedad: number;
  observaciones: string | null;
  estado: string;
  created_at: string;
};

const KEYWORDS = [
  "olor",
  "compactado",
  "larvas",
  "no sube",
  "humedo",
  "anaerobio",
] as const;

type Keyword = (typeof KEYWORDS)[number];

type Metricas = {
  n_composteras: number;
  n_mediciones: number;
  temp_media: number | null;
  temp_max_media: number | null; // promedio de la temperatura máxima por compostera
  pct_humedad_alta: number | null;
  pct_danger: number | null;
  obs_keywords: Record<Keyword, number>;
};

export type PatronFormulacion = {
  formulacion_id: number;
  nombre: string;
  nivel_estructura: string | null;
  humedad_inicial_estimada: number | null;
  material_estructurante_pct: number | null;
  relacion_cn_estimada: number | null;
  base_calculo: string;
  composteras_ids: number[];
  metricas: Metricas;
  hallazgos: string[];
  banderas: string[];
};

export type PatronesReport = {
  generated_at: string;
  modo: "actual" | "historica";
  total_formulaciones: number;
  formulaciones: PatronFormulacion[];
};

// Umbrales (ajustables en un solo lugar)
const UMBRAL_TEMP_BAJA = 30;              // °C
const UMBRAL_HUMEDAD_INICIAL_ALTA = 70;   // %
const UMBRAL_PCT_DANGER_RIESGO = 20;      // %
const UMBRAL_ESTRUCTURANTE_BAJO = 10;     // %
const HUMEDAD_ALTA = 70;                  // % medición individual

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round(n: number | null, d = 1): number | null {
  if (n == null) return null;
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

/**
 * Analiza el desempeño de las composteras agrupándolas por formulación.
 *
 * @param modo - "actual" agrupa por formulación vigente en la compostera;
 *               "historica" incluye cualquier formulación asociada alguna vez.
 */
export async function analyzePatronesPorFormulacion(
  modo: "actual" | "historica" = "actual",
): Promise<PatronesReport> {
  const [formulaciones, asociaciones] = await Promise.all([
    getAllFormulaciones() as Promise<FormulacionRow[]>,
    getAllAsociacionesFormulacion() as Promise<AsociacionRow[]>,
  ]);

  // Índice: formulacion_id -> Set<compostera_id>
  const composterasPorFormulacion = new Map<number, Set<number>>();
  for (const a of asociaciones) {
    if (modo === "actual" && !a.es_actual) continue;
    if (!composterasPorFormulacion.has(a.formulacion_id)) {
      composterasPorFormulacion.set(a.formulacion_id, new Set());
    }
    composterasPorFormulacion.get(a.formulacion_id)!.add(a.compostera_id);
  }

  // Cache de mediciones por compostera para evitar consultas duplicadas
  const medicionesCache = new Map<number, MedicionRow[]>();
  async function getMedicionesCompostera(id: number): Promise<MedicionRow[]> {
    if (medicionesCache.has(id)) return medicionesCache.get(id)!;
    const rows = (await getMedicionesExport(id)) as MedicionRow[];
    medicionesCache.set(id, rows);
    return rows;
  }

  const salida: PatronFormulacion[] = [];

  for (const f of formulaciones) {
    const ids = Array.from(composterasPorFormulacion.get(f.id) ?? []).sort(
      (a, b) => a - b,
    );

    // Reunir mediciones de todas las composteras asociadas
    const porCompostera = await Promise.all(
      ids.map((id) => getMedicionesCompostera(id)),
    );
    const todas: MedicionRow[] = porCompostera.flat();

    const temps = todas.map((m) => m.temperatura);
    const maxPorCompostera = porCompostera
      .filter((arr) => arr.length > 0)
      .map((arr) => Math.max(...arr.map((m) => m.temperatura)));

    const humedadAlta = todas.filter((m) => m.humedad >= HUMEDAD_ALTA).length;
    const dangers = todas.filter((m) => m.estado === "danger").length;

    const obsKeywords: Record<Keyword, number> = {
      olor: 0, compactado: 0, larvas: 0, "no sube": 0, humedo: 0, anaerobio: 0,
    };
    for (const m of todas) {
      if (!m.observaciones) continue;
      const texto = normalizar(m.observaciones);
      for (const kw of KEYWORDS) {
        if (texto.includes(kw)) obsKeywords[kw]++;
      }
    }

    const tempMedia = mean(temps);
    const tempMaxMedia = mean(maxPorCompostera);
    const pctHumedadAlta =
      todas.length > 0 ? (humedadAlta / todas.length) * 100 : null;
    const pctDanger =
      todas.length > 0 ? (dangers / todas.length) * 100 : null;

    const metricas: Metricas = {
      n_composteras: ids.length,
      n_mediciones: todas.length,
      temp_media: round(tempMedia, 1),
      temp_max_media: round(tempMaxMedia, 1),
      pct_humedad_alta: round(pctHumedadAlta, 1),
      pct_danger: round(pctDanger, 1),
      obs_keywords: obsKeywords,
    };

    // --- Reglas deterministas ---
    const hallazgos: string[] = [];
    const banderas: string[] = [];

    if (
      f.nivel_estructura === "baja" &&
      tempMedia != null &&
      tempMedia < UMBRAL_TEMP_BAJA
    ) {
      hallazgos.push("baja estructura asociada a bajo calentamiento");
      banderas.push("estructura_baja_temp_baja");
    }

    if (
      f.humedad_inicial_estimada != null &&
      f.humedad_inicial_estimada >= UMBRAL_HUMEDAD_INICIAL_ALTA &&
      pctDanger != null &&
      pctDanger > UMBRAL_PCT_DANGER_RIESGO
    ) {
      hallazgos.push("formulación húmeda asociada a mayor riesgo operativo");
      banderas.push("humedad_inicial_alta_riesgo");
    }

    if (
      f.material_estructurante_pct != null &&
      f.material_estructurante_pct < UMBRAL_ESTRUCTURANTE_BAJO &&
      obsKeywords.compactado > 0
    ) {
      hallazgos.push("posible deficiencia estructural");
      banderas.push("deficiencia_estructural");
    }

    // Hallazgo extra útil: alta frecuencia de humedad alta con base en humedad inicial alta
    if (
      f.humedad_inicial_estimada != null &&
      f.humedad_inicial_estimada >= UMBRAL_HUMEDAD_INICIAL_ALTA &&
      pctHumedadAlta != null &&
      pctHumedadAlta >= 50
    ) {
      hallazgos.push("humedad inicial alta coincide con humedad sostenida en campo");
      banderas.push("humedad_sostenida");
    }

    // Hallazgo: olor o anaerobiosis recurrente
    if (obsKeywords.olor + obsKeywords.anaerobio >= 3) {
      hallazgos.push("observaciones recurrentes de olor/anaerobiosis");
      banderas.push("anaerobiosis_observada");
    }

    salida.push({
      formulacion_id: f.id,
      nombre: f.nombre,
      nivel_estructura: f.nivel_estructura,
      humedad_inicial_estimada: f.humedad_inicial_estimada,
      material_estructurante_pct: f.material_estructurante_pct,
      relacion_cn_estimada: f.relacion_cn_estimada,
      base_calculo: f.base_calculo,
      composteras_ids: ids,
      metricas,
      hallazgos,
      banderas,
    });
  }

  return {
    generated_at: new Date().toISOString(),
    modo,
    total_formulaciones: salida.length,
    formulaciones: salida,
  };
}
