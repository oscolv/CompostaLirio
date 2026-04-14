"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

type Formulacion = {
  id: number;
  nombre: string;
  base_calculo: string;
  activa: boolean;
};

type Asociacion = {
  asociacion_id: number;
  compostera_id: number;
  formulacion_id: number;
  fecha_asociacion: string;
  es_actual: boolean;
  asociacion_notas: string | null;
  asociacion_created_at: string;
  // columnas de formulaciones (JOIN)
  nombre: string;
  base_calculo: string;
  tipo_excreta: string | null;
  nivel_estructura: string | null;
};

type Compostera = {
  id: number;
  nombre: string | null;
  fecha_inicio: string | null;
  activa: boolean;
  masa_inicial: number | null;
};

function IconPlus() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function hoyISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatoFecha(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ComposteraDetailPage() {
  const params = useParams<{ id: string }>();
  const composteraId = Number(params?.id);

  const [compostera, setCompostera] = useState<Compostera | null>(null);
  const [asociaciones, setAsociaciones] = useState<Asociacion[]>([]);
  const [formulaciones, setFormulaciones] = useState<Formulacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [selFormId, setSelFormId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(hoyISO());
  const [notas, setNotas] = useState<string>("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function eliminarAsociacion(asocId: number) {
    if (!confirm("¿Eliminar esta formulación asociada?")) return;
    setDeletingId(asocId);
    setMensaje("");
    try {
      const r = await fetch(
        `/api/composteras/${composteraId}/formulaciones/${asocId}`,
        { method: "DELETE" },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Error al eliminar");
      await cargar();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "Error");
    } finally {
      setDeletingId(null);
    }
  }

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const t = Date.now();
      const [compRes, asocRes, formRes] = await Promise.all([
        fetch(`/api/composteras?t=${t}`, { cache: "no-store" }),
        fetch(`/api/composteras/${composteraId}/formulaciones?t=${t}`, { cache: "no-store" }),
        fetch(`/api/formulaciones?t=${t}`, { cache: "no-store" }),
      ]);
      const comps = (await compRes.json()) as Compostera[];
      const asocs = (await asocRes.json()) as Asociacion[];
      const forms = (await formRes.json()) as Formulacion[];
      setCompostera(Array.isArray(comps) ? comps.find((c) => c.id === composteraId) ?? null : null);
      setAsociaciones(Array.isArray(asocs) ? asocs : []);
      setFormulaciones(Array.isArray(forms) ? forms : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (Number.isFinite(composteraId)) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composteraId]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");
    if (!selFormId) {
      setMensaje("Selecciona una formulación");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/composteras/${composteraId}/formulaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formulacion_id: Number(selFormId),
          fecha: fecha || null,
          notas: notas.trim() || null,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Error al asociar");
      setSelFormId("");
      setNotas("");
      setFecha(hoyISO());
      setShowForm(false);
      setMensaje("Formulación asociada");
      setTimeout(() => setMensaje(""), 2500);
      await cargar();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const titulo = compostera?.nombre
    ? `${compostera.nombre}`
    : `Compostera #${composteraId}`;

  return (
    <div className="min-h-screen bg-crema-100">
      <PageHeader
        kicker={`Compostera · N.º ${String(composteraId).padStart(2, "0")}`}
        title={titulo}
        subtitle="Detalle de la compostera, formulaciones asociadas y su evolución en el proceso."
        backHref="/configuracion"
        backLabel="Volver a configuración"
      />

      <main className="max-w-[960px] mx-auto px-5 md:px-8 py-8">
        {loading && (
          <div className="text-center text-verde-600 py-8 text-[14px] animate-pulse-fade">
            Cargando...
          </div>
        )}

        {error && (
          <div className="page-card border-red-200 bg-red-50 text-[14px] text-red-700 mb-4">
            {error}
          </div>
        )}

        {!loading && compostera && (
          <div className="page-card mb-4">
            <h2 className="text-[15px] font-semibold text-verde-900 mb-2">Datos</h2>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-gray-400">Nombre</dt>
              <dd className="text-verde-900 text-right">{compostera.nombre || "—"}</dd>
              <dt className="text-gray-400">Fecha inicio</dt>
              <dd className="text-verde-900 text-right">
                {compostera.fecha_inicio ? formatoFecha(compostera.fecha_inicio) : "—"}
              </dd>
              <dt className="text-gray-400">Masa inicial</dt>
              <dd className="text-verde-900 text-right">
                {compostera.masa_inicial != null ? `${compostera.masa_inicial} kg` : "—"}
              </dd>
              <dt className="text-gray-400">Estado</dt>
              <dd className="text-right">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    compostera.activa ? "bg-verde-100 text-verde-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {compostera.activa ? "Activa" : "Inactiva"}
                </span>
              </dd>
            </dl>
          </div>
        )}

        {/* --- Formulaciones asociadas --- */}
        <section className="page-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-verde-900">Formulaciones asociadas</h2>
          </div>

          {!showForm && (
            <button
              onClick={() => {
                setMensaje("");
                setShowForm(true);
              }}
              className="btn-primary flex items-center justify-center gap-2 mb-4"
            >
              <IconPlus /> Agregar formulación
            </button>
          )}

          {showForm && (
            <form
              onSubmit={guardar}
              className="rounded-xl border border-verde-200 bg-verde-50/40 p-3 flex flex-col gap-3 mb-4"
            >
              <div>
                <label className="text-[11px] font-semibold text-verde-700/70 uppercase tracking-wider block mb-1">
                  Formulación *
                </label>
                <select
                  required
                  value={selFormId}
                  onChange={(e) => setSelFormId(e.target.value)}
                  className="input-field"
                >
                  <option value="">— Selecciona una —</option>
                  {formulaciones.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre} ({f.base_calculo})
                    </option>
                  ))}
                </select>
                {formulaciones.length === 0 && (
                  <p className="text-[12px] text-gray-500 mt-1">
                    No hay formulaciones.{" "}
                    <Link href="/configuracion/formulaciones" className="text-verde-700 underline">
                      Crear una
                    </Link>
                    .
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-verde-700/70 uppercase tracking-wider block mb-1">
                  Fecha de asociación
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-verde-700/70 uppercase tracking-wider block mb-1">
                  Notas
                </label>
                <textarea
                  rows={2}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="input-field resize-none"
                  placeholder="Observaciones (opcional)"
                />
              </div>

              {mensaje && (
                <div
                  className={`text-[13px] font-medium text-center ${
                    mensaje === "Formulación asociada" ? "text-verde-600" : "text-red-600"
                  }`}
                >
                  {mensaje}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setMensaje("");
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border border-verde-200 text-verde-800 font-semibold text-[14px] bg-white active:scale-95 transition-transform"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !selFormId}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          )}

          {asociaciones.length === 0 && !showForm && (
            <p className="text-center text-gray-400 py-4 text-[13px]">
              Sin formulaciones asociadas aún.
            </p>
          )}

          {asociaciones.length > 0 && (
            <ol className="flex flex-col gap-2.5">
              {asociaciones.map((a) => (
                <li
                  key={a.asociacion_id}
                  className={`rounded-xl p-3 border ${
                    a.es_actual
                      ? "border-verde-300 bg-verde-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[14px] text-verde-900 leading-tight">
                          {a.nombre}
                        </span>
                        {a.es_actual && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-verde-700 text-white">
                            Actual
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-gray-500 mt-0.5">
                        {formatoFecha(a.fecha_asociacion)}
                      </div>
                      {a.asociacion_notas && (
                        <p className="text-[12px] text-gray-600 mt-1 italic leading-snug">
                          {a.asociacion_notas}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarAsociacion(a.asociacion_id)}
                      disabled={deletingId === a.asociacion_id}
                      className="shrink-0 text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 px-2 py-1"
                      aria-label="Eliminar formulación asociada"
                    >
                      {deletingId === a.asociacion_id ? "..." : "Eliminar"}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}
