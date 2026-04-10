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
  const diff = hoy.getTime() - inicio.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

export default function Configuracion() {
  const [composteras, setComposteras] = useState<Compostera[]>(
    defaultComposteras(),
  );
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
              ? {
                  ...saved,
                  nombre: saved.nombre || "",
                  fecha_inicio: saved.fecha_inicio
                    ? saved.fecha_inicio.split("T")[0]
                    : "",
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
    setComposteras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  }

  async function guardar() {
    setSaving(true);
    setMensaje("");
    try {
      const payload = composteras.map((c) => ({
        id: c.id,
        nombre: c.nombre || null,
        fecha_inicio: c.fecha_inicio || null,
        activa: c.activa,
      }));
      const res = await fetch("/api/composteras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composteras: payload }),
      });
      if (res.ok) {
        setMensaje("Guardado");
        setTimeout(() => setMensaje(""), 2000);
      } else {
        setMensaje("Error al guardar");
      }
    } catch {
      setMensaje("Error de conexi\u00f3n");
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-crema-100 via-crema-300 to-crema-400">
      <header className="bg-verde-800 px-5 py-5 text-crema-100 relative overflow-hidden">
        <div className="absolute -top-5 -right-2 text-[120px] opacity-[0.08] leading-none select-none">
          {"\u2699\uFE0F"}
        </div>
        <div className="text-[13px] uppercase tracking-[0.15em] opacity-70 mb-1">
          San Francisco Bojay
        </div>
        <h1 className="font-display text-[26px] font-black leading-tight">
          Configuraci&oacute;n
        </h1>
        <div className="text-sm opacity-80 mt-1">
          <Link
            href="/"
            className="underline underline-offset-2 opacity-90 hover:opacity-100"
          >
            &larr; Volver al monitor
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-4">
        <div className="bg-crema-50 border-2 border-verde-800 rounded-xl p-5 mb-4">
          <div className="text-base font-bold mb-1 text-verde-800">
            Composteras
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Configura la fecha de inicio de cada compostera. La app calcula
            autom&aacute;ticamente el d&iacute;a del proceso.
          </p>

          {loading ? (
            <div className="text-center text-verde-800 py-8 animate-pulse-fade">
              Cargando...
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {composteras.map((c) => {
                const dias = diasDesde(c.fecha_inicio);
                return (
                  <div
                    key={c.id}
                    className={`border-2 rounded-xl p-3 ${
                      c.activa
                        ? "border-verde-800/30 bg-white"
                        : "border-gray-200 bg-gray-50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-verde-800 text-sm">
                        #{c.id}
                      </span>
                      <label className="flex items-center gap-2 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={c.activa}
                          onChange={(e) =>
                            update(c.id, "activa", e.target.checked)
                          }
                          className="accent-verde-800"
                        />
                        Activa
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-verde-800/60 uppercase block mb-0.5">
                          Nombre (opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="ej: Pila norte"
                          value={c.nombre}
                          onChange={(e) =>
                            update(c.id, "nombre", e.target.value)
                          }
                          className="w-full px-2 py-2 border border-verde-800/20 rounded-lg text-sm bg-crema-100 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-verde-800/60 uppercase block mb-0.5">
                          Fecha de inicio
                        </label>
                        <input
                          type="date"
                          value={c.fecha_inicio}
                          onChange={(e) =>
                            update(c.id, "fecha_inicio", e.target.value)
                          }
                          className="w-full px-2 py-2 border border-verde-800/20 rounded-lg text-sm bg-crema-100 outline-none"
                        />
                      </div>
                    </div>

                    {dias !== null && (
                      <div className="text-xs text-verde-800 font-medium mt-2">
                        D&iacute;a {dias} del proceso
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={guardar}
            disabled={saving}
            className={`w-full mt-4 py-3.5 rounded-lg text-base font-bold tracking-wide text-crema-100 ${
              saving
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-verde-800 active:bg-verde-900 cursor-pointer"
            }`}
          >
            {saving ? "Guardando..." : "Guardar configuraci\u00f3n"}
          </button>

          {mensaje && (
            <div
              className={`text-center text-sm font-medium mt-2 ${
                mensaje === "Guardado" ? "text-verde-800" : "text-red-600"
              }`}
            >
              {mensaje === "Guardado" ? "\u2713" : "\u2717"} {mensaje}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
