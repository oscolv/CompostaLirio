"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type Status = { emoji: string; label: string; key: string };

function getStatus(temp: number, ph: number, hum: number): Status {
  if (temp < 25 || temp > 70 || ph < 4.5 || ph > 9 || hum < 35 || hum > 80)
    return { emoji: "\u{1F534}", label: "Fuera de rango", key: "danger" };
  if (temp < 40 || temp > 65 || ph < 5.5 || ph > 8.5 || hum < 45 || hum > 70)
    return { emoji: "\u{1F7E1}", label: "Atenci\u00f3n", key: "warning" };
  return { emoji: "\u{1F7E2}", label: "En rango", key: "good" };
}

type Message = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [view, setView] = useState<"input" | "chat">("input");
  const [compostera, setCompostera] = useState("1");
  const [dias, setDias] = useState("");
  const [temp, setTemp] = useState("");
  const [ph, setPh] = useState("");
  const [hum, setHum] = useState("");
  const [obs, setObs] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [freeQuestion, setFreeQuestion] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function saveMedicion(estado: string) {
    try {
      await fetch("/api/mediciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compostera: parseInt(compostera),
          dia: dias ? parseInt(dias) : null,
          temperatura: parseFloat(temp),
          ph: parseFloat(ph),
          humedad: parseFloat(hum),
          observaciones: obs || null,
          estado,
        }),
      });
    } catch {
      // silently fail — the chat still works without DB
    }
  }

  async function callAgent(userMsg: string, newMessages?: Message[]) {
    setLoading(true);
    const msgs: Message[] = newMessages || [
      ...messages,
      { role: "user", content: userMsg },
    ];
    if (!newMessages) setMessages(msgs);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply =
        data.reply || data.error || "Error al obtener respuesta. Intenta de nuevo.";
      setMessages([...msgs, { role: "assistant", content: reply }]);
    } catch {
      setMessages([
        ...msgs,
        {
          role: "assistant",
          content: "Error de conexi\u00f3n. Verifica tu internet e intenta de nuevo.",
        },
      ]);
    }
    setLoading(false);
  }

  function handleSubmitData() {
    const t = parseFloat(temp);
    const p = parseFloat(ph);
    const h = parseFloat(hum);
    if (isNaN(t) || isNaN(p) || isNaN(h)) return;

    const status = getStatus(t, p, h);
    saveMedicion(status.key);

    let msg = `DATOS DE COMPOSTERA #${compostera}`;
    if (dias) msg += ` | D\u00eda ${dias} del proceso`;
    msg += `\n- Temperatura: ${t}\u00b0C\n- pH: ${p}\n- Humedad: ${h}%`;
    if (obs.trim()) msg += `\n- Observaciones: ${obs}`;
    msg += `\n\nDame tu diagn\u00f3stico y recomendaciones.`;

    const newMsgs: Message[] = [{ role: "user", content: msg }];
    setMessages(newMsgs);
    setView("chat");
    callAgent(msg, newMsgs);
  }

  function handleFreeQuestion() {
    if (!freeQuestion.trim()) return;
    const q = freeQuestion.trim();
    setFreeQuestion("");
    const newMsgs: Message[] = [...messages, { role: "user", content: q }];
    setMessages(newMsgs);
    callAgent(q, newMsgs);
  }

  function resetAll() {
    setView("input");
    setMessages([]);
    setCompostera("1");
    setDias("");
    setTemp("");
    setPh("");
    setHum("");
    setObs("");
  }

  const canSubmit = temp !== "" && ph !== "" && hum !== "";
  const statusPreview =
    canSubmit && !isNaN(parseFloat(temp)) && !isNaN(parseFloat(ph)) && !isNaN(parseFloat(hum))
      ? getStatus(parseFloat(temp), parseFloat(ph), parseFloat(hum))
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-crema-100 via-crema-300 to-crema-400">
      {/* Header */}
      <header className="bg-verde-800 px-5 py-5 text-crema-100 relative overflow-hidden">
        <div className="absolute -top-5 -right-2 text-[120px] opacity-[0.08] leading-none select-none">
          {"\u{1F33F}"}
        </div>
        <div className="text-[13px] uppercase tracking-[0.15em] opacity-70 mb-1">
          San Francisco Bojay
        </div>
        <h1 className="font-display text-[26px] font-black leading-tight">
          Agente de Composta
        </h1>
        <div className="text-sm opacity-80 mt-1 flex items-center justify-between">
          <span>Lirio acu&aacute;tico &middot; 10 composteras &middot; 2 ton</span>
          <Link
            href="/historial"
            className="underline underline-offset-2 opacity-90 hover:opacity-100"
          >
            Historial
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 py-4">
        {view === "input" ? (
          <>
            {/* Data input form */}
            <div className="bg-crema-50 border-2 border-verde-800 rounded-xl p-5 mb-4">
              <div className="text-base font-bold mb-4 text-verde-800">
                {"\u{1F4CB}"} Registro de monitoreo
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[13px] font-bold text-verde-800 uppercase tracking-wider mb-1 block">
                    Compostera #
                  </label>
                  <select
                    value={compostera}
                    onChange={(e) => setCompostera(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-verde-800 rounded-lg text-base bg-crema-100 outline-none"
                  >
                    {Array.from({ length: 10 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-bold text-verde-800 uppercase tracking-wider mb-1 block">
                    D&iacute;a del proceso
                  </label>
                  <input
                    type="number"
                    placeholder="ej: 12"
                    value={dias}
                    onChange={(e) => setDias(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-verde-800 rounded-lg text-base bg-crema-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-[13px] font-bold text-verde-800 uppercase tracking-wider mb-1 block">
                    Temp &deg;C
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="55"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-verde-800 rounded-lg text-base bg-crema-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-bold text-verde-800 uppercase tracking-wider mb-1 block">
                    pH
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="7.0"
                    value={ph}
                    onChange={(e) => setPh(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-verde-800 rounded-lg text-base bg-crema-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-bold text-verde-800 uppercase tracking-wider mb-1 block">
                    Humedad %
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="60"
                    value={hum}
                    onChange={(e) => setHum(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-verde-800 rounded-lg text-base bg-crema-100 outline-none"
                  />
                </div>
              </div>

              {statusPreview && (
                <div
                  className={`px-3 py-2 rounded-lg mb-3 text-sm font-medium text-center ${
                    statusPreview.key === "good"
                      ? "bg-verde-50"
                      : statusPreview.key === "warning"
                        ? "bg-yellow-50"
                        : "bg-red-50"
                  }`}
                >
                  {statusPreview.emoji} {statusPreview.label}
                </div>
              )}

              <div className="mb-4">
                <label className="text-[13px] font-bold text-verde-800 uppercase tracking-wider mb-1 block">
                  Observaciones (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Olor, color, fauna, volteo reciente..."
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  className="w-full px-3 py-3 border-2 border-verde-800 rounded-lg text-base bg-crema-100 outline-none"
                />
              </div>

              <button
                onClick={handleSubmitData}
                disabled={!canSubmit}
                className={`w-full py-3.5 rounded-lg text-base font-bold tracking-wide text-crema-100 ${
                  canSubmit
                    ? "bg-verde-800 active:bg-verde-900 cursor-pointer"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {"\u{1F331}"} Pedir diagn&oacute;stico al agente
              </button>
            </div>

            {/* Quick questions */}
            <div className="bg-crema-50 border-2 border-crema-500 rounded-xl p-4">
              <div className="text-sm font-bold mb-2.5 text-tierra-600">
                {"\u{1F4AC}"} O haz una pregunta libre
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ej: &iquest;Cu&aacute;nto aserr&iacute;n le pongo?"
                  value={freeQuestion}
                  onChange={(e) => setFreeQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setView("chat");
                      handleFreeQuestion();
                    }
                  }}
                  className="flex-1 px-3 py-3 border-2 border-crema-500 rounded-lg text-base bg-crema-100 outline-none"
                />
                <button
                  onClick={() => {
                    setView("chat");
                    handleFreeQuestion();
                  }}
                  disabled={!freeQuestion.trim()}
                  className={`px-4 py-3 rounded-lg text-sm font-bold text-crema-100 whitespace-nowrap ${
                    freeQuestion.trim()
                      ? "bg-tierra-600 cursor-pointer"
                      : "bg-gray-400 cursor-not-allowed"
                  }`}
                >
                  Enviar
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {[
                  "\u00bfCu\u00e1ndo voltear?",
                  "\u00bfC\u00f3mo bajar humedad?",
                  "\u00bfQu\u00e9 mezclar con el lirio?",
                  "\u00bfCu\u00e1nto tarda la composta?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setFreeQuestion(q)}
                    className="px-2.5 py-1.5 bg-crema-200 border border-crema-500 rounded-full text-xs text-tierra-600 cursor-pointer active:bg-crema-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Chat view */}
            <button
              onClick={resetAll}
              className="flex items-center gap-1.5 text-verde-800 font-bold text-sm mb-3 active:opacity-70"
            >
              &larr; Nuevo registro
            </button>

            <div className="flex flex-col gap-3 mb-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-xl px-4 py-3.5 text-sm leading-relaxed whitespace-pre-wrap max-w-[95%] ${
                    m.role === "user"
                      ? "bg-verde-800 text-crema-100 self-end"
                      : "bg-crema-50 text-gray-900 border-2 border-verde-800 self-start"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="text-[11px] font-bold text-verde-800 uppercase tracking-widest mb-1.5">
                      {"\u{1F33F}"} Agente de Composta
                    </div>
                  )}
                  {m.content}
                </div>
              ))}
              {loading && (
                <div className="bg-crema-50 border-2 border-verde-800 rounded-xl px-4 py-3.5 text-sm text-verde-800 self-start animate-pulse-fade">
                  {"\u{1F33F}"} Analizando datos...
                </div>
              )}
              <div ref={chatEnd} />
            </div>

            {/* Follow-up input */}
            <div className="sticky bottom-0 pt-5 pb-2 bg-gradient-to-t from-crema-300 via-crema-300 to-transparent">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Pregunta de seguimiento..."
                  value={freeQuestion}
                  onChange={(e) => setFreeQuestion(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !loading && handleFreeQuestion()
                  }
                  disabled={loading}
                  className="flex-1 px-3 py-3 border-2 border-verde-800 rounded-lg text-base bg-crema-100 outline-none disabled:opacity-50"
                />
                <button
                  onClick={handleFreeQuestion}
                  disabled={loading || !freeQuestion.trim()}
                  className={`px-4 py-3 rounded-lg font-bold text-crema-100 ${
                    loading || !freeQuestion.trim()
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-verde-800 cursor-pointer active:bg-verde-900"
                  }`}
                >
                  &rarr;
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
