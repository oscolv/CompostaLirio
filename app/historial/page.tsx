"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

type Medicion = {
  id: number;
  compostera: number;
  dia: number | null;
  temperatura: number;
  ph: number;
  humedad: number;
  observaciones: string | null;
  estado: string;
  foto_url: string | null;
  created_at: string;
};

const estadoConfig: Record<string, { dot: string; bg: string; border: string }> = {
  good: { dot: "bg-verde-500", bg: "bg-verde-50/50", border: "border-verde-200/60" },
  warning: { dot: "bg-amber-500", bg: "bg-amber-50/50", border: "border-amber-200/60" },
  danger: { dot: "bg-red-500", bg: "bg-red-50/50", border: "border-red-200/60" },
};

function IconArrowLeft() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

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
  const editFotoInput = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = filtro ? `?compostera=${filtro}` : "";
      const res = await fetch(`/api/mediciones${params}`);
      if (!res.ok) throw new Error();
      setMediciones(await res.json());
    } catch {
      setError("No se pudo conectar a la base de datos.");
    }
    setLoading(false);
  }, [filtro]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
  }

  function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => resolve(new File([blob!], file.name, { type: "image/jpeg" })),
          "image/jpeg",
          quality,
        );
      };
      img.src = URL.createObjectURL(file);
    });
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

  function getEstado(temp: number, ph: number, hum: number): string {
    if (temp < 25 || temp > 70 || ph < 4.5 || ph > 9 || hum < 35 || hum > 80) return "danger";
    if (temp < 40 || temp > 65 || ph < 5.5 || ph > 8.5 || hum < 45 || hum > 70) return "warning";
    return "good";
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
        const compressed = await compressImage(editFoto);
        const formData = new FormData();
        formData.append("foto", compressed);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        setEditFotoUploading(false);
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          fotoUrl = data.url;
        }
      } else if (editFotoRemoved) {
        fotoUrl = null;
      }

      const estado = getEstado(t, p, h);
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

  function downloadCSV() {
    if (mediciones.length === 0) return;
    const header = "ID,Compostera,Dia,Temperatura,pH,Humedad,Estado,Observaciones,Fecha";
    const rows = mediciones.map((m) => {
      const fecha = new Date(m.created_at).toLocaleString("es-MX");
      const obs = (m.observaciones || "").replace(/"/g, '""');
      return `${m.id},${m.compostera},${m.dia ?? ""},${m.temperatura},${m.ph},${m.humedad},${m.estado},"${obs}","${fecha}"`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `composta-lirio-mediciones${filtro ? `-compostera-${filtro}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-crema-100">
      <header className="bg-gradient-to-br from-verde-800 to-verde-950 px-5 py-6 text-white relative overflow-hidden">
        <div className="absolute -top-8 -right-4 text-[140px] opacity-[0.06] leading-none select-none rotate-12">
          {"\u{1F4CA}"}
        </div>
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-verde-200 mb-1.5">
            San Francisco Bojay
          </div>
          <h1 className="font-display text-[28px] font-black leading-tight tracking-tight">
            Historial
          </h1>
          <div className="mt-3">
            <Link href="/" className="flex items-center gap-1.5 text-[13px] font-medium text-verde-200 hover:text-white transition-colors">
              <IconArrowLeft /> Volver al monitor
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        <div className="flex gap-2 mb-4">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="input-field flex-1"
          >
            <option value="">Todas las composteras</option>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Compostera #{i + 1}</option>
            ))}
          </select>
          <button
            onClick={downloadCSV}
            disabled={mediciones.length === 0}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-verde-700 text-white text-[13px] font-semibold shadow-card transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none"
          >
            <IconDownload />
            CSV
          </button>
        </div>

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
            const est = estadoConfig[m.estado] || estadoConfig.good;
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
                    { label: "Humedad", value: ({ 20: "DRY++", 30: "DRY+", 40: "DRY", 55: "WET", 70: "WET+", 85: "WET++" } as Record<number, string>)[m.humedad] || `${m.humedad}%` },
                  ].map((d) => (
                    <div key={d.label} className="bg-white/60 rounded-lg px-2.5 py-2 text-center">
                      <div className="text-[10px] font-semibold text-verde-700/50 uppercase tracking-wider">{d.label}</div>
                      <div className="text-[15px] font-semibold text-gray-800 mt-0.5">{d.value}</div>
                    </div>
                  ))}
                </div>
                {m.foto_url && (
                  <div className="mt-2.5">
                    <a href={m.foto_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <img src={m.foto_url} alt={`Foto compostera #${m.compostera}`} className="w-full h-32 object-cover rounded-lg" />
                    </a>
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
                        <a
                          href={m.foto_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
                        >
                          Ver foto
                        </a>
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
                          <img src={editFotoExisting} alt="Foto actual" className="w-full h-32 object-cover rounded-xl" />
                          <div className="absolute top-1.5 right-1.5 flex gap-1">
                            <button
                              onClick={() => editFotoInput.current?.click()}
                              className="w-6 h-6 bg-black/50 text-white rounded-full text-[11px] flex items-center justify-center"
                              title="Cambiar foto"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                              </svg>
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
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                          </svg>
                          {editFotoRemoved ? "Agregar foto" : "Tomar o cargar foto"}
                        </button>
                      )}
                    </div>
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
    </div>
  );
}
