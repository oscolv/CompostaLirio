import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaV2, getSitioById, updateSitio, deactivateSitio } from "@/lib/db";
import { validarSitioInput } from "@/lib/validaciones";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const id = parseId(idStr);
    if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    const sitio = await getSitioById(id);
    if (!sitio) return NextResponse.json({ error: "Sitio no encontrado" }, { status: 404 });
    return NextResponse.json(sitio);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const id = parseId(idStr);
    if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const body = await req.json();
    const validado = validarSitioInput(body);
    if (!validado.ok) return NextResponse.json({ error: validado.error }, { status: 400 });

    const d = validado.data;
    const sitio = await updateSitio(id, {
      nombre: d.nombre,
      descripcion: d.descripcion ?? null,
      ubicacion: d.ubicacion ?? null,
      activo: d.activo,
    });
    if (!sitio) return NextResponse.json({ error: "Sitio no encontrado" }, { status: 404 });
    return NextResponse.json(sitio);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.includes("duplicate key") || message.includes("sitios_nombre_key")) {
      return NextResponse.json({ error: "Ya existe un sitio con ese nombre" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Soft-delete: marca como inactivo. No se hace hard delete porque
// composteras y ciclos mantienen FK con ON DELETE RESTRICT.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const id = parseId(idStr);
    if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    await deactivateSitio(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
