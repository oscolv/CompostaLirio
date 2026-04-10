"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Markdown from "react-markdown";

type Status = { label: string; key: string; color: string; bg: string; ring: string };

const GOOD: Status = { label: "En rango", key: "good", color: "text-verde-700", bg: "bg-verde-50", ring: "ring-verde-200" };
const WARN: Status = { label: "Atenci\u00f3n", key: "warning", color: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200" };
const DANGER: Status = { label: "Fuera de rango", key: "danger", color: "text-red-700", bg: "bg-red-50", ring: "ring-red-200" };

function getStatus(temp: number, ph: number, hum: number, dia?: number | null): Status {
  // Determine phase from day of process
  let phase: "mesofilica" | "termofilica" | "maduracion" = "mesofilica";
  if (dia && dia > 30) phase = "maduracion";
  else if (dia && dia > 7) phase = "termofilica";

  // Phase-specific optimal ranges [min, max]
  const ranges = {
    mesofilica:  { temp: [25, 40], ph: [5.5, 7.0], hum: [55, 65] },
    termofilica: { temp: [55, 65], ph: [7.0, 8.5], hum: [50, 60] },
    maduracion:  { temp: [25, 40], ph: [6.5, 8.0], hum: [45, 55] },
  }[phase];

  // Hard danger limits (regardless of phase)
  if (temp > 75 || temp < 10 || ph < 4.0 || ph > 9.5 || hum < 25 || hum > 85) return DANGER;

  // Check each parameter against phase range with warning margin of ~15%
  let worst: Status = GOOD;
  function check(val: number, min: number, max: number) {
    const margin = (max - min) * 0.3;
    if (val < min - margin || val > max + margin) worst = DANGER;
    else if (val < min || val > max) { if (worst !== DANGER) worst = WARN; }
  }

  check(temp, ranges.temp[0], ranges.temp[1]);
  check(ph, ranges.ph[0], ranges.ph[1]);
  check(hum, ranges.hum[0], ranges.hum[1]);
  return worst;
}

type Message = { role: "user" | "assistant"; content: string };

const HUMEDAD_NIVELES: { label: string; value: number }[] = [
  { label: "DRY++", value: 20 },
  { label: "DRY+", value: 30 },
  { label: "DRY", value: 40 },
  { label: "WET", value: 55 },
  { label: "WET+", value: 70 },
  { label: "WET++", value: 85 },
];

type ComposteraInfo = {
  id: number;
  nombre: string | null;
  fecha_inicio: string | null;
  activa: boolean;
};

function diasDesde(fecha: string): number {
  const inicio = new Date(fecha + "T00:00:00");
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/* ---- SVG Icons ---- */
function IconClipboard() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 1.136.845 2.1 1.976 2.193 1.31.109 2.637.163 3.974.163l3 3v-3.091c.34-.02.68-.045 1.02-.072 1.133-.094 1.98-1.057 1.98-2.193V10.608c0-.969-.616-1.813-1.5-2.097z" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  );
}

function IconLeaf() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.71c.15-.43.31-.85.49-1.26C8.1 19.83 10.28 21 13 21c5.5 0 9-3.5 9-9V3l-1-.5C21 2.5 17 2 17 8zm-4 11c-1.78 0-3.35-.65-4.59-1.76C10.77 13.83 14.53 11.29 17 10c-2.49 1.29-5.36 4.07-6.81 7.25-.23-.48-.39-.98-.39-1.5 0-1.5.89-2.83 2.2-3.42.68-.3 1.42-.47 2.16-.49C16 11 17 10 17 8s2-4 4-4v4c0 4.5-3.5 8-8 8z" />
    </svg>
  );
}

export default function Home() {
  const [mode, setMode] = useState<"select" | "registro" | "pregunta" | "chat">("select");
  const [composteras, setComposteras] = useState<ComposteraInfo[]>([]);
  const [compostera, setCompostera] = useState("1");
  const [temp, setTemp] = useState("");
  const [ph, setPh] = useState("");
  const [hum, setHum] = useState("");
  const [obs, setObs] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [freeQuestion, setFreeQuestion] = useState("");
  const [saveStatus, setSaveStatus] = useState<"" | "ok" | "error">("");
  const [validationError, setValidationError] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [fotoUploading, setFotoUploading] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const fotoInput = useRef<HTMLInputElement>(null);

  const fetchComposteras = useCallback(async () => {
    try {
      const res = await fetch("/api/composteras");
      const rows = await res.json();
      if (Array.isArray(rows)) setComposteras(rows);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchComposteras(); }, [fetchComposteras]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const selectedInfo = composteras.find((c) => c.id === parseInt(compostera));
  const diaActual = selectedInfo?.fecha_inicio ? diasDesde(selectedInfo.fecha_inicio.split("T")[0]) : null;
  const activeComposteras = composteras.filter((c) => c.activa);

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

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  function clearFoto() {
    setFoto(null);
    setFotoPreview("");
    if (fotoInput.current) fotoInput.current.value = "";
  }

  async function uploadFoto(): Promise<string | null> {
    if (!foto) return null;
    setFotoUploading(true);
    try {
      const compressed = await compressImage(foto);
      const formData = new FormData();
      formData.append("foto", compressed);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) return null;
      const data = await res.json();
      return data.url;
    } catch {
      return null;
    } finally {
      setFotoUploading(false);
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
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
          tipo: tipo || "pregunta",
          compostera: tipo === "diagnostico" ? parseInt(compostera) : null,
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || "Error al obtener respuesta. Intenta de nuevo.";
      setMessages([...msgs, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...msgs, { role: "assistant", content: "Error de conexi\u00f3n. Verifica tu internet e intenta de nuevo." }]);
    }
    setLoading(false);
  }

  async function handleSubmitData() {
    const t = parseFloat(temp), p = parseFloat(ph), h = parseFloat(hum);
    if (isNaN(t) || isNaN(p) || isNaN(h)) return;

    // Validate ranges
    if (t < 0 || t > 100) { setValidationError("Temperatura debe estar entre 0 y 100\u00b0C"); return; }
    if (p < 0 || p > 14) { setValidationError("pH debe estar entre 0 y 14"); return; }
    setValidationError("");

    const status = getStatus(t, p, h, diaActual);

    // Upload photo first if present
    let fotoUrl: string | null = null;
    if (foto) {
      fotoUrl = await uploadFoto();
      // Photo upload failure is not blocking — save measurement anyway
    }

    const saved = await saveMedicion(status.key, fotoUrl);
    if (!saved) {
      setValidationError("No se pudo guardar la medición. Verifica tu conexión e intenta de nuevo.");
      return;
    }
    const nombre = selectedInfo?.nombre ? `${selectedInfo.nombre} (#${compostera})` : `#${compostera}`;
    const nivelHum = HUMEDAD_NIVELES.find((n) => n.value === h);
    let msg = `DATOS DE COMPOSTERA ${nombre}`;
    if (diaActual) msg += ` | D\u00eda ${diaActual} del proceso`;
    msg += `\n- Temperatura: ${t}\u00b0C\n- pH: ${p}\n- Humedad: ${nivelHum ? `${nivelHum.label} (~${h}%)` : `${h}%`}`;
    if (obs.trim()) msg += `\n- Observaciones: ${obs}`;
    msg += `\n\nDame tu diagn\u00f3stico y recomendaciones.`;
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

  function resetAll() {
    setMode("select");
    setMessages([]);
    setCompostera("1");
    setTemp(""); setPh(""); setHum(""); setObs(""); setFreeQuestion("");
    clearFoto();
  }

  const canSubmit = temp !== "" && ph !== "" && hum !== "";
  const statusPreview =
    canSubmit && !isNaN(parseFloat(temp)) && !isNaN(parseFloat(ph)) && !isNaN(parseFloat(hum))
      ? getStatus(parseFloat(temp), parseFloat(ph), parseFloat(hum), diaActual)
      : null;

  return (
    <div className="min-h-screen bg-crema-100">
      {/* Header */}
      <header className="bg-gradient-to-br from-verde-800 to-verde-950 px-5 py-6 text-white relative overflow-hidden">
        <div className="absolute -top-8 -right-4 text-[140px] opacity-[0.06] leading-none select-none rotate-12">
          {"\u{1F33F}"}
        </div>
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-verde-200 mb-1.5">
            San Francisco Bojay
          </div>
          <h1 className="font-display text-[28px] font-black leading-tight tracking-tight">
            Agente de Composta
          </h1>
          <nav className="flex items-center gap-4 mt-3 text-[13px] font-medium text-verde-200">
            <Link href="/historial" className="hover:text-white transition-colors">
              Historial
            </Link>
            <span className="w-px h-3 bg-verde-600" />
            <Link href="/consultas" className="hover:text-white transition-colors">
              Consultas
            </Link>
            <span className="w-px h-3 bg-verde-600" />
            <Link href="/configuracion" className="hover:text-white transition-colors">
              Config
            </Link>
            <span className="w-px h-3 bg-verde-600" />
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="hover:text-white transition-colors"
            >
              Salir
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-5">
        {/* ---- SELECT MODE ---- */}
        {mode === "select" && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <button
              onClick={() => setMode("registro")}
              className="page-card flex items-start gap-4 text-left transition-shadow duration-200 hover:shadow-card-hover active:scale-[0.98]"
            >
              <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-xl bg-verde-50 text-verde-700 flex items-center justify-center">
                <IconClipboard />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-verde-900 mb-0.5">
                  Registrar medici&oacute;n
                </div>
                <div className="text-[13px] text-gray-400 leading-snug">
                  Capturar temperatura, pH y humedad de una compostera
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode("pregunta")}
              className="page-card flex items-start gap-4 text-left transition-shadow duration-200 hover:shadow-card-hover active:scale-[0.98]"
            >
              <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-xl bg-tierra-400/10 text-tierra-600 flex items-center justify-center">
                <IconChat />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-gray-800 mb-0.5">
                  Solo preguntar
                </div>
                <div className="text-[13px] text-gray-400 leading-snug">
                  Consultar sobre compostaje sin registrar datos
                </div>
              </div>
            </button>
          </div>
        )}

        {/* ---- REGISTRO MODE ---- */}
        {mode === "registro" && (
          <div className="animate-fade-in">
            <button onClick={resetAll} className="flex items-center gap-1.5 text-verde-700 font-semibold text-[13px] mb-4 active:opacity-70 transition-opacity">
              <IconArrowLeft /> Volver
            </button>

            <div className="page-card">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-verde-50 text-verde-700 flex items-center justify-center">
                  <IconClipboard />
                </div>
                <h2 className="text-[15px] font-semibold text-verde-900">Registro de monitoreo</h2>
              </div>

              <div className="mb-4">
                <label className="input-label">Compostera</label>
                <select value={compostera} onChange={(e) => setCompostera(e.target.value)} className="input-field">
                  {(activeComposteras.length > 0
                    ? activeComposteras
                    : Array.from({ length: 10 }, (_, i) => ({ id: i + 1, nombre: null } as ComposteraInfo))
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.id}{c.nombre ? ` \u2014 ${c.nombre}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {diaActual !== null && (
                <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl mb-4 text-[13px] font-semibold text-verde-700 bg-verde-50 ring-1 ring-verde-200">
                  <IconLeaf />
                  D&iacute;a {diaActual} del proceso
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="input-label">Temp &deg;C</label>
                  <input type="number" step="0.1" min="0" max="100" placeholder="55" value={temp} onChange={(e) => setTemp(e.target.value)} className="input-field text-center" />
                </div>
                <div>
                  <label className="input-label">pH</label>
                  <input type="number" step="0.1" min="0" max="14" placeholder="7.0" value={ph} onChange={(e) => setPh(e.target.value)} className="input-field text-center" />
                </div>
                <div>
                  <label className="input-label">Humedad</label>
                  <select value={hum} onChange={(e) => setHum(e.target.value)} className="input-field text-center">
                    <option value="">—</option>
                    {HUMEDAD_NIVELES.map((n) => (
                      <option key={n.label} value={n.value}>{n.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {statusPreview && (
                <div className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl mb-4 text-[13px] font-semibold ring-1 ${statusPreview.color} ${statusPreview.bg} ${statusPreview.ring}`}>
                  <span className={`w-2 h-2 rounded-full ${statusPreview.key === "good" ? "bg-verde-500" : statusPreview.key === "warning" ? "bg-amber-500" : "bg-red-500"}`} />
                  {statusPreview.label}
                </div>
              )}

              <div className="mb-4">
                <label className="input-label">Observaciones (opcional)</label>
                <input type="text" placeholder="Olor, color, fauna, volteo reciente..." value={obs} onChange={(e) => setObs(e.target.value)} className="input-field" />
              </div>

              <div className="mb-5">
                <label className="input-label">Foto (opcional)</label>
                <input
                  ref={fotoInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFoto}
                  className="hidden"
                />
                {!fotoPreview ? (
                  <button
                    type="button"
                    onClick={() => fotoInput.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-verde-200 text-verde-600 text-[13px] font-semibold transition-colors hover:border-verde-400 hover:bg-verde-50/50 active:scale-[0.98]"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    Tomar foto de la composta
                  </button>
                ) : (
                  <div className="relative">
                    <img src={fotoPreview} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
                    <button
                      type="button"
                      onClick={clearFoto}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center text-[14px] font-bold hover:bg-black/70"
                    >
                      &times;
                    </button>
                    {fotoUploading && (
                      <div className="absolute inset-0 bg-white/60 rounded-xl flex items-center justify-center">
                        <span className="text-[13px] font-semibold text-verde-700 animate-pulse-fade">Subiendo foto...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {validationError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 text-[13px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200 animate-fade-in">
                  {validationError}
                </div>
              )}

              <button onClick={handleSubmitData} disabled={!canSubmit} className="btn-primary">
                Pedir diagn&oacute;stico
              </button>

              {saveStatus && (
                <div className={`text-center text-[13px] font-medium mt-2 animate-fade-in ${
                  saveStatus === "ok" ? "text-verde-600" : "text-red-600"
                }`}>
                  {saveStatus === "ok" ? "\u2713 Medici\u00f3n guardada" : "\u2717 Error al guardar medici\u00f3n"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- PREGUNTA MODE ---- */}
        {mode === "pregunta" && (
          <div className="animate-fade-in">
            <button onClick={resetAll} className="flex items-center gap-1.5 text-verde-700 font-semibold text-[13px] mb-4 active:opacity-70 transition-opacity">
              <IconArrowLeft /> Volver
            </button>

            <div className="page-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-tierra-400/10 text-tierra-600 flex items-center justify-center">
                  <IconChat />
                </div>
                <h2 className="text-[15px] font-semibold text-gray-800">Pregunta libre</h2>
              </div>
              <p className="text-[13px] text-gray-400 mb-5">
                Pregunta lo que quieras sobre compostaje de lirio. No se registra ning&uacute;n dato.
              </p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="ej: &iquest;Cu&aacute;nto aserr&iacute;n le pongo?"
                  value={freeQuestion}
                  onChange={(e) => setFreeQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && freeQuestion.trim()) handleFreeQuestion(); }}
                  className="input-field flex-1"
                />
                <button
                  onClick={handleFreeQuestion}
                  disabled={!freeQuestion.trim()}
                  className="flex items-center justify-center w-12 h-12 rounded-xl bg-verde-700 text-white shadow-card transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none"
                >
                  <IconSend />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  "\u00bfCu\u00e1ndo voltear?",
                  "\u00bfC\u00f3mo bajar humedad?",
                  "\u00bfQu\u00e9 mezclar con el lirio?",
                  "\u00bfCu\u00e1nto tarda la composta?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setFreeQuestion(q)}
                    className="px-3 py-1.5 bg-crema-200 rounded-full text-[12px] font-medium text-tierra-600 transition-colors hover:bg-crema-300 active:bg-crema-400"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---- CHAT MODE ---- */}
        {mode === "chat" && (
          <div className="animate-fade-in">
            <button onClick={resetAll} className="flex items-center gap-1.5 text-verde-700 font-semibold text-[13px] mb-4 active:opacity-70 transition-opacity">
              <IconArrowLeft /> Inicio
            </button>

            <div className="flex flex-col gap-3 mb-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-2xl px-4 py-3.5 text-[14px] leading-relaxed max-w-[92%] shadow-card ${
                    m.role === "user"
                      ? "bg-verde-800 text-white self-end rounded-br-md whitespace-pre-wrap"
                      : "bg-white text-gray-700 self-start rounded-bl-md border border-verde-100"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-verde-600 uppercase tracking-widest mb-2 pb-2 border-b border-verde-50">
                      <IconLeaf />
                      Agente de Composta
                    </div>
                  )}
                  {m.role === "assistant" ? (
                    <div className="prose-chat">
                      <Markdown>{m.content}</Markdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              ))}
              {loading && (
                <div className="bg-white border border-verde-100 rounded-2xl rounded-bl-md px-4 py-3.5 text-[14px] text-verde-600 self-start shadow-card animate-pulse-fade">
                  <div className="flex items-center gap-2">
                    <IconLeaf />
                    <span>Analizando...</span>
                  </div>
                </div>
              )}
              <div ref={chatEnd} />
            </div>

            {/* Follow-up input */}
            <div className="sticky bottom-0 pt-6 pb-3 bg-gradient-to-t from-crema-100 via-crema-100/95 to-transparent">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Pregunta de seguimiento..."
                  value={freeQuestion}
                  onChange={(e) => setFreeQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && handleFreeQuestion()}
                  disabled={loading}
                  className="input-field flex-1 disabled:opacity-50"
                />
                <button
                  onClick={handleFreeQuestion}
                  disabled={loading || !freeQuestion.trim()}
                  className="flex items-center justify-center w-12 h-12 rounded-xl bg-verde-700 text-white shadow-card transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none"
                >
                  <IconSend />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
