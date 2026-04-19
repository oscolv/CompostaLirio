import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT, DIAGNOSTICO_HISTORICO_PROMPT } from "@/lib/prompt";
import {
  ensureSchemaV2,
  insertConsultaConCiclo,
  getMedicionesExport,
  getMedicionesExportByCiclo,
} from "@/lib/db";
import { buildResumenHistorico, buildResumenHistoricoPorCiclo } from "@/lib/diagnostico";
import { resolverCiclo } from "@/lib/ciclos";

type MedicionRow = {
  id: number;
  dia: number | null;
  foto_url: string | null;
  created_at: string;
};

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

  let compostera: number | null = null;
  let cicloId: number | null = null;
  try {
    const body = await req.json();
    cicloId = typeof body.ciclo_id === "number" ? body.ciclo_id : null;
    compostera = typeof body.compostera === "number" ? body.compostera : null;
    if (!cicloId && !compostera) {
      return NextResponse.json(
        { error: "Debes indicar ciclo_id o compostera." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Request body inválido." }, { status: 400 });
  }

  try {
    await ensureSchemaV2();

    // Resolución unificada: valida coherencia ciclo↔compostera si vienen
    // ambos. Si solo viene compostera, toma su ciclo activo. Si tampoco
    // hay ciclo activo, cae al histórico total de la compostera (legacy).
    const resolved = await resolverCiclo(compostera, cicloId);

    let resumen: string | null = null;
    let composteraEfectiva: number | null = compostera;
    if (resolved.ok) {
      cicloId = resolved.ciclo.id;
      composteraEfectiva = resolved.ciclo.compostera_id;
      resumen = await buildResumenHistoricoPorCiclo(cicloId);
    } else if (resolved.err.code === "NO_ACTIVE_CYCLE" && compostera) {
      // Sin ciclo activo: se conserva el comportamiento legacy de diagnosticar
      // el histórico completo de la compostera. `buildResumenHistorico`
      // internamente vuelve a intentar el ciclo activo y solo procesa el
      // histórico total si realmente no existe ninguno.
      resumen = await buildResumenHistorico(compostera);
    } else {
      return NextResponse.json({ error: resolved.err.error }, { status: resolved.err.status });
    }

    if (!resumen) {
      const where = cicloId ? `ciclo #${cicloId}` : `compostera #${compostera}`;
      return NextResponse.json({ error: `No hay registros para el ${where}.` }, { status: 404 });
    }

    const systemContent = SYSTEM_PROMPT + "\n\n" + DIAGNOSTICO_HISTORICO_PROMPT;
    const userMessage = resumen + "\n\nDame tu diagnóstico integral.";

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

    try {
      const label = cicloId
        ? `Diagnóstico histórico ciclo #${cicloId}`
        : `Diagnóstico histórico compostera #${composteraEfectiva}`;
      await insertConsultaConCiclo({
        tipo: "diagnostico-historico",
        compostera: composteraEfectiva,
        ciclo_id: cicloId,
        pregunta: label,
        respuesta: reply,
      });
    } catch (e) {
      console.error("[diagnostico] Failed to log consulta:", e);
    }

    // Últimas 3 fotos del mismo ámbito (ciclo preferente, compostera legacy)
    let fotos: { url: string; fecha: string; dia: number | null }[] = [];
    try {
      const rows = (cicloId
        ? await getMedicionesExportByCiclo(cicloId)
        : composteraEfectiva
          ? await getMedicionesExport(composteraEfectiva)
          : []) as MedicionRow[];
      fotos = rows
        .filter((r) => r.foto_url)
        .slice(-3)
        .map((r) => ({ url: r.foto_url as string, fecha: r.created_at, dia: r.dia }));
    } catch (e) {
      console.error("[diagnostico] fotos:", e);
    }

    return NextResponse.json({ reply, resumen, fotos, ciclo_id: cicloId });
  } catch (e) {
    console.error("[diagnostico] Error:", e);
    return NextResponse.json(
      { error: `Error: ${e instanceof Error ? e.message : "desconocido"}` },
      { status: 502 },
    );
  }
}
