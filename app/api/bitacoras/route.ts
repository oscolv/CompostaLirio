import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaV2, insertBitacora } from "@/lib/db";
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
