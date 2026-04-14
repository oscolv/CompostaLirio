"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

type Compostera = {
  id: number;
  nombre: string;
  fecha_inicio: string;
  activa: boolean;
  masa_inicial: string;
};

function defaultComposteras(): Compostera[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i + 1, nombre: "", fecha_inicio: "", activa: true, masa_inicial: "",
  }));
}

function diasDesde(fecha: string): number | null {
  if (!fecha) return null;
  const inicio = new Date(fecha + "T00:00:00");
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export default function Configuracion() {
  const [composteras, setComposteras] = useState<Compostera[]>(defaultComposteras());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    fetch("/api/composteras")
      .then((r) => r.json())
      .then((rows: Array<{ id: number; nombre: string | null; fecha_inicio: string | null; activa: boolean; masa_inicial: number | null }>) => {
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
                }
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
      const payload = composteras.map((c) => {
        const masa = c.masa_inicial.trim() === "" ? null : Number(c.masa_inicial);
        return {
          id: c.id,
          nombre: c.nombre || null,
          fecha_inicio: c.fecha_inicio || null,
          activa: c.activa,
          masa_inicial: masa != null && !Number.isNaN(masa) ? masa : null,
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
      setMensaje("Error de conexión");
    }
    setSaving(false);
  }

  const masaTotal = composteras
    .reduce((acc, c) => { const n = Number(c.masa_inicial); return acc + (Number.isFinite(n) ? n : 0); }, 0);

  return (
    <div className="min-h-screen pb-24">
      <PageHeader
        kicker="Bitácora · Sección IV"
        title="Configuración."
        subtitle="Gestiona tus composteras: nombre, fecha de inicio, masa y estado. La app calcula el día del proceso automáticamente."
        folio={`${composteras.filter((c) => c.activa).length} ACTIVAS · ${masaTotal.toLocaleString("es-MX")} KG`}
        nav={[
          { href: "/", label: "Índice" },
          { href: "/historial", label: "Historial" },
          { href: "/consultas", label: "Consultas" },
          { href: "/configuracion", label: "Configuración", active: true },
        ]}
      />

      <main className="max-w-[960px] mx-auto px-5 md:px-8 py-8 md:py-10">
        <Link
          href="/configuracion/formulaciones"
          className="group flex items-center justify-between p-5 rounded-md bg-papel-50 border border-tinta-900/10 mb-6 transition-all hover:border-tinta-600 hover:-translate-y-0.5 hover:shadow-card-hover"
        >
          <div>
            <div className="kicker">Catálogo</div>
            <div className="font-display text-[20px] font-black text-tinta-900 leading-tight mt-1">
              Formulaciones
            </div>
            <div className="text-[13px] text-tinta-600 leading-snug mt-1">
              Recetas de mezcla (lirio + estructurante + otros insumos)
            </div>
          </div>
          <span className="text-tinta-700 text-2xl leading-none transition-transform group-hover:translate-x-1">→</span>
        </Link>

        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="kicker">Composteras</div>
            <h2 className="font-display text-[28px] font-black text-tinta-900 leading-tight mt-1">
              Parque de unidades
            </h2>
          </div>
          <div className="hidden sm:block font-mono text-[11px] text-tinta-500 tabular-nums">
            {composteras.length} UNIDADES
          </div>
        </div>

        {loading ? (
          <div className="text-center text-tinta-600 py-16 text-[12px] uppercase tracking-kicker font-semibold animate-pulse-fade">
            Cargando…
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {composteras.map((c) => {
              const dias = diasDesde(c.fecha_inicio);
              return (
                <div
                  key={c.id}
                  className={`relative rounded-md p-4 border transition-all ${
                    c.activa
                      ? "border-tinta-900/15 bg-papel-50"
                      : "border-tinta-900/5 bg-papel-200/30 opacity-60"
                  }`}
                >
                  <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-sm ${c.activa ? "bg-tinta-600" : "bg-tinta-200"}`} />
                  <div className="pl-2 flex items-start justify-between mb-3">
                    <div>
                      <div className="font-mono text-[10.5px] text-tinta-500 tabular-nums">
                        N.º {String(c.id).padStart(2, "0")}
                      </div>
                      <div className="font-display text-[17px] font-semibold text-tinta-900 leading-tight">
                        {c.nombre || `Compostera ${c.id}`}
                      </div>
                      {dias !== null && (
                        <div className="font-mono text-[11px] text-ocre-600 mt-1 tabular-nums">
                          D {dias} · día del proceso
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-kicker text-tinta-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={c.activa}
                        onChange={(e) => update(c.id, "activa", e.target.checked)}
                        className="w-4 h-4 accent-tinta-800 rounded-xs"
                      />
                      Activa
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pl-2">
                    <div>
                      <label className="input-label">Nombre</label>
                      <input
                        type="text"
                        placeholder="Ej: Pila norte"
                        value={c.nombre}
                        onChange={(e) => update(c.id, "nombre", e.target.value)}
                        className="input-field text-[13px] py-2"
                      />
                    </div>
                    <div>
                      <label className="input-label">Fecha inicio</label>
                      <input
                        type="date"
                        value={c.fecha_inicio}
                        onChange={(e) => update(c.id, "fecha_inicio", e.target.value)}
                        className="input-field text-[13px] py-2"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="input-label">Masa inicial (kg)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0" step="0.1"
                        placeholder="200"
                        value={c.masa_inicial}
                        onChange={(e) => update(c.id, "masa_inicial", e.target.value)}
                        className="input-field text-[13px] py-2 font-mono"
                      />
                    </div>
                  </div>

                  <Link
                    href={`/configuracion/composteras/${c.id}`}
                    className="mt-3 ml-2 inline-flex items-center justify-between w-[calc(100%-0.5rem)] text-[11px] font-semibold uppercase tracking-kicker text-tinta-700 hover:text-arcilla-600 transition-colors"
                  >
                    <span>Detalle y formulaciones</span>
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {!loading && (
          <div className="mt-6 relative rounded-md border border-tinta-900/12 bg-tinta-900 text-papel-100 px-5 py-4 flex items-center justify-between">
            <div>
              <div className="kicker text-papel-200/70">Masa total en proceso</div>
              <div className="text-[12px] text-papel-200/60 mt-1">
                Suma de masa inicial declarada en todas las composteras.
              </div>
            </div>
            <div className="font-mono text-[32px] font-semibold text-papel-50 tabular-nums leading-none">
              {masaTotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
              <span className="text-[14px] text-papel-200/60 ml-1.5">kg</span>
            </div>
          </div>
        )}

        <div className="sticky bottom-4 mt-6">
          <button onClick={guardar} disabled={saving} className="btn-primary">
            {saving ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>

        {mensaje && (
          <div className={`text-center text-[11.5px] font-semibold uppercase tracking-kicker mt-3 animate-fade-in ${
            mensaje === "Guardado" ? "text-tinta-700" : "text-arcilla-600"
          }`}>
            {mensaje === "Guardado" ? "✓ Guardado correctamente" : "✗ " + mensaje}
          </div>
        )}
      </main>
    </div>
  );
}
