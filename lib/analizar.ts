import type { AnalisisJSON } from "@/lib/analisis";

export type AnalizarResponse = {
  resultado: string;
  json: AnalisisJSON | null;
  estado: "verde" | "amarillo" | "rojo" | null;
  accion: string | null;
};

export async function analizarImagen(file: File): Promise<AnalizarResponse> {
  const formData = new FormData();
  formData.append("imagen", file);
  const res = await fetch("/api/analizar", { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "No se pudo analizar la imagen");
  }
  const data = await res.json();
  if (!data?.resultado) throw new Error("No se pudo analizar la imagen");
  return {
    resultado: data.resultado as string,
    json: (data.json as AnalisisJSON | null) ?? null,
    estado: (data.estado as AnalizarResponse["estado"]) ?? null,
    accion: (data.accion as string | null) ?? null,
  };
}
