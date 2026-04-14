type Props = {
  label: string;
  value: React.ReactNode;
  unit?: string;
  align?: "left" | "center" | "right";
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function Stat({
  label,
  value,
  unit,
  align = "left",
  size = "md",
  className = "",
}: Props) {
  const alignCls = align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start text-left";
  const valueSize = size === "lg" ? "text-[28px]" : size === "sm" ? "text-[15px]" : "text-[20px]";
  return (
    <div className={`flex flex-col ${alignCls} ${className}`}>
      <span className="text-[9.5px] font-semibold uppercase tracking-kicker text-tinta-500">
        {label}
      </span>
      <span className="mt-0.5 flex items-baseline gap-1">
        <span className={`stat-value ${valueSize} leading-none`}>{value}</span>
        {unit && (
          <span className="font-mono text-[10.5px] text-tinta-500 uppercase tracking-wider">{unit}</span>
        )}
      </span>
    </div>
  );
}
