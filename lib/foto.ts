// Utilidades de foto (solo cliente).

export function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name, { type: "image/jpeg" })),
        "image/jpeg",
        quality,
      );
    };
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadFoto(
  file: File,
  compressOpts?: { maxWidth?: number; quality?: number },
): Promise<string> {
  const compressed = await compressImage(
    file,
    compressOpts?.maxWidth ?? 1200,
    compressOpts?.quality ?? 0.7,
  );
  const formData = new FormData();
  formData.append("foto", compressed);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Error al subir la foto" }));
    throw new Error(data?.error || `Error ${res.status} al subir la foto`);
  }
  const data = await res.json();
  if (!data?.url) throw new Error("El servidor no devolvió la URL de la foto");
  return data.url as string;
}
