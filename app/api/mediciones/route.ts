import { NextRequest, NextResponse } from "next/server";
import { ensureTable, insertMedicion, getMediciones } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const result = await insertMedicion({
      compostera: body.compostera,
      dia: body.dia || null,
      temperatura: body.temperatura,
      ph: body.ph,
      humedad: body.humedad,
      observaciones: body.observaciones || null,
      estado: body.estado || "good",
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const compostera = searchParams.get("compostera");
    const rows = await getMediciones(
      compostera ? parseInt(compostera) : undefined,
    );
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
