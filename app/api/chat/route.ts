import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { ensureTable, insertConsulta, getMediciones } from "@/lib/db";

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("[chat] DEEPSEEK_API_KEY is not set");
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY no configurada en el servidor." },
      { status: 500 },
    );
  }

  let messages;
  let compostera: number | null = null;
  let tipo = "pregunta";
  try {
    const body = await req.json();
    messages = body.messages;
    compostera = body.compostera ?? null;
    tipo = body.tipo ?? "pregunta";
  } catch (e) {
    console.error("[chat] Invalid request body:", e);
    return NextResponse.json({ error: "Request body inv\u00e1lido." }, { status: 400 });
  }

  try {
    // For diagnostics, inject recent history of that compostera
    let historyContext = "";
    if (tipo === "diagnostico" && compostera) {
      try {
        await ensureTable();
        const recent = await getMediciones(compostera);
        // Take last 5 measurements (excluding the one just saved which may not be in DB yet)
        const last5 = recent.slice(0, 5);
        if (last5.length > 0) {
          historyContext = `\n\nHISTORIAL RECIENTE DE COMPOSTERA #${compostera} (${last5.length} mediciones anteriores, de más reciente a más antigua):\n`;
          const humedadNiveles: Record<number, string> = { 20: "DRY++", 30: "DRY+", 40: "DRY", 55: "WET", 70: "WET+", 85: "WET++" };
          historyContext += last5.map((m: Record<string, unknown>) => {
            const fecha = new Date(m.created_at as string).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
            const humVal = Number(m.humedad);
            const humLabel = humedadNiveles[humVal] ? `${humedadNiveles[humVal]} (~${humVal}%)` : `${humVal}%`;
            return `- ${fecha} (día ${m.dia ?? "?"}): Temp ${m.temperatura}°C, pH ${m.ph}, Humedad ${humLabel}${m.observaciones ? `, Obs: ${m.observaciones}` : ""} → ${m.estado}`;
          }).join("\n");
          historyContext += "\n\nUsa este historial para detectar tendencias (temperatura subiendo/bajando, humedad persistente, etc.) y menciona si ves algo relevante en la evolución.";
        }
      } catch (e) {
        console.error("[chat] Failed to fetch history:", e);
      }
    }

    const systemContent = SYSTEM_PROMPT + historyContext;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[chat] DeepSeek API error ${res.status}:`, body);
      return NextResponse.json(
        { error: `Error de la API (${res.status}): ${body}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const reply =
      data.choices?.[0]?.message?.content || "No pude generar respuesta.";

    // Log the last user message + response to consultas
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg?.content) {
      try {
        await ensureTable();
        await insertConsulta({
          tipo,
          compostera,
          pregunta: lastUserMsg.content,
          respuesta: reply,
        });
      } catch (e) {
        console.error("[chat] Failed to log consulta:", e);
      }
    }

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[chat] Fetch error:", e);
    return NextResponse.json(
      { error: `Error de conexi\u00f3n al servidor de IA: ${e instanceof Error ? e.message : "desconocido"}` },
      { status: 502 },
    );
  }
}
