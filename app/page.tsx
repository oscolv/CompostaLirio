"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import NextImage from "next/image";
import Markdown from "react-markdown";
import { analizarImagen } from "@/lib/analizar";

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

type DiagFoto = { url: string; fecha: string; dia: number | null };
type Message = {
  role: "user" | "assistant";
  content: string;
  fotos?: DiagFoto[];
};

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

function diasDesde(fecha: string, hasta?: string): number {
  const inicio = new Date(fecha + "T00:00:00");
  const fin = hasta ? new Date(hasta + "T00:00:00") : new Date();
  fin.setHours(0, 0, 0, 0);
  return Math.floor((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function hoyISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function IconChart() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-1.5m-3 1.5l-3-1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  );
}

export default function Home() {
  const [mode, setMode] = useState<"select" | "registro" | "pregunta" | "chat" | "diagnostico-historico">("select");
  const [composteras, setComposteras] = useState<ComposteraInfo[]>([]);
  const [compostera, setCompostera] = useState("1");
  const [temp, setTemp] = useState("");
  const [ph, setPh] = useState("");
  const [hum, setHum] = useState("");
  const [obs, setObs] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [fotoModal, setFotoModal] = useState<string | null>(null);

  useEffect(() => {
    if (!fotoModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFotoModal(null); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fotoModal]);
  const [freeQuestion, setFreeQuestion] = useState("");
  const [saveStatus, setSaveStatus] = useState<"" | "ok" | "error">("");
  const [validationError, setValidationError] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [fotoUploading, setFotoUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [datosGuardados, setDatosGuardados] = useState(false);
  const [noGuardarPregunta, setNoGuardarPregunta] = useState(true);
  const [diagCompostera, setDiagCompostera] = useState("1");
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState("");
  const [fechaRegistro, setFechaRegistro] = useState(hoyISO());
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
  const diaActual = selectedInfo?.fecha_inicio ? diasDesde(selectedInfo.fecha_inicio.split("T")[0], fechaRegistro) : null;
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
    setAnalyzeError("");
    if (fotoInput.current) fotoInput.current.value = "";
  }

  async function handleAnalizar() {
    if (!foto || analyzing) return;
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const resultado = await analizarImagen(foto);
      setObs(resultado);
    } catch {
      setAnalyzeError("No se pudo analizar la imagen");
    } finally {
      setAnalyzing(false);
    }
  }

  async function uploadFoto(): Promise<string | null> {
    if (!foto) return null;
    setFotoUploading(true);
    try {
      const compressed = await compressImage(foto);
      const formData = new FormData();
      formData.append("foto", compressed);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error al subir la foto" }));
        throw new Error(data?.error || `Error ${res.status} al subir la foto`);
      }
      const data = await res.json();
      if (!data?.url) throw new Error("El servidor no devolvió la URL de la foto");
      return data.url;
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
      setMessages([...msgs, { role: "assistant", content: "Error de conexi\u00f3n. Verifica tu internet e intenta de nuevo." }]);
    }
    setLoading(false);
  }

  async function handleGuardar() {
    const t = parseFloat(temp), p = parseFloat(ph), h = parseFloat(hum);
    if (isNaN(t) || isNaN(p) || isNaN(h)) return;

    // Validate ranges
    if (t < 0 || t > 100) { setValidationError("Temperatura debe estar entre 0 y 100\u00b0C"); return; }
    if (p < 0 || p > 14) { setValidationError("pH debe estar entre 0 y 14"); return; }
    setValidationError("");
    setLoading(true);

    const status = getStatus(t, p, h, diaActual);

    // Upload photo first if present
    let fotoUrl: string | null = null;
    if (foto) {
      try {
        fotoUrl = await uploadFoto();
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

  return (
    <div className="min-h-screen bg-crema-100">
      {/* Header con foto de la ciénega de Bojay — altura acotada para no empujar las acciones */}
      <header className="relative overflow-hidden text-white h-[34vh] min-h-[180px] max-h-[240px]">
        {/* Imagen de fondo optimizada por next/image */}
        <NextImage
          src="/bojay.jpg"
          alt="Ciénega de San Francisco Bojay"
          fill
          priority
          sizes="(max-width: 480px) 100vw, 480px"
          className="object-cover"
        />
        {/* Overlay oscuro para asegurar contraste del texto */}
        <div className="absolute inset-0 bg-gradient-to-b from-verde-950/70 via-verde-900/55 to-verde-950/85" />

        <div className="relative z-10 h-full max-w-[480px] mx-auto px-5 py-4 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-verde-100 drop-shadow-sm">
              San Francisco Bojay
            </div>
            <h1 className="font-display text-[26px] font-black leading-tight tracking-tight mt-0.5 drop-shadow">
              Agente de Composta
            </h1>
            <p className="text-[12px] leading-snug text-verde-50/90 mt-1 max-w-[320px] drop-shadow-sm">
              Sistema de monitoreo y diagnóstico de compostaje de lirio acuático
            </p>
          </div>

          <nav className="flex items-center gap-4 text-[13px] font-medium text-verde-100">
            <Link href="/historial" className="hover:text-white transition-colors">
              Historial
            </Link>
            <span className="w-px h-3 bg-verde-200/40" />
            <Link href="/consultas" className="hover:text-white transition-colors">
              Consultas
            </Link>
            <span className="w-px h-3 bg-verde-200/40" />
            <Link href="/configuracion" className="hover:text-white transition-colors">
              Config
            </Link>
            <span className="w-px h-3 bg-verde-200/40" />
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

            <button
              onClick={() => setMode("diagnostico-historico")}
              className="page-card flex items-start gap-4 text-left transition-shadow duration-200 hover:shadow-card-hover active:scale-[0.98]"
            >
              <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <IconChart />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-gray-800 mb-0.5">
                  Diagnosticar compostera
                </div>
                <div className="text-[13px] text-gray-400 leading-snug">
                  Analizar todo el historial de una compostera
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

              <div className="mb-4">
                <label className="input-label">Fecha del registro</label>
                <input
                  type="date"
                  value={fechaRegistro}
                  max={hoyISO()}
                  onChange={(e) => setFechaRegistro(e.target.value || hoyISO())}
                  className="input-field"
                />
                {fechaRegistro !== hoyISO() && (
                  <div className="text-[11px] text-tierra-600 font-medium mt-1.5">
                    Registro con fecha atrasada
                  </div>
                )}
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
                {foto && (
                  <>
                    <button
                      type="button"
                      onClick={handleAnalizar}
                      disabled={analyzing}
                      className="mt-2 w-full px-4 py-2.5 rounded-xl bg-verde-700 text-white text-[13px] font-semibold shadow-card transition-all active:scale-[0.98] disabled:bg-gray-300 disabled:shadow-none"
                    >
                      {analyzing ? "Analizando..." : "Analizar imagen"}
                    </button>
                    {analyzeError && (
                      <div className="mt-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200">
                        {analyzeError}
                      </div>
                    )}
                  </>
                )}
              </div>

              {validationError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 text-[13px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200 animate-fade-in">
                  {validationError}
                </div>
              )}

              {!datosGuardados ? (
                <button onClick={handleGuardar} disabled={!canSubmit || loading} className="btn-primary">
                  {loading ? "Guardando..." : "Guardar medici\u00f3n"}
                </button>
              ) : (
                <div className="flex flex-col gap-2 animate-fade-in">
                  <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-verde-700 bg-verde-50 ring-1 ring-verde-200">
                    &#x2713; Medici&oacute;n guardada
                  </div>
                  <button onClick={handlePedirDiagnostico} className="btn-primary">
                    Pedir diagn&oacute;stico al agente
                  </button>
                  <button onClick={resetAll} className="w-full py-3 rounded-xl text-[13px] font-semibold text-gray-500 bg-white border border-gray-200 shadow-card transition-all active:scale-[0.98]">
                    Listo, no necesito diagn&oacute;stico
                  </button>
                </div>
              )}

              {saveStatus === "error" && (
                <div className="text-center text-[13px] font-medium mt-2 animate-fade-in text-red-600">
                  &#x2717; Error al guardar medici&oacute;n
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
              <p className="text-[13px] text-gray-400 mb-4">
                Pregunta lo que quieras sobre compostaje de lirio. No se registra ning&uacute;n dato.
              </p>
              <label className="flex items-center gap-2 mb-4 text-[13px] text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noGuardarPregunta}
                  onChange={(e) => setNoGuardarPregunta(e.target.checked)}
                  className="w-4 h-4 rounded accent-verde-700"
                />
                No guardar esta pregunta en el historial de consultas
              </label>
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

        {/* ---- DIAGNOSTICO HISTORICO MODE ---- */}
        {mode === "diagnostico-historico" && (
          <div className="animate-fade-in">
            <button onClick={resetAll} className="flex items-center gap-1.5 text-verde-700 font-semibold text-[13px] mb-4 active:opacity-70 transition-opacity">
              <IconArrowLeft /> Volver
            </button>

            <div className="page-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <IconChart />
                </div>
                <h2 className="text-[15px] font-semibold text-gray-800">Diagnosticar compostera</h2>
              </div>
              <p className="text-[13px] text-gray-400 mb-4">
                Analiza todo el historial de mediciones y genera un diagn&oacute;stico integral.
              </p>

              <div className="mb-4">
                <label className="input-label">Compostera</label>
                <select value={diagCompostera} onChange={(e) => setDiagCompostera(e.target.value)} className="input-field">
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

              {diagError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 text-[13px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200 animate-fade-in">
                  {diagError}
                </div>
              )}

              <button
                onClick={handleDiagnosticoHistorico}
                disabled={diagLoading}
                className="btn-primary"
              >
                {diagLoading ? "Analizando historial..." : "Generar diagn\u00f3stico"}
              </button>
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
                  {m.role === "assistant" && m.fotos && m.fotos.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-verde-50">
                      <div className="text-[11px] font-semibold text-verde-700/70 uppercase tracking-wider mb-2">
                        Últimas fotos
                      </div>
                      <div className="flex gap-2">
                        {m.fotos.map((f, idx) => {
                          const fecha = new Date(f.fecha).toLocaleDateString("es-MX", {
                            day: "numeric", month: "short", timeZone: "America/Mexico_City",
                          });
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setFotoModal(f.url)}
                              className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
                              aria-label="Ver foto en grande"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={f.url}
                                alt={`Foto ${fecha}`}
                                className="w-20 h-20 object-cover rounded-lg border border-verde-100 shadow-sm"
                              />
                              <span className="text-[10px] text-gray-500 leading-tight text-center">
                                {fecha}
                                {f.dia != null && <><br />día {f.dia}</>}
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

      {fotoModal && (
        <div
          onClick={() => setFotoModal(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setFotoModal(null); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white text-2xl flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="Cerrar"
          >
            &times;
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoModal}
            alt="Foto ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
