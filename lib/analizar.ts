export async function analizarImagen(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("imagen", file);
  const res = await fetch("/api/analizar", { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "No se pudo analizar la imagen");
  }
  const data = await res.json();
  if (!data?.resultado) throw new Error("No se pudo analizar la imagen");
  return data.resultado as string;
}
