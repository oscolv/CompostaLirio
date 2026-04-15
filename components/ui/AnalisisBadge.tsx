import type { AnalisisEstado } from "@/lib/types";

type Props = {
  estado: AnalisisEstado | null | undefined;
  accion: string | null | undefined;
  /** Variante compacta para la edición en historial. */
  compact?: boolean;
};

export function AnalisisBadge({ estado, accion, compact = false }: Props) {
  if (!estado || !accion) return null;

  const tone =
    estado === "verde"
      ? "text-verde-700 bg-verde-50 ring-verde-200"
      : estado === "amarillo"
        ? "text-amber-700 bg-amber-50 ring-amber-200"
        : "text-red-700 bg-red-50 ring-red-200";

  const dot =
    estado === "verde" ? "bg-verde-500" : estado === "amarillo" ? "bg-amber-500" : "bg-red-500";

  const size = compact
    ? "mt-2 px-3 py-1.5 rounded-lg text-[11px]"
    : "mt-2 px-3 py-2 rounded-xl text-[12px]";
  const dotSize = compact ? "w-1.5 h-1.5" : "w-2 h-2";

  return (
    <div className={`${size} font-semibold ring-1 flex items-center gap-2 ${tone}`}>
      <span className={`${dotSize} rounded-full ${dot}`} />
      {accion}
    </div>
  );
}
