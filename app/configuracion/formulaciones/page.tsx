"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";

type Formulacion = {
  id: number;
  nombre: string;
  descripcion: string | null;
  base_calculo: "humeda" | "seca";
  lirio_acuatico_pct: number | null;
  excreta_pct: number | null;
  tipo_excreta: string | null;
  hojarasca_pct: number | null;
  residuos_vegetales_pct: number | null;
  material_estructurante_pct: number | null;
  relacion_cn_estimada: number | null;
  humedad_inicial_estimada: number | null;
  nivel_estructura: string | null;
  notas: string | null;
  activa: boolean;
  created_at: string;
  n_asociaciones: number;
};

type FormState = {
  nombre: string;
  descripcion: string;
  base_calculo: "humeda" | "seca";
  lirio_acuatico_pct: string;
  excreta_pct: string;
  tipo_excreta: "" | "bovina" | "ovina" | "equina" | "gallinaza" | "mixta";
  hojarasca_pct: string;
  residuos_vegetales_pct: string;
  material_estructurante_pct: string;
  relacion_cn_estimada: string;
  humedad_inicial_estimada: string;
  nivel_estructura: "" | "baja" | "media" | "alta";
  notas: string;
  activa: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: "",
  descripcion: "",
  base_calculo: "humeda",
  lirio_acuatico_pct: "",
  excreta_pct: "",
  tipo_excreta: "",
  hojarasca_pct: "",
  residuos_vegetales_pct: "",
  material_estructurante_pct: "",
  relacion_cn_estimada: "",
  humedad_inicial_estimada: "",
  nivel_estructura: "",
  notas: "",
  activa: true,
};

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function IconArrowLeft() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

export default function FormulacionesPage() {
  const [lista, setLista] = useState<Formulacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function toFormState(f: Formulacion): FormState {
    const s = (n: number | null) => (n == null ? "" : String(n));
    return {
      nombre: f.nombre,
      descripcion: f.descripcion ?? "",
      base_calculo: f.base_calculo,
      lirio_acuatico_pct: s(f.lirio_acuatico_pct),
      excreta_pct: s(f.excreta_pct),
      tipo_excreta: (f.tipo_excreta as FormState["tipo_excreta"]) || "",
      hojarasca_pct: s(f.hojarasca_pct),
      residuos_vegetales_pct: s(f.residuos_vegetales_pct),
      material_estructurante_pct: s(f.material_estructurante_pct),
      relacion_cn_estimada: s(f.relacion_cn_estimada),
      humedad_inicial_estimada: s(f.humedad_inicial_estimada),
      nivel_estructura: (f.nivel_estructura as FormState["nivel_estructura"]) || "",
      notas: f.notas ?? "",
      activa: f.activa,
    };
  }

  function editar(f: Formulacion) {
    setEditId(f.id);
    setForm(toFormState(f));
    setMensaje("");
    setShowForm(true);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function borrar(f: Formulacion) {
    if (!confirm(`¿Eliminar la formulación "${f.nombre}"?`)) return;
    setDeletingId(f.id);
    setMensaje("");
    try {
      const r = await fetch(`/api/formulaciones/${f.id}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Error al eliminar");
      await cargar();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "Error");
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActiva(f: Formulacion) {
    const accion = f.activa ? "desactivar" : "reactivar";
    if (f.activa && !confirm(
      `Desactivar "${f.nombre}". Dejará de aparecer en el selector de nuevas asociaciones, pero el historial y los diagnósticos la seguirán citando. ¿Continuar?`,
    )) return;
    setDeletingId(f.id);
    setMensaje("");
    try {
      const payload = {
        nombre: f.nombre,
        descripcion: f.descripcion,
        base_calculo: f.base_calculo,
        lirio_acuatico_pct: f.lirio_acuatico_pct,
        excreta_pct: f.excreta_pct,
        tipo_excreta: f.tipo_excreta,
        hojarasca_pct: f.hojarasca_pct,
        residuos_vegetales_pct: f.residuos_vegetales_pct,
        material_estructurante_pct: f.material_estructurante_pct,
        relacion_cn_estimada: f.relacion_cn_estimada,
        humedad_inicial_estimada: f.humedad_inicial_estimada,
        nivel_estructura: f.nivel_estructura,
        notas: f.notas,
        activa: !f.activa,
      };
      const r = await fetch(`/api/formulaciones/${f.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `Error al ${accion}`);
      await cargar();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "Error");
    } finally {
      setDeletingId(null);
    }
  }

  const sumaPct =
    num(form.lirio_acuatico_pct) +
    num(form.excreta_pct) +
    num(form.hojarasca_pct) +
    num(form.residuos_vegetales_pct) +
    num(form.material_estructurante_pct);

  const sumaOk = Math.abs(sumaPct - 100) < 0.01;

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/formulaciones?all=1", { cache: "no-store" });
      if (!r.ok) throw new Error("Error al cargar");
      const rows = (await r.json()) as Formulacion[];
      setLista(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");

    if (!form.nombre.trim()) {
      setMensaje("El nombre es obligatorio");
      return;
    }
    if (!sumaOk) {
      setMensaje(`La suma de porcentajes debe ser 100 (actual: ${sumaPct.toFixed(1)})`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        base_calculo: form.base_calculo,
        lirio_acuatico_pct: num(form.lirio_acuatico_pct),
        excreta_pct: num(form.excreta_pct),
        tipo_excreta: form.tipo_excreta || null,
        hojarasca_pct: num(form.hojarasca_pct),
        residuos_vegetales_pct: num(form.residuos_vegetales_pct),
        material_estructurante_pct: num(form.material_estructurante_pct),
        relacion_cn_estimada: form.relacion_cn_estimada.trim() === "" ? null : num(form.relacion_cn_estimada),
        humedad_inicial_estimada: form.humedad_inicial_estimada.trim() === "" ? null : num(form.humedad_inicial_estimada),
        nivel_estructura: form.nivel_estructura || null,
        notas: form.notas.trim() || null,
        activa: form.activa,
      };

      const url = editId != null ? `/api/formulaciones/${editId}` : "/api/formulaciones";
      const method = editId != null ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Error al guardar");

      const exito = editId != null ? "Formulación actualizada" : "Formulación creada";
      setForm(EMPTY_FORM);
      setEditId(null);
      setShowForm(false);
      setMensaje(exito);
      setTimeout(() => setMensaje(""), 2500);
      await cargar();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "Error");
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
              Formulaciones
            </h1>
          </div>
          <Link
            href="/configuracion"
            className="flex items-center gap-1.5 text-[13px] font-medium text-verde-100 hover:text-white transition-colors"
          >
            <IconArrowLeft /> Volver a configuración
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        {/* --- Botón nueva --- */}
        {!showForm && (
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setEditId(null);
              setMensaje("");
              setShowForm(true);
            }}
            className="btn-primary flex items-center justify-center gap-2 mb-5"
          >
            <IconPlus /> Nueva formulación
          </button>
        )}

        {/* --- Formulario --- */}
        {showForm && (
          <form onSubmit={guardar} className="page-card mb-5 flex flex-col gap-4">
            <h2 className="text-[15px] font-semibold text-verde-900">
              {editId != null ? "Editar formulación" : "Nueva formulación"}
            </h2>

            {/* Identificación */}
            <div>
              <label className="text-[11px] font-semibold text-verde-700/70 uppercase tracking-wider block mb-1">
                Nombre *
              </label>
              <input
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setField("nombre", e.target.value)}
                className="input-field"
                placeholder="Ej: Mezcla bovina estándar"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-verde-700/70 uppercase tracking-wider block mb-1">
                Descripción
              </label>
              <textarea
                rows={2}
                value={form.descripcion}
                onChange={(e) => setField("descripcion", e.target.value)}
                className="input-field resize-none"
                placeholder="Contexto, uso típico, observaciones generales"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-verde-700/70 uppercase tracking-wider block mb-1">
                Base de cálculo *
              </label>
              <select
                value={form.base_calculo}
                onChange={(e) => setField("base_calculo", e.target.value as "humeda" | "seca")}
                className="input-field"
              >
                <option value="humeda">Húmeda</option>
                <option value="seca">Seca</option>
              </select>
            </div>

            {/* Composición % */}
            <div className="rounded-xl border border-verde-100 bg-verde-50/40 p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-verde-700 uppercase tracking-wider">
                  Composición (%)
                </span>
                <span
                  className={`text-[13px] font-bold tabular-nums ${
                    sumaOk ? "text-verde-700" : "text-red-600"
                  }`}
                >
                  {sumaPct.toFixed(1)} / 100
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <PctInput label="Lirio acuático" value={form.lirio_acuatico_pct} onChange={(v) => setField("lirio_acuatico_pct", v)} />
                <PctInput label="Excreta" value={form.excreta_pct} onChange={(v) => setField("excreta_pct", v)} />
                <PctInput label="Hojarasca" value={form.hojarasca_pct} onChange={(v) => setField("hojarasca_pct", v)} />
                <PctInput label="Residuos vegetales" value={form.residuos_vegetales_pct} onChange={(v) => setField("residuos_vegetales_pct", v)} />
                <div className="col-span-2">
                  <PctInput label="Material estructurante" value={form.material_estructurante_pct} onChange={(v) => setField("material_estructurante_pct", v)} />
                </div>
              </div>
            </div>

            {/* Detalles adicionales */}
            <div>
              <label className="text-[11px] font-semibold text-verde-700/70 uppercase tracking-wider block mb-1">
                Tipo de excreta
              </label>
              <select
                value={form.tipo_excreta}
                onChange={(e) => setField("tipo_excreta", e.target.value as FormState["tipo_excreta"])}
                className="input-field"
              >
                <option value="">— Sin especificar —</option>
                <option value="bovina">Bovina</option>
                <option value="ovina">Ovina</option>
                <option value="equina">Equina</option>
                <option value="gallinaza">Gallinaza</option>
                <option value="mixta">Mixta</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-verde-700/70 uppercase tracking-wider block mb-1">
                  Relación C/N
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={form.relacion_cn_estimada}
                  onChange={(e) => setField("relacion_cn_estimada", e.target.value)}
                  className="input-field"
                  placeholder="Ej: 28"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-verde-700/70 uppercase tracking-wider block mb-1">
                  Humedad inicial (%)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.humedad_inicial_estimada}
                  onChange={(e) => setField("humedad_inicial_estimada", e.target.value)}
                  className="input-field"
                  placeholder="Ej: 60"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-verde-700/70 uppercase tracking-wider block mb-1">
                Nivel de estructura
              </label>
              <select
                value={form.nivel_estructura}
                onChange={(e) => setField("nivel_estructura", e.target.value as FormState["nivel_estructura"])}
                className="input-field"
              >
                <option value="">— Sin especificar —</option>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-verde-700/70 uppercase tracking-wider block mb-1">
                Notas
              </label>
              <textarea
                rows={2}
                value={form.notas}
                onChange={(e) => setField("notas", e.target.value)}
                className="input-field resize-none"
                placeholder="Observaciones adicionales"
              />
            </div>

            <label className="flex items-center gap-2 text-[13px] text-verde-900 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.activa}
                onChange={(e) => setField("activa", e.target.checked)}
                className="w-4 h-4 accent-verde-700 rounded"
              />
              Formulación activa
            </label>

            {mensaje && (
              <div
                className={`text-[13px] font-medium text-center ${
                  mensaje === "Formulación creada" || mensaje === "Formulación actualizada"
                    ? "text-verde-600"
                    : "text-red-600"
                }`}
              >
                {mensaje}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditId(null);
                  setForm(EMPTY_FORM);
                  setMensaje("");
                }}
                className="flex-1 px-4 py-3 rounded-xl border border-verde-200 text-verde-800 font-semibold text-[14px] bg-white active:scale-95 transition-transform"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !sumaOk || !form.nombre.trim()}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}

        {/* --- Listado --- */}
        {loading && (
          <div className="text-center text-verde-600 py-8 text-[14px] animate-pulse-fade">
            Cargando formulaciones...
          </div>
        )}

        {error && (
          <div className="page-card border-red-200 bg-red-50 text-[14px] text-red-700">{error}</div>
        )}

        {!showForm && mensaje && (
          <div
            className={`page-card text-[13px] font-medium text-center mb-3 ${
              mensaje === "Formulación creada" || mensaje === "Formulación actualizada"
                ? "border-verde-200 bg-verde-50 text-verde-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {mensaje}
          </div>
        )}

        {!loading && !error && lista.length === 0 && !showForm && (
          <div className="text-center text-gray-400 py-10 text-[14px]">
            No hay formulaciones registradas.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {lista.map((f) => (
            <article key={f.id} className="page-card">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-[15px] font-semibold text-verde-900 leading-tight">{f.nombre}</h3>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    f.activa ? "bg-verde-100 text-verde-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {f.activa ? "Activa" : "Inactiva"}
                </span>
              </div>

              {f.descripcion && (
                <p className="text-[13px] text-gray-500 leading-snug mb-2">{f.descripcion}</p>
              )}

              <div className="flex flex-wrap gap-1.5 text-[11px] text-verde-700 mb-2">
                <Badge>Base: {f.base_calculo}</Badge>
                {f.tipo_excreta && <Badge>Excreta: {f.tipo_excreta}</Badge>}
                {f.nivel_estructura && <Badge>Estructura: {f.nivel_estructura}</Badge>}
                {f.relacion_cn_estimada != null && <Badge>C/N: {f.relacion_cn_estimada}</Badge>}
                {f.humedad_inicial_estimada != null && <Badge>Hum: {f.humedad_inicial_estimada}%</Badge>}
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <Row label="Lirio" value={f.lirio_acuatico_pct} />
                <Row label="Excreta" value={f.excreta_pct} />
                <Row label="Hojarasca" value={f.hojarasca_pct} />
                <Row label="Res. vegetales" value={f.residuos_vegetales_pct} />
                <Row label="Estructurante" value={f.material_estructurante_pct} />
              </dl>

              {f.notas && (
                <p className="mt-2 text-[12px] text-gray-500 italic leading-snug border-t border-verde-50 pt-2">
                  {f.notas}
                </p>
              )}

              {f.n_asociaciones > 0 && (
                <p className="mt-2 text-[11px] text-gray-500">
                  Usada en {f.n_asociaciones} compostera{f.n_asociaciones === 1 ? "" : "s"}.
                </p>
              )}

              <div className="flex gap-2 mt-3 pt-2 border-t border-verde-50">
                <button
                  type="button"
                  onClick={() => editar(f)}
                  className="flex-1 px-3 py-2 rounded-lg border border-verde-200 text-verde-800 font-semibold text-[12px] bg-white active:scale-95 transition-transform"
                >
                  Editar
                </button>
                {!f.activa ? (
                  <button
                    type="button"
                    onClick={() => toggleActiva(f)}
                    disabled={deletingId === f.id}
                    className="flex-1 px-3 py-2 rounded-lg border border-verde-300 text-verde-700 font-semibold text-[12px] bg-white active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {deletingId === f.id ? "..." : "Reactivar"}
                  </button>
                ) : f.n_asociaciones > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleActiva(f)}
                    disabled={deletingId === f.id}
                    className="flex-1 px-3 py-2 rounded-lg border border-amber-300 text-amber-700 font-semibold text-[12px] bg-white active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {deletingId === f.id ? "..." : "Desactivar"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => borrar(f)}
                    disabled={deletingId === f.id}
                    className="flex-1 px-3 py-2 rounded-lg border border-red-200 text-red-600 font-semibold text-[12px] bg-white active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {deletingId === f.id ? "Eliminando..." : "Borrar"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

function PctInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-verde-900/80 block mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full px-3 py-2.5 pr-8 border border-verde-200 rounded-lg text-[14px] bg-white outline-none focus:border-verde-500 transition-colors"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">%</span>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-verde-50 border border-verde-100 px-2 py-0.5 rounded-full">{children}</span>
  );
}

function Row({ label, value }: { label: string; value: number | null }) {
  return (
    <>
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-verde-900 font-medium text-right tabular-nums">
        {value != null ? `${value}%` : "—"}
      </dd>
    </>
  );
}
