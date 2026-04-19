import { NextRequest, NextResponse } from "next/server";
import {
  ensureSchemaV2,
  getCicloById,
  updateCiclo,
  closeCiclo,
  discardCiclo,
} from "@/lib/db";

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
    const ciclo = await getCicloById(id);
    if (!ciclo) return NextResponse.json({ error: "Ciclo no encontrado" }, { status: 404 });
    return NextResponse.json(ciclo);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Editar campos editables del ciclo (nombre, formulación, peso, objetivo, observaciones).
// Para cambiar el estado (cerrar / descartar) se usa POST con ?action=.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const id = parseId(idStr);
    if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const body = (await req.json()) as Record<string, unknown>;
    const nombre = typeof body.nombre === "string" ? body.nombre : null;
    const formulacion_id_raw = body.formulacion_id;
    const formulacion_id =
      formulacion_id_raw === null || formulacion_id_raw === undefined || formulacion_id_raw === ""
        ? null
        : Number(formulacion_id_raw);
    const peso_raw = body.peso_inicial_kg;
    const peso_inicial_kg =
      peso_raw === null || peso_raw === undefined || peso_raw === ""
        ? null
        : Number(peso_raw);
    const objetivo = typeof body.objetivo === "string" ? body.objetivo : null;
    const observaciones_generales =
      typeof body.observaciones_generales === "string" ? body.observaciones_generales : null;

    const ciclo = await updateCiclo(id, {
      nombre,
      formulacion_id,
      peso_inicial_kg,
      objetivo,
      observaciones_generales,
    });
    if (!ciclo) return NextResponse.json({ error: "Ciclo no encontrado" }, { status: 404 });
    return NextResponse.json(ciclo);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Acciones de transición de estado: ?action=cerrar|descartar
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const id = parseId(idStr);
    if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "cerrar") {
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      const fecha_fin =
        typeof (body as { fecha_fin?: unknown }).fecha_fin === "string"
          ? ((body as { fecha_fin: string }).fecha_fin)
          : null;
      if (fecha_fin && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_fin)) {
        return NextResponse.json({ error: "fecha_fin debe ser YYYY-MM-DD" }, { status: 400 });
      }
      const ciclo = await closeCiclo(id, fecha_fin);
      if (!ciclo) return NextResponse.json({ error: "Ciclo no encontrado" }, { status: 404 });
      return NextResponse.json(ciclo);
    }

    if (action === "descartar") {
      const ciclo = await discardCiclo(id);
      if (!ciclo) return NextResponse.json({ error: "Ciclo no encontrado" }, { status: 404 });
      return NextResponse.json(ciclo);
    }

    return NextResponse.json({ error: "action debe ser 'cerrar' o 'descartar'" }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
