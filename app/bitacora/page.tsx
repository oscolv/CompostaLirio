"use client";

import { useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { hoyISO, horaActual } from "@/lib/fechas";
import { IconArrowLeft, IconCamera, IconBook } from "@/components/ui/icons";
import { useSitio } from "@/lib/sitio-context";
import { useMultiPhotoUpload } from "@/hooks/useMultiPhotoUpload";

const MAX_FOTOS = 10;
// Bitácora es registro visual humano (no pasa por análisis IA), así que
// se comprime más agresivo que la foto de medición (1200/0.7).
const COMPRESS_BITACORA = { maxWidth: 900, quality: 0.55 };

export default function Bitacora() {
  const { activos: sitiosActivos, sitioId, setSitioId, loading: loadingSitios } = useSitio();
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState(horaActual());
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [guardada, setGuardada] = useState(false);
  const photos = useMultiPhotoUpload(MAX_FOTOS, COMPRESS_BITACORA);

  const mostrarSelectorSitio = sitiosActivos.length > 1;
  const obsTrim = obs.trim();
  const canSubmit =
    !!sitioId &&
    !!obsTrim &&
    !saving &&
    !photos.busy &&
    photos.failedCount === 0;

  function resetForm() {
    setFecha(hoyISO());
    setHora(horaActual());
    setObs("");
    setError("");
    setGuardada(false);
    photos.clear();
  }

  async function handleGuardar() {
    if (!sitioId) {
      setError("Selecciona un sitio.");
      return;
    }
    if (!obsTrim) {
      setError("Escribe las observaciones.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const urls = await photos.waitForUploads();
      const res = await fetch("/api/bitacoras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sitio_id: sitioId,
          fecha,
          hora,
          observaciones: obsTrim,
          fotos: urls,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error al guardar" }));
        throw new Error(data?.error || `Error ${res.status}`);
      }
      setGuardada(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "No se pudo guardar la bitácora";
      setError(msg);
    } finally {
      setSaving(false);
    }
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
              Bit&aacute;cora
            </h1>
          </div>
          <Link href="/" className="flex items-center gap-1.5 text-[13px] font-medium text-verde-100 hover:text-white transition-colors">
            <IconArrowLeft /> Volver al monitor
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        <div className="page-card">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-tierra-400/10 text-tierra-600 flex items-center justify-center">
              <IconBook />
            </div>
            <h2 className="text-[15px] font-semibold text-verde-900">Nueva entrada</h2>
          </div>

          {mostrarSelectorSitio && (
            <div className="mb-4">
              <label className="input-label">Sitio</label>
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
              No hay sitios activos. Crea uno desde Config para empezar.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="input-label">Fecha del registro</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="input-label">Hora</label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="input-label">Observaciones</label>
            <textarea
              rows={4}
              placeholder="Anota incidencias, clima, visitas, ingreso de lirio, fauna, volteos..."
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              maxLength={2000}
              className="input-field resize-none"
            />
            <div className="text-[11px] text-gray-400 mt-1 text-right">
              {obs.length}/2000
            </div>
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <label className="input-label mb-0">Fotos (hasta {MAX_FOTOS})</label>
              {photos.count > 0 && (
                <div className="text-[11px] font-semibold text-gray-500">
                  {photos.readyCount}/{photos.count} listas
                  {photos.pendingCount > 0 && (
                    <span className="text-verde-700"> · {photos.pendingCount} subiendo</span>
                  )}
                  {photos.failedCount > 0 && (
                    <span className="text-red-600"> · {photos.failedCount} con error</span>
                  )}
                </div>
              )}
            </div>
            <input
              ref={photos.inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={photos.handleSelect}
              className="hidden"
            />

            {photos.items.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {photos.items.map((it) => (
                  <div key={it.id} className="relative aspect-square animate-fade-in">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={it.preview}
                      alt="Foto"
                      className="w-full h-full object-cover rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => photos.remove(it.id)}
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
                        onClick={() => photos.retry(it.id)}
                        disabled={saving}
                        className="absolute inset-0 bg-red-600/80 rounded-xl flex flex-col items-center justify-center gap-1 px-1 text-center hover:bg-red-700/85 active:scale-[0.97] disabled:opacity-60"
                        aria-label="Reintentar subida"
                      >
                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014.65-3M19 5A9 9 0 004.35 8" />
                        </svg>
                        <span className="text-[10px] font-semibold text-white leading-tight">
                          Reintentar
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {photos.canAddMore && (
              <button
                type="button"
                onClick={photos.open}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-verde-200 text-verde-600 text-[13px] font-semibold transition-colors hover:border-verde-400 hover:bg-verde-50/50 active:scale-[0.98] disabled:opacity-50"
              >
                <IconCamera />
                {photos.count === 0 ? "Agregar fotos" : `Agregar más (${photos.count}/${MAX_FOTOS})`}
              </button>
            )}

            {!photos.canAddMore && (
              <div className="text-[12px] text-gray-500 text-center py-2">
                L&iacute;mite de {MAX_FOTOS} fotos alcanzado
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 text-[13px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200 animate-fade-in">
              {error}
            </div>
          )}

          {!guardada ? (
            <button
              onClick={handleGuardar}
              disabled={!canSubmit}
              className="btn-primary"
            >
              {saving
                ? "Guardando..."
                : photos.busy
                  ? `Esperando ${photos.pendingCount} foto(s)...`
                  : photos.failedCount > 0
                    ? "Reintenta las fotos con error"
                    : "Guardar bitácora"}
            </button>
          ) : (
            <div className="flex flex-col gap-2 animate-fade-in">
              <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-verde-700 bg-verde-50 ring-1 ring-verde-200">
                &#x2713; Bit&aacute;cora guardada
              </div>
              <button onClick={resetForm} className="btn-primary">
                Nueva bit&aacute;cora
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/bitacora/historial"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-verde-700 hover:text-verde-900 transition-colors"
          >
            Ver entradas anteriores &rarr;
          </Link>
        </div>
      </main>
    </div>
  );
}
