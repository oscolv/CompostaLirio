import { NextRequest, NextResponse } from "next/server";
import {
  generarHash,
  validarSalida,
  parseResultado,
  evaluarComposta,
  esNoAplica,
  type AnalisisJSON,
  type EvaluacionReglas,
} from "@/lib/analisis";
import {
  ensureAnalisisTable,
  getAnalisisByHash,
  insertAnalisis,
} from "@/lib/db";
import { callOpenAIVision } from "@/lib/openai-vision";

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

function buildResponse(
  resultado: string,
  json: AnalisisJSON | null,
  evaluacion: EvaluacionReglas | null,
) {
  return NextResponse.json({
    resultado,
    json,
    estado: evaluacion?.estado ?? null,
    accion: evaluacion?.accion ?? null,
  });
}

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
    const hash = generarHash(buf);

    await ensureAnalisisTable().catch((e) => {
      console.error("[analizar] ensureAnalisisTable:", e);
    });

    const cached = await getAnalisisByHash(hash).catch(() => null);
    if (cached) {
      const json = (cached.json as AnalisisJSON | null) ?? null;
      const evaluacion =
        cached.estado && cached.accion
          ? { estado: cached.estado as EvaluacionReglas["estado"], accion: cached.accion }
          : null;
      return buildResponse(cached.resultado as string, json, evaluacion);
    }

    const base64 = buf.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const respuesta = await callOpenAIVision({
      apiKey,
      model: "gpt-5.4-mini",
      prompt: PROMPT,
      dataUrl,
      maxOutputTokens: 80,
    });

    if (!respuesta.ok) {
      console.error("[analizar] OpenAI error:", respuesta.status, respuesta.detail);
      return NextResponse.json({ error: "No se pudo analizar la imagen" }, { status: 502 });
    }

    const resultado = respuesta.texto;
    if (!resultado) {
      return NextResponse.json({ error: "No se pudo analizar la imagen" }, { status: 502 });
    }

    if (esNoAplica(resultado)) {
      await insertAnalisis({
        hash,
        resultado,
        json: null,
        estado: null,
        accion: null,
      }).catch((e) => console.error("[analizar] insertAnalisis:", e));
      return buildResponse(resultado, null, null);
    }

    if (!validarSalida(resultado)) {
      console.error("[analizar] Salida inválida:", resultado);
      return NextResponse.json(
        { error: "La IA devolvió una respuesta con formato inválido." },
        { status: 422 },
      );
    }

    const json = parseResultado(resultado);
    if (!json) {
      console.error("[analizar] No se pudo parsear:", resultado);
      return NextResponse.json(
        { error: "La IA devolvió una respuesta con formato inválido." },
        { status: 422 },
      );
    }

    const evaluacion = evaluarComposta(json);

    await insertAnalisis({
      hash,
      resultado,
      json,
      estado: evaluacion.estado,
      accion: evaluacion.accion,
    }).catch((e) => console.error("[analizar] insertAnalisis:", e));

    return buildResponse(resultado, json, evaluacion);
  } catch (e) {
    console.error("[analizar] Error:", e);
    return NextResponse.json({ error: "No se pudo analizar la imagen" }, { status: 500 });
  }
}
