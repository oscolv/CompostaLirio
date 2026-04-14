import { NextRequest, NextResponse } from "next/server";
import { ensureTable, deleteAsociacionFormulacion } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; asocId: string } },
) {
  try {
    await ensureTable();
    const asociacion_id = Number(params.asocId);
    if (!Number.isFinite(asociacion_id)) {
      return NextResponse.json({ error: "asocId inválido" }, { status: 400 });
    }
    await deleteAsociacionFormulacion(asociacion_id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[delete-asociacion] error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
