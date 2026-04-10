import { NextRequest, NextResponse } from "next/server";
import { ensureTable, getComposteras, upsertCompostera } from "@/lib/db";

export async function GET() {
  try {
    await ensureTable();
    const rows = await getComposteras();
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { composteras } = body as {
      composteras: {
        id: number;
        nombre: string | null;
        fecha_inicio: string | null;
        activa: boolean;
      }[];
    };

    for (const c of composteras) {
      await upsertCompostera(c);
    }

    const rows = await getComposteras();
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
