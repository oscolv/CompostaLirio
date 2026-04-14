"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type { Medicion } from "@/lib/types";
import { estadoCardConfig, getEstadoSimple } from "@/lib/estado";
import { humedadLabel } from "@/lib/humedad";
import { uploadFoto } from "@/lib/foto";
import { IconDownload, IconCamera } from "@/components/ui/icons";
import { FotoModal } from "@/components/ui/FotoModal";
import { AnalisisBadge } from "@/components/ui/AnalisisBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { useFotoModal } from "@/hooks/useFotoModal";
import { TemperatureChart } from "@/components/charts/TemperatureChart";

export default function Historial() {
  const [mediciones, setMediciones] = useState<Medicion[]>([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    compostera: number; dia: string; temperatura: string; ph: string; humedad: string; observaciones: string;
  }>({ compostera: 1, dia: "", temperatura: "", ph: "", humedad: "", observaciones: "" });
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
      if (filtro) qs.set("compostera", filtro);
      qs.set("t", String(Date.now()));
      const res = await fetch(`/api/mediciones?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setMediciones(await res.json());
    } catch {
      setError("No se pudo conectar a la base de datos.");
    }
    setLoading(false);
  }, [filtro]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete(id: number) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setDeleting(id);
    try {
      const res = await fetch(`/api/mediciones?id=${id}`, { method: "DELETE" });
      if (res.ok) setMediciones((prev) => prev.filter((m) => m.id !== id));
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
      let fotoUrl: string | null | undefined = undefined;
      if (editFoto) {
        setEditFotoUploading(true);
        try {
          fotoUrl = await uploadFoto(editFoto);
        } catch (e) {
          setEditFotoUploading(false);
          setSaving(false);
          alert(e instanceof Error ? `No se pudo subir la foto: ${e.message}` : "No se pudo subir la foto.");
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
          temperatura: t, ph: p, humedad: h,
          observaciones: editForm.observaciones || null,
          estado,
          ...(fotoUrl !== undefined ? { foto_url: fotoUrl } : {}),
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
  const fotoModal = useFotoModal();

  useEffect(() => { setShowChart(false); }, [filtro]);

  const tempPoints = filtro
    ? mediciones
        .filter((m) => typeof m.temperatura === "number" && !isNaN(m.temperatura))
        .map((m) => ({ fecha: new Date(m.created_at), temperatura: Number(m.temperatura) }))
    : [];
  const canShowChart = !!filtro && tempPoints.length > 0;

  async function downloadCSV() {
    setDownloading(true);
    try {
      const params = filtro ? `?compostera=${filtro}` : "";
      const res = await fetch(`/api/mediciones/export${params}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `composta-lirio-mediciones${filtro ? `-compostera-${filtro}` : ""}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setDownloading(false);
  }

  const totalMediciones = mediciones.length;

  return (
    <div className="min-h-screen">
      <PageHeader
        kicker="Bitácora · Sección II"
        title="Historial."
        subtitle="Cada entrada del cuaderno de campo, con sus temperaturas, pH y humedad. Filtra por compostera para visualizar la evolución."
        folio={`${totalMediciones} ENTRADAS · ${filtro ? `COMPOSTERA ${filtro}` : "TODAS"}`}
        nav={[
          { href: "/", label: "Índice" },
          { href: "/historial", label: "Historial", active: true },
          { href: "/consultas", label: "Consultas" },
          { href: "/configuracion", label: "Configuración" },
        ]}
      />

      <main className="max-w-[960px] mx-auto px-5 md:px-8 py-8 md:py-10">
        {/* Filtros & acciones */}
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="input-field sm:flex-1"
          >
            <option value="">Todas las composteras</option>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Compostera #{i + 1}</option>
            ))}
          </select>
          <button
            onClick={downloadCSV}
            disabled={downloading}
            className="btn-outline sm:w-auto"
          >
            <IconDownload />
            {downloading ? "Descargando…" : "Exportar CSV"}
          </button>
        </div>

        {canShowChart && (
          <div className="mb-6">
            <button
              onClick={() => setShowChart((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-md bg-papel-50 border border-tinta-900/10 text-tinta-800 text-[12px] font-semibold uppercase tracking-kicker hover:border-tinta-600 transition-all"
            >
              <span>{showChart ? "Ocultar gráfica de temperatura" : "Mostrar gráfica de temperatura"}</span>
              <span className="font-mono text-tinta-500">{showChart ? "−" : "+"}</span>
            </button>
            {showChart && (
              <div className="mt-3 page-card page-card--flush animate-fade-in">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="kicker">Serie temporal</div>
                  <div className="font-mono text-[11px] text-tinta-500 tabular-nums">
                    {tempPoints.length} PUNTOS
                  </div>
                </div>
                <TemperatureChart puntos={tempPoints} />
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="text-center text-tinta-600 py-16 text-[12px] uppercase tracking-kicker font-semibold animate-pulse-fade">
            Cargando mediciones…
          </div>
        )}

        {error && (
          <div className="page-card border-arcilla-200 bg-arcilla-50 text-[13px] text-arcilla-700">
            {error}
          </div>
        )}

        {!loading && !error && mediciones.length === 0 && (
          <EmptyState
            kicker="Sin entradas"
            title="Aún no hay mediciones."
            body="Cuando guardes una medición desde el índice, aparecerá aquí como una ficha de bitácora."
          />
        )}

        <div className="flex flex-col gap-3">
          {mediciones.map((m, idx) => {
            const est = estadoCardConfig[m.estado] || estadoCardConfig.good;
            const fecha = new Date(m.created_at);
            const isOpen = expandido === m.id;
            const tone = m.estado === "warning" ? "bg-ocre-400" : m.estado === "danger" ? "bg-arcilla-500" : "bg-tinta-500";
            return (
              <div
                key={m.id}
                onClick={() => { if (confirmDelete !== m.id && editando !== m.id) setExpandido(isOpen ? null : m.id); }}
                className={`group relative rounded-md border cursor-pointer transition-all bg-papel-50 hover:border-tinta-600 ${est.border}`}
              >
                {/* Barra lateral de estado */}
                <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-sm ${tone}`} />

                <div className="pl-5 pr-4 py-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[10.5px] text-tinta-500 tabular-nums">
                        N.º {String(totalMediciones - idx).padStart(3, "0")}
                      </span>
                      <span className="font-display font-semibold text-[15px] text-tinta-900">
                        Compostera #{m.compostera}
                      </span>
                    </div>
                    <span className="font-mono text-[10.5px] text-tinta-500 tabular-nums uppercase">
                      {fecha.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                      {" · "}
                      {fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <MiniStat label="Temp" value={m.temperatura} unit="°C" />
                    <MiniStat label="pH" value={m.ph} unit="" />
                    <MiniStat label="Humedad" value={humedadLabel(m.humedad)} unit="" textual />
                  </div>

                  {m.foto_url && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); fotoModal.open(m.foto_url); }}
                        className="group/photo relative w-20 h-20 rounded-sm overflow-hidden border border-tinta-900/20 active:scale-95 transition-transform"
                        aria-label="Ver foto en grande"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.foto_url} alt={`Foto compostera #${m.compostera}`} className="w-full h-full object-cover" />
                        <span className="absolute inset-0 bg-tinta-900/0 group-hover/photo:bg-tinta-900/30 transition-colors" />
                      </button>
                    </div>
                  )}

                  {(m.dia || m.observaciones) && (
                    <div className="mt-3 pt-3 border-t border-tinta-900/8 flex flex-col gap-1">
                      {m.dia && (
                        <div className="font-mono text-[11px] text-tinta-600 tabular-nums uppercase tracking-wider">
                          Día {m.dia} del proceso
                        </div>
                      )}
                      {m.observaciones && (
                        <div className="text-[12.5px] text-tinta-700 italic font-display">
                          “{m.observaciones}”
                        </div>
                      )}
                    </div>
                  )}

                  {isOpen && editando !== m.id && (
                    <div className="mt-3 pt-3 border-t border-tinta-900/8 flex items-center justify-between animate-fade-in">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); startEdit(m); }}
                          className="px-3 py-1.5 rounded-sm text-[10.5px] font-semibold uppercase tracking-kicker bg-tinta-50 text-tinta-700 hover:bg-tinta-100 transition-all"
                        >
                          Editar
                        </button>
                        {m.foto_url && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); fotoModal.open(m.foto_url); }}
                            className="px-3 py-1.5 rounded-sm text-[10.5px] font-semibold uppercase tracking-kicker bg-dato-50 text-dato-600 hover:bg-dato-100 transition-all"
                          >
                            Ver foto
                          </button>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                        disabled={deleting === m.id}
                        className={`px-3 py-1.5 rounded-sm text-[10.5px] font-semibold uppercase tracking-kicker transition-all ${
                          confirmDelete === m.id
                            ? "bg-arcilla-500 text-papel-50"
                            : "bg-arcilla-50 text-arcilla-600 hover:bg-arcilla-100"
                        } disabled:opacity-50`}
                      >
                        {deleting === m.id ? "Borrando…" : confirmDelete === m.id ? "Confirmar" : "Borrar"}
                      </button>
                    </div>
                  )}

                  {editando === m.id && (
                    <div className="mt-3 pt-3 border-t border-tinta-900/8 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                      <div className="kicker mb-3">Editar entrada</div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="input-label">Compostera</label>
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
                          <label className="input-label">Día</label>
                          <input
                            type="number"
                            value={editForm.dia}
                            onChange={(e) => setEditForm({ ...editForm, dia: e.target.value })}
                            placeholder="—"
                            className="input-field text-[13px] py-2 font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div>
                          <label className="input-label">Temp °C</label>
                          <input
                            type="number" step="0.1"
                            value={editForm.temperatura}
                            onChange={(e) => setEditForm({ ...editForm, temperatura: e.target.value })}
                            className="input-field text-[13px] py-2 text-center font-mono"
                          />
                        </div>
                        <div>
                          <label className="input-label">pH</label>
                          <input
                            type="number" step="0.1"
                            value={editForm.ph}
                            onChange={(e) => setEditForm({ ...editForm, ph: e.target.value })}
                            className="input-field text-[13px] py-2 text-center font-mono"
                          />
                        </div>
                        <div>
                          <label className="input-label">Humedad %</label>
                          <input
                            type="number" step="1"
                            value={editForm.humedad}
                            onChange={(e) => setEditForm({ ...editForm, humedad: e.target.value })}
                            className="input-field text-[13px] py-2 text-center font-mono"
                          />
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="input-label">Observaciones</label>
                        <input
                          type="text"
                          value={editForm.observaciones}
                          onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                          placeholder="Opcional"
                          className="input-field text-[13px] py-2"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="input-label">Foto</label>
                        <input
                          ref={editFotoInput}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleEditFoto}
                          className="hidden"
                        />
                        {editFotoPreview ? (
                          <div className="relative mt-1 rounded-sm overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={editFotoPreview} alt="Preview" className="w-full h-32 object-cover" />
                            <button
                              onClick={clearEditFoto}
                              className="absolute top-1.5 right-1.5 w-6 h-6 bg-tinta-900/80 text-papel-50 rounded-full text-[14px] flex items-center justify-center"
                            >
                              ×
                            </button>
                            {editFotoUploading && (
                              <div className="absolute bottom-2 left-2 bg-papel-50/90 rounded-sm px-3 py-1">
                                <span className="text-[10px] font-semibold uppercase tracking-kicker text-tinta-700 animate-pulse-fade">Subiendo…</span>
                              </div>
                            )}
                          </div>
                        ) : !editFotoRemoved && editFotoExisting ? (
                          <div className="relative mt-1 rounded-sm overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={editFotoExisting} alt="Foto actual" className="w-full h-32 object-cover" />
                            <div className="absolute top-1.5 right-1.5 flex gap-1">
                              <button
                                onClick={() => editFotoInput.current?.click()}
                                className="w-6 h-6 bg-tinta-900/80 text-papel-50 rounded-full text-[11px] flex items-center justify-center"
                                title="Cambiar foto"
                              >
                                <IconCamera className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={clearEditFoto}
                                className="w-6 h-6 bg-tinta-900/80 text-papel-50 rounded-full text-[14px] flex items-center justify-center"
                                title="Quitar foto"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => editFotoInput.current?.click()}
                            className="mt-1 w-full flex items-center justify-center gap-2 py-3 rounded-sm border border-dashed border-tinta-300 text-tinta-600 text-[11px] font-semibold uppercase tracking-kicker hover:border-tinta-600 hover:text-tinta-900 transition-colors"
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
                            className="w-full px-4 py-2 rounded-sm bg-tinta-800 text-papel-50 text-[10.5px] font-semibold uppercase tracking-kicker transition-all active:scale-[0.99] disabled:bg-tinta-200 disabled:text-tinta-400"
                          >
                            {editAnalysis.analyzing ? "Analizando…" : "Analizar imagen"}
                          </button>
                          {editAnalysis.error && (
                            <div className="mt-2 px-3 py-1.5 rounded-sm text-[10.5px] font-semibold text-arcilla-700 bg-arcilla-50 ring-1 ring-arcilla-200">
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
                          className="flex-1 py-2.5 rounded-sm text-[10.5px] font-semibold uppercase tracking-kicker bg-tinta-800 text-papel-50 transition-all active:scale-[0.99] disabled:bg-tinta-200 disabled:text-tinta-400"
                        >
                          {saving ? "Guardando…" : "Guardar cambios"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2.5 rounded-sm text-[10.5px] font-semibold uppercase tracking-kicker bg-papel-200 text-tinta-700 hover:bg-papel-300 transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <FotoModal url={fotoModal.url} onClose={fotoModal.close} showOpenOriginal />
    </div>
  );
}

function MiniStat({ label, value, unit, textual = false }: { label: string; value: string | number; unit?: string; textual?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9.5px] font-semibold uppercase tracking-kicker text-tinta-500 mb-0.5">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className={`${textual ? "font-display text-[14px] font-semibold" : "font-mono text-[17px] font-semibold tabular-nums"} text-tinta-900 leading-none`}>
          {value}
        </span>
        {unit && <span className="font-mono text-[10px] text-tinta-500">{unit}</span>}
      </span>
    </div>
  );
}

function EmptyState({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="text-center py-16 px-6 border border-dashed border-tinta-900/15 rounded-md bg-papel-50/30">
      <div className="kicker justify-center mb-3">{kicker}</div>
      <div className="font-display text-[24px] font-black text-tinta-900 leading-tight mb-2">
        {title}
      </div>
      <p className="text-[13px] text-tinta-600 max-w-[36ch] mx-auto leading-relaxed">
        {body}
      </p>
      <Link href="/" className="btn-outline inline-flex mt-5">Ir al índice</Link>
    </div>
  );
}
