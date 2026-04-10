import { NextRequest, NextResponse } from "next/server";
import { ensureTable, getConsultas } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get("tipo") || undefined;
    const rows = await getConsultas(tipo);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
