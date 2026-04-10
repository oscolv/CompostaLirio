import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("foto") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "La foto es muy pesada. Máximo 2MB." },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Solo se aceptan imágenes." },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `composta-${Date.now()}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("[upload] Error:", e);
    return NextResponse.json(
      { error: "Error al subir la foto." },
      { status: 500 },
    );
  }
}
