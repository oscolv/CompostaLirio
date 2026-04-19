"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useSitios } from "@/hooks/useSitios";

type Compostera = {
  id: number;
  nombre: string;
  fecha_inicio: string;
  activa: boolean;
  masa_inicial: string;
  sitio_id: number | null;
};

function defaultComposteras(): Compostera[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    nombre: "",
    fecha_inicio: "",
    activa: true,
    masa_inicial: "",
    sitio_id: null,
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
  const { activos: sitiosActivos } = useSitios();

  useEffect(() => {
    fetch("/api/composteras")
      .then((r) => r.json())
      .then((rows: Array<{ id: number; nombre: string | null; fecha_inicio: string | null; activa: boolean; masa_inicial: number | null; sitio_id: number | null }>) => {
        if (Array.isArray(rows) && rows.length > 0) {
          const merged = defaultComposteras().map((def) => {
            const saved = rows.find((r) => r.id === def.id);
            return saved
              ? {
                  id: saved.id,
                  nombre: saved.nombre || "",
                  fecha_inicio: saved.fecha_inicio ? saved.fecha_inicio.split("T")[0] : "",
                  activa: saved.activa,
                  masa_inicial: saved.masa_inicial != null ? String(saved.masa_inicial) : "",
                  sitio_id: saved.sitio_id ?? null,
                }
              : def;
          });
          setComposteras(merged);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update(id: number, field: keyof Compostera, value: string | boolean | number | null) {
    setComposteras((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  async function guardar() {
    setSaving(true);
    setMensaje("");
    try {
      const payload = composteras.map((c) => {
        const masa = c.masa_inicial.trim() === "" ? null : Number(c.masa_inicial);
        return {
          id: c.id,
          nombre: c.nombre || null,
          fecha_inicio: c.fecha_inicio || null,
          activa: c.activa,
          masa_inicial: masa != null && !Number.isNaN(masa) ? masa : null,
          sitio_id: c.sitio_id,
        };
      });
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
      <header className="relative overflow-hidden text-white h-[26vh] min-h-[150px] max-h-[200px]">
        <NextImage
          src="/bojay.jpg"
          alt="Ciénega de San Francisco Bojay"
          fill
          priority
          sizes="(max-width: 480px) 100vw, 480px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-verde-950/70 via-verde-900/55 to-verde-950/85" />
        <div className="relative z-10 h-full max-w-[480px] mx-auto px-5 py-4 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-verde-100 drop-shadow-sm">
              San Francisco Bojay
            </div>
            <h1 className="font-display text-[26px] font-black leading-tight tracking-tight mt-0.5 drop-shadow">
              Configuraci&oacute;n
            </h1>
          </div>
          <Link href="/" className="flex items-center gap-1.5 text-[13px] font-medium text-verde-100 hover:text-white transition-colors">
            <IconArrowLeft /> Volver al monitor
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        <Link
          href="/configuracion/sitios"
          className="page-card flex items-center justify-between mb-3 transition-shadow hover:shadow-card-hover active:scale-[0.98]"
        >
          <div>
            <div className="text-[15px] font-semibold text-verde-900">Sitios</div>
            <div className="text-[12px] text-gray-400 leading-snug">
              Gestionar sitios (Bojay, Tepeji...) que agrupan composteras
            </div>
          </div>
          <span className="text-verde-700 text-xl leading-none">→</span>
        </Link>

        <Link
          href="/configuracion/formulaciones"
          className="page-card flex items-center justify-between mb-4 transition-shadow hover:shadow-card-hover active:scale-[0.98]"
        >
          <div>
            <div className="text-[15px] font-semibold text-verde-900">Formulaciones</div>
            <div className="text-[12px] text-gray-400 leading-snug">
              Gestionar recetas de mezcla de composta
            </div>
          </div>
          <span className="text-verde-700 text-xl leading-none">→</span>
        </Link>

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
                      <div className="col-span-2">
                        <label className="text-[10px] font-semibold text-verde-700/50 uppercase tracking-wider block mb-1">
                          Masa inicial (kg)
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.1"
                          placeholder="Ej: 200"
                          value={c.masa_inicial}
                          onChange={(e) => update(c.id, "masa_inicial", e.target.value)}
                          className="w-full px-2.5 py-2 border border-verde-200/50 rounded-lg text-[13px] bg-white outline-none focus:border-verde-400 transition-colors"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-semibold text-verde-700/50 uppercase tracking-wider block mb-1">
                          Sitio
                        </label>
                        <select
                          value={c.sitio_id ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            update(c.id, "sitio_id", v === "" ? null : Number(v));
                          }}
                          className="w-full px-2.5 py-2 border border-verde-200/50 rounded-lg text-[13px] bg-white outline-none focus:border-verde-400 transition-colors"
                        >
                          <option value="">— Sin asignar —</option>
                          {sitiosActivos.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-1">
                      <Link
                        href={`/configuracion/composteras/${c.id}/ciclos`}
                        className="flex items-center justify-between text-[12px] font-medium text-verde-700 hover:text-verde-900 transition-colors"
                      >
                        <span>Ciclos de esta compostera</span>
                        <span className="text-base leading-none">→</span>
                      </Link>
                      <Link
                        href={`/configuracion/composteras/${c.id}`}
                        className="flex items-center justify-between text-[12px] font-medium text-verde-700 hover:text-verde-900 transition-colors"
                      >
                        <span>Formulaciones y detalle (legacy)</span>
                        <span className="text-base leading-none">→</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && (
            <div className="mt-5 rounded-xl border border-verde-200/60 bg-verde-50/60 px-4 py-3 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-verde-700 uppercase tracking-wider">
                Masa total de composta
              </span>
              <span className="text-[18px] font-bold text-verde-900 tabular-nums">
                {composteras
                  .reduce((acc, c) => {
                    const n = Number(c.masa_inicial);
                    return acc + (Number.isFinite(n) ? n : 0);
                  }, 0)
                  .toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg
              </span>
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
