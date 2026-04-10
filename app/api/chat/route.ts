import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/prompt";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[chat] ANTHROPIC_API_KEY is not set");
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no configurada en el servidor." },
      { status: 500 },
    );
  }

  let messages;
  try {
    const body = await req.json();
    messages = body.messages;
  } catch (e) {
    console.error("[chat] Invalid request body:", e);
    return NextResponse.json({ error: "Request body inv\u00e1lido." }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[chat] Anthropic API error ${res.status}:`, body);
      return NextResponse.json(
        { error: `Error de la API (${res.status}): ${body}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const reply =
      data.content?.map((b: { text?: string }) => b.text || "").join("\n") ||
      "No pude generar respuesta.";

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[chat] Fetch error:", e);
    return NextResponse.json(
      { error: `Error de conexi\u00f3n al servidor de IA: ${e instanceof Error ? e.message : "desconocido"}` },
      { status: 502 },
    );
  }
}
