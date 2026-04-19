import { NextRequest, NextResponse } from "next/server";
import {
  ensureSchemaV2,
  insertMedicion,
  getMediciones,
  getMedicionesByCiclo,
  getMedicionesBySitio,
  getMedicionById,
  deleteMedicion,
  updateMedicion,
} from "@/lib/db";
import { del } from "@vercel/blob";
import { validarMedicionInput } from "@/lib/validaciones";
import { resolverCiclo } from "@/lib/ciclos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    await ensureSchemaV2();
    const body = await req.json();
    const validado = validarMedicionInput(body);
    if (!validado.ok) {
      return NextResponse.json({ error: validado.error }, { status: 400 });
    }
    const d = validado.data;

    const resolved = await resolverCiclo(d.compostera, d.ciclo_id ?? undefined);
    if (!resolved.ok) {
      // Mensaje específico de este flujo: el usuario está intentando registrar.
      const error =
        resolved.err.code === "NO_ACTIVE_CYCLE"
          ? "No hay ciclo activo para esta compostera. Crea uno antes de registrar mediciones."
          : resolved.err.error;
      return NextResponse.json({ error }, { status: resolved.err.status });
    }

    const result = await insertMedicion({
      compostera: d.compostera,
      ciclo_id: resolved.ciclo.id,
      dia: d.dia,
      temperatura: d.temperatura,
      ph: d.ph,
      humedad: d.humedad,
      observaciones: d.observaciones,
      estado: d.estado,
      foto_url: d.foto_url ?? null,
      created_at: d.fecha ?? null,
    });
    return NextResponse.json({ ...result, ciclo_id: resolved.ciclo.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureSchemaV2();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Falta el ID" }, { status: 400 });
    }

    const medicion = await getMedicionById(parseInt(id));
    if (!medicion) {
      return NextResponse.json({ error: "Medición no encontrada" }, { status: 404 });
    }

    if (medicion.foto_url) {
      try {
        await del(medicion.foto_url);
      } catch {
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
    await ensureSchemaV2();
    const body = await req.json();
    const idRaw = (body as { id?: unknown })?.id;
    const id = typeof idRaw === "number" ? idRaw : typeof idRaw === "string" ? parseInt(idRaw, 10) : NaN;
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Falta el ID" }, { status: 400 });
    }

    const validado = validarMedicionInput(body);
    if (!validado.ok) {
      return NextResponse.json({ error: validado.error }, { status: 400 });
    }
    const d = validado.data;
    const fotoUrlProvisto = d.foto_url !== undefined;

    if (fotoUrlProvisto) {
      const existing = await getMedicionById(id);
      if (existing?.foto_url && existing.foto_url !== d.foto_url) {
        try {
          await del(existing.foto_url);
        } catch {
          console.error("[mediciones] Failed to delete old blob:", existing.foto_url);
        }
      }
    }

    // Si viene ciclo_id explícito en el PUT, se reasigna; si no, se deja el que ya tenía.
    const result = await updateMedicion(id, {
      compostera: d.compostera,
      ...(d.ciclo_id !== undefined ? { ciclo_id: d.ciclo_id } : {}),
      dia: d.dia,
      temperatura: d.temperatura,
      ph: d.ph,
      humedad: d.humedad,
      observaciones: d.observaciones,
      estado: d.estado,
      ...(fotoUrlProvisto ? { foto_url: d.foto_url ?? null } : {}),
      ...(d.fecha ? { created_at: d.fecha } : {}),
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
    await ensureSchemaV2();
    const { searchParams } = new URL(req.url);
    const cicloId = searchParams.get("ciclo_id");
    const compostera = searchParams.get("compostera");
    const sitioId = searchParams.get("sitio_id");

    // Prioridad: ciclo_id > compostera > sitio_id > todo
    let rows;
    if (cicloId) {
      const n = parseInt(cicloId, 10);
      rows = Number.isInteger(n) && n > 0 ? await getMedicionesByCiclo(n) : [];
    } else if (compostera) {
      rows = await getMediciones(parseInt(compostera));
    } else if (sitioId) {
      const n = parseInt(sitioId, 10);
      rows = Number.isInteger(n) && n > 0 ? await getMedicionesBySitio(n) : [];
    } else {
      rows = await getMediciones();
    }
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
