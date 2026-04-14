type Tone = "good" | "warning" | "danger" | "neutral" | "info";

type Props = {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
};

const toneClass: Record<Tone, string> = {
  good:    "text-tinta-700 bg-tinta-50 ring-tinta-200/70",
  warning: "text-ocre-600 bg-ocre-50 ring-ocre-200/70",
  danger:  "text-arcilla-600 bg-arcilla-50 ring-arcilla-200/70",
  info:    "text-dato-600 bg-dato-50 ring-dato-200/70",
  neutral: "text-tinta-600 bg-papel-100 ring-tinta-200/40",
};

export function StatusChip({ tone = "neutral", children, className = "" }: Props) {
  return (
    <span className={`status-chip ${toneClass[tone]} ${className}`}>
      {children}
    </span>
  );
}
