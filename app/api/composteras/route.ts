import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaV2, getComposteras, upsertCompostera } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchemaV2();
    const rows = await getComposteras();
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchemaV2();
    const body = await req.json();
    const { composteras } = body as {
      composteras: {
        id: number;
        nombre: string | null;
        fecha_inicio: string | null;
        activa: boolean;
        masa_inicial: number | null;
        sitio_id?: number | null;
        tipo?: string | null;
        capacidad_kg?: number | null;
        estado?: "activa" | "inactiva" | "retirada";
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
