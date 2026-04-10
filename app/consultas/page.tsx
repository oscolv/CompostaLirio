"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Markdown from "react-markdown";

type Consulta = {
  id: number;
  tipo: string;
  compostera: number | null;
  pregunta: string;
  respuesta: string | null;
  created_at: string;
};

function IconArrowLeft() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 1.136.845 2.1 1.976 2.193 1.31.109 2.637.163 3.974.163l3 3v-3.091c.34-.02.68-.045 1.02-.072 1.133-.094 1.98-1.057 1.98-2.193V10.608c0-.969-.616-1.813-1.5-2.097z" />
    </svg>
  );
}

export default function Consultas() {
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [filtro, setFiltro] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = filtro ? `?tipo=${filtro}` : "";
      const res = await fetch(`/api/consultas${params}`);
      if (!res.ok) throw new Error();
      setConsultas(await res.json());
    } catch {
      setError("No se pudo cargar las consultas.");
    }
    setLoading(false);
  }, [filtro]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalDiag = consultas.filter((c) => c.tipo === "diagnostico").length;
  const totalPreg = consultas.filter((c) => c.tipo === "pregunta").length;

  return (
    <div className="min-h-screen bg-crema-100">
      <header className="bg-gradient-to-br from-verde-800 to-verde-950 px-5 py-6 text-white relative overflow-hidden">
        <div className="absolute -top-8 -right-4 text-[140px] opacity-[0.06] leading-none select-none rotate-12">
          {"\u{1F4AC}"}
        </div>
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-verde-200 mb-1.5">
            San Francisco Bojay
          </div>
          <h1 className="font-display text-[28px] font-black leading-tight tracking-tight">
            Consultas
          </h1>
          <div className="mt-3">
            <Link href="/" className="flex items-center gap-1.5 text-[13px] font-medium text-verde-200 hover:text-white transition-colors">
              <IconArrowLeft /> Volver al monitor
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        {/* Stats */}
        {!loading && !error && consultas.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-xl p-3 shadow-card border border-verde-100/50 text-center">
              <div className="text-[22px] font-bold text-verde-700">{totalDiag}</div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Diagn&oacute;sticos</div>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-card border border-verde-100/50 text-center">
              <div className="text-[22px] font-bold text-tierra-600">{totalPreg}</div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Preguntas libres</div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {["", "diagnostico", "pregunta"].map((val) => {
            const label = val === "" ? "Todas" : val === "diagnostico" ? "Diagn\u00f3sticos" : "Preguntas";
            const active = filtro === val;
            return (
              <button
                key={val}
                onClick={() => setFiltro(val)}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                  active
                    ? "bg-verde-700 text-white shadow-card"
                    : "bg-white text-gray-500 border border-verde-100/50 shadow-card"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="text-center text-verde-600 py-12 text-[14px] animate-pulse-fade">
            Cargando consultas...
          </div>
        )}

        {error && (
          <div className="page-card border-red-200 bg-red-50 text-[14px] text-red-700">{error}</div>
        )}

        {!loading && !error && consultas.length === 0 && (
          <div className="text-center text-gray-400 py-12 text-[14px]">
            No hay consultas registradas a&uacute;n. Las preguntas se guardan autom&aacute;ticamente cuando usan el agente.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {consultas.map((c) => {
            const isDiag = c.tipo === "diagnostico";
            const isOpen = expandido === c.id;
            const fecha = new Date(c.created_at);

            return (
              <button
                key={c.id}
                onClick={() => setExpandido(isOpen ? null : c.id)}
                className="page-card text-left transition-shadow hover:shadow-card-hover active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                    isDiag ? "bg-verde-50 text-verde-700" : "bg-tierra-400/10 text-tierra-600"
                  }`}>
                    {isDiag ? <IconClipboard /> : <IconChat />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                        isDiag ? "text-verde-600" : "text-tierra-500"
                      }`}>
                        {isDiag ? `Diagn\u00f3stico${c.compostera ? ` #${c.compostera}` : ""}` : "Pregunta libre"}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">
                        {fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <p className={`text-[13px] text-gray-700 leading-snug ${isOpen ? "" : "line-clamp-2"}`}>
                      {c.pregunta}
                    </p>
                    {isOpen && c.respuesta && (
                      <div className="mt-3 pt-3 border-t border-verde-100/50">
                        <div className="text-[11px] font-semibold text-verde-600 uppercase tracking-wider mb-1.5">
                          Respuesta del agente
                        </div>
                        <div className="text-[13px] text-gray-600 leading-relaxed prose-chat">
                          <Markdown>{c.respuesta}</Markdown>
                        </div>
                      </div>
                    )}
                    {!isOpen && c.respuesta && (
                      <div className="text-[11px] text-verde-600 font-medium mt-1.5">
                        Toca para ver respuesta
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
