import { NextRequest, NextResponse } from "next/server";
import { ensureTable, insertMedicion, getMediciones, getMedicionById, deleteMedicion, updateMedicion } from "@/lib/db";
import { del } from "@vercel/blob";

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
      foto_url: body.foto_url || null,
      created_at: body.fecha || null,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Falta el ID" }, { status: 400 });
    }

    // Get the record first to check for photo
    const medicion = await getMedicionById(parseInt(id));
    if (!medicion) {
      return NextResponse.json({ error: "Medición no encontrada" }, { status: 404 });
    }

    // Delete photo from Vercel Blob if exists
    if (medicion.foto_url) {
      try {
        await del(medicion.foto_url);
      } catch {
        // Photo deletion failure is not blocking
        console.error("[mediciones] Failed to delete blob:", medicion.foto_url);
      }
    }

    await deleteMedicion(parseInt(id));
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: "Falta el ID" }, { status: 400 });
    }
    // If a new photo is set and there was an old one, delete the old blob
    if (body.foto_url !== undefined) {
      const existing = await getMedicionById(id);
      if (existing?.foto_url && existing.foto_url !== body.foto_url) {
        try {
          await del(existing.foto_url);
        } catch {
          console.error("[mediciones] Failed to delete old blob:", existing.foto_url);
        }
      }
    }

    const result = await updateMedicion(id, {
      compostera: body.compostera,
      dia: body.dia || null,
      temperatura: body.temperatura,
      ph: body.ph,
      humedad: body.humedad,
      observaciones: body.observaciones || null,
      estado: body.estado || "good",
      ...(body.foto_url !== undefined ? { foto_url: body.foto_url } : {}),
    });
    if (!result) {
      return NextResponse.json({ error: "Medición no encontrada" }, { status: 404 });
    }
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
