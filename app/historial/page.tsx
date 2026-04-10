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

const estadoStyle: Record<string, { emoji: string; bg: string }> = {
  good: { emoji: "\u{1F7E2}", bg: "bg-verde-50" },
  warning: { emoji: "\u{1F7E1}", bg: "bg-yellow-50" },
  danger: { emoji: "\u{1F534}", bg: "bg-red-50" },
};

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
      if (!res.ok) throw new Error("Error al cargar datos");
      const data = await res.json();
      setMediciones(data);
    } catch {
      setError(
        "No se pudo conectar a la base de datos. Verifica que Postgres est\u00e9 configurado.",
      );
    }
    setLoading(false);
  }, [filtro]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-crema-100 via-crema-300 to-crema-400">
      <header className="bg-verde-800 px-5 py-5 text-crema-100 relative overflow-hidden">
        <div className="absolute -top-5 -right-2 text-[120px] opacity-[0.08] leading-none select-none">
          {"\u{1F4CA}"}
        </div>
        <div className="text-[13px] uppercase tracking-[0.15em] opacity-70 mb-1">
          San Francisco Bojay
        </div>
        <h1 className="font-display text-[26px] font-black leading-tight">
          Historial
        </h1>
        <div className="text-sm opacity-80 mt-1">
          <Link href="/" className="underline underline-offset-2 opacity-90 hover:opacity-100">
            &larr; Volver al monitor
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-4">
        {/* Filter */}
        <div className="flex gap-2 mb-4">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="flex-1 px-3 py-3 border-2 border-verde-800 rounded-lg text-base bg-crema-100 outline-none"
          >
            <option value="">Todas las composteras</option>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Compostera #{i + 1}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="text-center text-verde-800 py-8 animate-pulse-fade">
            Cargando mediciones...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {!loading && !error && mediciones.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No hay mediciones registradas a&uacute;n.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {mediciones.map((m) => {
            const est = estadoStyle[m.estado] || estadoStyle.good;
            const fecha = new Date(m.created_at);
            return (
              <div
                key={m.id}
                className={`${est.bg} border-2 border-verde-800/20 rounded-xl p-4`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-verde-800">
                    {est.emoji} Compostera #{m.compostera}
                  </span>
                  <span className="text-xs text-gray-500">
                    {fecha.toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-[11px] font-bold text-verde-800/60 uppercase">
                      Temp
                    </span>
                    <div className="font-medium">{m.temperatura}&deg;C</div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-verde-800/60 uppercase">
                      pH
                    </span>
                    <div className="font-medium">{m.ph}</div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-verde-800/60 uppercase">
                      Humedad
                    </span>
                    <div className="font-medium">{m.humedad}%</div>
                  </div>
                </div>
                {m.dia && (
                  <div className="text-xs text-gray-500 mt-2">
                    D&iacute;a {m.dia} del proceso
                  </div>
                )}
                {m.observaciones && (
                  <div className="text-xs text-gray-600 mt-1 italic">
                    {m.observaciones}
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
