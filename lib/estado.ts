export type Status = {
  label: string;
  key: "good" | "warning" | "danger";
  color: string;
  bg: string;
  ring: string;
};

export const GOOD: Status = { label: "En rango",        key: "good",    color: "text-verde-700", bg: "bg-verde-50", ring: "ring-verde-200" };
export const WARN: Status = { label: "Atenci\u00f3n",    key: "warning", color: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200" };
export const DANGER: Status = { label: "Fuera de rango", key: "danger",  color: "text-red-700",   bg: "bg-red-50",   ring: "ring-red-200" };

type Fase = "mesofilica" | "termofilica" | "maduracion";

function faseDelProceso(dia?: number | null): Fase {
  if (dia && dia > 30) return "maduracion";
  if (dia && dia > 7) return "termofilica";
  return "mesofilica";
}

const RANGOS_POR_FASE: Record<Fase, { temp: [number, number]; ph: [number, number]; hum: [number, number] }> = {
  mesofilica:  { temp: [25, 40], ph: [5.5, 7.0], hum: [55, 65] },
  termofilica: { temp: [55, 65], ph: [7.0, 8.5], hum: [50, 60] },
  maduracion:  { temp: [25, 40], ph: [6.5, 8.0], hum: [45, 55] },
};

// Versión por fase (la de captura). Considera el día del proceso.
export function getStatus(temp: number, ph: number, hum: number, dia?: number | null): Status {
  if (temp > 75 || temp < 10 || ph < 4.0 || ph > 9.5 || hum < 25 || hum > 85) return DANGER;

  const ranges = RANGOS_POR_FASE[faseDelProceso(dia)];
  let worst: Status = GOOD;
  const check = (val: number, min: number, max: number) => {
    const margin = (max - min) * 0.3;
    if (val < min - margin || val > max + margin) worst = DANGER;
    else if (val < min || val > max) { if (worst !== DANGER) worst = WARN; }
  };
  check(temp, ranges.temp[0], ranges.temp[1]);
  check(ph,   ranges.ph[0],   ranges.ph[1]);
  check(hum,  ranges.hum[0],  ranges.hum[1]);
  return worst;
}

// Versión sin fase (la que usaba historial para guardar la edición).
// Se preserva tal cual para no cambiar el comportamiento visible.
export function getEstadoSimple(temp: number, ph: number, hum: number): Status["key"] {
  if (temp < 25 || temp > 70 || ph < 4.5 || ph > 9 || hum < 35 || hum > 80) return "danger";
  if (temp < 40 || temp > 65 || ph < 5.5 || ph > 8.5 || hum < 45 || hum > 70) return "warning";
  return "good";
}

export const estadoCardConfig: Record<string, { dot: string; bg: string; border: string }> = {
  good:    { dot: "bg-verde-500", bg: "bg-verde-50/50", border: "border-verde-200/60" },
  warning: { dot: "bg-amber-500", bg: "bg-amber-50/50", border: "border-amber-200/60" },
  danger:  { dot: "bg-red-500",   bg: "bg-red-50/50",   border: "border-red-200/60" },
};
