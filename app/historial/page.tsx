"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import NextImage from "next/image";
import type { Medicion } from "@/lib/types";
import { estadoCardConfig, getEstadoSimple } from "@/lib/estado";
import { humedadLabel } from "@/lib/humedad";
import { uploadFoto } from "@/lib/foto";
import { combinarFechaHora, fechaLocalDeISO, horaLocalDeISO } from "@/lib/fechas";
import { IconArrowLeft, IconDownload, IconCamera } from "@/components/ui/icons";
import { FotoModal } from "@/components/ui/FotoModal";
import { AnalisisBadge } from "@/components/ui/AnalisisBadge";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { useFotoModal } from "@/hooks/useFotoModal";
import { MetricChart } from "@/components/charts/MetricChart";
import { useSitios } from "@/hooks/useSitios";
import { useComposteras } from "@/hooks/useComposteras";
import { useCiclos } from "@/hooks/useCiclos";

type MetricaKey = "temperatura" | "ph" | "humedad";

const METRICAS: { key: MetricaKey; label: string; formatY: (v: number) => string; ariaLabel: string }[] = [
  { key: "temperatura", label: "Temp", formatY: (v) => `${v.toFixed(0)}\u00b0`, ariaLabel: "Gráfica de temperatura" },
  { key: "ph", label: "pH", formatY: (v) => v.toFixed(1), ariaLabel: "Gráfica de pH" },
  { key: "humedad", label: "Humedad", formatY: (v) => `${v.toFixed(0)}%`, ariaLabel: "Gráfica de humedad" },
];

export default function Historial() {
  const [mediciones, setMediciones] = useState<Medicion[]>([]);
  const [filtro, setFiltro] = useState("");
  const [sitioFiltro, setSitioFiltro] = useState<number | null>(null);
  const [cicloFiltro, setCicloFiltro] = useState<number | null>(null);
  const { activos: sitiosActivos } = useSitios();
  const { activas: composterasDelSitio } = useComposteras(sitioFiltro);
  const composteraIdNum = filtro ? parseInt(filtro, 10) : null;
  const { ciclos: ciclosCompostera } = useCiclos(composteraIdNum);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    compostera: number; dia: string; temperatura: string; ph: string; humedad: string; observaciones: string; fecha: string; hora: string;
  }>({ compostera: 1, dia: "", temperatura: "", ph: "", humedad: "", observaciones: "", fecha: "", hora: "" });
  const [saving, setSaving] = useState(false);
  const [editFoto, setEditFoto] = useState<File | null>(null);
  const [editFotoPreview, setEditFotoPreview] = useState("");
  const [editFotoExisting, setEditFotoExisting] = useState<string | null>(null);
  const [editFotoRemoved, setEditFotoRemoved] = useState(false);
  const [editFotoUploading, setEditFotoUploading] = useState(false);
  const editAnalysis = useImageAnalysis();
  const editFotoInput = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (cicloFiltro) qs.set("ciclo_id", String(cicloFiltro));
      else if (filtro) qs.set("compostera", filtro);
      else if (sitioFiltro) qs.set("sitio_id", String(sitioFiltro));
      qs.set("t", String(Date.now()));
      const res = await fetch(`/api/mediciones?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setMediciones(await res.json());
    } catch {
      setError("No se pudo conectar a la base de datos.");
    }
    setLoading(false);
  }, [filtro, sitioFiltro, cicloFiltro]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset downstream filters cuando cambia el de arriba.
  useEffect(() => { setFiltro(""); setCicloFiltro(null); }, [sitioFiltro]);
  useEffect(() => { setCicloFiltro(null); }, [filtro]);

  async function handleDelete(id: number) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setDeleting(id);
    try {
      const res = await fetch(`/api/mediciones?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setMediciones((prev) => prev.filter((m) => m.id !== id));
      }
    } catch { /* ignore */ }
    setDeleting(null);
    setConfirmDelete(null);
  }

  function startEdit(m: Medicion) {
    setEditando(m.id);
    setEditForm({
      compostera: m.compostera,
      dia: m.dia?.toString() ?? "",
      temperatura: m.temperatura.toString(),
      ph: m.ph.toString(),
      humedad: m.humedad.toString(),
      observaciones: m.observaciones ?? "",
      fecha: fechaLocalDeISO(m.created_at),
      hora: horaLocalDeISO(m.created_at),
    });
    setEditFoto(null);
    setEditFotoPreview("");
    setEditFotoExisting(m.foto_url);
    setEditFotoRemoved(false);
    setExpandido(m.id);
    setConfirmDelete(null);
  }

  function cancelEdit() {
    setEditando(null);
    setEditFoto(null);
    setEditFotoPreview("");
    setEditFotoRemoved(false);
    editAnalysis.reset();
  }

  async function handleEditAnalizar() {
    if (editAnalysis.analyzing) return;
    let file: File | null = editFoto;
    if (!file && !editFotoRemoved && editFotoExisting) {
      try {
        const r = await fetch(editFotoExisting);
        const blob = await r.blob();
        file = new File([blob], "existing.jpg", { type: blob.type || "image/jpeg" });
      } catch {
        editAnalysis.setError("No se pudo analizar la imagen");
        return;
      }
    }
    if (!file) return;
    const data = await editAnalysis.analizar(file);
    if (data) {
      setEditForm((prev) => ({
        ...prev,
        observaciones: prev.observaciones.trim()
          ? `${prev.observaciones.trim()} ${data.resultado}`
          : data.resultado,
      }));
    }
  }

  function handleEditFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditFoto(file);
    setEditFotoPreview(URL.createObjectURL(file));
    setEditFotoRemoved(false);
  }

  function clearEditFoto() {
    setEditFoto(null);
    setEditFotoPreview("");
    setEditFotoRemoved(true);
    if (editFotoInput.current) editFotoInput.current.value = "";
  }

  async function handleSaveEdit(id: number) {
    const t = parseFloat(editForm.temperatura);
    const p = parseFloat(editForm.ph);
    const h = parseFloat(editForm.humedad);
    if (isNaN(t) || isNaN(p) || isNaN(h)) return;

    setSaving(true);
    try {
      // Upload new photo if selected
      let fotoUrl: string | null | undefined = undefined;
      if (editFoto) {
        setEditFotoUploading(true);
        try {
          fotoUrl = await uploadFoto(editFoto);
        } catch (e) {
          setEditFotoUploading(false);
          setSaving(false);
          alert(
            e instanceof Error
              ? `No se pudo subir la foto: ${e.message}`
              : "No se pudo subir la foto.",
          );
          return;
        }
        setEditFotoUploading(false);
      } else if (editFotoRemoved) {
        fotoUrl = null;
      }

      const estado = getEstadoSimple(t, p, h);
      const res = await fetch("/api/mediciones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          compostera: editForm.compostera,
          dia: editForm.dia ? parseInt(editForm.dia) : null,
          temperatura: t,
          ph: p,
          humedad: h,
          observaciones: editForm.observaciones || null,
          estado,
          ...(fotoUrl !== undefined ? { foto_url: fotoUrl } : {}),
          ...(editForm.fecha && editForm.hora
            ? { fecha: combinarFechaHora(editForm.fecha, editForm.hora) }
            : {}),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMediciones((prev) => prev.map((m) => m.id === id ? { ...m, ...updated } : m));
        setEditando(null);
        setEditFoto(null);
        setEditFotoPreview("");
        setEditFotoRemoved(false);
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  const [downloading, setDownloading] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [metrica, setMetrica] = useState<MetricaKey>("temperatura");
  const fotoModal = useFotoModal();

  useEffect(() => { setShowChart(false); }, [filtro, cicloFiltro]);

  const chartPoints = (filtro || cicloFiltro)
    ? mediciones
        .filter((m) => typeof m[metrica] === "number" && !isNaN(m[metrica] as number))
        .map((m) => ({ fecha: new Date(m.created_at), valor: Number(m[metrica]) }))
    : [];
  const canShowChart = (!!filtro || !!cicloFiltro) && chartPoints.length > 0;
  const metricaActiva = METRICAS.find((m) => m.key === metrica) ?? METRICAS[0];
  const chartTituloSufijo = cicloFiltro
    ? `Ciclo #${cicloFiltro}`
    : filtro ? `Compostera #${filtro}` : "";

  async function downloadCSV() {
    setDownloading(true);
    try {
      let query = "";
      let nombreArchivo = "";
      if (cicloFiltro) {
        query = `?ciclo_id=${cicloFiltro}`;
        nombreArchivo = `-ciclo-${cicloFiltro}`;
      } else if (filtro) {
        query = `?compostera=${filtro}`;
        nombreArchivo = `-compostera-${filtro}`;
      }
      const res = await fetch(`/api/mediciones/export${query}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `composta-lirio-mediciones${nombreArchivo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setDownloading(false);
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
              Historial
            </h1>
          </div>
          <Link href="/" className="flex items-center gap-1.5 text-[13px] font-medium text-verde-100 hover:text-white transition-colors">
            <IconArrowLeft /> Volver al monitor
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        <div className="flex flex-col gap-2 mb-4">
          {sitiosActivos.length > 1 && (
            <select
              value={sitioFiltro ?? ""}
              onChange={(e) => setSitioFiltro(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="input-field"
            >
              <option value="">Todos los sitios</option>
              {sitiosActivos.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="input-field flex-1"
            >
              <option value="">Todas las composteras</option>
              {(composterasDelSitio.length > 0
                ? composterasDelSitio
                : Array.from({ length: 10 }, (_, i) => ({ id: i + 1, nombre: null } as { id: number; nombre: string | null }))
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  Compostera #{c.id}{c.nombre ? ` — ${c.nombre}` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={downloadCSV}
              disabled={downloading}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-verde-700 text-white text-[13px] font-semibold shadow-card transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none"
            >
              <IconDownload />
              {downloading ? "Descargando..." : "CSV"}
            </button>
          </div>
          {filtro && ciclosCompostera.length > 0 && (
            <select
              value={cicloFiltro ?? ""}
              onChange={(e) => setCicloFiltro(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="input-field"
            >
              <option value="">Todos los ciclos</option>
              {ciclosCompostera.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre || `Ciclo #${c.id}`} — {c.fecha_inicio.split("T")[0]}
                  {c.estado !== "activo" ? ` (${c.estado})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {canShowChart && (
          <div className="mb-4">
            <button
              onClick={() => setShowChart((v) => !v)}
              className="w-full px-4 py-2.5 rounded-xl bg-verde-50 text-verde-700 text-[13px] font-semibold hover:bg-verde-100 transition-all active:scale-[0.98]"
            >
              {showChart ? "Ocultar gr\u00e1fica" : "Mostrar gr\u00e1fica"}
            </button>
            {showChart && (
              <div className="mt-3 rounded-2xl p-4 border border-verde-100 bg-white shadow-card animate-fade-in">
                <div className="flex gap-1.5 mb-3 p-1 bg-verde-50 rounded-xl">
                  {METRICAS.map((m) => {
                    const active = metrica === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setMetrica(m.key)}
                        className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all ${
                          active
                            ? "bg-white text-verde-800 shadow-card"
                            : "text-verde-700/70 hover:text-verde-800"
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[13px] font-semibold text-verde-800 mb-2">
                  Evoluci&oacute;n de {metricaActiva.label.toLowerCase()} {chartTituloSufijo}
                </div>
                <MetricChart
                  puntos={chartPoints}
                  formatY={metricaActiva.formatY}
                  ariaLabel={`${metricaActiva.ariaLabel} ${chartTituloSufijo}`}
                />
              </div>
            )}
          </div>
        )}

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
            const est = estadoCardConfig[m.estado] || estadoCardConfig.good;
            const fecha = new Date(m.created_at);
            const isOpen = expandido === m.id;
            return (
              <div
                key={m.id}
                onClick={() => { if (confirmDelete !== m.id && editando !== m.id) setExpandido(isOpen ? null : m.id); }}
                className={`rounded-2xl p-4 border shadow-card cursor-pointer transition-shadow hover:shadow-card-hover ${est.bg} ${est.border}`}
              >
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
                    { label: "Humedad", value: humedadLabel(m.humedad) },
                  ].map((d) => (
                    <div key={d.label} className="bg-white/60 rounded-lg px-2.5 py-2 text-center">
                      <div className="text-[10px] font-semibold text-verde-700/50 uppercase tracking-wider">{d.label}</div>
                      <div className="text-[15px] font-semibold text-gray-800 mt-0.5">{d.value}</div>
                    </div>
                  ))}
                </div>
                {m.foto_url && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); fotoModal.open(m.foto_url); }}
                      className="group relative w-20 h-20 rounded-lg overflow-hidden border border-white/60 shadow-sm active:scale-95 transition-transform"
                      aria-label="Ver foto en grande"
                    >
                      <img
                        src={m.foto_url}
                        alt={`Foto compostera #${m.compostera}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                      </span>
                    </button>
                  </div>
                )}
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
                {isOpen && editando !== m.id && (
                  <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(m); }}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-verde-50 text-verde-700 hover:bg-verde-100 transition-all"
                      >
                        Editar
                      </button>
                      {m.foto_url && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); fotoModal.open(m.foto_url); }}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
                        >
                          Ver foto
                        </button>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                      disabled={deleting === m.id}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                        confirmDelete === m.id
                          ? "bg-red-500 text-white"
                          : "bg-red-50 text-red-600 hover:bg-red-100"
                      } disabled:opacity-50`}
                    >
                      {deleting === m.id ? "Borrando..." : confirmDelete === m.id ? "Confirmar borrar" : "Borrar registro"}
                    </button>
                  </div>
                )}
                {editando === m.id && (
                  <div className="mt-3 pt-3 border-t border-black/5 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                    <div className="text-[12px] font-semibold text-verde-700 uppercase tracking-wider mb-3">
                      Editar registro
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase">Compostera</label>
                        <select
                          value={editForm.compostera}
                          onChange={(e) => setEditForm({ ...editForm, compostera: parseInt(e.target.value) })}
                          className="input-field text-[13px] py-2"
                        >
                          {Array.from({ length: 10 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>#{i + 1}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase">D&iacute;a</label>
                        <input
                          type="number"
                          value={editForm.dia}
                          onChange={(e) => setEditForm({ ...editForm, dia: e.target.value })}
                          placeholder="—"
                          className="input-field text-[13px] py-2"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase">Fecha</label>
                        <input
                          type="date"
                          value={editForm.fecha}
                          onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })}
                          className="input-field text-[13px] py-2"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase">Hora</label>
                        <input
                          type="time"
                          value={editForm.hora}
                          onChange={(e) => setEditForm({ ...editForm, hora: e.target.value })}
                          className="input-field text-[13px] py-2"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase">Temp &deg;C</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editForm.temperatura}
                          onChange={(e) => setEditForm({ ...editForm, temperatura: e.target.value })}
                          className="input-field text-[13px] py-2 text-center"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase">pH</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editForm.ph}
                          onChange={(e) => setEditForm({ ...editForm, ph: e.target.value })}
                          className="input-field text-[13px] py-2 text-center"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase">Humedad %</label>
                        <input
                          type="number"
                          step="1"
                          value={editForm.humedad}
                          onChange={(e) => setEditForm({ ...editForm, humedad: e.target.value })}
                          className="input-field text-[13px] py-2 text-center"
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase">Observaciones</label>
                      <input
                        type="text"
                        value={editForm.observaciones}
                        onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                        placeholder="Opcional"
                        className="input-field text-[13px] py-2"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase">Foto</label>
                      <input
                        ref={editFotoInput}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleEditFoto}
                        className="hidden"
                      />
                      {editFotoPreview ? (
                        <div className="relative mt-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={editFotoPreview} alt="Preview" className="w-full h-32 object-cover rounded-xl" />
                          <button
                            onClick={clearEditFoto}
                            className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 text-white rounded-full text-[14px] flex items-center justify-center"
                          >
                            &times;
                          </button>
                          {editFotoUploading && (
                            <div className="absolute bottom-2 left-2 bg-white/90 rounded-full px-3 py-1">
                              <span className="text-[11px] font-semibold text-verde-700 animate-pulse-fade">Subiendo foto...</span>
                            </div>
                          )}
                        </div>
                      ) : !editFotoRemoved && editFotoExisting ? (
                        <div className="relative mt-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={editFotoExisting} alt="Foto actual" className="w-full h-32 object-cover rounded-xl" />
                          <div className="absolute top-1.5 right-1.5 flex gap-1">
                            <button
                              onClick={() => editFotoInput.current?.click()}
                              className="w-6 h-6 bg-black/50 text-white rounded-full text-[11px] flex items-center justify-center"
                              title="Cambiar foto"
                            >
                              <IconCamera className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={clearEditFoto}
                              className="w-6 h-6 bg-black/50 text-white rounded-full text-[14px] flex items-center justify-center"
                              title="Quitar foto"
                            >
                              &times;
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => editFotoInput.current?.click()}
                          className="mt-1 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-verde-200 text-verde-600 text-[12px] font-medium hover:bg-verde-50/50 transition-colors"
                        >
                          <IconCamera className="w-4 h-4" />
                          {editFotoRemoved ? "Agregar foto" : "Tomar o cargar foto"}
                        </button>
                      )}
                    </div>
                    {(editFoto || (!editFotoRemoved && editFotoExisting)) && (
                      <div className="mb-3">
                        <button
                          type="button"
                          onClick={handleEditAnalizar}
                          disabled={editAnalysis.analyzing}
                          className="w-full px-4 py-2 rounded-lg bg-verde-700 text-white text-[12px] font-semibold transition-all active:scale-[0.98] disabled:bg-gray-300"
                        >
                          {editAnalysis.analyzing ? "Analizando..." : "Analizar imagen"}
                        </button>
                        {editAnalysis.error && (
                          <div className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200">
                            {editAnalysis.error}
                          </div>
                        )}
                        <AnalisisBadge estado={editAnalysis.data?.estado} accion={editAnalysis.data?.accion} compact />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(m.id)}
                        disabled={saving || !editForm.temperatura || !editForm.ph || !editForm.humedad}
                        className="flex-1 py-2 rounded-lg text-[12px] font-semibold bg-verde-700 text-white transition-all active:scale-[0.98] disabled:bg-gray-300"
                      >
                        {saving ? "Guardando..." : "Guardar cambios"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <FotoModal url={fotoModal.url} onClose={fotoModal.close} showOpenOriginal />
    </div>
  );
}
