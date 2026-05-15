"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import Markdown from "react-markdown";
import { IconArrowLeft, IconCamera, IconBook } from "@/components/ui/icons";
import { FotoModal } from "@/components/ui/FotoModal";
import { useFotoModal } from "@/hooks/useFotoModal";
import { useMultiPhotoUpload } from "@/hooks/useMultiPhotoUpload";
import { useSitio } from "@/lib/sitio-context";
import { fechaLocalDeISO } from "@/lib/fechas";

type Bitacora = {
  id: number;
  sitio_id: number;
  fecha: string;          // YYYY-MM-DD o ISO
  hora: string;           // HH:MM:SS
  observaciones: string;
  fotos: string[];
  created_at: string;
};

const MAX_FOTOS = 10;

function normalizarFecha(f: string): string {
  // La columna DATE puede venir como "YYYY-MM-DD" o ISO completo.
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
  return fechaLocalDeISO(f);
}

function normalizarHora(h: string): string {
  // TIME viene como "HH:MM:SS"; recortar a "HH:MM" para el input.
  return h.length >= 5 ? h.slice(0, 5) : h;
}

export default function BitacoraHistorial() {
  const { activos: sitiosActivos, sitioId, setSitioId, loading: loadingSitios } = useSitio();
  const [entradas, setEntradas] = useState<Bitacora[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editFecha, setEditFecha] = useState("");
  const [editHora, setEditHora] = useState("");
  const [editObs, setEditObs] = useState("");
  const [editFotosExistentes, setEditFotosExistentes] = useState<string[]>([]);
  const editPhotos = useMultiPhotoUpload(MAX_FOTOS);
  const fotoModal = useFotoModal();

  const mostrarSelectorSitio = sitiosActivos.length > 1;

  const fetchData = useCallback(async () => {
    if (!sitioId) {
      setEntradas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/bitacoras?sitio_id=${sitioId}&t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      setEntradas(await res.json());
    } catch {
      setError("No se pudo cargar el historial.");
    }
    setLoading(false);
  }, [sitioId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function startEdit(b: Bitacora) {
    setEditando(b.id);
    setExpandido(b.id);
    setEditFecha(normalizarFecha(b.fecha));
    setEditHora(normalizarHora(b.hora));
    setEditObs(b.observaciones);
    setEditFotosExistentes(b.fotos ?? []);
    editPhotos.clear();
    setError("");
  }

  function cancelEdit() {
    setEditando(null);
    editPhotos.clear();
  }

  function quitarFotoExistente(url: string) {
    setEditFotosExistentes((prev) => prev.filter((u) => u !== url));
  }

  async function guardarEdicion(id: number) {
    if (!editObs.trim()) {
      setError("Las observaciones son obligatorias.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const nuevas = await editPhotos.waitForUploads();
      const fotos = [...editFotosExistentes, ...nuevas].slice(0, MAX_FOTOS);
      const res = await fetch(`/api/bitacoras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: editFecha,
          hora: editHora,
          observaciones: editObs.trim(),
          fotos,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error al guardar" }));
        throw new Error(data?.error || `Error ${res.status}`);
      }
      const updated = (await res.json()) as Bitacora;
      setEntradas((prev) => prev.map((e) => (e.id === id ? updated : e)));
      setEditando(null);
      editPhotos.clear();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "No se pudo guardar";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function borrar(id: number) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setDeleting(id);
    try {
      const res = await fetch(`/api/bitacoras/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setEntradas((prev) => prev.filter((e) => e.id !== id));
      setExpandido(null);
      setEditando(null);
      setConfirmDelete(null);
    } catch {
      setError("No se pudo borrar.");
    } finally {
      setDeleting(null);
    }
  }

  const totalFotosEdit = editFotosExistentes.length + editPhotos.count;
  const canEditAddMore = totalFotosEdit < MAX_FOTOS;
  const canSaveEdit =
    !!editObs.trim() &&
    !saving &&
    !editPhotos.busy &&
    editPhotos.failedCount === 0;

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
              Bit&aacute;cora &mdash; Historial
            </h1>
          </div>
          <Link href="/bitacora" className="flex items-center gap-1.5 text-[13px] font-medium text-verde-100 hover:text-white transition-colors">
            <IconArrowLeft /> Volver a nueva entrada
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        {mostrarSelectorSitio && (
          <div className="mb-4">
            <select
              value={sitioId ?? ""}
              onChange={(e) => setSitioId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="input-field"
            >
              <option value="">— Selecciona un sitio —</option>
              {sitiosActivos.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {!loadingSitios && sitiosActivos.length === 0 && (
          <div className="mb-4 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-amber-800 bg-amber-50 ring-1 ring-amber-200">
            No hay sitios activos.
          </div>
        )}

        {error && (
          <div className="mb-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200">
            {error}
          </div>
        )}

        {loading && (
          <div className="page-card text-center text-gray-500 text-[13px]">Cargando…</div>
        )}

        {!loading && entradas.length === 0 && sitioId && (
          <div className="page-card text-center text-gray-500 text-[13px]">
            No hay entradas para este sitio todavía.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {entradas.map((b) => {
            const isOpen = expandido === b.id;
            const isEdit = editando === b.id;
            const fecha = normalizarFecha(b.fecha);
            const hora = normalizarHora(b.hora);
            const nFotos = b.fotos?.length ?? 0;

            return (
              <div key={b.id} className="page-card">
                {!isEdit ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpandido(isOpen ? null : b.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg bg-tierra-400/10 text-tierra-600 flex items-center justify-center">
                          <IconBook />
                        </div>
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold text-verde-900">
                            {fecha} &middot; {hora}
                          </div>
                          {nFotos > 0 && (
                            <div className="text-[11px] text-gray-500">
                              {nFotos} foto{nFotos === 1 ? "" : "s"}
                            </div>
                          )}
                        </div>
                      </div>
                      {isOpen ? (
                        <div className="text-[13px] text-gray-700 leading-snug prose-chat">
                          <Markdown>{b.observaciones}</Markdown>
                        </div>
                      ) : (
                        <p className="text-[13px] text-gray-700 leading-snug line-clamp-2">
                          {b.observaciones}
                        </p>
                      )}
                    </button>

                    {isOpen && nFotos > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {b.fotos.map((url) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => fotoModal.open(url)}
                            className="relative aspect-square overflow-hidden rounded-xl active:scale-[0.97] transition-transform"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="Foto" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    {isOpen && (
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => startEdit(b)}
                          className="flex-1 px-3 py-2 rounded-xl bg-verde-50 text-verde-700 text-[13px] font-semibold ring-1 ring-verde-200 hover:bg-verde-100 active:scale-[0.98] transition-all"
                        >
                          Editar
                        </button>
                        {confirmDelete === b.id ? (
                          <button
                            type="button"
                            onClick={() => borrar(b.id)}
                            disabled={deleting === b.id}
                            className="flex-1 px-3 py-2 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 active:scale-[0.98] disabled:opacity-60 transition-all"
                          >
                            {deleting === b.id ? "Borrando..." : "Confirmar borrar"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => borrar(b.id)}
                            className="flex-1 px-3 py-2 rounded-xl bg-red-50 text-red-700 text-[13px] font-semibold ring-1 ring-red-200 hover:bg-red-100 active:scale-[0.98] transition-all"
                          >
                            Borrar
                          </button>
                        )}
                        {confirmDelete === b.id && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-[13px] font-semibold hover:bg-gray-200 active:scale-[0.98] transition-all"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-verde-50 text-verde-700 flex items-center justify-center">
                        <IconBook />
                      </div>
                      <h3 className="text-[14px] font-semibold text-verde-900">Editar entrada</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="input-label">Fecha</label>
                        <input
                          type="date"
                          value={editFecha}
                          onChange={(e) => setEditFecha(e.target.value)}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="input-label">Hora</label>
                        <input
                          type="time"
                          value={editHora}
                          onChange={(e) => setEditHora(e.target.value)}
                          className="input-field"
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="input-label">Observaciones</label>
                      <textarea
                        rows={4}
                        value={editObs}
                        onChange={(e) => setEditObs(e.target.value)}
                        maxLength={2000}
                        className="input-field resize-none"
                      />
                      <div className="text-[11px] text-gray-400 mt-1 text-right">{editObs.length}/2000</div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <label className="input-label mb-0">Fotos ({totalFotosEdit}/{MAX_FOTOS})</label>
                        {editPhotos.count > 0 && (
                          <div className="text-[11px] font-semibold text-gray-500">
                            {editPhotos.readyCount}/{editPhotos.count} nuevas listas
                            {editPhotos.pendingCount > 0 && (
                              <span className="text-verde-700"> · {editPhotos.pendingCount} subiendo</span>
                            )}
                            {editPhotos.failedCount > 0 && (
                              <span className="text-red-600"> · {editPhotos.failedCount} con error</span>
                            )}
                          </div>
                        )}
                      </div>

                      {(editFotosExistentes.length > 0 || editPhotos.items.length > 0) && (
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {editFotosExistentes.map((url) => (
                            <div key={url} className="relative aspect-square">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="Foto" className="w-full h-full object-cover rounded-xl" />
                              <button
                                type="button"
                                onClick={() => quitarFotoExistente(url)}
                                disabled={saving}
                                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center text-[14px] font-bold hover:bg-black/75 active:scale-90 disabled:opacity-50"
                                aria-label="Quitar foto"
                              >
                                &times;
                              </button>
                            </div>
                          ))}

                          {editPhotos.items.map((it) => (
                            <div key={it.id} className="relative aspect-square animate-fade-in">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={it.preview} alt="Foto" className="w-full h-full object-cover rounded-xl" />
                              <button
                                type="button"
                                onClick={() => editPhotos.remove(it.id)}
                                disabled={saving}
                                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center text-[14px] font-bold hover:bg-black/75 active:scale-90 disabled:opacity-50"
                                aria-label="Quitar foto"
                              >
                                &times;
                              </button>
                              {it.uploading && (
                                <div className="absolute inset-0 bg-black/40 rounded-xl flex flex-col items-center justify-center gap-1">
                                  <svg className="w-6 h-6 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                  </svg>
                                  <span className="text-[10px] font-semibold text-white">Subiendo</span>
                                </div>
                              )}
                              {!it.uploading && it.url && (
                                <div className="absolute bottom-1 left-1 w-6 h-6 rounded-full bg-verde-600 text-white flex items-center justify-center shadow-card">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                              {!it.uploading && it.error && (
                                <button
                                  type="button"
                                  onClick={() => editPhotos.retry(it.id)}
                                  disabled={saving}
                                  className="absolute inset-0 bg-red-600/80 rounded-xl flex flex-col items-center justify-center gap-1 px-1 text-center hover:bg-red-700/85 active:scale-[0.97] disabled:opacity-60"
                                  aria-label="Reintentar"
                                >
                                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014.65-3M19 5A9 9 0 004.35 8" />
                                  </svg>
                                  <span className="text-[10px] font-semibold text-white leading-tight">Reintentar</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <input
                        ref={editPhotos.inputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={editPhotos.handleSelect}
                        className="hidden"
                      />

                      {canEditAddMore && (
                        <button
                          type="button"
                          onClick={editPhotos.open}
                          disabled={saving}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-verde-200 text-verde-600 text-[13px] font-semibold transition-colors hover:border-verde-400 hover:bg-verde-50/50 active:scale-[0.98] disabled:opacity-50"
                        >
                          <IconCamera />
                          Agregar fotos
                        </button>
                      )}

                      {!canEditAddMore && (
                        <div className="text-[12px] text-gray-500 text-center py-2">
                          L&iacute;mite de {MAX_FOTOS} fotos alcanzado
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-[13px] font-semibold hover:bg-gray-200 active:scale-[0.98] disabled:opacity-50 transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => guardarEdicion(b.id)}
                        disabled={!canSaveEdit}
                        className="flex-1 btn-primary"
                      >
                        {saving
                          ? "Guardando..."
                          : editPhotos.busy
                            ? `Esperando ${editPhotos.pendingCount}...`
                            : "Guardar cambios"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {fotoModal.url && <FotoModal url={fotoModal.url} onClose={fotoModal.close} showOpenOriginal />}
    </div>
  );
}
