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
      ? "text-tinta-700 bg-tinta-50 ring-tinta-200"
      : estado === "amarillo"
        ? "text-ocre-600 bg-ocre-50 ring-ocre-200"
        : "text-arcilla-600 bg-arcilla-50 ring-arcilla-200";

  const bar =
    estado === "verde" ? "bg-tinta-500" : estado === "amarillo" ? "bg-ocre-400" : "bg-arcilla-500";

  const pad = compact ? "mt-2 pl-3 pr-3 py-1.5 text-[10.5px]" : "mt-2.5 pl-3.5 pr-3 py-2 text-[11.5px]";

  return (
    <div className={`relative ${pad} font-semibold uppercase tracking-[0.14em] ring-1 rounded-sm flex items-center gap-2 ${tone}`}>
      <span className={`absolute left-0 top-1 bottom-1 w-[3px] rounded-sm ${bar}`} />
      <span className="ml-0.5">{accion}</span>
    </div>
  );
}
