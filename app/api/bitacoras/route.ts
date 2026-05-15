import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaV2, insertBitacora, getBitacorasBySitio } from "@/lib/db";
import { validarBitacoraInput } from "@/lib/validaciones";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    await ensureSchemaV2();
    const body = await req.json();
    const validado = validarBitacoraInput(body);
    if (!validado.ok) {
      return NextResponse.json({ error: validado.error }, { status: 400 });
    }
    const result = await insertBitacora(validado.data);
    return NextResponse.json({ id: result.id, created_at: result.created_at });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureSchemaV2();
    const { searchParams } = new URL(req.url);
    const sitioParam = searchParams.get("sitio_id");
    if (!sitioParam) {
      return NextResponse.json({ error: "sitio_id es requerido" }, { status: 400 });
    }
    const sitio_id = parseInt(sitioParam, 10);
    if (!Number.isInteger(sitio_id) || sitio_id < 1) {
      return NextResponse.json({ error: "sitio_id inválido" }, { status: 400 });
    }
    const rows = await getBitacorasBySitio(sitio_id);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
