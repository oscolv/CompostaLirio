"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useSitio } from "@/lib/sitio-context";
import type { ComposteraConCounts } from "@/lib/types";

type RowSaveState = "idle" | "saving" | "saved" | "error";

type Row = {
  id: number;
  sitio_id: number;
  nombre: string;
  fecha_inicio: string;
  activa: boolean;
  masa_inicial: string;
  estado: "activa" | "inactiva" | "retirada";
  ciclos_count: number;
  mediciones_count: number;
  saveState: RowSaveState;
  errorMsg: string;
};

function toRow(c: ComposteraConCounts): Row {
  return {
    id: c.id,
    sitio_id: c.sitio_id ?? 0,
    nombre: c.nombre ?? "",
    fecha_inicio: c.fecha_inicio ? c.fecha_inicio.split("T")[0] : "",
    activa: c.activa,
    masa_inicial: c.masa_inicial != null ? String(c.masa_inicial) : "",
    estado: (c.estado as Row["estado"]) ?? (c.activa ? "activa" : "inactiva"),
    ciclos_count: c.ciclos_count ?? 0,
    mediciones_count: c.mediciones_count ?? 0,
    saveState: "idle",
    errorMsg: "",
  };
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
  const { activos: sitiosActivos, sitioId, setSitioId, loading: sitiosLoading } = useSitio();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const sitioActual = sitiosActivos.find((s) => s.id === sitioId) ?? null;

  const fetchRows = useCallback(async (sid: number) => {
    setLoading(true);
    setGlobalError("");
    try {
      const res = await fetch(`/api/sitios/${sid}/composteras?counts=1`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ComposteraConCounts[];
      setRows(data.map(toRow));
    } catch {
      setGlobalError("No se pudo cargar la lista de composteras.");
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (sitioId == null) {
      setRows([]);
      setLoading(false);
      return;
    }
    fetchRows(sitioId);
  }, [sitioId, fetchRows]);

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function crearCompostera() {
    if (sitioId == null) return;
    setCreating(true);
    setGlobalError("");
    try {
      const res = await fetch(`/api/sitios/${sitioId}/composteras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGlobalError(data.error || "No se pudo crear la compostera.");
        setCreating(false);
        return;
      }
      await fetchRows(sitioId);
    } catch {
      setGlobalError("Error de conexión al crear.");
    }
    setCreating(false);
  }

  async function guardarFila(row: Row) {
    updateRow(row.id, { saveState: "saving", errorMsg: "" });
    const masa = row.masa_inicial.trim() === "" ? null : Number(row.masa_inicial);
    const payload = {
      composteras: [
        {
          id: row.id,
          nombre: row.nombre || null,
          fecha_inicio: row.fecha_inicio || null,
          activa: row.activa,
          masa_inicial: masa != null && !Number.isNaN(masa) ? masa : null,
          sitio_id: row.sitio_id,
        },
      ],
    };
    try {
      const res = await fetch("/api/composteras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        updateRow(row.id, { saveState: "saved" });
        setTimeout(() => updateRow(row.id, { saveState: "idle" }), 2000);
      } else {
        updateRow(row.id, { saveState: "error", errorMsg: "No se guardó" });
      }
    } catch {
      updateRow(row.id, { saveState: "error", errorMsg: "Error de conexión" });
    }
  }

  async function eliminarFila(row: Row) {
    if (row.ciclos_count > 0) return;
    if (!window.confirm(`¿Eliminar compostera #${row.id}? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/composteras/${row.id}`, { method: "DELETE" });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          updateRow(row.id, {
            ciclos_count: data.ciclos_count ?? row.ciclos_count,
            mediciones_count: data.mediciones_count ?? row.mediciones_count,
            errorMsg: "Tiene historia; usa Retirar",
          });
        } else {
          updateRow(row.id, { errorMsg: data.error || "No se pudo eliminar" });
        }
      }
    } catch {
      updateRow(row.id, { errorMsg: "Error de conexión" });
    }
  }

  async function retirarFila(row: Row) {
    if (!window.confirm(`¿Retirar compostera #${row.id}? Quedará marcada como retirada y sin actividad en el monitor.`)) return;
    try {
      const res = await fetch(`/api/composteras/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "retirada" }),
      });
      if (res.ok) {
        updateRow(row.id, { estado: "retirada", activa: false });
      } else {
        const data = await res.json().catch(() => ({}));
        updateRow(row.id, { errorMsg: data.error || "No se pudo retirar" });
      }
    } catch {
      updateRow(row.id, { errorMsg: "Error de conexión" });
    }
  }

  const masaTotal = rows.reduce((acc, r) => {
    const n = Number(r.masa_inicial);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);

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
              {sitioActual?.nombre ?? "Configuración"}
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
          <p className="text-[13px] text-gray-400 mb-4 leading-snug">
            {sitioActual
              ? `Composteras del sitio "${sitioActual.nombre}".`
              : "Elige un sitio para ver sus composteras."}
          </p>

          {sitiosActivos.length > 1 && (
            <div className="mb-4">
              <label className="input-label">Sitio activo</label>
              <select
                value={sitioId ?? ""}
                onChange={(e) => setSitioId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="input-field"
              >
                <option value="">— Elige un sitio —</option>
                {sitiosActivos.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {globalError && (
            <div className="mb-3 px-3 py-2 rounded-xl text-[13px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200">
              {globalError}
            </div>
          )}

          {sitioId == null && !sitiosLoading && (
            <div className="text-center text-gray-400 py-8 text-[13px]">
              Elige un sitio arriba para administrar sus composteras.
            </div>
          )}

          {sitioId != null && (loading || sitiosLoading) && (
            <div className="text-center text-verde-600 py-12 text-[14px] animate-pulse-fade">
              Cargando...
            </div>
          )}

          {sitioId != null && !loading && !sitiosLoading && rows.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[13px] text-gray-500 mb-4">
                Este sitio aún no tiene composteras.
              </p>
              <button
                onClick={crearCompostera}
                disabled={creating}
                className="btn-primary"
              >
                {creating ? "Creando..." : "Crear primera compostera"}
              </button>
            </div>
          )}

          {sitioId != null && !loading && rows.length > 0 && (
            <>
              <button
                onClick={crearCompostera}
                disabled={creating}
                className="w-full mb-4 px-4 py-3 rounded-xl border-2 border-dashed border-verde-300 text-verde-700 text-[13px] font-semibold transition-colors hover:border-verde-500 hover:bg-verde-50/50 active:scale-[0.98] disabled:opacity-50"
              >
                {creating ? "Creando..." : "+ Nueva compostera"}
              </button>

              <div className="flex flex-col gap-3">
                {rows.map((r) => {
                  const dias = diasDesde(r.fecha_inicio);
                  const retirada = r.estado === "retirada";
                  const puedeEliminar = r.ciclos_count === 0 && r.mediciones_count === 0;

                  return (
                    <div
                      key={r.id}
                      className={`rounded-xl p-3.5 border transition-all duration-200 ${
                        retirada
                          ? "border-gray-200 bg-gray-50 opacity-60"
                          : r.activa
                            ? "border-verde-200/60 bg-verde-50/30"
                            : "border-gray-200 bg-gray-50 opacity-70"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            retirada ? "bg-gray-400" : r.activa ? "bg-verde-500" : "bg-gray-300"
                          }`} />
                          <span className="font-semibold text-[14px] text-verde-900">#{r.id}</span>
                          {retirada && (
                            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                              Retirada
                            </span>
                          )}
                          {!retirada && dias !== null && (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-verde-600 bg-verde-100 px-2 py-0.5 rounded-full">
                              <IconLeaf />
                              D&iacute;a {dias}
                            </span>
                          )}
                        </div>
                        {!retirada && (
                          <label className="flex items-center gap-2 text-[12px] text-gray-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={r.activa}
                              onChange={(e) => updateRow(r.id, { activa: e.target.checked })}
                              className="w-4 h-4 accent-verde-700 rounded"
                            />
                            Activa
                          </label>
                        )}
                      </div>

                      {(r.ciclos_count > 0 || r.mediciones_count > 0) && (
                        <div className="text-[11px] text-gray-500 mb-2">
                          {r.ciclos_count} ciclo{r.ciclos_count === 1 ? "" : "s"} · {r.mediciones_count} medici{r.mediciones_count === 1 ? "ón" : "ones"}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-verde-700/50 uppercase tracking-wider block mb-1">
                            Nombre
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: Pila norte"
                            value={r.nombre}
                            disabled={retirada}
                            onChange={(e) => updateRow(r.id, { nombre: e.target.value })}
                            className="w-full px-2.5 py-2 border border-verde-200/50 rounded-lg text-[13px] bg-white outline-none focus:border-verde-400 transition-colors disabled:bg-gray-100"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-verde-700/50 uppercase tracking-wider block mb-1">
                            Fecha de inicio
                          </label>
                          <input
                            type="date"
                            value={r.fecha_inicio}
                            disabled={retirada}
                            onChange={(e) => updateRow(r.id, { fecha_inicio: e.target.value })}
                            className="w-full px-2.5 py-2 border border-verde-200/50 rounded-lg text-[13px] bg-white outline-none focus:border-verde-400 transition-colors disabled:bg-gray-100"
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
                            value={r.masa_inicial}
                            disabled={retirada}
                            onChange={(e) => updateRow(r.id, { masa_inicial: e.target.value })}
                            className="w-full px-2.5 py-2 border border-verde-200/50 rounded-lg text-[13px] bg-white outline-none focus:border-verde-400 transition-colors disabled:bg-gray-100"
                          />
                        </div>
                      </div>

                      {!retirada && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => guardarFila(r)}
                            disabled={r.saveState === "saving"}
                            className="flex-1 px-3 py-2 rounded-lg bg-verde-700 text-white text-[12px] font-semibold shadow-card transition-all active:scale-[0.98] disabled:bg-gray-300"
                          >
                            {r.saveState === "saving"
                              ? "Guardando..."
                              : r.saveState === "saved"
                                ? "✓ Guardado"
                                : "Guardar"}
                          </button>
                          {puedeEliminar ? (
                            <button
                              onClick={() => eliminarFila(r)}
                              className="px-3 py-2 rounded-lg text-[12px] font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 active:scale-[0.98] transition-all"
                            >
                              Eliminar
                            </button>
                          ) : (
                            <button
                              onClick={() => retirarFila(r)}
                              className="px-3 py-2 rounded-lg text-[12px] font-semibold text-tierra-600 bg-white border border-tierra-200 hover:bg-crema-200 active:scale-[0.98] transition-all"
                              title="Tiene historia — no se puede borrar, pero sí retirar"
                            >
                              Retirar
                            </button>
                          )}
                        </div>
                      )}

                      {r.errorMsg && (
                        <div className="mt-2 text-[11px] font-semibold text-red-600">{r.errorMsg}</div>
                      )}

                      <div className="mt-3 flex flex-col gap-1">
                        <Link
                          href={`/configuracion/composteras/${r.id}/ciclos`}
                          className="flex items-center justify-between text-[12px] font-medium text-verde-700 hover:text-verde-900 transition-colors"
                        >
                          <span>Ciclos de esta compostera</span>
                          <span className="text-base leading-none">→</span>
                        </Link>
                        <Link
                          href={`/configuracion/composteras/${r.id}`}
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

              <div className="mt-5 rounded-xl border border-verde-200/60 bg-verde-50/60 px-4 py-3 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-verde-700 uppercase tracking-wider">
                  Masa total de composta
                </span>
                <span className="text-[18px] font-bold text-verde-900 tabular-nums">
                  {masaTotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg
                </span>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
