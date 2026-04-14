import { createHash } from "crypto";

export type AnalisisJSON = {
  humedad: "bajo" | "medio" | "alto";
  compactacion: "sí" | "no";
  estructura: "visible" | "no visible";
  problemas: string[];
  observacion: string;
};

export type EvaluacionReglas = {
  estado: "verde" | "amarillo" | "rojo";
  accion: string;
};

const PROBLEMAS_VALIDOS = [
  "ninguno",
  "larvas",
  "moho",
  "zonas negras",
  "exceso de agua",
];

export function generarHash(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function esNoAplica(texto: string): boolean {
  return /^\s*no aplica/i.test(texto);
}

export function validarSalida(texto: string): boolean {
  if (!texto) return false;
  return (
    /Humedad\s*:/i.test(texto) &&
    /Compactaci[óo]n\s*:/i.test(texto) &&
    /Estructura\s*:/i.test(texto) &&
    /Problemas\s*:/i.test(texto) &&
    /Observaci[óo]n\s*:/i.test(texto)
  );
}

function extractCampo(texto: string, label: RegExp): string | null {
  const re = new RegExp(`${label.source}\\s*:\\s*([^.]+?)\\s*\\.`, "i");
  const m = texto.match(re);
  return m ? m[1].trim() : null;
}

export function parseResultado(texto: string): AnalisisJSON | null {
  if (!texto) return null;
  const humedadRaw = extractCampo(texto, /Humedad/);
  const compactRaw = extractCampo(texto, /Compactaci[óo]n/);
  const estructRaw = extractCampo(texto, /Estructura/);
  const problemasRaw = extractCampo(texto, /Problemas/);
  const obsMatch = texto.match(/Observaci[óo]n\s*:\s*(.+?)\s*\.?\s*$/i);
  const observacion = obsMatch ? obsMatch[1].trim() : null;

  if (!humedadRaw || !compactRaw || !estructRaw || !problemasRaw || !observacion) {
    return null;
  }

  const humedad = humedadRaw.toLowerCase();
  let compactacion = compactRaw.toLowerCase();
  if (compactacion === "si") compactacion = "sí";
  const estructura = estructRaw.toLowerCase();

  if (!["bajo", "medio", "alto"].includes(humedad)) return null;
  if (!["sí", "no"].includes(compactacion)) return null;
  if (!["visible", "no visible"].includes(estructura)) return null;

  const problemas = problemasRaw
    .toLowerCase()
    .split(/,|\s+y\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => PROBLEMAS_VALIDOS.includes(p));

  if (problemas.length === 0) return null;

  return {
    humedad: humedad as AnalisisJSON["humedad"],
    compactacion: compactacion as AnalisisJSON["compactacion"],
    estructura: estructura as AnalisisJSON["estructura"],
    problemas,
    observacion,
  };
}

export function evaluarComposta(data: AnalisisJSON): EvaluacionReglas {
  if (data.humedad === "alto" && data.compactacion === "sí") {
    return { estado: "rojo", accion: "Voltear y agregar material seco" };
  }
  if (data.problemas.includes("larvas")) {
    return { estado: "amarillo", accion: "Revisar humedad y aireación" };
  }
  if (data.humedad === "medio" && data.compactacion === "no") {
    return { estado: "verde", accion: "Condición adecuada" };
  }
  return { estado: "amarillo", accion: "Revisar condiciones manualmente" };
}
