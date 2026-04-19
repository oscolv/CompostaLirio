"use client";

import { useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useSitios } from "@/hooks/useSitios";
import { IconArrowLeft } from "@/components/ui/icons";
import type { Sitio } from "@/lib/types";

export default function SitiosPage() {
  const { sitios, loading, refetch } = useSitios();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startNew() {
    setEditingId(null);
    setNombre("");
    setDescripcion("");
    setUbicacion("");
    setError("");
    setShowForm(true);
  }

  function startEdit(s: Sitio) {
    setEditingId(s.id);
    setNombre(s.nombre);
    setDescripcion(s.descripcion ?? "");
    setUbicacion(s.ubicacion ?? "");
    setError("");
    setShowForm(true);
  }

  async function guardar() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = editingId ? `/api/sitios/${editingId}` : "/api/sitios";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          ubicacion: ubicacion.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Error al guardar.");
        setSaving(false);
        return;
      }
      setShowForm(false);
      await refetch();
    } catch {
      setError("Error de conexión.");
    }
    setSaving(false);
  }

  async function toggleActivo(s: Sitio) {
    try {
      if (s.activo) {
        await fetch(`/api/sitios/${s.id}`, { method: "DELETE" });
      } else {
        await fetch(`/api/sitios/${s.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activo: true }),
        });
      }
      await refetch();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-crema-100">
      <header className="relative overflow-hidden text-white h-[22vh] min-h-[130px] max-h-[180px]">
        <NextImage src="/bojay.jpg" alt="Bojay" fill priority sizes="(max-width: 480px) 100vw, 480px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-verde-950/70 via-verde-900/55 to-verde-950/85" />
        <div className="relative z-10 h-full max-w-[480px] mx-auto px-5 py-4 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-verde-100 drop-shadow-sm">Configuración</div>
            <h1 className="font-display text-[24px] font-black leading-tight tracking-tight mt-0.5 drop-shadow">Sitios</h1>
          </div>
          <Link href="/configuracion" className="flex items-center gap-1.5 text-[13px] font-medium text-verde-100 hover:text-white transition-colors">
            <IconArrowLeft /> Volver
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        {!showForm && (
          <button onClick={startNew} className="btn-primary mb-4">+ Nuevo sitio</button>
        )}

        {showForm && (
          <div className="page-card mb-4">
            <h2 className="text-[15px] font-semibold text-verde-900 mb-4">
              {editingId ? "Editar sitio" : "Nuevo sitio"}
            </h2>
            <div className="mb-3">
              <label className="input-label">Nombre *</label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="input-field" placeholder="Ej: Tepeji" />
            </div>
            <div className="mb-3">
              <label className="input-label">Ubicación</label>
              <input type="text" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className="input-field" placeholder="Ej: Tepeji del Río, Hidalgo" />
            </div>
            <div className="mb-4">
              <label className="input-label">Descripción</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="input-field min-h-[80px]" placeholder="Notas, contexto, etc." />
            </div>
            {error && (
              <div className="mb-3 px-3 py-2 rounded-xl text-[13px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200">{error}</div>
            )}
            <div className="flex gap-2">
              <button onClick={guardar} disabled={saving} className="btn-primary flex-1">
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-3 rounded-xl text-[13px] font-semibold text-gray-500 bg-white border border-gray-200">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="page-card">
          <h2 className="text-[15px] font-semibold text-verde-900 mb-1">Sitios registrados</h2>
          {loading ? (
            <div className="text-center text-verde-600 py-12 text-[14px] animate-pulse-fade">Cargando...</div>
          ) : sitios.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-[13px]">No hay sitios registrados.</div>
          ) : (
            <div className="flex flex-col gap-2 mt-3">
              {sitios.map((s) => (
                <div key={s.id} className={`rounded-xl p-3 border transition-all ${s.activo ? "border-verde-200/60 bg-verde-50/30" : "border-gray-200 bg-gray-50 opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${s.activo ? "bg-verde-500" : "bg-gray-300"}`} />
                        <span className="font-semibold text-[14px] text-verde-900 truncate">{s.nombre}</span>
                      </div>
                      {s.ubicacion && <div className="text-[12px] text-gray-500 mt-1">{s.ubicacion}</div>}
                      {s.descripcion && <div className="text-[12px] text-gray-400 mt-1 leading-snug">{s.descripcion}</div>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => startEdit(s)} className="text-[11px] font-semibold text-verde-700 px-2 py-1 rounded bg-verde-50 hover:bg-verde-100">
                        Editar
                      </button>
                      <button onClick={() => toggleActivo(s)} className="text-[11px] font-semibold text-tierra-600 px-2 py-1 rounded bg-crema-200 hover:bg-crema-300">
                        {s.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
