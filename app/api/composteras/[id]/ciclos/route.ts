import { NextRequest, NextResponse } from "next/server";
import {
  ensureSchemaV2,
  getCiclosByCompostera,
  getCicloActivo,
  createCiclo,
} from "@/lib/db";
import { validarCicloInput } from "@/lib/validaciones";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const id = parseId(idStr);
    if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    const rows = await getCiclosByCompostera(id);
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const compostera_id = parseId(idStr);
    if (compostera_id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const body = await req.json();
    const validado = validarCicloInput({ ...body, compostera_id });
    if (!validado.ok) return NextResponse.json({ error: validado.error }, { status: 400 });

    // No permitir iniciar otro ciclo activo si ya existe uno.
    const activo = await getCicloActivo(compostera_id);
    if (activo) {
      return NextResponse.json(
        { error: "Ya existe un ciclo activo en esta compostera. Ciérralo antes de iniciar otro." },
        { status: 409 },
      );
    }

    const d = validado.data;
    const ciclo = await createCiclo({
      compostera_id: d.compostera_id,
      nombre: d.nombre ?? null,
      fecha_inicio: d.fecha_inicio,
      formulacion_id: d.formulacion_id ?? null,
      peso_inicial_kg: d.peso_inicial_kg ?? null,
      objetivo: d.objetivo ?? null,
      observaciones_generales: d.observaciones_generales ?? null,
    });
    return NextResponse.json(ciclo);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
