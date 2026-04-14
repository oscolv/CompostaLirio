import { NextRequest, NextResponse } from "next/server";
import {
  ensureTable,
  createFormulacion,
  getFormulaciones,
  type FormulacionInput,
} from "@/lib/db";

export async function GET() {
  try {
    await ensureTable();
    const rows = await getFormulaciones();
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = (await req.json()) as FormulacionInput;

    if (!body.nombre || !body.nombre.trim()) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }
    if (body.base_calculo !== "humeda" && body.base_calculo !== "seca") {
      return NextResponse.json({ error: "base_calculo inválida" }, { status: 400 });
    }

    // Validación: suma de porcentajes de composición = 100
    const pct = [
      body.lirio_acuatico_pct,
      body.excreta_pct,
      body.hojarasca_pct,
      body.residuos_vegetales_pct,
      body.material_estructurante_pct,
    ].map((v) => (typeof v === "number" && !Number.isNaN(v) ? v : 0));
    const suma = pct.reduce((a, b) => a + b, 0);
    if (Math.abs(suma - 100) > 0.01) {
      return NextResponse.json(
        { error: `La suma de porcentajes debe ser 100 (actual: ${suma})` },
        { status: 400 },
      );
    }

    const row = await createFormulacion(body);
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
