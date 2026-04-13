import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT, DIAGNOSTICO_HISTORICO_PROMPT } from "@/lib/prompt";
import { ensureTable, insertConsulta } from "@/lib/db";
import { buildResumenHistorico } from "@/lib/diagnostico";

// Rate limiting: 15 requests per hour per IP (heavier endpoint)
const RATE_LIMIT = 15;
const RATE_WINDOW = 60 * 60 * 1000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera un momento antes de intentar de nuevo." },
      { status: 429 },
    );
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DEEPSEEK_API_KEY no configurada." }, { status: 500 });
  }

  let compostera: number;
  try {
    const body = await req.json();
    compostera = body.compostera;
    if (!compostera || typeof compostera !== "number") {
      return NextResponse.json({ error: "Falta el número de compostera." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Request body inválido." }, { status: 400 });
  }

  try {
    await ensureTable();

    const resumen = await buildResumenHistorico(compostera);
    if (!resumen) {
      return NextResponse.json(
        { error: `No hay registros para la compostera #${compostera}.` },
        { status: 404 },
      );
    }

    const systemContent = SYSTEM_PROMPT + "\n\n" + DIAGNOSTICO_HISTORICO_PROMPT;
    const userMessage = resumen + "\n\nDame tu diagnóstico integral de esta compostera.";

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
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[diagnostico] DeepSeek API error ${res.status}:`, body);
      return NextResponse.json({ error: `Error de la API (${res.status})` }, { status: 502 });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "No pude generar respuesta.";

    // Log to consultas
    try {
      await insertConsulta({
        tipo: "diagnostico-historico",
        compostera,
        pregunta: `Diagnóstico histórico compostera #${compostera}`,
        respuesta: reply,
      });
    } catch (e) {
      console.error("[diagnostico] Failed to log consulta:", e);
    }

    return NextResponse.json({ reply, resumen });
  } catch (e) {
    console.error("[diagnostico] Error:", e);
    return NextResponse.json(
      { error: `Error: ${e instanceof Error ? e.message : "desconocido"}` },
      { status: 502 },
    );
  }
}
