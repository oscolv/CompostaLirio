import { NextRequest, NextResponse } from "next/server";
import {
  ensureSchemaV2,
  getComposterasBySitio,
  getComposterasConCountsBySitio,
  getSitioById,
  createCompostera,
} from "@/lib/db";
import { validarComposteraNuevaInput } from "@/lib/validaciones";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const withCounts = req.nextUrl.searchParams.get("counts") === "1";
    const rows = withCounts
      ? await getComposterasConCountsBySitio(id)
      : await getComposterasBySitio(id);
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const sitio_id = parseInt(idStr, 10);
    if (!Number.isInteger(sitio_id) || sitio_id <= 0) {
      return NextResponse.json({ error: "ID de sitio inválido" }, { status: 400 });
    }
    const sitio = await getSitioById(sitio_id);
    if (!sitio) {
      return NextResponse.json({ error: "Sitio no existe" }, { status: 404 });
    }
    const body = await req.json().catch(() => null);
    const validado = validarComposteraNuevaInput(body);
    if (!validado.ok) {
      return NextResponse.json({ error: validado.error }, { status: 400 });
    }
    const d = validado.data;
    const fila = await createCompostera({
      sitio_id,
      nombre: d.nombre,
      fecha_inicio: d.fecha_inicio,
      masa_inicial: d.masa_inicial,
      tipo: d.tipo,
      capacidad_kg: d.capacidad_kg,
      activa: d.activa,
    });
    return NextResponse.json(fila, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
