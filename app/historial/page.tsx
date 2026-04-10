"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Medicion = {
  id: number;
  compostera: number;
  dia: number | null;
  temperatura: number;
  ph: number;
  humedad: number;
  observaciones: string | null;
  estado: string;
  created_at: string;
};

const estadoConfig: Record<string, { dot: string; bg: string; border: string }> = {
  good: { dot: "bg-verde-500", bg: "bg-verde-50/50", border: "border-verde-200/60" },
  warning: { dot: "bg-amber-500", bg: "bg-amber-50/50", border: "border-amber-200/60" },
  danger: { dot: "bg-red-500", bg: "bg-red-50/50", border: "border-red-200/60" },
};

function IconArrowLeft() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

export default function Historial() {
  const [mediciones, setMediciones] = useState<Medicion[]>([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = filtro ? `?compostera=${filtro}` : "";
      const res = await fetch(`/api/mediciones${params}`);
      if (!res.ok) throw new Error();
      setMediciones(await res.json());
    } catch {
      setError("No se pudo conectar a la base de datos.");
    }
    setLoading(false);
  }, [filtro]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="min-h-screen bg-crema-100">
      <header className="bg-gradient-to-br from-verde-800 to-verde-950 px-5 py-6 text-white relative overflow-hidden">
        <div className="absolute -top-8 -right-4 text-[140px] opacity-[0.06] leading-none select-none rotate-12">
          {"\u{1F4CA}"}
        </div>
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-verde-200 mb-1.5">
            San Francisco Bojay
          </div>
          <h1 className="font-display text-[28px] font-black leading-tight tracking-tight">
            Historial
          </h1>
          <div className="mt-3">
            <Link href="/" className="flex items-center gap-1.5 text-[13px] font-medium text-verde-200 hover:text-white transition-colors">
              <IconArrowLeft /> Volver al monitor
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        <div className="mb-4">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="input-field"
          >
            <option value="">Todas las composteras</option>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Compostera #{i + 1}</option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="text-center text-verde-600 py-12 text-[14px] animate-pulse-fade">
            Cargando mediciones...
          </div>
        )}

        {error && (
          <div className="page-card border-red-200 bg-red-50 text-[14px] text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && mediciones.length === 0 && (
          <div className="text-center text-gray-400 py-12 text-[14px]">
            No hay mediciones registradas a&uacute;n.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {mediciones.map((m) => {
            const est = estadoConfig[m.estado] || estadoConfig.good;
            const fecha = new Date(m.created_at);
            return (
              <div key={m.id} className={`rounded-2xl p-4 border shadow-card ${est.bg} ${est.border}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${est.dot}`} />
                    <span className="font-semibold text-[14px] text-verde-900">
                      Compostera #{m.compostera}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-gray-400">
                    {fecha.toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Temp", value: `${m.temperatura}\u00b0C` },
                    { label: "pH", value: `${m.ph}` },
                    { label: "Humedad", value: `${m.humedad}%` },
                  ].map((d) => (
                    <div key={d.label} className="bg-white/60 rounded-lg px-2.5 py-2 text-center">
                      <div className="text-[10px] font-semibold text-verde-700/50 uppercase tracking-wider">{d.label}</div>
                      <div className="text-[15px] font-semibold text-gray-800 mt-0.5">{d.value}</div>
                    </div>
                  ))}
                </div>
                {(m.dia || m.observaciones) && (
                  <div className="mt-2.5 pt-2.5 border-t border-black/5 flex flex-col gap-0.5">
                    {m.dia && (
                      <div className="text-[12px] font-medium text-verde-700/60">
                        D&iacute;a {m.dia} del proceso
                      </div>
                    )}
                    {m.observaciones && (
                      <div className="text-[12px] text-gray-500 italic">{m.observaciones}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
