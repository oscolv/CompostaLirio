"use client";

import { useMemo } from "react";

export type TempPoint = { fecha: Date; temperatura: number };

type Props = {
  puntos: TempPoint[];
  width?: number;
  height?: number;
};

export function TemperatureChart({ puntos, height = 200 }: Props) {
  const data = useMemo(
    () =>
      puntos
        .filter((p) => Number.isFinite(p.temperatura) && !isNaN(p.fecha.getTime()))
        .sort((a, b) => a.fecha.getTime() - b.fecha.getTime()),
    [puntos],
  );

  if (data.length < 2) {
    return (
      <div className="text-center text-gray-500 text-[13px] py-6">
        No hay suficientes registros para mostrar la gr&aacute;fica
      </div>
    );
  }

  const W = 480;
  const H = height;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const temps = data.map((d) => d.temperatura);
  const times = data.map((d) => d.fecha.getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const tempMinRaw = Math.min(...temps);
  const tempMaxRaw = Math.max(...temps);
  const pad = Math.max(1, (tempMaxRaw - tempMinRaw) * 0.1);
  const yMin = Math.floor(tempMinRaw - pad);
  const yMax = Math.ceil(tempMaxRaw + pad);
  const ySpan = yMax - yMin || 1;
  const tSpan = tMax - tMin || 1;

  const x = (t: number) => padL + ((t - tMin) / tSpan) * plotW;
  const y = (v: number) => padT + plotH - ((v - yMin) / ySpan) * plotH;

  const path = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.fecha.getTime()).toFixed(1)} ${y(d.temperatura).toFixed(1)}`)
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
      aria-label="Gr&aacute;fica de temperatura vs tiempo"
    >
      {yLabels.map((t, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={t.y}
            y2={t.y}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
          <text
            x={padL - 6}
            y={t.y + 3}
            textAnchor="end"
            fontSize="10"
            fill="#6b7280"
          >
            {t.v.toFixed(0)}&deg;
          </text>
        </g>
      ))}

      {xTicks.map((d, i) => (
        <text
          key={i}
          x={x(d.fecha.getTime())}
          y={H - 8}
          textAnchor="middle"
          fontSize="10"
          fill="#6b7280"
        >
          {fmt(d.fecha)}
        </text>
      ))}

      <path d={path} fill="none" stroke="#15803d" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => (
        <circle
          key={i}
          cx={x(d.fecha.getTime())}
          cy={y(d.temperatura)}
          r={2.5}
          fill="#15803d"
        />
      ))}
    </svg>
  );
}
