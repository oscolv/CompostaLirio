"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
import { IconArrowLeft, IconLeaf } from "@/components/ui/icons";
import { hoyISO, diasDesde } from "@/lib/fechas";
import type { Ciclo, ComposteraInfo } from "@/lib/types";

type Formulacion = { id: number; nombre: string };

export default function CiclosPage() {
  const params = useParams<{ id: string }>();
  const composteraId = Number(params?.id);

  const [compostera, setCompostera] = useState<ComposteraInfo | null>(null);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [formulaciones, setFormulaciones] = useState<Formulacion[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(hoyISO());
  const [nombre, setNombre] = useState("");
  const [pesoInicial, setPesoInicial] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [formulacionId, setFormulacionId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchCiclos = useCallback(async () => {
    const res = await fetch(`/api/composteras/${composteraId}/ciclos`);
    const rows = await res.json();
    if (Array.isArray(rows)) setCiclos(rows);
  }, [composteraId]);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, fRes] = await Promise.all([
          fetch("/api/composteras"),
          fetch("/api/formulaciones").catch(() => null),
        ]);
        const cs = await cRes.json();
        if (Array.isArray(cs)) {
          const found = cs.find((c: ComposteraInfo) => c.id === composteraId);
          setCompostera(found ?? null);
        }
        if (fRes && fRes.ok) {
          const fs = await fRes.json();
          if (Array.isArray(fs)) setFormulaciones(fs);
        }
        await fetchCiclos();
      } finally {
        setLoading(false);
      }
    })();
  }, [composteraId, fetchCiclos]);

  async function crearCiclo() {
    if (!fechaInicio) {
      setError("Fecha de inicio obligatoria.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const peso = pesoInicial.trim() ? Number(pesoInicial) : null;
      const res = await fetch(`/api/composteras/${composteraId}/ciclos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_inicio: fechaInicio,
          nombre: nombre.trim() || null,
          peso_inicial_kg: peso != null && !Number.isNaN(peso) ? peso : null,
          objetivo: objetivo.trim() || null,
          formulacion_id: formulacionId ? parseInt(formulacionId, 10) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Error al crear ciclo.");
        setSaving(false);
        return;
      }
      setShowForm(false);
      setNombre("");
      setPesoInicial("");
      setObjetivo("");
      setFormulacionId("");
      await fetchCiclos();
    } catch {
      setError("Error de conexión.");
    }
    setSaving(false);
  }

  async function cerrarCiclo(cicloId: number) {
    if (!confirm("¿Cerrar este ciclo? Después deberás iniciar uno nuevo para seguir registrando mediciones.")) return;
    await fetch(`/api/ciclos/${cicloId}?action=cerrar`, { method: "POST" });
    await fetchCiclos();
  }

  async function descartarCiclo(cicloId: number) {
    if (!confirm("¿Descartar este ciclo? Se conservará el historial pero quedará marcado como descartado.")) return;
    await fetch(`/api/ciclos/${cicloId}?action=descartar`, { method: "POST" });
    await fetchCiclos();
  }

  const ciclosOrdenados = [...ciclos].sort((a, b) => {
    if (a.estado === "activo" && b.estado !== "activo") return -1;
    if (a.estado !== "activo" && b.estado === "activo") return 1;
    return b.fecha_inicio.localeCompare(a.fecha_inicio);
  });

  const hayActivo = ciclos.some((c) => c.estado === "activo");

  return (
    <div className="min-h-screen bg-crema-100">
      <header className="relative overflow-hidden text-white h-[22vh] min-h-[130px] max-h-[180px]">
        <NextImage src="/bojay.jpg" alt="Bojay" fill priority sizes="(max-width: 480px) 100vw, 480px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-verde-950/70 via-verde-900/55 to-verde-950/85" />
        <div className="relative z-10 h-full max-w-[480px] mx-auto px-5 py-4 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-verde-100 drop-shadow-sm">
              Compostera #{composteraId}{compostera?.nombre ? ` — ${compostera.nombre}` : ""}
            </div>
            <h1 className="font-display text-[24px] font-black leading-tight tracking-tight mt-0.5 drop-shadow">Ciclos</h1>
          </div>
          <Link href="/configuracion" className="flex items-center gap-1.5 text-[13px] font-medium text-verde-100 hover:text-white transition-colors">
            <IconArrowLeft /> Configuración
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        {!showForm && !hayActivo && (
          <button onClick={() => setShowForm(true)} className="btn-primary mb-4">
            + Iniciar nuevo ciclo
          </button>
        )}

        {!showForm && hayActivo && (
          <div className="page-card mb-4 flex items-center justify-between gap-3">
            <div className="text-[13px] text-gray-500 leading-snug">
              Ya hay un ciclo activo. Ciérralo antes de iniciar otro.
            </div>
          </div>
        )}

        {showForm && (
          <div className="page-card mb-4">
            <h2 className="text-[15px] font-semibold text-verde-900 mb-4">Nuevo ciclo</h2>
            <div className="mb-3">
              <label className="input-label">Fecha de inicio *</label>
              <input type="date" value={fechaInicio} max={hoyISO()} onChange={(e) => setFechaInicio(e.target.value)} className="input-field" />
            </div>
            <div className="mb-3">
              <label className="input-label">Nombre (opcional)</label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Ciclo 3 — primavera" className="input-field" />
            </div>
            <div className="mb-3">
              <label className="input-label">Peso inicial (kg)</label>
              <input type="number" inputMode="decimal" min="0" step="0.1" value={pesoInicial} onChange={(e) => setPesoInicial(e.target.value)} className="input-field" />
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
            <div className="mb-4">
              <label className="input-label">Objetivo</label>
              <input type="text" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ej: Composta madura en 90 días" className="input-field" />
            </div>
            {error && (
              <div className="mb-3 px-3 py-2 rounded-xl text-[13px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200">{error}</div>
            )}
            <div className="flex gap-2">
              <button onClick={crearCiclo} disabled={saving} className="btn-primary flex-1">
                {saving ? "Creando..." : "Crear ciclo"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-3 rounded-xl text-[13px] font-semibold text-gray-500 bg-white border border-gray-200">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="page-card">
          <h2 className="text-[15px] font-semibold text-verde-900 mb-3">Historial de ciclos</h2>
          {loading ? (
            <div className="text-center text-verde-600 py-12 text-[14px] animate-pulse-fade">Cargando...</div>
          ) : ciclosOrdenados.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-[13px]">No hay ciclos registrados todavía.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {ciclosOrdenados.map((c) => {
                const dias = diasDesde(c.fecha_inicio.split("T")[0], (c.fecha_fin ?? hoyISO()).split("T")[0]);
                const estadoColor =
                  c.estado === "activo" ? "bg-verde-500" :
                  c.estado === "cerrado" ? "bg-gray-400" : "bg-red-400";
                return (
                  <div key={c.id} className={`rounded-xl p-3 border ${c.estado === "activo" ? "border-verde-200/60 bg-verde-50/40" : "border-gray-200 bg-gray-50/50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`w-2 h-2 rounded-full ${estadoColor}`} />
                          <span className="font-semibold text-[14px] text-verde-900">{c.nombre || `Ciclo #${c.id}`}</span>
                          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{c.estado}</span>
                          {c.estado === "activo" && dias != null && (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-verde-600 bg-verde-100 px-2 py-0.5 rounded-full">
                              <IconLeaf /> Día {dias}
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-gray-500 mt-1">
                          Inicio: {c.fecha_inicio.split("T")[0]}{c.fecha_fin ? ` — Fin: ${c.fecha_fin.split("T")[0]}` : ""}
                        </div>
                        {c.peso_inicial_kg != null && (
                          <div className="text-[12px] text-gray-500">Peso inicial: {c.peso_inicial_kg} kg</div>
                        )}
                        {c.objetivo && <div className="text-[12px] text-gray-400 mt-0.5">{c.objetivo}</div>}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Link href={`/configuracion/ciclos/${c.id}`} className="text-[11px] font-semibold text-verde-700 px-2 py-1 rounded bg-verde-50 hover:bg-verde-100 text-center">
                          Detalle
                        </Link>
                        {c.estado === "activo" && (
                          <>
                            <button onClick={() => cerrarCiclo(c.id)} className="text-[11px] font-semibold text-tierra-600 px-2 py-1 rounded bg-crema-200 hover:bg-crema-300">
                              Cerrar
                            </button>
                            <button onClick={() => descartarCiclo(c.id)} className="text-[11px] font-semibold text-red-600 px-2 py-1 rounded bg-red-50 hover:bg-red-100">
                              Descartar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
