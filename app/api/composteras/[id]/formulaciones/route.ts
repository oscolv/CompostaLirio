import { NextRequest, NextResponse } from "next/server";
import {
  ensureTable,
  getFormulacionesDeCompostera,
  asociarFormulacionACompostera,
} from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await ensureTable();
    const compostera_id = Number(params.id);
    if (!Number.isFinite(compostera_id)) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }
    const rows = await getFormulacionesDeCompostera(compostera_id);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await ensureTable();
    const compostera_id = Number(params.id);
    if (!Number.isFinite(compostera_id)) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }
    const body = (await req.json()) as {
      formulacion_id: number;
      fecha?: string | null;
      notas?: string | null;
    };
    if (!body.formulacion_id) {
      return NextResponse.json({ error: "formulacion_id requerido" }, { status: 400 });
    }
    const row = await asociarFormulacionACompostera(
      compostera_id,
      body.formulacion_id,
      body.fecha ?? null,
      body.notas ?? null,
    );
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[asociar-formulacion] error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
