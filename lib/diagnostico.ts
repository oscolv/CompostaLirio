import {
  getMedicionesExport,
  getMedicionesExportByCiclo,
  getFormulacionActual,
  getFormulacionesDeCompostera,
  getFormulacionById,
  getComposteraById,
  getCicloById,
  getCicloActivo,
} from "./db";

type ComposteraRow = {
  id: number;
  nombre: string | null;
  fecha_inicio: string | null;
  activa: boolean;
  masa_inicial: number | null;
};

type FormulacionRow = {
  asociacion_id?: number;
  formulacion_id?: number;
  fecha_asociacion?: string;
  es_actual?: boolean;
  asociacion_notas?: string | null;
  id?: number;
  nombre: string;
  descripcion: string | null;
  base_calculo: string;
  lirio_acuatico_pct: number | null;
  excreta_pct: number | null;
  tipo_excreta: string | null;
  hojarasca_pct: number | null;
  residuos_vegetales_pct: number | null;
  material_estructurante_pct: number | null;
  relacion_cn_estimada: number | null;
  humedad_inicial_estimada: number | null;
  nivel_estructura: string | null;
};

type CicloRow = {
  id: number;
  compostera_id: number;
  nombre: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: string;
  formulacion_id: number | null;
  peso_inicial_kg: number | null;
  objetivo: string | null;
  observaciones_generales: string | null;
};

type MedicionRow = {
  id: number;
  compostera: number;
  ciclo_id: number | null;
  dia: number | null;
  temperatura: number;
  ph: number;
  humedad: number;
  observaciones: string | null;
  estado: string;
  created_at: string;
};

const HUMEDAD_NIVELES: Record<number, string> = {
  20: "DRY++", 30: "DRY+", 40: "DRY", 55: "WET", 70: "WET+", 85: "WET++",
};

function trend(vals: number[]): string {
  if (vals.length < 2) return "sin datos suficientes";
  const first = vals[0], last = vals[vals.length - 1];
  const diff = last - first;
  const pct = first !== 0 ? Math.abs(diff / first) * 100 : 0;
  if (pct < 5) return "estable";
  return diff > 0 ? "subiendo" : "bajando";
}

function avg(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function humLabel(val: number): string {
  return HUMEDAD_NIVELES[val] ? `${HUMEDAD_NIVELES[val]} (~${val}%)` : `${val}%`;
}

function formatFormulacion(f: FormulacionRow): string {
  let out = "";
  out += `\n- Nombre: ${f.nombre}`;
  if (f.descripcion) out += `\n- Descripción: ${f.descripcion}`;
  out += `\n- Base de cálculo: ${f.base_calculo}`;
  const comp: string[] = [];
  if (f.lirio_acuatico_pct != null)         comp.push(`lirio ${f.lirio_acuatico_pct}%`);
  if (f.excreta_pct != null)                comp.push(`excreta ${f.excreta_pct}%`);
  if (f.hojarasca_pct != null)              comp.push(`hojarasca ${f.hojarasca_pct}%`);
  if (f.residuos_vegetales_pct != null)     comp.push(`residuos vegetales ${f.residuos_vegetales_pct}%`);
  if (f.material_estructurante_pct != null) comp.push(`estructurante ${f.material_estructurante_pct}%`);
  if (comp.length) out += `\n- Composición: ${comp.join(", ")}`;
  if (f.tipo_excreta)                       out += `\n- Tipo de excreta: ${f.tipo_excreta}`;
  if (f.relacion_cn_estimada != null)       out += `\n- Relación C/N estimada: ${f.relacion_cn_estimada}`;
  if (f.humedad_inicial_estimada != null)   out += `\n- Humedad inicial estimada: ${f.humedad_inicial_estimada}%`;
  if (f.nivel_estructura)                   out += `\n- Nivel de estructura: ${f.nivel_estructura}`;
  return out;
}

// =====================================================================
// Núcleo de análisis estadístico. Consumido por las dos variantes de
// resumen (por compostera legacy y por ciclo). Devuelve los bloques de
// texto que no dependen del origen del subconjunto de mediciones.
// =====================================================================
function resumenEstadistico(rows: MedicionRow[]): string {
  const total = rows.length;
  if (total === 0) return "";

  const primera = new Date(rows[0].created_at);
  const ultima = new Date(rows[total - 1].created_at);
  const diasSpan = Math.max(1, Math.ceil((ultima.getTime() - primera.getTime()) / (1000 * 60 * 60 * 24)));

  const temps = rows.map((r) => r.temperatura);
  const phs = rows.map((r) => r.ph);
  const hums = rows.map((r) => r.humedad);

  const dangerCount = rows.filter((r) => r.estado === "danger").length;
  const warningCount = rows.filter((r) => r.estado === "warning").length;
  const humedadAlta = rows.filter((r) => r.humedad >= 70).length;

  const recientes = rows.slice(-5);
  const tempsRec = recientes.map((r) => r.temperatura);
  const phsRec = recientes.map((r) => r.ph);
  const humsRec = recientes.map((r) => r.humedad);

  const observaciones = rows
    .filter((r) => r.observaciones && r.observaciones.trim())
    .slice(-10)
    .map((r) => {
      const fecha = new Date(r.created_at).toLocaleDateString("es-MX", {
        day: "numeric", month: "short", timeZone: "America/Mexico_City",
      });
      return `- ${fecha} (día ${r.dia ?? "?"}): ${r.observaciones}`;
    });

  const ult = rows[total - 1];
  const fechaUlt = new Date(ult.created_at).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Mexico_City",
  });

  const flags: string[] = [];
  if (humedadAlta / total > 0.5) flags.push("Humedad alta en más del 50% de registros");
  if (dangerCount / total > 0.3) flags.push("Más del 30% de registros en estado peligro");
  const tempMax = Math.max(...temps);
  if (tempMax > 75) flags.push(`Temperatura máxima registrada: ${tempMax}°C (riesgo)`);
  const tempsBajo = rows.filter((r) => r.dia && r.dia > 7 && r.temperatura < 45).length;
  if (tempsBajo > 3) flags.push(`${tempsBajo} registros con temp <45°C después de día 7 (posible falta de calentamiento)`);

  let out = "";
  out += `\n- Total de registros: ${total}`;
  out += `\n- Periodo: ${diasSpan} días (${primera.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })} a ${ultima.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })})`;
  if (ult.dia) out += `\n- Día actual del proceso: ${ult.dia}`;
  out += `\n- Último registro: ${fechaUlt}`;

  out += `\n\nÚltima medición:`;
  out += `\n- Temp: ${ult.temperatura}°C, pH: ${ult.ph}, Humedad: ${humLabel(ult.humedad)}, Estado: ${ult.estado}`;

  out += `\n\nEstadísticas globales:`;
  out += `\n- Temperatura: media ${avg(temps).toFixed(1)}°C, máx ${tempMax}°C, mín ${Math.min(...temps)}°C`;
  out += `\n- pH: media ${avg(phs).toFixed(1)}, máx ${Math.max(...phs)}, mín ${Math.min(...phs)}`;
  out += `\n- Humedad alta (≥70%): ${humedadAlta} de ${total} registros (${Math.round(humedadAlta / total * 100)}%)`;
  out += `\n- Estados: ${dangerCount} peligro, ${warningCount} atención, ${total - dangerCount - warningCount} en rango`;

  out += `\n\nTendencia reciente (últimos ${recientes.length} registros):`;
  out += `\n- Temperatura: ${trend(tempsRec)} (${tempsRec[0]}→${tempsRec[tempsRec.length - 1]}°C)`;
  out += `\n- pH: ${trend(phsRec)} (${phsRec[0]}→${phsRec[phsRec.length - 1]})`;
  out += `\n- Humedad: ${trend(humsRec)} (${humLabel(humsRec[0])}→${humLabel(humsRec[humsRec.length - 1])})`;

  if (observaciones.length > 0) {
    out += `\n\nObservaciones de campo recientes:`;
    out += `\n${observaciones.join("\n")}`;
  }

  if (flags.length > 0) {
    out += `\n\nFlags técnicas:`;
    flags.forEach((f) => { out += `\n- ⚠ ${f}`; });
  }

  return out;
}

// =====================================================================
// Resumen por compostera (legacy): agrupa TODAS las mediciones de la
// compostera sin distinguir ciclos. Se conserva por compatibilidad con
// flujos antiguos. Internamente delega al ciclo activo si existe para
// ofrecer contexto de ciclo a la IA cuando sea posible.
// =====================================================================
export async function buildResumenHistorico(compostera: number): Promise<string | null> {
  // Si la compostera tiene un ciclo activo, el diagnóstico por ciclo es
  // el comportamiento correcto. Caemos a histórico total sólo si no hay
  // ningún ciclo aún (caso previo a la migración).
  try {
    const activo = (await getCicloActivo(compostera)) as CicloRow | null;
    if (activo) return buildResumenHistoricoPorCiclo(activo.id);
  } catch (e) {
    console.error("[diagnostico] ciclo activo:", e);
  }

  const rows = (await getMedicionesExport(compostera)) as MedicionRow[];
  if (rows.length === 0) return null;

  let comp: ComposteraRow | null = null;
  try {
    comp = (await getComposteraById(compostera)) as ComposteraRow | null;
  } catch (e) {
    console.error("[diagnostico] compostera:", e);
  }

  let resumen = `RESUMEN HISTÓRICO DE COMPOSTERA #${compostera}`;
  resumen += `\n\nDatos generales:`;
  if (comp?.nombre) resumen += `\n- Nombre: ${comp.nombre}`;
  if (comp?.masa_inicial != null) {
    resumen += `\n- Masa inicial de composta: ${comp.masa_inicial} kg (referencia al inicio del proceso; irá disminuyendo conforme avanza la descomposición)`;
  }
  resumen += resumenEstadistico(rows);

  try {
    const actual = (await getFormulacionActual(compostera)) as FormulacionRow | null;
    const historial = (await getFormulacionesDeCompostera(compostera)) as FormulacionRow[];

    if (actual) {
      resumen += `\n\nFormulación actual:${formatFormulacion(actual)}`;
      if (actual.asociacion_notas) resumen += `\n- Notas de asociación: ${actual.asociacion_notas}`;
    } else {
      resumen += `\n\nFormulación actual: no registrada`;
    }

    if (historial.length > 0) {
      resumen += `\n\nHistorial de formulaciones:`;
      const ordenadas = [...historial].reverse();
      ordenadas.forEach((h) => {
        const fecha = h.fecha_asociacion
          ? new Date(h.fecha_asociacion).toLocaleDateString("es-MX", {
              day: "numeric", month: "short", year: "numeric",
              timeZone: "America/Mexico_City",
            })
          : "?";
        resumen += `\n- ${fecha}: ${h.nombre}${h.es_actual ? " (actual)" : ""}`;
      });
    }
  } catch (e) {
    console.error("[diagnostico] formulaciones:", e);
  }

  return resumen;
}

// =====================================================================
// Resumen por ciclo: fuente de verdad del nuevo modelo. Acota el
// análisis al subconjunto de mediciones del ciclo e incluye los datos
// propios del ciclo (fecha de inicio, formulación, peso inicial, etc.).
// =====================================================================
export async function buildResumenHistoricoPorCiclo(ciclo_id: number): Promise<string | null> {
  const ciclo = (await getCicloById(ciclo_id)) as CicloRow | null;
  if (!ciclo) return null;

  const rows = (await getMedicionesExportByCiclo(ciclo_id)) as MedicionRow[];

  let comp: ComposteraRow | null = null;
  try {
    comp = (await getComposteraById(ciclo.compostera_id)) as ComposteraRow | null;
  } catch (e) {
    console.error("[diagnostico] compostera:", e);
  }

  const nombreCompostera = comp?.nombre
    ? `${comp.nombre} (#${ciclo.compostera_id})`
    : `#${ciclo.compostera_id}`;
  const nombreCiclo = ciclo.nombre ? ciclo.nombre : `Ciclo #${ciclo.id}`;

  let resumen = `RESUMEN DEL ${nombreCiclo.toUpperCase()} DE COMPOSTERA ${nombreCompostera}`;
  resumen += `\n\nDatos del ciclo:`;
  resumen += `\n- Estado: ${ciclo.estado}`;
  resumen += `\n- Fecha de inicio: ${ciclo.fecha_inicio}`;
  if (ciclo.fecha_fin) resumen += `\n- Fecha de fin: ${ciclo.fecha_fin}`;
  if (ciclo.peso_inicial_kg != null) {
    resumen += `\n- Peso inicial: ${ciclo.peso_inicial_kg} kg (referencia al inicio del ciclo)`;
  }
  if (ciclo.objetivo) resumen += `\n- Objetivo: ${ciclo.objetivo}`;
  if (ciclo.observaciones_generales) {
    resumen += `\n- Observaciones generales: ${ciclo.observaciones_generales}`;
  }

  if (rows.length === 0) {
    resumen += `\n\nAún no hay mediciones registradas en este ciclo.`;
  } else {
    resumen += resumenEstadistico(rows);
  }

  // Formulación del ciclo (fuente de verdad) + fallback al historial legacy
  try {
    if (ciclo.formulacion_id) {
      const f = (await getFormulacionById(ciclo.formulacion_id)) as FormulacionRow | null;
      if (f) resumen += `\n\nFormulación del ciclo:${formatFormulacion(f)}`;
    } else {
      // Fallback: formulación actual de la compostera si el ciclo no la tiene asignada
      const actual = (await getFormulacionActual(ciclo.compostera_id)) as FormulacionRow | null;
      if (actual) {
        resumen += `\n\nFormulación asociada a la compostera (legacy):${formatFormulacion(actual)}`;
      } else {
        resumen += `\n\nFormulación: no registrada`;
      }
    }
  } catch (e) {
    console.error("[diagnostico] formulacion ciclo:", e);
  }

  return resumen;
}
