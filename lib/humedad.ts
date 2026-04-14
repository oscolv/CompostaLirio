export type HumedadNivel = { label: string; value: number };

export const HUMEDAD_NIVELES: HumedadNivel[] = [
  { label: "DRY++", value: 20 },
  { label: "DRY+", value: 30 },
  { label: "DRY", value: 40 },
  { label: "WET", value: 55 },
  { label: "WET+", value: 70 },
  { label: "WET++", value: 85 },
];

const HUMEDAD_LABELS: Record<number, string> = HUMEDAD_NIVELES.reduce(
  (acc, n) => ({ ...acc, [n.value]: n.label }),
  {} as Record<number, string>,
);

export function humedadLabel(valor: number): string {
  return HUMEDAD_LABELS[valor] ?? `${valor}%`;
}
