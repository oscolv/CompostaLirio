import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaV2, getComposterasBySitio } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const rows = await getComposterasBySitio(id);
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
