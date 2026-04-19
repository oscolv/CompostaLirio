import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaV2, getSitios, createSitio } from "@/lib/db";
import { validarSitioInput } from "@/lib/validaciones";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    await ensureSchemaV2();
    const { searchParams } = new URL(req.url);
    const activos = searchParams.get("activos") === "1";
    const rows = await getSitios(activos);
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchemaV2();
    const body = await req.json();
    const validado = validarSitioInput(body);
    if (!validado.ok) {
      return NextResponse.json({ error: validado.error }, { status: 400 });
    }
    const d = validado.data;
    const sitio = await createSitio({
      nombre: d.nombre,
      descripcion: d.descripcion ?? null,
      ubicacion: d.ubicacion ?? null,
      activo: d.activo,
    });
    return NextResponse.json(sitio);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    // Unique violation en nombre
    if (message.includes("duplicate key") || message.includes("sitios_nombre_key")) {
      return NextResponse.json({ error: "Ya existe un sitio con ese nombre" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
