"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Compostera = {
  id: number;
  nombre: string;
  fecha_inicio: string;
  activa: boolean;
};

function defaultComposteras(): Compostera[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    nombre: "",
    fecha_inicio: "",
    activa: true,
  }));
}

function diasDesde(fecha: string): number | null {
  if (!fecha) return null;
  const inicio = new Date(fecha + "T00:00:00");
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function IconArrowLeft() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function IconLeaf() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.71c.15-.43.31-.85.49-1.26C8.1 19.83 10.28 21 13 21c5.5 0 9-3.5 9-9V3l-1-.5C21 2.5 17 2 17 8zm-4 11c-1.78 0-3.35-.65-4.59-1.76C10.77 13.83 14.53 11.29 17 10c-2.49 1.29-5.36 4.07-6.81 7.25-.23-.48-.39-.98-.39-1.5 0-1.5.89-2.83 2.2-3.42.68-.3 1.42-.47 2.16-.49C16 11 17 10 17 8s2-4 4-4v4c0 4.5-3.5 8-8 8z" />
    </svg>
  );
}

export default function Configuracion() {
  const [composteras, setComposteras] = useState<Compostera[]>(defaultComposteras());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    fetch("/api/composteras")
      .then((r) => r.json())
      .then((rows: Compostera[]) => {
        if (Array.isArray(rows) && rows.length > 0) {
          const merged = defaultComposteras().map((def) => {
            const saved = rows.find((r) => r.id === def.id);
            return saved
              ? { ...saved, nombre: saved.nombre || "", fecha_inicio: saved.fecha_inicio ? saved.fecha_inicio.split("T")[0] : "" }
              : def;
          });
          setComposteras(merged);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update(id: number, field: keyof Compostera, value: string | boolean) {
    setComposteras((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  async function guardar() {
    setSaving(true);
    setMensaje("");
    try {
      const payload = composteras.map((c) => ({
        id: c.id, nombre: c.nombre || null, fecha_inicio: c.fecha_inicio || null, activa: c.activa,
      }));
      const res = await fetch("/api/composteras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composteras: payload }),
      });
      if (res.ok) {
        setMensaje("Guardado");
        setTimeout(() => setMensaje(""), 2500);
      } else {
        setMensaje("Error al guardar");
      }
    } catch {
      setMensaje("Error de conexi\u00f3n");
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-crema-100">
      <header className="bg-gradient-to-br from-verde-800 to-verde-950 px-5 py-6 text-white relative overflow-hidden">
        <div className="absolute -top-8 -right-4 text-[140px] opacity-[0.06] leading-none select-none rotate-12">
          {"\u2699\uFE0F"}
        </div>
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-verde-200 mb-1.5">
            San Francisco Bojay
          </div>
          <h1 className="font-display text-[28px] font-black leading-tight tracking-tight">
            Configuraci&oacute;n
          </h1>
          <div className="mt-3">
            <Link href="/" className="flex items-center gap-1.5 text-[13px] font-medium text-verde-200 hover:text-white transition-colors">
              <IconArrowLeft /> Volver al monitor
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        <div className="page-card">
          <h2 className="text-[15px] font-semibold text-verde-900 mb-1">Composteras</h2>
          <p className="text-[13px] text-gray-400 mb-5 leading-snug">
            Configura la fecha de inicio de cada compostera. La app calcula autom&aacute;ticamente el d&iacute;a del proceso.
          </p>

          {loading ? (
            <div className="text-center text-verde-600 py-12 text-[14px] animate-pulse-fade">
              Cargando...
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {composteras.map((c) => {
                const dias = diasDesde(c.fecha_inicio);
                return (
                  <div
                    key={c.id}
                    className={`rounded-xl p-3.5 border transition-all duration-200 ${
                      c.activa
                        ? "border-verde-200/60 bg-verde-50/30"
                        : "border-gray-200 bg-gray-50 opacity-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${c.activa ? "bg-verde-500" : "bg-gray-300"}`} />
                        <span className="font-semibold text-[14px] text-verde-900">#{c.id}</span>
                        {dias !== null && (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-verde-600 bg-verde-100 px-2 py-0.5 rounded-full">
                            <IconLeaf />
                            D&iacute;a {dias}
                          </span>
                        )}
                      </div>
                      <label className="flex items-center gap-2 text-[12px] text-gray-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={c.activa}
                          onChange={(e) => update(c.id, "activa", e.target.checked)}
                          className="w-4 h-4 accent-verde-700 rounded"
                        />
                        Activa
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-verde-700/50 uppercase tracking-wider block mb-1">
                          Nombre
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Pila norte"
                          value={c.nombre}
                          onChange={(e) => update(c.id, "nombre", e.target.value)}
                          className="w-full px-2.5 py-2 border border-verde-200/50 rounded-lg text-[13px] bg-white outline-none focus:border-verde-400 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-verde-700/50 uppercase tracking-wider block mb-1">
                          Fecha de inicio
                        </label>
                        <input
                          type="date"
                          value={c.fecha_inicio}
                          onChange={(e) => update(c.id, "fecha_inicio", e.target.value)}
                          className="w-full px-2.5 py-2 border border-verde-200/50 rounded-lg text-[13px] bg-white outline-none focus:border-verde-400 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="sticky bottom-4 mt-5">
            <button onClick={guardar} disabled={saving} className="btn-primary">
              {saving ? "Guardando..." : "Guardar configuraci\u00f3n"}
            </button>
          </div>

          {mensaje && (
            <div className={`text-center text-[13px] font-medium mt-3 animate-fade-in ${
              mensaje === "Guardado" ? "text-verde-600" : "text-red-600"
            }`}>
              {mensaje === "Guardado" ? "\u2713 Guardado correctamente" : "\u2717 " + mensaje}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
