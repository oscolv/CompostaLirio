import { NextRequest, NextResponse } from "next/server";

const MAX_SIZE = 5 * 1024 * 1024;

const PROMPT = `Eres experto en compostaje de lirio acuático.

Primero determina si la imagen muestra composta o material en compostaje.

Si NO es composta, responde EXACTAMENTE:
No aplica: imagen no corresponde a composta.

Si SÍ es composta, clasifica SOLO con base en lo visible:

Humedad: bajo / medio / alto
Compactación: sí / no
Estructura: visible / no visible
Problemas visibles: ninguno / larvas / moho / zonas negras / exceso de agua (elige uno o más)

Observación: máximo 10 palabras, sin interpretación, solo descripción visual.

Responde EXACTAMENTE en este formato (sin texto adicional):

Humedad: __. Compactación: __. Estructura: __. Problemas: __. Observación: __.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY no configurada." }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("imagen") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se recibió imagen." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "El archivo debe ser una imagen." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Imagen demasiado grande (máx 5MB)." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        temperature: 0,
        max_output_tokens: 80,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              { type: "input_image", image_url: dataUrl },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[analizar] OpenAI error:", res.status, detail);
      return NextResponse.json({ error: "No se pudo analizar la imagen" }, { status: 502 });
    }

    const data = await res.json();
    let resultado: string = data.output_text || "";
    if (!resultado && Array.isArray(data.output)) {
      for (const item of data.output) {
        const parts = item?.content;
        if (Array.isArray(parts)) {
          for (const p of parts) {
            if (typeof p?.text === "string") resultado += p.text;
          }
        }
      }
    }
    resultado = resultado.trim();
    if (!resultado) {
      return NextResponse.json({ error: "No se pudo analizar la imagen" }, { status: 502 });
    }
    return NextResponse.json({ resultado });
  } catch (e) {
    console.error("[analizar] Error:", e);
    return NextResponse.json({ error: "No se pudo analizar la imagen" }, { status: 500 });
  }
}
