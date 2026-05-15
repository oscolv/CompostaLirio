import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import {
  ensureSchemaV2,
  getBitacoraById,
  updateBitacora,
  deleteBitacora,
} from "@/lib/db";
import { validarBitacoraUpdate } from "@/lib/validaciones";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseId(idParam: string): number | null {
  const id = parseInt(idParam, 10);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

// Borra del Blob las URLs que estaban en la bitácora pero ya no están
// en el nuevo array. No lanza si alguna falla — Blob puede haber sido
// vaciado manualmente o la URL puede ser inválida.
async function deleteRemovedBlobs(prev: string[], next: string[]) {
  const conservadas = new Set(next);
  const aBorrar = prev.filter((url) => !conservadas.has(url));
  for (const url of aBorrar) {
    try {
      await del(url);
    } catch (e) {
      console.error("[bitacoras] no se pudo borrar foto del Blob:", url, e);
    }
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureSchemaV2();
    const id = parseId(params.id);
    if (id === null) return NextResponse.json({ error: "id inválido" }, { status: 400 });
    const row = await getBitacoraById(id);
    if (!row) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureSchemaV2();
    const id = parseId(params.id);
    if (id === null) return NextResponse.json({ error: "id inválido" }, { status: 400 });

    const body = await req.json();
    const validado = validarBitacoraUpdate(body);
    if (!validado.ok) return NextResponse.json({ error: validado.error }, { status: 400 });

    const prev = await getBitacoraById(id);
    if (!prev) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const result = await updateBitacora(id, validado.data);
    if (!result) return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });

    const prevFotos: string[] = Array.isArray(prev.fotos) ? prev.fotos : [];
    await deleteRemovedBlobs(prevFotos, validado.data.fotos);

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureSchemaV2();
    const id = parseId(params.id);
    if (id === null) return NextResponse.json({ error: "id inválido" }, { status: 400 });

    const prev = await getBitacoraById(id);
    if (!prev) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    await deleteBitacora(id);
    const prevFotos: string[] = Array.isArray(prev.fotos) ? prev.fotos : [];
    await deleteRemovedBlobs(prevFotos, []);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
