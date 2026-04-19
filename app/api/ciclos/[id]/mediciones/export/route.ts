import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaV2, getMedicionesExportByCiclo } from "@/lib/db";

function csvField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchemaV2();
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const rows = await getMedicionesExportByCiclo(id);

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
        "Content-Disposition": `attachment; filename="ciclo-${id}-mediciones.csv"`,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
