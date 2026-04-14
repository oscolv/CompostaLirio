import type { MedicionInput } from "@/lib/types";

type ValidacionResultado =
  | { ok: true; data: MedicionInput }
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

// Valida el body de POST/PUT de /api/mediciones. Estricto pero tolerante
// a strings numéricos (el cliente a veces los envía así).
export function validarMedicionInput(body: unknown): ValidacionResultado {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido" };
  }
  const b = body as Record<string, unknown>;

  const compostera = entero(b.compostera);
  if (compostera === null || compostera < 1) {
    return { ok: false, error: "Compostera inválida" };
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
  const dia = diaRaw === null || diaRaw === undefined || diaRaw === "" ? null : entero(diaRaw);
  if (diaRaw !== null && diaRaw !== undefined && diaRaw !== "" && dia === null) {
    return { ok: false, error: "Día inválido" };
  }

  const observaciones = typeof b.observaciones === "string" && b.observaciones.trim() !== ""
    ? b.observaciones
    : null;

  const estado = typeof b.estado === "string" && b.estado ? b.estado : "good";

  const fotoUrlRaw = b.foto_url;
  const foto_url =
    fotoUrlRaw === undefined ? undefined : fotoUrlRaw === null ? null : typeof fotoUrlRaw === "string" ? fotoUrlRaw : null;

  const fechaRaw = b.fecha;
  const fecha = typeof fechaRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw) ? fechaRaw : null;

  return {
    ok: true,
    data: {
      compostera,
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
