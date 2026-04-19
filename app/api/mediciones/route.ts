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
  getCicloActivo,
  getCicloById,
} from "@/lib/db";
import { del } from "@vercel/blob";
import { validarMedicionInput } from "@/lib/validaciones";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Resuelve el ciclo_id que debe quedar persistido en la medición.
// Prioridad: ciclo_id explícito del body > ciclo activo de la compostera.
// Si no hay ciclo activo devuelve null con un error legible para el cliente.
async function resolverCicloId(
  compostera: number,
  cicloIdExplicito: number | null | undefined,
): Promise<{ ok: true; ciclo_id: number } | { ok: false; error: string }> {
  if (typeof cicloIdExplicito === "number" && cicloIdExplicito > 0) {
    const ciclo = await getCicloById(cicloIdExplicito);
    if (!ciclo) return { ok: false, error: "Ciclo no encontrado" };
    if (ciclo.compostera_id !== compostera) {
      return { ok: false, error: "El ciclo no pertenece a esta compostera" };
    }
    return { ok: true, ciclo_id: ciclo.id as number };
  }
  const activo = await getCicloActivo(compostera);
  if (!activo) {
    return {
      ok: false,
      error: "No hay ciclo activo para esta compostera. Crea uno antes de registrar mediciones.",
    };
  }
  return { ok: true, ciclo_id: activo.id as number };
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchemaV2();
    const body = await req.json();
    const validado = validarMedicionInput(body);
    if (!validado.ok) {
      return NextResponse.json({ error: validado.error }, { status: 400 });
    }
    const d = validado.data;

    const resolved = await resolverCicloId(d.compostera, d.ciclo_id ?? undefined);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const result = await insertMedicion({
      compostera: d.compostera,
      ciclo_id: resolved.ciclo_id,
      dia: d.dia,
      temperatura: d.temperatura,
      ph: d.ph,
      humedad: d.humedad,
      observaciones: d.observaciones,
      estado: d.estado,
      foto_url: d.foto_url ?? null,
      created_at: d.fecha ?? null,
    });
    return NextResponse.json({ ...result, ciclo_id: resolved.ciclo_id });
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
