"use client";

import { useMemo } from "react";

export type MetricPoint = { fecha: Date; valor: number };

type Props = {
  puntos: MetricPoint[];
  height?: number;
  formatY?: (v: number) => string;
  yMinFixed?: number;
  yMaxFixed?: number;
  ariaLabel?: string;
};

export function MetricChart({
  puntos,
  height = 200,
  formatY = (v) => v.toFixed(0),
  yMinFixed,
  yMaxFixed,
  ariaLabel = "Gráfica",
}: Props) {
  const data = useMemo(
    () =>
      puntos
        .filter((p) => Number.isFinite(p.valor) && !isNaN(p.fecha.getTime()))
        .sort((a, b) => a.fecha.getTime() - b.fecha.getTime()),
    [puntos],
  );

  if (data.length < 2) {
    return (
      <div className="text-center text-tinta-500 text-[12px] uppercase tracking-kicker font-semibold py-8">
        · Aún no hay suficientes registros para graficar ·
      </div>
    );
  }

  const W = 480;
  const H = height;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const valores = data.map((d) => d.valor);
  const times = data.map((d) => d.fecha.getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const valMinRaw = Math.min(...valores);
  const valMaxRaw = Math.max(...valores);
  const pad = Math.max(1, (valMaxRaw - valMinRaw) * 0.1);
  const yMin = yMinFixed ?? Math.floor(valMinRaw - pad);
  const yMax = yMaxFixed ?? Math.ceil(valMaxRaw + pad);
  const ySpan = yMax - yMin || 1;
  const tSpan = tMax - tMin || 1;

  const x = (t: number) => padL + ((t - tMin) / tSpan) * plotW;
  const y = (v: number) => padT + plotH - ((v - yMin) / ySpan) * plotH;

  const path = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.fecha.getTime()).toFixed(1)} ${y(d.valor).toFixed(1)}`)
    .join(" ");

  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = yMin + (ySpan * i) / yTicks;
    return { v, y: y(v) };
  });

  const maxXTicks = 4;
  const step = Math.max(1, Math.ceil(data.length / maxXTicks));
  const xTicks = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  const fmt = (d: Date) =>
    d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label={ariaLabel}
    >
      {yLabels.map((t, i) => (
        <g key={i}>
          <line
            x1={padL} x2={W - padR}
            y1={t.y} y2={t.y}
            stroke="#0f1a11" strokeOpacity={i === 0 || i === yLabels.length - 1 ? 0.18 : 0.06}
            strokeWidth={1} strokeDasharray={i === 0 || i === yLabels.length - 1 ? "0" : "2 3"}
          />
          <text
            x={padL - 8} y={t.y + 3}
            textAnchor="end"
            fontSize="9.5"
            fontFamily="'JetBrains Mono', monospace"
            fill="#4a6340"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatY(t.v)}
          </text>
        </g>
      ))}

      {xTicks.map((d, i) => (
        <g key={i}>
          <line
            x1={x(d.fecha.getTime())} x2={x(d.fecha.getTime())}
            y1={padT + plotH} y2={padT + plotH + 4}
            stroke="#0f1a11" strokeOpacity={0.3} strokeWidth={1}
          />
          <text
            x={x(d.fecha.getTime())} y={H - 8}
            textAnchor="middle"
            fontSize="9.5"
            fontFamily="'JetBrains Mono', monospace"
            fill="#4a6340"
            style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            {fmt(d.fecha)}
          </text>
        </g>
      ))}

      <defs>
        <linearGradient id="metricFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#253621" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#253621" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L ${x(times[times.length - 1]).toFixed(1)} ${padT + plotH} L ${x(times[0]).toFixed(1)} ${padT + plotH} Z`}
        fill="url(#metricFill)"
      />

      <path d={path} fill="none" stroke="#253621" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(d.fecha.getTime())} cy={y(d.valor)} r={3.2} fill="#fcf9f0" stroke="#253621" strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  );
}
