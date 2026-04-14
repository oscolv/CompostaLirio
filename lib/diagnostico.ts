import { getMedicionesExport, getFormulacionActual, getFormulacionesDeCompostera } from "./db";

type FormulacionRow = {
  asociacion_id: number;
  formulacion_id: number;
  fecha_asociacion: string;
  es_actual: boolean;
  asociacion_notas: string | null;
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

type MedicionRow = {
  id: number;
  compostera: number;
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

export async function buildResumenHistorico(compostera: number): Promise<string | null> {
  const rows = (await getMedicionesExport(compostera)) as MedicionRow[];
  if (rows.length === 0) return null;

  const total = rows.length;
  const primera = new Date(rows[0].created_at);
  const ultima = new Date(rows[total - 1].created_at);
  const diasSpan = Math.max(1, Math.ceil((ultima.getTime() - primera.getTime()) / (1000 * 60 * 60 * 24)));

  const temps = rows.map((r) => r.temperatura);
  const phs = rows.map((r) => r.ph);
  const hums = rows.map((r) => r.humedad);

  const dangerCount = rows.filter((r) => r.estado === "danger").length;
  const warningCount = rows.filter((r) => r.estado === "warning").length;

  // Frecuencia de humedad alta (>=70)
  const humedadAlta = rows.filter((r) => r.humedad >= 70).length;

  // Últimos 5 registros para tendencia reciente
  const recientes = rows.slice(-5);
  const tempsRec = recientes.map((r) => r.temperatura);
  const phsRec = recientes.map((r) => r.ph);
  const humsRec = recientes.map((r) => r.humedad);

  // Observaciones no vacías
  const observaciones = rows
    .filter((r) => r.observaciones && r.observaciones.trim())
    .slice(-10)
    .map((r) => {
      const fecha = new Date(r.created_at).toLocaleDateString("es-MX", {
        day: "numeric", month: "short", timeZone: "America/Mexico_City",
      });
      return `- ${fecha} (día ${r.dia ?? "?"}): ${r.observaciones}`;
    });

  // Último registro
  const ult = rows[total - 1];
  const fechaUlt = new Date(ult.created_at).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Mexico_City",
  });

  // Día más reciente del proceso
  const diaActual = ult.dia;

  // Flags técnicas
  const flags: string[] = [];
  if (humedadAlta / total > 0.5) flags.push("Humedad alta en más del 50% de registros");
  if (dangerCount / total > 0.3) flags.push("Más del 30% de registros en estado peligro");
  const tempMax = Math.max(...temps);
  if (tempMax > 75) flags.push(`Temperatura máxima registrada: ${tempMax}°C (riesgo)`);
  const tempsBajo = rows.filter((r) => r.dia && r.dia > 7 && r.temperatura < 45).length;
  if (tempsBajo > 3) flags.push(`${tempsBajo} registros con temp <45°C después de día 7 (posible falta de calentamiento)`);

  let resumen = `RESUMEN HISTÓRICO DE COMPOSTERA #${compostera}`;
  resumen += `\n\nDatos generales:`;
  resumen += `\n- Total de registros: ${total}`;
  resumen += `\n- Periodo: ${diasSpan} días (${primera.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })} a ${ultima.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })})`;
  if (diaActual) resumen += `\n- Día actual del proceso: ${diaActual}`;
  resumen += `\n- Último registro: ${fechaUlt}`;

  resumen += `\n\nÚltima medición:`;
  resumen += `\n- Temp: ${ult.temperatura}°C, pH: ${ult.ph}, Humedad: ${humLabel(ult.humedad)}, Estado: ${ult.estado}`;

  resumen += `\n\nEstadísticas globales:`;
  resumen += `\n- Temperatura: media ${avg(temps).toFixed(1)}°C, máx ${tempMax}°C, mín ${Math.min(...temps)}°C`;
  resumen += `\n- pH: media ${avg(phs).toFixed(1)}, máx ${Math.max(...phs)}, mín ${Math.min(...phs)}`;
  resumen += `\n- Humedad alta (≥70%): ${humedadAlta} de ${total} registros (${Math.round(humedadAlta / total * 100)}%)`;
  resumen += `\n- Estados: ${dangerCount} peligro, ${warningCount} atención, ${total - dangerCount - warningCount} en rango`;

  resumen += `\n\nTendencia reciente (últimos ${recientes.length} registros):`;
  resumen += `\n- Temperatura: ${trend(tempsRec)} (${tempsRec[0]}→${tempsRec[tempsRec.length - 1]}°C)`;
  resumen += `\n- pH: ${trend(phsRec)} (${phsRec[0]}→${phsRec[phsRec.length - 1]})`;
  resumen += `\n- Humedad: ${trend(humsRec)} (${humLabel(humsRec[0])}→${humLabel(humsRec[humsRec.length - 1])})`;

  if (observaciones.length > 0) {
    resumen += `\n\nObservaciones de campo recientes:`;
    resumen += `\n${observaciones.join("\n")}`;
  }

  if (flags.length > 0) {
    resumen += `\n\nFlags técnicas:`;
    flags.forEach((f) => { resumen += `\n- ⚠ ${f}`; });
  }

  // --- Formulaciones ---
  try {
    const actual = (await getFormulacionActual(compostera)) as FormulacionRow | null;
    const historial = (await getFormulacionesDeCompostera(compostera)) as FormulacionRow[];

    if (actual) {
      resumen += `\n\nFormulación actual:`;
      resumen += `\n- Nombre: ${actual.nombre}`;
      if (actual.descripcion) resumen += `\n- Descripción: ${actual.descripcion}`;
      resumen += `\n- Base de cálculo: ${actual.base_calculo}`;
      const comp: string[] = [];
      if (actual.lirio_acuatico_pct != null)        comp.push(`lirio ${actual.lirio_acuatico_pct}%`);
      if (actual.excreta_pct != null)               comp.push(`excreta ${actual.excreta_pct}%`);
      if (actual.hojarasca_pct != null)             comp.push(`hojarasca ${actual.hojarasca_pct}%`);
      if (actual.residuos_vegetales_pct != null)    comp.push(`residuos vegetales ${actual.residuos_vegetales_pct}%`);
      if (actual.material_estructurante_pct != null) comp.push(`estructurante ${actual.material_estructurante_pct}%`);
      if (comp.length) resumen += `\n- Composición: ${comp.join(", ")}`;
      if (actual.tipo_excreta)             resumen += `\n- Tipo de excreta: ${actual.tipo_excreta}`;
      if (actual.relacion_cn_estimada != null)     resumen += `\n- Relación C/N estimada: ${actual.relacion_cn_estimada}`;
      if (actual.humedad_inicial_estimada != null) resumen += `\n- Humedad inicial estimada: ${actual.humedad_inicial_estimada}%`;
      if (actual.nivel_estructura)         resumen += `\n- Nivel de estructura: ${actual.nivel_estructura}`;
      if (actual.asociacion_notas)         resumen += `\n- Notas de asociación: ${actual.asociacion_notas}`;
    } else {
      resumen += `\n\nFormulación actual: no registrada`;
    }

    if (historial.length > 0) {
      resumen += `\n\nHistorial de formulaciones:`;
      // ordenadas por fecha descendente desde DB; mostramos en orden cronológico creciente
      const ordenadas = [...historial].reverse();
      ordenadas.forEach((h) => {
        const fecha = new Date(h.fecha_asociacion).toLocaleDateString("es-MX", {
          day: "numeric", month: "short", year: "numeric",
          timeZone: "America/Mexico_City",
        });
        resumen += `\n- ${fecha}: ${h.nombre}${h.es_actual ? " (actual)" : ""}`;
      });
    }
  } catch (e) {
    // Si la consulta de formulaciones falla, no bloquear el diagnóstico
    console.error("[diagnostico] formulaciones:", e);
  }

  return resumen;
}
