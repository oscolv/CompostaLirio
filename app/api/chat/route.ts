import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import {
  ensureSchemaV2,
  insertConsultaConCiclo,
  getMediciones,
  getMedicionesByCiclo,
} from "@/lib/db";
import { resolverCiclo } from "@/lib/ciclos";

// Rate limiting: 30 requests per hour per IP
const RATE_LIMIT = 30;
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
    console.error("[chat] DEEPSEEK_API_KEY is not set");
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY no configurada en el servidor." },
      { status: 500 },
    );
  }

  let messages;
  let compostera: number | null = null;
  let cicloId: number | null = null;
  let tipo = "pregunta";
  let guardar = true;
  try {
    const body = await req.json();
    messages = body.messages;
    compostera = body.compostera ?? null;
    cicloId = typeof body.ciclo_id === "number" ? body.ciclo_id : null;
    tipo = body.tipo ?? "pregunta";
    guardar = body.guardar !== false;
  } catch (e) {
    console.error("[chat] Invalid request body:", e);
    return NextResponse.json({ error: "Request body inv\u00e1lido." }, { status: 400 });
  }

  try {
    // Para diagnóstico: inyectamos historial reciente. Preferimos ciclo > compostera.
    let historyContext = "";
    if (tipo === "diagnostico" && (cicloId || compostera)) {
      try {
        await ensureSchemaV2();

        // Resolución unificada: valida coherencia ciclo↔compostera.
        // Si no hay ciclo activo, cae a historial global de la compostera
        // (legacy, útil solo en composteras sin ciclo todavía).
        const resolved = await resolverCiclo(compostera, cicloId);
        if (resolved.ok) {
          cicloId = resolved.ciclo.id;
        } else if (resolved.err.code === "MISMATCH" || resolved.err.code === "NOT_FOUND") {
          return NextResponse.json({ error: resolved.err.error }, { status: resolved.err.status });
        }

        const recent = cicloId
          ? await getMedicionesByCiclo(cicloId)
          : await getMediciones(compostera ?? undefined);
        const last5 = recent.slice(0, 5);
        if (last5.length > 0) {
          const humedadNiveles: Record<number, string> = { 20: "DRY++", 30: "DRY+", 40: "DRY", 55: "WET", 70: "WET+", 85: "WET++" };

          const ambito = cicloId
            ? `CICLO #${cicloId}${compostera ? ` (compostera #${compostera})` : ""}`
            : `COMPOSTERA #${compostera}`;
          historyContext = `\n\nHISTORIAL RECIENTE DE ${ambito} (${last5.length} mediciones, de más reciente a más antigua):\n`;
          historyContext += last5.map((m: Record<string, unknown>) => {
            const fecha = new Date(m.created_at as string).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
            const humVal = Number(m.humedad);
            const humLabel = humedadNiveles[humVal] ? `${humedadNiveles[humVal]} (~${humVal}%)` : `${humVal}%`;
            return `- ${fecha} (día ${m.dia ?? "?"}): Temp ${m.temperatura}°C, pH ${m.ph}, Humedad ${humLabel}${m.observaciones ? `, Obs: ${m.observaciones}` : ""} → ${m.estado}`;
          }).join("\n");

          if (last5.length >= 2) {
            const temps = last5.map((m: Record<string, unknown>) => Number(m.temperatura)).reverse();
            const hums = last5.map((m: Record<string, unknown>) => Number(m.humedad)).reverse();
            const phs = last5.map((m: Record<string, unknown>) => Number(m.ph)).reverse();
            const alerts = last5.filter((m: Record<string, unknown>) => m.estado === "danger").length;
            const warnings = last5.filter((m: Record<string, unknown>) => m.estado === "warning").length;

            const trend = (vals: number[]): string => {
              const first = vals[0], last = vals[vals.length - 1];
              const diff = last - first;
              const pct = first !== 0 ? Math.abs(diff / first) * 100 : 0;
              if (pct < 5) return "estable";
              return diff > 0 ? "subiendo" : "bajando";
            };

            historyContext += `\n\nRESUMEN DE TENDENCIAS (calculado):`;
            historyContext += `\n- Temperatura: ${trend(temps)} (${temps[0]}→${temps[temps.length - 1]}°C)`;
            historyContext += `\n- Humedad: ${trend(hums)} (${humedadNiveles[hums[0]] || hums[0] + "%"}→${humedadNiveles[hums[hums.length - 1]] || hums[hums.length - 1] + "%"})`;
            historyContext += `\n- pH: ${trend(phs)} (${phs[0]}→${phs[phs.length - 1]})`;
            if (alerts > 0) historyContext += `\n- ⚠ ${alerts} medición(es) en peligro en las últimas ${last5.length}`;
            if (warnings > 0) historyContext += `\n- ${warnings} medición(es) con atención en las últimas ${last5.length}`;
          }

          historyContext += "\n\nUsa el historial y las tendencias para enriquecer tu diagnóstico. Menciona tendencias relevantes.";
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

    const lastUserMsg = messages[messages.length - 1];
    if (guardar && lastUserMsg?.content) {
      try {
        await ensureSchemaV2();
        await insertConsultaConCiclo({
          tipo,
          compostera,
          ciclo_id: cicloId,
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
