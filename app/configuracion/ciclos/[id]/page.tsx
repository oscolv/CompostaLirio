"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
import { IconArrowLeft } from "@/components/ui/icons";
import { hoyISO, diasDesde } from "@/lib/fechas";
import type { Ciclo } from "@/lib/types";

type Formulacion = { id: number; nombre: string };

export default function CicloDetallePage() {
  const params = useParams<{ id: string }>();
  const cicloId = Number(params?.id);

  const [ciclo, setCiclo] = useState<Ciclo | null>(null);
  const [formulaciones, setFormulaciones] = useState<Formulacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [nombre, setNombre] = useState("");
  const [formulacionId, setFormulacionId] = useState<string>("");
  const [pesoInicial, setPesoInicial] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const fetchCiclo = useCallback(async () => {
    const res = await fetch(`/api/ciclos/${cicloId}`);
    if (!res.ok) return;
    const data = (await res.json()) as Ciclo;
    setCiclo(data);
    setNombre(data.nombre ?? "");
    setFormulacionId(data.formulacion_id ? String(data.formulacion_id) : "");
    setPesoInicial(data.peso_inicial_kg != null ? String(data.peso_inicial_kg) : "");
    setObjetivo(data.objetivo ?? "");
    setObservaciones(data.observaciones_generales ?? "");
  }, [cicloId]);

  useEffect(() => {
    (async () => {
      try {
        const [_, fRes] = await Promise.all([
          fetchCiclo(),
          fetch("/api/formulaciones").catch(() => null),
        ]);
        void _;
        if (fRes && fRes.ok) {
          const fs = await fRes.json();
          if (Array.isArray(fs)) setFormulaciones(fs);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchCiclo]);

  async function guardar() {
    setSaving(true);
    setError("");
    setMensaje("");
    try {
      const peso = pesoInicial.trim() ? Number(pesoInicial) : null;
      const res = await fetch(`/api/ciclos/${cicloId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim() || null,
          formulacion_id: formulacionId ? parseInt(formulacionId, 10) : null,
          peso_inicial_kg: peso != null && !Number.isNaN(peso) ? peso : null,
          objetivo: objetivo.trim() || null,
          observaciones_generales: observaciones.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Error al guardar.");
        setSaving(false);
        return;
      }
      setMensaje("Guardado");
      setTimeout(() => setMensaje(""), 2500);
      await fetchCiclo();
    } catch {
      setError("Error de conexión.");
    }
    setSaving(false);
  }

  async function cerrar() {
    if (!confirm("¿Cerrar este ciclo?")) return;
    await fetch(`/api/ciclos/${cicloId}?action=cerrar`, { method: "POST" });
    await fetchCiclo();
  }

  async function descartar() {
    if (!confirm("¿Descartar este ciclo?")) return;
    await fetch(`/api/ciclos/${cicloId}?action=descartar`, { method: "POST" });
    await fetchCiclo();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-crema-100 flex items-center justify-center">
        <div className="text-verde-600 text-[14px] animate-pulse-fade">Cargando...</div>
      </div>
    );
  }

  if (!ciclo) {
    return (
      <div className="min-h-screen bg-crema-100 flex items-center justify-center">
        <div className="text-red-600 text-[14px]">Ciclo no encontrado.</div>
      </div>
    );
  }

  const dias = diasDesde(ciclo.fecha_inicio.split("T")[0], (ciclo.fecha_fin ?? hoyISO()).split("T")[0]);

  return (
    <div className="min-h-screen bg-crema-100">
      <header className="relative overflow-hidden text-white h-[22vh] min-h-[130px] max-h-[180px]">
        <NextImage src="/bojay.jpg" alt="Bojay" fill priority sizes="(max-width: 480px) 100vw, 480px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-verde-950/70 via-verde-900/55 to-verde-950/85" />
        <div className="relative z-10 h-full max-w-[480px] mx-auto px-5 py-4 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-verde-100 drop-shadow-sm">
              Compostera #{ciclo.compostera_id} — Ciclo #{ciclo.id}
            </div>
            <h1 className="font-display text-[22px] font-black leading-tight tracking-tight mt-0.5 drop-shadow">
              {ciclo.nombre || `Ciclo #${ciclo.id}`}
            </h1>
          </div>
          <Link href={`/configuracion/composteras/${ciclo.compostera_id}/ciclos`} className="flex items-center gap-1.5 text-[13px] font-medium text-verde-100 hover:text-white transition-colors">
            <IconArrowLeft /> Ciclos
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        <div className="page-card mb-4">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`w-2 h-2 rounded-full ${
              ciclo.estado === "activo" ? "bg-verde-500" :
              ciclo.estado === "cerrado" ? "bg-gray-400" : "bg-red-400"
            }`} />
            <span className="text-[13px] font-semibold text-verde-900 uppercase tracking-wider">
              {ciclo.estado}
            </span>
            {dias != null && (
              <span className="text-[12px] font-medium text-verde-600 bg-verde-100 px-2 py-0.5 rounded-full">
                Día {dias}
              </span>
            )}
          </div>
          <div className="text-[12px] text-gray-500">
            Inicio: {ciclo.fecha_inicio.split("T")[0]}
            {ciclo.fecha_fin ? ` — Fin: ${ciclo.fecha_fin.split("T")[0]}` : ""}
          </div>
        </div>

        <div className="page-card mb-4">
          <h2 className="text-[15px] font-semibold text-verde-900 mb-4">Datos del ciclo</h2>
          <div className="mb-3">
            <label className="input-label">Nombre</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="input-field" />
          </div>
          <div className="mb-3">
            <label className="input-label">Formulación</label>
            <select value={formulacionId} onChange={(e) => setFormulacionId(e.target.value)} className="input-field">
              <option value="">— Sin asignar —</option>
              {formulaciones.map((f) => (
                <option key={f.id} value={f.id}>{f.nombre}</option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="input-label">Peso inicial (kg)</label>
            <input type="number" inputMode="decimal" min="0" step="0.1" value={pesoInicial} onChange={(e) => setPesoInicial(e.target.value)} className="input-field" />
          </div>
          <div className="mb-3">
            <label className="input-label">Objetivo</label>
            <input type="text" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className="input-field" />
          </div>
          <div className="mb-4">
            <label className="input-label">Observaciones generales</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="input-field min-h-[80px]" />
          </div>

          {error && (
            <div className="mb-3 px-3 py-2 rounded-xl text-[13px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200">{error}</div>
          )}
          {mensaje && (
            <div className="mb-3 px-3 py-2 rounded-xl text-[13px] font-semibold text-verde-700 bg-verde-50 ring-1 ring-verde-200">✓ {mensaje}</div>
          )}

          <button onClick={guardar} disabled={saving} className="btn-primary">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

        {ciclo.estado === "activo" && (
          <div className="page-card">
            <h2 className="text-[14px] font-semibold text-verde-900 mb-3">Acciones</h2>
            <div className="flex gap-2">
              <button onClick={cerrar} className="flex-1 px-4 py-3 rounded-xl text-[13px] font-semibold text-tierra-700 bg-crema-200 hover:bg-crema-300">
                Cerrar ciclo
              </button>
              <button onClick={descartar} className="flex-1 px-4 py-3 rounded-xl text-[13px] font-semibold text-red-700 bg-red-50 hover:bg-red-100">
                Descartar
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
