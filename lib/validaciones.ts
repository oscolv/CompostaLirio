import type { CicloInput, MedicionInput, SitioInput } from "@/lib/types";

type ValidacionResultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function entero(v: unknown): number | null {
  const n = num(v);
  return n !== null && Number.isInteger(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function fechaISO(v: unknown): string | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// =====================================================================
// MEDICIÓN
// =====================================================================
export function validarMedicionInput(body: unknown): ValidacionResultado<MedicionInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido" };
  }
  const b = body as Record<string, unknown>;

  // LEGACY COMPAT: compostera sigue siendo obligatoria porque
  // mediciones.compostera es NOT NULL en BD y el resolverCiclo acepta
  // inferir ciclo desde ella. Cuando se promueva ciclo_id a NOT NULL
  // y se elimine mediciones.compostera, este campo pasa a opcional.
  const compostera = entero(b.compostera);
  if (compostera === null || compostera < 1) {
    return { ok: false, error: "Compostera inválida" };
  }

  const cicloIdRaw = b.ciclo_id;
  let ciclo_id: number | null | undefined;
  if (cicloIdRaw === undefined) {
    ciclo_id = undefined;
  } else if (cicloIdRaw === null || cicloIdRaw === "") {
    ciclo_id = null;
  } else {
    const c = entero(cicloIdRaw);
    if (c === null || c < 1) return { ok: false, error: "ciclo_id inválido" };
    ciclo_id = c;
  }

  const temperatura = num(b.temperatura);
  if (temperatura === null || temperatura < 0 || temperatura > 100) {
    return { ok: false, error: "Temperatura fuera de rango (0-100)" };
  }

  const ph = num(b.ph);
  if (ph === null || ph < 0 || ph > 14) {
    return { ok: false, error: "pH fuera de rango (0-14)" };
  }

  const humedad = num(b.humedad);
  if (humedad === null || humedad < 0 || humedad > 100) {
    return { ok: false, error: "Humedad fuera de rango (0-100)" };
  }

  const diaRaw = b.dia;
  const dia = diaRaw === null || diaRaw === undefined || diaRaw === ""
    ? null
    : entero(diaRaw);
  if (diaRaw !== null && diaRaw !== undefined && diaRaw !== "" && dia === null) {
    return { ok: false, error: "Día inválido" };
  }

  const observaciones = typeof b.observaciones === "string" && b.observaciones.trim() !== ""
    ? b.observaciones
    : null;

  const estado = typeof b.estado === "string" && b.estado ? b.estado : "good";

  const fotoUrlRaw = b.foto_url;
  const foto_url =
    fotoUrlRaw === undefined
      ? undefined
      : fotoUrlRaw === null
        ? null
        : typeof fotoUrlRaw === "string"
          ? fotoUrlRaw
          : null;

  const fecha = fechaISO(b.fecha);

  return {
    ok: true,
    data: {
      compostera,
      ...(ciclo_id !== undefined ? { ciclo_id } : {}),
      dia,
      temperatura,
      ph,
      humedad,
      observaciones,
      estado,
      ...(foto_url !== undefined ? { foto_url } : {}),
      fecha,
    },
  };
}

// =====================================================================
// CICLO
// =====================================================================
export function validarCicloInput(body: unknown): ValidacionResultado<CicloInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido" };
  const b = body as Record<string, unknown>;

  const compostera_id = entero(b.compostera_id);
  if (compostera_id === null || compostera_id < 1) {
    return { ok: false, error: "compostera_id inválido" };
  }

  const fecha_inicio_raw = typeof b.fecha_inicio === "string" ? b.fecha_inicio : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio_raw)) {
    return { ok: false, error: "fecha_inicio debe ser YYYY-MM-DD" };
  }

  const nombre = str(b.nombre);

  const formulacion_id_raw = b.formulacion_id;
  let formulacion_id: number | null | undefined;
  if (formulacion_id_raw === undefined) formulacion_id = undefined;
  else if (formulacion_id_raw === null || formulacion_id_raw === "") formulacion_id = null;
  else {
    const f = entero(formulacion_id_raw);
    if (f === null || f < 1) return { ok: false, error: "formulacion_id inválido" };
    formulacion_id = f;
  }

  const peso_raw = b.peso_inicial_kg;
  let peso_inicial_kg: number | null | undefined;
  if (peso_raw === undefined) peso_inicial_kg = undefined;
  else if (peso_raw === null || peso_raw === "") peso_inicial_kg = null;
  else {
    const p = num(peso_raw);
    if (p === null || p < 0) return { ok: false, error: "peso_inicial_kg inválido" };
    peso_inicial_kg = p;
  }

  const objetivo = str(b.objetivo);
  const observaciones_generales = str(b.observaciones_generales);

  return {
    ok: true,
    data: {
      compostera_id,
      fecha_inicio: fecha_inicio_raw,
      nombre,
      ...(formulacion_id !== undefined ? { formulacion_id } : {}),
      ...(peso_inicial_kg !== undefined ? { peso_inicial_kg } : {}),
      objetivo,
      observaciones_generales,
    },
  };
}

// =====================================================================
// COMPOSTERA (creación)
// sitio_id viene de la URL, no del body.
// =====================================================================
export type ComposteraNuevaInput = {
  nombre: string | null;
  fecha_inicio: string | null;
  masa_inicial: number | null;
  tipo: string | null;
  capacidad_kg: number | null;
  activa: boolean;
};

export function validarComposteraNuevaInput(body: unknown): ValidacionResultado<ComposteraNuevaInput> {
  if (body === null || body === undefined) {
    return { ok: true, data: { nombre: null, fecha_inicio: null, masa_inicial: null, tipo: null, capacidad_kg: null, activa: true } };
  }
  if (typeof body !== "object") return { ok: false, error: "Body inválido" };
  const b = body as Record<string, unknown>;

  const nombre = str(b.nombre);

  let fecha_inicio: string | null = null;
  if (b.fecha_inicio !== undefined && b.fecha_inicio !== null && b.fecha_inicio !== "") {
    if (typeof b.fecha_inicio !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha_inicio)) {
      return { ok: false, error: "fecha_inicio debe ser YYYY-MM-DD" };
    }
    fecha_inicio = b.fecha_inicio;
  }

  let masa_inicial: number | null = null;
  if (b.masa_inicial !== undefined && b.masa_inicial !== null && b.masa_inicial !== "") {
    const m = num(b.masa_inicial);
    if (m === null || m < 0) return { ok: false, error: "masa_inicial debe ser >= 0" };
    masa_inicial = m;
  }

  const tipo = str(b.tipo);

  let capacidad_kg: number | null = null;
  if (b.capacidad_kg !== undefined && b.capacidad_kg !== null && b.capacidad_kg !== "") {
    const c = num(b.capacidad_kg);
    if (c === null || c < 0) return { ok: false, error: "capacidad_kg debe ser >= 0" };
    capacidad_kg = c;
  }

  const activa = typeof b.activa === "boolean" ? b.activa : true;

  return { ok: true, data: { nombre, fecha_inicio, masa_inicial, tipo, capacidad_kg, activa } };
}

// =====================================================================
// BITÁCORA
// =====================================================================
export type BitacoraInput = {
  sitio_id: number;
  fecha: string;        // YYYY-MM-DD
  hora: string;         // HH:MM
  observaciones: string;
  fotos: string[];
};

export function validarBitacoraInput(body: unknown): ValidacionResultado<BitacoraInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido" };
  const b = body as Record<string, unknown>;

  const sitio_id = entero(b.sitio_id);
  if (sitio_id === null || sitio_id < 1) {
    return { ok: false, error: "sitio_id inválido" };
  }

  const fecha = typeof b.fecha === "string" ? b.fecha : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: "fecha debe ser YYYY-MM-DD" };
  }

  const hora = typeof b.hora === "string" ? b.hora : "";
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) {
    return { ok: false, error: "hora debe ser HH:MM" };
  }

  const observacionesRaw = typeof b.observaciones === "string" ? b.observaciones.trim() : "";
  if (!observacionesRaw) {
    return { ok: false, error: "Las observaciones son obligatorias" };
  }
  if (observacionesRaw.length > 2000) {
    return { ok: false, error: "Las observaciones no pueden exceder 2000 caracteres" };
  }

  let fotos: string[] = [];
  if (b.fotos !== undefined && b.fotos !== null) {
    if (!Array.isArray(b.fotos)) {
      return { ok: false, error: "fotos debe ser un arreglo" };
    }
    if (b.fotos.length > 10) {
      return { ok: false, error: "Máximo 10 fotos por bitácora" };
    }
    for (const url of b.fotos) {
      if (typeof url !== "string" || !url.startsWith("https://")) {
        return { ok: false, error: "URLs de fotos inválidas" };
      }
    }
    fotos = b.fotos as string[];
  }

  return {
    ok: true,
    data: { sitio_id, fecha, hora, observaciones: observacionesRaw, fotos },
  };
}

export type BitacoraUpdateInput = {
  fecha: string;
  hora: string;
  observaciones: string;
  fotos: string[];
};

// Para edición: el sitio_id no se cambia (no permitimos mover bitácoras
// entre sitios). El resto comparte reglas con la creación.
export function validarBitacoraUpdate(body: unknown): ValidacionResultado<BitacoraUpdateInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido" };
  const b = body as Record<string, unknown>;

  const fecha = typeof b.fecha === "string" ? b.fecha : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: "fecha debe ser YYYY-MM-DD" };
  }

  const hora = typeof b.hora === "string" ? b.hora : "";
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) {
    return { ok: false, error: "hora debe ser HH:MM" };
  }

  const observacionesRaw = typeof b.observaciones === "string" ? b.observaciones.trim() : "";
  if (!observacionesRaw) return { ok: false, error: "Las observaciones son obligatorias" };
  if (observacionesRaw.length > 2000) {
    return { ok: false, error: "Las observaciones no pueden exceder 2000 caracteres" };
  }

  if (!Array.isArray(b.fotos)) return { ok: false, error: "fotos debe ser un arreglo" };
  if (b.fotos.length > 10) return { ok: false, error: "Máximo 10 fotos por bitácora" };
  for (const url of b.fotos) {
    if (typeof url !== "string" || !url.startsWith("https://")) {
      return { ok: false, error: "URLs de fotos inválidas" };
    }
  }

  return {
    ok: true,
    data: { fecha, hora, observaciones: observacionesRaw, fotos: b.fotos as string[] },
  };
}

// =====================================================================
// SITIO
// =====================================================================
export function validarSitioInput(body: unknown): ValidacionResultado<SitioInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido" };
  const b = body as Record<string, unknown>;

  const nombre = str(b.nombre);
  if (!nombre) return { ok: false, error: "nombre es obligatorio" };

  const descripcion = str(b.descripcion);
  const ubicacion = str(b.ubicacion);
  const activo = typeof b.activo === "boolean" ? b.activo : undefined;

  return {
    ok: true,
    data: {
      nombre,
      descripcion,
      ubicacion,
      ...(activo !== undefined ? { activo } : {}),
    },
  };
}
