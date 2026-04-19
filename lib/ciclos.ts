import { getCicloActivo, getCicloById } from "./db";

// =====================================================================
// Helper central para resolver el ciclo efectivo a partir de los dos
// inputs habituales del API: compostera y/o ciclo_id. Consumido por
// /api/mediciones (POST), /api/diagnostico y /api/chat para que toda la
// lógica de coherencia (un ciclo pertenece a una compostera concreta)
// y fallback (si no viene ciclo_id, usar el ciclo activo) viva en un
// único lugar.
// =====================================================================

export type CicloResuelto = {
  id: number;
  compostera_id: number;
};

export type ResolverCicloErrorCode =
  | "MISSING"
  | "NOT_FOUND"
  | "MISMATCH"
  | "NO_ACTIVE_CYCLE";

export type ResolverCicloError = {
  code: ResolverCicloErrorCode;
  error: string;
  status: number;
};

export type ResolverCicloResult =
  | { ok: true; ciclo: CicloResuelto }
  | { ok: false; err: ResolverCicloError };

// Reglas:
//  - Si viene ciclo_id:
//      · ciclo no existe → NOT_FOUND (404)
//      · ciclo existe y además viene compostera distinta → MISMATCH (400)
//      · ok
//  - Si no viene ciclo_id pero viene compostera:
//      · hay ciclo activo → ok
//      · no hay ciclo activo → NO_ACTIVE_CYCLE (400)
//  - Si no viene ninguno → MISSING (400).
//
// El caller puede inspeccionar `err.code` para personalizar el mensaje
// si lo necesita (p.ej. /api/mediciones añade "Crea uno antes de
// registrar mediciones." en el caso NO_ACTIVE_CYCLE).
export async function resolverCiclo(
  compostera: number | null | undefined,
  ciclo_id: number | null | undefined,
): Promise<ResolverCicloResult> {
  if (typeof ciclo_id === "number" && ciclo_id > 0) {
    const ciclo = (await getCicloById(ciclo_id)) as
      | { id: number; compostera_id: number }
      | null;
    if (!ciclo) {
      return {
        ok: false,
        err: { code: "NOT_FOUND", status: 404, error: `Ciclo #${ciclo_id} no encontrado.` },
      };
    }
    if (
      typeof compostera === "number" &&
      compostera > 0 &&
      ciclo.compostera_id !== compostera
    ) {
      return {
        ok: false,
        err: {
          code: "MISMATCH",
          status: 400,
          error: "El ciclo no pertenece a esta compostera.",
        },
      };
    }
    return { ok: true, ciclo: { id: ciclo.id, compostera_id: ciclo.compostera_id } };
  }

  if (typeof compostera === "number" && compostera > 0) {
    const activo = (await getCicloActivo(compostera)) as
      | { id: number; compostera_id: number }
      | null;
    if (!activo) {
      return {
        ok: false,
        err: {
          code: "NO_ACTIVE_CYCLE",
          status: 400,
          error: "No hay ciclo activo para esta compostera.",
        },
      };
    }
    return { ok: true, ciclo: { id: activo.id, compostera_id: activo.compostera_id } };
  }

  return {
    ok: false,
    err: {
      code: "MISSING",
      status: 400,
      error: "Debes indicar ciclo_id o compostera.",
    },
  };
}
