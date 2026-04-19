import { NextRequest, NextResponse } from "next/server";
import {
  ensureSchemaV2,
  getComposteraById,
  countDependenciasCompostera,
  deleteCompostera,
  setEstadoCompostera,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseId(idStr: string): number | null {
  const id = parseInt(idStr, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const id = parseId(idStr);
    if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const compostera = await getComposteraById(id);
    if (!compostera) return NextResponse.json({ error: "Compostera no existe" }, { status: 404 });

    const deps = await countDependenciasCompostera(id);
    if (deps.ciclos > 0) {
      return NextResponse.json(
        {
          error: "No se puede borrar: tiene historia",
          ciclos_count: deps.ciclos,
          mediciones_count: deps.mediciones,
          puede_retirar: true,
        },
        { status: 409 },
      );
    }

    await deleteCompostera(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const id = parseId(idStr);
    if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const body = await req.json().catch(() => null);
    const estado = body && typeof body === "object" ? (body as { estado?: unknown }).estado : null;
    if (estado !== "activa" && estado !== "inactiva" && estado !== "retirada") {
      return NextResponse.json({ error: "estado debe ser activa|inactiva|retirada" }, { status: 400 });
    }

    const existe = await getComposteraById(id);
    if (!existe) return NextResponse.json({ error: "Compostera no existe" }, { status: 404 });

    const fila = await setEstadoCompostera(id, estado);
    return NextResponse.json(fila);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
