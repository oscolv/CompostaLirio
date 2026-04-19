import { NextRequest, NextResponse } from "next/server";
import {
  ensureSchemaV2,
  getMedicionesExport,
  getMedicionesExportByCiclo,
  getMedicionesExportBySitio,
} from "@/lib/db";

function csvField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: NextRequest) {
  try {
    await ensureSchemaV2();
    const { searchParams } = new URL(req.url);
    const cicloId = searchParams.get("ciclo_id");
    const compostera = searchParams.get("compostera");
    const sitioId = searchParams.get("sitio_id");

    // Prioridad: ciclo_id > compostera > sitio_id > todo
    // (alineado con GET /api/mediciones)
    let rows;
    if (cicloId) {
      const n = parseInt(cicloId, 10);
      rows = Number.isInteger(n) && n > 0 ? await getMedicionesExportByCiclo(n) : [];
    } else if (compostera) {
      rows = await getMedicionesExport(parseInt(compostera));
    } else if (sitioId) {
      const n = parseInt(sitioId, 10);
      rows = Number.isInteger(n) && n > 0 ? await getMedicionesExportBySitio(n) : [];
    } else {
      rows = await getMedicionesExport();
    }

    const header = "ID,Compostera,Ciclo,Dia,Temperatura,pH,Humedad,Estado,Observaciones,Fecha";
    const lines = rows.map((m) => {
      const fecha = new Date(m.created_at as string).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
      return [
        String(m.id),
        String(m.compostera),
        String(m.ciclo_id ?? ""),
        m.dia != null ? String(m.dia) : "",
        String(m.temperatura),
        String(m.ph),
        String(m.humedad),
        String(m.estado),
        csvField(String(m.observaciones ?? "")),
        csvField(fecha),
      ].join(",");
    });

    const csv = "\uFEFF" + [header, ...lines].join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mediciones.csv"`,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
