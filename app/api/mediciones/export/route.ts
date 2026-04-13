import { NextRequest, NextResponse } from "next/server";
import { ensureTable, getMedicionesExport } from "@/lib/db";

function csvField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const compostera = searchParams.get("compostera");
    const rows = await getMedicionesExport(
      compostera ? parseInt(compostera) : undefined,
    );

    const header = "ID,Compostera,Dia,Temperatura,pH,Humedad,Estado,Observaciones,Fecha";
    const lines = rows.map((m) => {
      const fecha = new Date(m.created_at as string).toLocaleString("es-MX");
      return [
        String(m.id),
        String(m.compostera),
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
