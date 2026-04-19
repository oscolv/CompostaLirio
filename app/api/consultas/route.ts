import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaV2, getConsultas, deleteConsulta } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await ensureSchemaV2();
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get("tipo") || undefined;
    const rows = await getConsultas(tipo);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureSchemaV2();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Falta el ID" }, { status: 400 });
    }
    await deleteConsulta(parseInt(id));
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
