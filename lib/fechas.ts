export function hoyISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function diasDesde(fecha: string, hasta?: string): number {
  const inicio = new Date(fecha + "T00:00:00");
  const fin = hasta ? new Date(hasta + "T00:00:00") : new Date();
  fin.setHours(0, 0, 0, 0);
  return Math.floor((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}
