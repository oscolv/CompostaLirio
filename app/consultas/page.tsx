"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import { PageHeader } from "@/components/ui/PageHeader";

type Consulta = {
  id: number;
  tipo: string;
  compostera: number | null;
  pregunta: string;
  respuesta: string | null;
  created_at: string;
};

export default function Consultas() {
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [filtro, setFiltro] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

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

  async function handleDelete(id: number) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setDeleting(id);
    try {
      const res = await fetch(`/api/consultas?id=${id}`, { method: "DELETE" });
      if (res.ok) setConsultas((prev) => prev.filter((c) => c.id !== id));
    } catch { /* ignore */ }
    setDeleting(null);
    setConfirmDelete(null);
  }

  const totalDiag = consultas.filter((c) => c.tipo === "diagnostico").length;
  const totalPreg = consultas.filter((c) => c.tipo === "pregunta").length;

  return (
    <div className="min-h-screen">
      <PageHeader
        kicker="Bitácora · Sección III"
        title="Consultas."
        subtitle="Preguntas y diagnósticos hechos al agente. Aquí se archiva la conversación técnica del proceso."
        folio={`${consultas.length} REGISTROS · DIAG ${totalDiag} · PREG ${totalPreg}`}
        nav={[
          { href: "/", label: "Índice" },
          { href: "/historial", label: "Historial" },
          { href: "/consultas", label: "Consultas", active: true },
          { href: "/configuracion", label: "Configuración" },
        ]}
      />

      <main className="max-w-[960px] mx-auto px-5 md:px-8 py-8 md:py-10">
        {/* Stats resumen */}
        {!loading && !error && consultas.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard label="Diagnósticos" value={totalDiag} accent="tinta" />
            <StatCard label="Preguntas libres" value={totalPreg} accent="ocre" />
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-1 mb-5 p-1 bg-papel-200/60 border border-tinta-900/10 rounded-md">
          {["", "diagnostico", "pregunta"].map((val) => {
            const label = val === "" ? "Todas" : val === "diagnostico" ? "Diagnósticos" : "Preguntas";
            const active = filtro === val;
            return (
              <button
                key={val}
                onClick={() => setFiltro(val)}
                className={`flex-1 py-2 rounded-sm text-[11.5px] font-semibold uppercase tracking-kicker transition-all ${
                  active
                    ? "bg-tinta-900 text-papel-50 shadow-ink"
                    : "text-tinta-600 hover:text-tinta-900"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="text-center text-tinta-600 py-16 text-[12px] uppercase tracking-kicker font-semibold animate-pulse-fade">
            Cargando consultas…
          </div>
        )}

        {error && (
          <div className="page-card border-arcilla-200 bg-arcilla-50 text-[13px] text-arcilla-700">{error}</div>
        )}

        {!loading && !error && consultas.length === 0 && (
          <div className="text-center py-16 px-6 border border-dashed border-tinta-900/15 rounded-md bg-papel-50/30">
            <div className="kicker justify-center mb-3">Sin consultas</div>
            <div className="font-display text-[22px] font-black text-tinta-900 leading-tight mb-2">
              Nada archivado aún.
            </div>
            <p className="text-[13px] text-tinta-600 max-w-[40ch] mx-auto leading-relaxed">
              Las preguntas que hagas al agente se guardan automáticamente aquí (a menos que las marques como privadas).
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {consultas.map((c, idx) => {
            const isDiag = c.tipo === "diagnostico";
            const isOpen = expandido === c.id;
            const fecha = new Date(c.created_at);
            const tone = isDiag ? "bg-tinta-700" : "bg-ocre-400";

            return (
              <div
                key={c.id}
                onClick={() => { if (confirmDelete !== c.id) setExpandido(isOpen ? null : c.id); }}
                className="group relative rounded-md border border-tinta-900/10 bg-papel-50 cursor-pointer transition-all hover:border-tinta-600"
              >
                <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-sm ${tone}`} />
                <div className="pl-5 pr-4 py-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[10.5px] text-tinta-500 tabular-nums">
                        N.º {String(consultas.length - idx).padStart(3, "0")}
                      </span>
                      <span className={`text-[10.5px] font-semibold uppercase tracking-kicker ${isDiag ? "text-tinta-700" : "text-ocre-600"}`}>
                        {isDiag ? `Diagnóstico${c.compostera ? ` #${c.compostera}` : ""}` : "Pregunta libre"}
                      </span>
                    </div>
                    <span className="font-mono text-[10.5px] text-tinta-500 tabular-nums uppercase">
                      {fecha.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                    </span>
                  </div>

                  <p className={`text-[14px] text-tinta-800 leading-snug font-display ${isOpen ? "" : "line-clamp-2"}`}>
                    {c.pregunta}
                  </p>

                  {isOpen && c.respuesta && (
                    <div className="mt-4 pt-4 border-t border-tinta-900/8">
                      <div className="kicker mb-2">Respuesta del agente</div>
                      <div className="text-[13.5px] text-tinta-700 leading-relaxed prose-chat">
                        <Markdown>{c.respuesta}</Markdown>
                      </div>
                    </div>
                  )}
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-tinta-900/8 flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                        disabled={deleting === c.id}
                        className={`px-3 py-1.5 rounded-sm text-[10.5px] font-semibold uppercase tracking-kicker transition-all ${
                          confirmDelete === c.id
                            ? "bg-arcilla-500 text-papel-50"
                            : "bg-arcilla-50 text-arcilla-600 hover:bg-arcilla-100"
                        } disabled:opacity-50`}
                      >
                        {deleting === c.id ? "Borrando…" : confirmDelete === c.id ? "Confirmar" : "Borrar"}
                      </button>
                    </div>
                  )}
                  {!isOpen && c.respuesta && (
                    <div className="text-[10.5px] text-tinta-600 font-semibold uppercase tracking-kicker mt-2">
                      + Toca para ver respuesta
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: "tinta" | "ocre" }) {
  const tone = accent === "ocre" ? "before:bg-ocre-400 text-ocre-600" : "before:bg-tinta-700 text-tinta-700";
  return (
    <div className={`relative bg-papel-50 border border-tinta-900/10 rounded-md px-4 py-3 before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-sm ${tone}`}>
      <div className="font-mono text-[28px] font-semibold text-tinta-900 tabular-nums leading-none">
        {String(value).padStart(2, "0")}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-kicker text-tinta-500 mt-1">{label}</div>
    </div>
  );
}
