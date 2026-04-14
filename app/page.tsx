"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import { getStatus } from "@/lib/estado";
import { hoyISO, diasDesde } from "@/lib/fechas";
import { HUMEDAD_NIVELES } from "@/lib/humedad";
import type { ComposteraInfo, Message } from "@/lib/types";
import {
  IconClipboard,
  IconChat,
  IconArrowLeft,
  IconSend,
  IconLeaf,
  IconChart,
  IconCamera,
} from "@/components/ui/icons";
import { FotoModal } from "@/components/ui/FotoModal";
import { AnalisisBadge } from "@/components/ui/AnalisisBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { useFotoModal } from "@/hooks/useFotoModal";
import { useComposteras } from "@/hooks/useComposteras";

export default function Home() {
  const [mode, setMode] = useState<"select" | "registro" | "pregunta" | "chat" | "diagnostico-historico">("select");
  const { composteras, activas: activeComposteras } = useComposteras();
  const [compostera, setCompostera] = useState("1");
  const [temp, setTemp] = useState("");
  const [ph, setPh] = useState("");
  const [hum, setHum] = useState("");
  const [obs, setObs] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const fotoModal = useFotoModal();

  const [freeQuestion, setFreeQuestion] = useState("");
  const [saveStatus, setSaveStatus] = useState<"" | "ok" | "error">("");
  const [validationError, setValidationError] = useState("");
  const photo = usePhotoUpload();
  const analysis = useImageAnalysis();
  const [datosGuardados, setDatosGuardados] = useState(false);
  const [noGuardarPregunta, setNoGuardarPregunta] = useState(true);
  const [diagCompostera, setDiagCompostera] = useState("1");
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState("");
  const [fechaRegistro, setFechaRegistro] = useState(hoyISO());
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const selectedInfo = composteras.find((c) => c.id === parseInt(compostera));
  const diaActual = selectedInfo?.fecha_inicio ? diasDesde(selectedInfo.fecha_inicio.split("T")[0], fechaRegistro) : null;
  const activasCount = activeComposteras.length;
  const hoyStr = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  function clearFoto() { photo.clear(); analysis.reset(); }

  async function handleAnalizar() {
    if (!photo.foto) return;
    const data = await analysis.analizar(photo.foto);
    if (data) {
      setObs((prev) => (prev.trim() ? `${prev.trim()} ${data.resultado}` : data.resultado));
    }
  }

  async function saveMedicion(estado: string, fotoUrl: string | null): Promise<boolean> {
    try {
      const res = await fetch("/api/mediciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compostera: parseInt(compostera), dia: diaActual,
          temperatura: parseFloat(temp), ph: parseFloat(ph), humedad: parseFloat(hum),
          observaciones: obs || null, estado, foto_url: fotoUrl,
          fecha: fechaRegistro !== hoyISO() ? fechaRegistro : null,
        }),
      });
      setSaveStatus(res.ok ? "ok" : "error");
      setTimeout(() => setSaveStatus(""), 3000);
      return res.ok;
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(""), 3000);
      return false;
    }
  }

  async function callAgent(userMsg: string, newMessages?: Message[], tipo?: string) {
    setLoading(true);
    const msgs: Message[] = newMessages || [...messages, { role: "user", content: userMsg }];
    if (!newMessages) setMessages(msgs);
    const tipoFinal = tipo || "pregunta";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
          tipo: tipoFinal,
          compostera: tipoFinal === "diagnostico" ? parseInt(compostera) : null,
          guardar: tipoFinal === "diagnostico" ? true : !noGuardarPregunta,
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || "Error al obtener respuesta. Intenta de nuevo.";
      setMessages([...msgs, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...msgs, { role: "assistant", content: "Error de conexión. Verifica tu internet e intenta de nuevo." }]);
    }
    setLoading(false);
  }

  async function handleGuardar() {
    const t = parseFloat(temp), p = parseFloat(ph), h = parseFloat(hum);
    if (isNaN(t) || isNaN(p) || isNaN(h)) return;
    if (t < 0 || t > 100) { setValidationError("Temperatura debe estar entre 0 y 100°C"); return; }
    if (p < 0 || p > 14) { setValidationError("pH debe estar entre 0 y 14"); return; }
    setValidationError("");
    setLoading(true);

    const status = getStatus(t, p, h, diaActual);
    let fotoUrl: string | null = null;
    if (photo.foto) {
      try {
        fotoUrl = await photo.upload();
      } catch (e) {
        setValidationError(
          e instanceof Error
            ? `No se pudo subir la foto: ${e.message}. Quita la foto para guardar sin ella, o intenta de nuevo.`
            : "No se pudo subir la foto.",
        );
        setLoading(false);
        return;
      }
    }
    const saved = await saveMedicion(status.key, fotoUrl);
    setLoading(false);
    if (!saved) {
      setValidationError("No se pudo guardar la medición. Verifica tu conexión e intenta de nuevo.");
      return;
    }
    setDatosGuardados(true);
  }

  function handlePedirDiagnostico() {
    const t = parseFloat(temp), p = parseFloat(ph), h = parseFloat(hum);
    const nombre = selectedInfo?.nombre ? `${selectedInfo.nombre} (#${compostera})` : `#${compostera}`;
    const nivelHum = HUMEDAD_NIVELES.find((n) => n.value === h);
    let msg = `DATOS DE COMPOSTERA ${nombre}`;
    if (diaActual) msg += ` | Día ${diaActual} del proceso`;
    msg += `\n- Temperatura: ${t}°C\n- pH: ${p}\n- Humedad: ${nivelHum ? `${nivelHum.label} (~${h}%)` : `${h}%`}`;
    if (obs.trim()) msg += `\n- Observaciones: ${obs}`;
    msg += `\n\nDame tu diagnóstico y recomendaciones.`;
    const newMsgs: Message[] = [{ role: "user", content: msg }];
    setMessages(newMsgs);
    setMode("chat");
    callAgent(msg, newMsgs, "diagnostico");
  }

  function handleFreeQuestion() {
    if (!freeQuestion.trim()) return;
    const q = freeQuestion.trim();
    setFreeQuestion("");
    const newMsgs: Message[] = [...messages, { role: "user", content: q }];
    setMessages(newMsgs);
    if (mode !== "chat") setMode("chat");
    callAgent(q, newMsgs);
  }

  async function handleDiagnosticoHistorico() {
    setDiagLoading(true);
    setDiagError("");
    try {
      const res = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compostera: parseInt(diagCompostera) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDiagError(data.error || "Error al obtener diagnóstico.");
        setDiagLoading(false);
        return;
      }
      setMessages([
        { role: "user", content: `Diagnóstico histórico de compostera #${diagCompostera}` },
        { role: "assistant", content: data.reply, fotos: Array.isArray(data.fotos) ? data.fotos : [] },
      ]);
      setMode("chat");
    } catch {
      setDiagError("Error de conexión. Verifica tu internet.");
    }
    setDiagLoading(false);
  }

  function resetAll() {
    setMode("select");
    setMessages([]);
    setCompostera("1");
    setTemp(""); setPh(""); setHum(""); setObs(""); setFreeQuestion("");
    clearFoto();
    setDatosGuardados(false);
    setFechaRegistro(hoyISO());
  }

  const canSubmit = temp !== "" && ph !== "" && hum !== "";
  const statusPreview =
    canSubmit && !isNaN(parseFloat(temp)) && !isNaN(parseFloat(ph)) && !isNaN(parseFloat(hum))
      ? getStatus(parseFloat(temp), parseFloat(ph), parseFloat(hum), diaActual)
      : null;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        kicker="Bitácora · Índice"
        title="Estación de campo."
        subtitle="Monitoreo y diagnóstico de composta de lirio acuático en San Francisco Bojay, Hidalgo. Cada medición es una entrada de esta bitácora compartida."
        folio={`${hoyStr.toUpperCase()} · ${activasCount} COMPOSTERAS`}
        nav={[
          { href: "/", label: "Índice", active: true },
          { href: "/historial", label: "Historial" },
          { href: "/consultas", label: "Consultas" },
          { href: "/configuracion", label: "Configuración" },
        ]}
        onLogout={handleLogout}
      />

      <main className="max-w-[960px] mx-auto px-5 md:px-8 py-8 md:py-12">
        {/* ---- SELECT MODE ---- */}
        {mode === "select" && (
          <div className="animate-fade-in">
            <div className="flex items-baseline justify-between mb-6">
              <div className="kicker">Tres acciones</div>
              <div className="font-mono text-[10.5px] text-tinta-500 uppercase tracking-wider">01 · 02 · 03</div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 stagger">
              <ActionTile
                index="01"
                title="Registrar medición"
                body="Captura temperatura, pH y humedad de una compostera. Incluye foto y observaciones de campo."
                accent="tinta"
                icon={<IconClipboard />}
                onClick={() => setMode("registro")}
              />
              <ActionTile
                index="02"
                title="Consultar al agente"
                body="Haz una pregunta libre sobre el proceso de compostaje sin registrar datos."
                accent="ocre"
                icon={<IconChat />}
                onClick={() => setMode("pregunta")}
              />
              <ActionTile
                index="03"
                title="Diagnóstico integral"
                body="Analiza todo el historial de una compostera y obtén recomendaciones concretas."
                accent="arcilla"
                icon={<IconChart />}
                onClick={() => setMode("diagnostico-historico")}
              />
            </div>

            {/* Tira de composteras activas */}
            {activasCount > 0 && (
              <div className="mt-10 pt-6 border-t border-tinta-900/10">
                <div className="flex items-baseline justify-between mb-4">
                  <div className="kicker">Composteras activas</div>
                  <Link
                    href="/configuracion"
                    className="text-[11px] font-semibold uppercase tracking-kicker text-tinta-600 hover:text-tinta-900 transition-colors"
                  >
                    Gestionar →
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {activeComposteras.slice(0, 10).map((c) => {
                    const dia = c.fecha_inicio ? diasDesde(c.fecha_inicio.split("T")[0], hoyISO()) : null;
                    return (
                      <div
                        key={c.id}
                        className="relative bg-papel-50/70 border border-tinta-900/10 rounded-md px-3 py-2.5 hover:border-tinta-600 transition-colors"
                      >
                        <div className="font-mono text-[10px] text-tinta-500 tabular-nums">N.º {String(c.id).padStart(2, "0")}</div>
                        <div className="font-display text-[15px] font-semibold text-tinta-900 leading-tight mt-0.5 truncate">
                          {c.nombre || `Compostera ${c.id}`}
                        </div>
                        {dia !== null && (
                          <div className="font-mono text-[10.5px] text-ocre-600 mt-1 tabular-nums">
                            D {dia}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---- REGISTRO MODE ---- */}
        {mode === "registro" && (
          <div className="animate-fade-in max-w-[600px]">
            <button onClick={resetAll} className="btn-ghost mb-5">
              <IconArrowLeft /> Volver al índice
            </button>

            <div className="page-card">
              <div className="flex items-baseline justify-between mb-5">
                <div>
                  <div className="kicker">Entrada nueva</div>
                  <h2 className="font-display text-[28px] font-black text-tinta-900 leading-tight mt-1">
                    Registro de medición
                  </h2>
                </div>
                <div className="hidden sm:block font-mono text-[11px] text-tinta-500 tabular-nums">
                  01 / 04
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="input-label">Compostera</label>
                  <select value={compostera} onChange={(e) => setCompostera(e.target.value)} className="input-field">
                    {(activeComposteras.length > 0
                      ? activeComposteras
                      : Array.from({ length: 10 }, (_, i) => ({ id: i + 1, nombre: null } as ComposteraInfo))
                    ).map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.id}{c.nombre ? ` — ${c.nombre}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">Fecha</label>
                  <input
                    type="date"
                    value={fechaRegistro}
                    max={hoyISO()}
                    onChange={(e) => setFechaRegistro(e.target.value || hoyISO())}
                    className="input-field"
                  />
                </div>
              </div>

              {fechaRegistro !== hoyISO() && (
                <div className="text-[11px] text-arcilla-600 font-semibold uppercase tracking-kicker -mt-2 mb-3">
                  · Registro con fecha atrasada
                </div>
              )}

              {diaActual !== null && (
                <div className="mb-4 flex items-center justify-between px-3.5 py-2.5 bg-tinta-50/60 border border-tinta-900/10 rounded-md">
                  <div className="flex items-center gap-2 text-tinta-700 text-[12px] font-semibold uppercase tracking-kicker">
                    <IconLeaf /> Día del proceso
                  </div>
                  <div className="font-mono text-[18px] font-semibold text-tinta-900 tabular-nums">
                    D {diaActual}
                  </div>
                </div>
              )}

              {/* Panel de instrumentos: 3 mediciones */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <InstrumentField label="Temperatura" unit="°C">
                  <input type="number" step="0.1" min="0" max="100" placeholder="55" value={temp} onChange={(e) => setTemp(e.target.value)} className="input-field text-center font-mono text-[18px] py-3.5" />
                </InstrumentField>
                <InstrumentField label="pH" unit="">
                  <input type="number" step="0.1" min="0" max="14" placeholder="7.0" value={ph} onChange={(e) => setPh(e.target.value)} className="input-field text-center font-mono text-[18px] py-3.5" />
                </InstrumentField>
                <InstrumentField label="Humedad" unit="">
                  <select value={hum} onChange={(e) => setHum(e.target.value)} className="input-field text-center font-mono text-[13px] py-3.5">
                    <option value="">—</option>
                    {HUMEDAD_NIVELES.map((n) => (
                      <option key={n.label} value={n.value}>{n.label}</option>
                    ))}
                  </select>
                </InstrumentField>
              </div>

              {statusPreview && (
                <div className={`flex items-center justify-between px-3.5 py-3 rounded-md mb-4 ring-1 ${statusPreview.bg} ${statusPreview.ring}`}>
                  <div className="kicker !text-inherit opacity-80" style={{ color: "inherit" }}>
                    <span className={statusPreview.color}>Estado preliminar</span>
                  </div>
                  <div className={`flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-kicker ${statusPreview.color}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${statusPreview.key === "good" ? "bg-tinta-500" : statusPreview.key === "warning" ? "bg-ocre-400" : "bg-arcilla-500"}`} />
                    {statusPreview.label}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="input-label">Observaciones de campo</label>
                <input type="text" placeholder="Olor, color, fauna, volteo reciente…" value={obs} onChange={(e) => setObs(e.target.value)} className="input-field" />
              </div>

              <div className="mb-5">
                <label className="input-label">Evidencia fotográfica</label>
                <input
                  ref={photo.inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={photo.handleSelect}
                  className="hidden"
                />
                {!photo.fotoPreview ? (
                  <button
                    type="button"
                    onClick={photo.open}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-4 rounded-md border border-dashed border-tinta-300 bg-papel-50/50 text-tinta-600 text-[12.5px] font-semibold uppercase tracking-[0.14em] transition-all hover:border-tinta-600 hover:text-tinta-900 hover:bg-papel-50 active:scale-[0.99]"
                  >
                    <IconCamera />
                    Tomar foto de la composta
                  </button>
                ) : (
                  <div className="relative rounded-md overflow-hidden border border-tinta-900/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.fotoPreview} alt="Preview" className="w-full h-44 object-cover" />
                    <button
                      type="button"
                      onClick={clearFoto}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-tinta-900/80 text-papel-50 flex items-center justify-center text-[14px] hover:bg-tinta-900"
                    >
                      ×
                    </button>
                    {photo.uploading && (
                      <div className="absolute inset-0 bg-papel-50/70 flex items-center justify-center">
                        <span className="text-[12px] font-semibold uppercase tracking-kicker text-tinta-700 animate-pulse-fade">Subiendo…</span>
                      </div>
                    )}
                  </div>
                )}
                {photo.foto && (
                  <>
                    <button
                      type="button"
                      onClick={handleAnalizar}
                      disabled={analysis.analyzing}
                      className="btn-outline w-full mt-2"
                    >
                      {analysis.analyzing ? "Analizando…" : "Analizar imagen con IA"}
                    </button>
                    {analysis.error && (
                      <div className="mt-2 px-3 py-2 rounded-sm text-[11.5px] font-semibold text-arcilla-700 bg-arcilla-50 ring-1 ring-arcilla-200">
                        {analysis.error}
                      </div>
                    )}
                    <AnalisisBadge estado={analysis.data?.estado} accion={analysis.data?.accion} />
                  </>
                )}
              </div>

              {validationError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-sm mb-3 text-[12.5px] font-semibold text-arcilla-700 bg-arcilla-50 ring-1 ring-arcilla-200 animate-fade-in">
                  {validationError}
                </div>
              )}

              {!datosGuardados ? (
                <button onClick={handleGuardar} disabled={!canSubmit || loading} className="btn-primary">
                  {loading ? "Guardando medición…" : "Guardar en bitácora"}
                </button>
              ) : (
                <div className="flex flex-col gap-2 animate-fade-in">
                  <div className="flex items-center justify-center gap-2 px-3 py-3 rounded-sm text-[12px] font-semibold uppercase tracking-kicker text-tinta-700 bg-tinta-50 ring-1 ring-tinta-200">
                    ✓ Entrada guardada en bitácora
                  </div>
                  <button onClick={handlePedirDiagnostico} className="btn-primary">
                    Pedir diagnóstico al agente
                  </button>
                  <button onClick={resetAll} className="btn-outline">
                    Listo, sin diagnóstico
                  </button>
                </div>
              )}

              {saveStatus === "error" && (
                <div className="text-center text-[12px] font-semibold uppercase tracking-kicker mt-2 animate-fade-in text-arcilla-600">
                  ✗ Error al guardar
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- PREGUNTA MODE ---- */}
        {mode === "pregunta" && (
          <div className="animate-fade-in max-w-[600px]">
            <button onClick={resetAll} className="btn-ghost mb-5">
              <IconArrowLeft /> Volver al índice
            </button>

            <div className="page-card">
              <div className="kicker text-ocre-600">Pregunta libre</div>
              <h2 className="font-display text-[28px] font-black text-tinta-900 leading-tight mt-1 mb-2">
                Consulta al agente
              </h2>
              <p className="text-[13.5px] text-tinta-600 mb-5 leading-relaxed">
                Pregunta lo que quieras sobre compostaje de lirio. No se registra ningún dato de compostera.
              </p>

              <label className="flex items-center gap-2.5 mb-4 text-[12.5px] text-tinta-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noGuardarPregunta}
                  onChange={(e) => setNoGuardarPregunta(e.target.checked)}
                  className="w-4 h-4 rounded-xs accent-tinta-800"
                />
                No guardar esta pregunta en el historial de consultas
              </label>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="¿Cuánto aserrín le pongo?"
                  value={freeQuestion}
                  onChange={(e) => setFreeQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && freeQuestion.trim()) handleFreeQuestion(); }}
                  className="input-field flex-1"
                />
                <button
                  onClick={handleFreeQuestion}
                  disabled={!freeQuestion.trim()}
                  className="flex items-center justify-center w-12 h-12 rounded-md bg-tinta-800 text-papel-50 transition-all active:scale-95 disabled:bg-tinta-200 disabled:text-tinta-400"
                >
                  <IconSend />
                </button>
              </div>

              <div className="text-[10.5px] font-semibold uppercase tracking-kicker text-tinta-500 mb-2">Sugerencias</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "¿Cuándo voltear?",
                  "¿Cómo bajar humedad?",
                  "¿Qué mezclar con el lirio?",
                  "¿Cuánto tarda la composta?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setFreeQuestion(q)}
                    className="px-3 py-1.5 bg-papel-100 border border-tinta-900/10 rounded-full text-[12px] font-medium text-tinta-700 transition-all hover:bg-papel-200 hover:border-tinta-600 active:scale-[0.98]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---- DIAGNOSTICO HISTORICO MODE ---- */}
        {mode === "diagnostico-historico" && (
          <div className="animate-fade-in max-w-[600px]">
            <button onClick={resetAll} className="btn-ghost mb-5">
              <IconArrowLeft /> Volver al índice
            </button>

            <div className="page-card">
              <div className="kicker text-arcilla-600">Análisis integral</div>
              <h2 className="font-display text-[28px] font-black text-tinta-900 leading-tight mt-1 mb-2">
                Diagnóstico de compostera
              </h2>
              <p className="text-[13.5px] text-tinta-600 mb-5 leading-relaxed">
                Analiza todo el historial de mediciones de una compostera y genera un diagnóstico con recomendaciones.
              </p>

              <div className="mb-4">
                <label className="input-label">Compostera a analizar</label>
                <select value={diagCompostera} onChange={(e) => setDiagCompostera(e.target.value)} className="input-field">
                  {(activeComposteras.length > 0
                    ? activeComposteras
                    : Array.from({ length: 10 }, (_, i) => ({ id: i + 1, nombre: null } as ComposteraInfo))
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.id}{c.nombre ? ` — ${c.nombre}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {diagError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-sm mb-3 text-[12.5px] font-semibold text-arcilla-700 bg-arcilla-50 ring-1 ring-arcilla-200 animate-fade-in">
                  {diagError}
                </div>
              )}

              <button onClick={handleDiagnosticoHistorico} disabled={diagLoading} className="btn-primary">
                {diagLoading ? "Analizando historial…" : "Generar diagnóstico"}
              </button>
            </div>
          </div>
        )}

        {/* ---- CHAT MODE ---- */}
        {mode === "chat" && (
          <div className="animate-fade-in max-w-[720px]">
            <button onClick={resetAll} className="btn-ghost mb-5">
              <IconArrowLeft /> Volver al índice
            </button>

            <div className="flex flex-col gap-3 mb-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-md px-4 py-4 text-[14px] leading-relaxed max-w-[92%] ${
                    m.role === "user"
                      ? "bg-tinta-900 text-papel-100 self-end whitespace-pre-wrap font-mono text-[13px]"
                      : "bg-papel-50 text-tinta-800 self-start border border-tinta-900/12 shadow-card"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-tinta-600 uppercase tracking-kicker mb-2.5 pb-2.5 border-b border-tinta-900/10">
                      <IconLeaf />
                      Agente · CompostaLirio
                    </div>
                  )}
                  {m.role === "assistant" ? (
                    <div className="prose-chat">
                      <Markdown>{m.content}</Markdown>
                    </div>
                  ) : (
                    m.content
                  )}
                  {m.role === "assistant" && m.fotos && m.fotos.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-tinta-900/10">
                      <div className="kicker mb-2">Últimas fotos</div>
                      <div className="flex gap-2 flex-wrap">
                        {m.fotos.map((f, idx) => {
                          const fecha = new Date(f.fecha).toLocaleDateString("es-MX", {
                            day: "numeric", month: "short", timeZone: "America/Mexico_City",
                          });
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => fotoModal.open(f.url)}
                              className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
                              aria-label="Ver foto en grande"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={f.url}
                                alt={`Foto ${fecha}`}
                                className="w-20 h-20 object-cover rounded-md border border-tinta-900/15"
                              />
                              <span className="font-mono text-[10px] text-tinta-500 leading-tight text-center tabular-nums">
                                {fecha}
                                {f.dia != null && <><br />D {f.dia}</>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="bg-papel-50 border border-tinta-900/12 rounded-md px-4 py-3.5 text-[13px] text-tinta-600 self-start shadow-card animate-pulse-fade">
                  <div className="flex items-center gap-2">
                    <IconLeaf />
                    <span className="uppercase tracking-kicker text-[11px] font-semibold">Analizando…</span>
                  </div>
                </div>
              )}
              <div ref={chatEnd} />
            </div>

            {/* Follow-up input */}
            <div className="sticky bottom-0 pt-6 pb-4 bg-gradient-to-t from-papel-100 via-papel-100/95 to-transparent -mx-5 px-5 md:-mx-8 md:px-8">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Pregunta de seguimiento…"
                  value={freeQuestion}
                  onChange={(e) => setFreeQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && handleFreeQuestion()}
                  disabled={loading}
                  className="input-field flex-1 disabled:opacity-50"
                />
                <button
                  onClick={handleFreeQuestion}
                  disabled={loading || !freeQuestion.trim()}
                  className="flex items-center justify-center w-12 h-12 rounded-md bg-tinta-800 text-papel-50 transition-all active:scale-95 disabled:bg-tinta-200 disabled:text-tinta-400"
                >
                  <IconSend />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <FotoModal url={fotoModal.url} onClose={fotoModal.close} />
    </div>
  );
}

/* ── Tile grande del índice ── */
type Accent = "tinta" | "ocre" | "arcilla";
function ActionTile({
  index, title, body, icon, accent, onClick,
}: {
  index: string; title: string; body: string;
  icon: React.ReactNode; accent: Accent; onClick: () => void;
}) {
  const rail =
    accent === "ocre" ? "before:bg-ocre-400" :
    accent === "arcilla" ? "before:bg-arcilla-500" :
    "before:bg-tinta-700";
  const iconTone =
    accent === "ocre" ? "bg-ocre-50 text-ocre-600 ring-ocre-200/60" :
    accent === "arcilla" ? "bg-arcilla-50 text-arcilla-600 ring-arcilla-200/60" :
    "bg-tinta-50 text-tinta-700 ring-tinta-200/60";

  return (
    <button
      onClick={onClick}
      className={`group relative text-left bg-papel-50 border border-tinta-900/10 rounded-md p-5 pt-14 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover active:translate-y-0 before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] ${rail}`}
    >
      <span className="absolute top-4 left-5 font-mono text-[11px] text-tinta-500 tabular-nums">N.º {index}</span>
      <span className={`absolute top-3.5 right-4 w-8 h-8 rounded-sm flex items-center justify-center ring-1 ${iconTone}`}>
        {icon}
      </span>
      <h3 className="font-display text-[22px] font-black text-tinta-900 leading-tight tracking-tight mb-2">
        {title}
      </h3>
      <p className="text-[13px] text-tinta-600 leading-relaxed">
        {body}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-kicker text-tinta-700 group-hover:text-arcilla-600 transition-colors">
        Abrir <span className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </button>
  );
}

function InstrumentField({
  label, unit, children,
}: { label: string; unit?: string; children: React.ReactNode }) {
  return (
    <div className="bg-papel-50/60 border border-tinta-900/10 rounded-md p-2.5">
      <div className="flex items-baseline justify-between mb-1.5 px-0.5">
        <span className="text-[9.5px] font-semibold uppercase tracking-kicker text-tinta-500">{label}</span>
        {unit && <span className="font-mono text-[9.5px] text-tinta-500">{unit}</span>}
      </div>
      {children}
    </div>
  );
}
