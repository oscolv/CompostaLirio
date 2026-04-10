import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `Eres un experto en compostaje de lirio acuático (Eichhornia crassipes). Trabajas con una comunidad en San Francisco Bojay que tiene 10 composteras con capacidad total de 2 toneladas de lirio. Tu rol es analizar datos de monitoreo y dar recomendaciones prácticas, claras y accionables.

CONOCIMIENTO CLAVE SOBRE LIRIO ACUÁTICO:
- Contenido de agua: 90-95%. Requiere secado previo o mezcla abundante con material seco (paja, aserrín, hojarasca, cartón).
- Relación C:N del lirio: ~15:1 (bajo en carbono). Necesita complemento de material rico en carbono para llegar a 25-30:1 ideal.
- Puede contener metales pesados si proviene de aguas contaminadas. La fase termofílica ayuda a estabilizarlos.
- Se descompone rápido por su alto contenido de agua y baja lignina, pero esto mismo causa compactación y anaerobiosis si no se voltea.

RANGOS ÓPTIMOS POR FASE:
Fase mesofílica inicial (días 1-7):
- Temperatura: 25-40°C (subiendo)
- pH: 5.5-7.0 (puede bajar al inicio, es normal)
- Humedad: 55-65%

Fase termofílica (días 7-30):
- Temperatura: 55-65°C (CRÍTICA: debe mantenerse >55°C al menos 3 días para eliminar patógenos)
- pH: 7.0-8.5
- Humedad: 50-60%

Fase de enfriamiento/maduración (días 30-90):
- Temperatura: 25-40°C (descendiendo gradualmente)
- pH: 6.5-8.0
- Humedad: 45-55%

PROBLEMAS COMUNES Y SOLUCIONES:
1. Temperatura no sube (< 45°C después de día 7):
   - Causa probable: exceso de humedad, falta de nitrógeno, compactación, pila muy pequeña.
   - Solución: voltear, agregar material nitrogenado (estiércol, restos de comida), verificar tamaño de pila (mín 1m³).

2. Mal olor (sulfuro/amoniaco):
   - Sulfuro (huevos podridos): anaerobiosis. Voltear inmediatamente, agregar material seco y estructurante.
   - Amoniaco: exceso de nitrógeno. Agregar material carbonoso (paja, aserrín, cartón).

3. pH muy ácido (< 5.5):
   - Causa: fermentación anaeróbica, exceso de humedad.
   - Solución: voltear, agregar cal agrícola (1-2 kg por m³), material seco.

4. pH muy alcalino (> 8.5):
   - Causa: exceso de cal o ceniza.
   - Solución: dejar de agregar cal, incorporar material orgánico fresco.

5. Humedad excesiva (> 70%):
   - Muy común con lirio. Voltear, agregar material seco, mejorar drenaje de la compostera.
   - La prueba del puño: al apretar un puñado, debe salir máximo 1-2 gotas.

6. Humedad insuficiente (< 40%):
   - Regar con lixiviado o agua. El material seco no se descompone.

FORMATO DE RESPUESTA:
- Sé directo y práctico. Marisol y su equipo son personas de campo, no científicos.
- Usa lenguaje sencillo pero preciso.
- Si algo está fuera de rango, di EXACTAMENTE qué hacer, cuánto agregar y cuándo revisar de nuevo.
- Si todo está bien, dilo claramente y di cuándo medir de nuevo.
- Siempre indica en qué fase crees que está la composta basándote en los datos.
- Si te dan datos preocupantes (temperatura muy alta >75°C, pH extremo), advierte con urgencia.
- Puedes responder preguntas generales sobre compostaje de lirio.`;

const STATUS = {
  good: { emoji: "🟢", label: "En rango" },
  warning: { emoji: "🟡", label: "Atención" },
  danger: { emoji: "🔴", label: "Fuera de rango" },
};

function getStatus(temp, ph, hum) {
  let worst = "good";
  if (temp < 25 || temp > 70 || ph < 4.5 || ph > 9 || hum < 35 || hum > 80) worst = "danger";
  else if (temp < 40 || temp > 65 || ph < 5.5 || ph > 8.5 || hum < 45 || hum > 70) worst = "warning";
  return STATUS[worst];
}

export default function CompostaLirio() {
  const [view, setView] = useState("input"); // input | chat
  const [compostera, setCompostera] = useState("1");
  const [dias, setDias] = useState("");
  const [temp, setTemp] = useState("");
  const [ph, setPh] = useState("");
  const [hum, setHum] = useState("");
  const [obs, setObs] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [freeQuestion, setFreeQuestion] = useState("");
  const chatEnd = useRef(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function callAgent(userMsg) {
    setLoading(true);
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);

    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      const data = await res.json();
      const reply = data.content?.map((b) => b.text || "").join("\n") || "No pude generar respuesta. Intenta de nuevo.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([...newMessages, { role: "assistant", content: "Error de conexión. Verifica tu internet e intenta de nuevo." }]);
    }
    setLoading(false);
  }

  function handleSubmitData() {
    const t = parseFloat(temp);
    const p = parseFloat(ph);
    const h = parseFloat(hum);
    if (isNaN(t) || isNaN(p) || isNaN(h)) return;

    let msg = `DATOS DE COMPOSTERA #${compostera}`;
    if (dias) msg += ` | Día ${dias} del proceso`;
    msg += `\n- Temperatura: ${t}°C\n- pH: ${p}\n- Humedad: ${h}%`;
    if (obs.trim()) msg += `\n- Observaciones: ${obs}`;
    msg += `\n\nDame tu diagnóstico y recomendaciones.`;

    setView("chat");
    callAgent(msg);
  }

  function handleFreeQuestion() {
    if (!freeQuestion.trim()) return;
    callAgent(freeQuestion.trim());
    setFreeQuestion("");
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

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    border: "2px solid #2d5016",
    borderRadius: "8px",
    fontSize: "16px",
    fontFamily: "'DM Sans', sans-serif",
    background: "#f9f7f2",
    color: "#1a1a1a",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: "13px",
    fontWeight: 700,
    color: "#2d5016",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "4px",
    display: "block",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(175deg, #f4f1e8 0%, #e8e4d4 40%, #ddd8c4 100%)",
      fontFamily: "'DM Sans', sans-serif",
      color: "#1a1a1a",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: "#2d5016",
        padding: "20px 24px",
        color: "#f4f1e8",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -20, right: -10, fontSize: "120px", opacity: 0.08, lineHeight: 1 }}>🌿</div>
        <div style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.15em", opacity: 0.7, marginBottom: "4px" }}>
          San Francisco Bojay
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "26px",
          fontWeight: 900,
          margin: 0,
          lineHeight: 1.15,
        }}>
          Agente de Composta
        </h1>
        <div style={{ fontSize: "14px", opacity: 0.8, marginTop: "4px" }}>
          Lirio acuático · 10 composteras · 2 ton
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px" }}>
        {view === "input" ? (
          <>
            {/* Data input form */}
            <div style={{
              background: "#fffef9",
              border: "2px solid #2d5016",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "16px",
            }}>
              <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", color: "#2d5016" }}>
                📋 Registro de monitoreo
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={labelStyle}>Compostera #</label>
                  <select value={compostera} onChange={(e) => setCompostera(e.target.value)} style={inputStyle}>
                    {[...Array(10)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Día del proceso</label>
                  <input type="number" placeholder="ej: 12" value={dias} onChange={(e) => setDias(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={labelStyle}>Temp °C</label>
                  <input type="number" step="0.1" placeholder="55" value={temp} onChange={(e) => setTemp(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>pH</label>
                  <input type="number" step="0.1" placeholder="7.0" value={ph} onChange={(e) => setPh(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Humedad %</label>
                  <input type="number" step="1" placeholder="60" value={hum} onChange={(e) => setHum(e.target.value)} style={inputStyle} />
                </div>
              </div>

              {temp && ph && hum && (
                <div style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: getStatus(parseFloat(temp), parseFloat(ph), parseFloat(hum)).emoji === "🟢" ? "#e8f5e1" : getStatus(parseFloat(temp), parseFloat(ph), parseFloat(hum)).emoji === "🟡" ? "#fef9e7" : "#fde8e8",
                  marginBottom: "12px",
                  fontSize: "14px",
                  fontWeight: 500,
                  textAlign: "center",
                }}>
                  {getStatus(parseFloat(temp), parseFloat(ph), parseFloat(hum)).emoji}{" "}
                  {getStatus(parseFloat(temp), parseFloat(ph), parseFloat(hum)).label}
                </div>
              )}

              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Observaciones (opcional)</label>
                <input type="text" placeholder="Olor, color, fauna, volteo reciente..." value={obs} onChange={(e) => setObs(e.target.value)} style={inputStyle} />
              </div>

              <button
                onClick={handleSubmitData}
                disabled={!temp || !ph || !hum}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: !temp || !ph || !hum ? "#a0a090" : "#2d5016",
                  color: "#f4f1e8",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor: !temp || !ph || !hum ? "not-allowed" : "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                🌱 Pedir diagnóstico al agente
              </button>
            </div>

            {/* Quick questions */}
            <div style={{
              background: "#fffef9",
              border: "2px solid #c4b98a",
              borderRadius: "12px",
              padding: "16px",
            }}>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "10px", color: "#6b5c2a" }}>
                💬 O haz una pregunta libre
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="ej: ¿Cuánto aserrín le pongo?"
                  value={freeQuestion}
                  onChange={(e) => setFreeQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFreeQuestion()}
                  style={{ ...inputStyle, borderColor: "#c4b98a" }}
                />
                <button
                  onClick={() => { setView("chat"); handleFreeQuestion(); }}
                  disabled={!freeQuestion.trim()}
                  style={{
                    padding: "12px 16px",
                    background: freeQuestion.trim() ? "#6b5c2a" : "#a0a090",
                    color: "#f4f1e8",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: freeQuestion.trim() ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap",
                  }}
                >
                  Enviar
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                {[
                  "¿Cuándo voltear?",
                  "¿Cómo bajar humedad?",
                  "¿Qué mezclar con el lirio?",
                  "¿Cuánto tarda la composta?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setFreeQuestion(q); }}
                    style={{
                      padding: "6px 10px",
                      background: "#f0ead6",
                      border: "1px solid #c4b98a",
                      borderRadius: "16px",
                      fontSize: "12px",
                      color: "#6b5c2a",
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                color: "#2d5016",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer",
                padding: "4px 0",
                marginBottom: "12px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ← Nuevo registro
            </button>

            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginBottom: "16px",
            }}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    background: m.role === "user" ? "#2d5016" : "#fffef9",
                    color: m.role === "user" ? "#f4f1e8" : "#1a1a1a",
                    border: m.role === "assistant" ? "2px solid #2d5016" : "none",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    maxWidth: "95%",
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  {m.role === "assistant" && (
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#2d5016", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                      🌿 Agente de Composta
                    </div>
                  )}
                  {m.content}
                </div>
              ))}
              {loading && (
                <div style={{
                  background: "#fffef9",
                  border: "2px solid #2d5016",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  fontSize: "14px",
                  color: "#2d5016",
                  alignSelf: "flex-start",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}>
                  <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
                  🌿 Analizando datos...
                </div>
              )}
              <div ref={chatEnd} />
            </div>

            {/* Follow-up input */}
            <div style={{
              position: "sticky",
              bottom: 0,
              background: "linear-gradient(transparent, #e8e4d4 30%)",
              paddingTop: "20px",
              paddingBottom: "8px",
            }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Pregunta de seguimiento..."
                  value={freeQuestion}
                  onChange={(e) => setFreeQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && handleFreeQuestion()}
                  disabled={loading}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={handleFreeQuestion}
                  disabled={loading || !freeQuestion.trim()}
                  style={{
                    padding: "12px 16px",
                    background: loading || !freeQuestion.trim() ? "#a0a090" : "#2d5016",
                    color: "#f4f1e8",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    cursor: loading || !freeQuestion.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
