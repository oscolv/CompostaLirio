// Helper delgado para llamar a /v1/responses de OpenAI con una imagen.

type OpenAIResponseData = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

export function extractOutputText(data: OpenAIResponseData): string {
  if (typeof data.output_text === "string" && data.output_text) {
    return data.output_text.trim();
  }
  let out = "";
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      const parts = item?.content;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          if (typeof p?.text === "string") out += p.text;
        }
      }
    }
  }
  return out.trim();
}

export async function callOpenAIVision(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  dataUrl: string;
  maxOutputTokens?: number;
}): Promise<{ ok: true; texto: string } | { ok: false; status: number; detail: string }> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0,
      max_output_tokens: opts.maxOutputTokens ?? 80,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: opts.prompt },
            { type: "input_image", image_url: opts.dataUrl },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, status: res.status, detail };
  }
  const data = (await res.json()) as OpenAIResponseData;
  return { ok: true, texto: extractOutputText(data) };
}
