import { NextRequest, NextResponse } from "next/server";
import {
  ensureTable,
  updateFormulacion,
  deleteFormulacion,
  countAsociacionesDeFormulacion,
  type FormulacionInput,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await ensureTable();
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }
    const body = (await req.json()) as FormulacionInput;

    if (!body.nombre || !body.nombre.trim()) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }
    if (body.base_calculo !== "humeda" && body.base_calculo !== "seca") {
      return NextResponse.json({ error: "base_calculo inválida" }, { status: 400 });
    }
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

    const row = await updateFormulacion(id, body);
    if (!row) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[update-formulacion] error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await ensureTable();
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }
    const n = await countAsociacionesDeFormulacion(id);
    if (n > 0) {
      return NextResponse.json(
        {
          error: `No se puede borrar: tiene ${n} asociación${n === 1 ? "" : "es"} con compostera${n === 1 ? "" : "s"}. Desactívala o elimina primero las asociaciones.`,
        },
        { status: 409 },
      );
    }
    await deleteFormulacion(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[delete-formulacion] error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
