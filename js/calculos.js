// Reglas de cálculo: semanas, ✓/✗, resumen de la etapa y metas. Funciones puras (sin pantalla ni guardado).
import { lunesDe, sumarDias, diasEntre } from "./fechas.js";

export const MALAS = new Set(["tentacion", "plato"]);

const redondear1 = (n) => Math.round(n * 10) / 10;
const porInicio = (etapas) => [...etapas].sort((a, b) => a.inicio.localeCompare(b.inicio));
const esReal = (dia) => dia && dia.peso != null && !dia.estimado;

export function etapaDe(iso, etapas) {
  let elegida = null;
  for (const etapa of porInicio(etapas)) if (etapa.inicio <= iso) elegida = etapa;
  if (elegida && elegida.fin && iso > elegida.fin) return null;
  return elegida;
}

export function rangoEtapa(etapa, etapas, hoy) {
  if (etapa.fin) return { desde: etapa.inicio, hasta: etapa.fin };
  const siguiente = porInicio(etapas).find((e) => e.inicio > etapa.inicio);
  return { desde: etapa.inicio, hasta: siguiente ? sumarDias(siguiente.inicio, -1) : hoy };
}

export function numeroSemana(iso, etapa) {
  return Math.floor(diasEntre(lunesDe(etapa.inicio), lunesDe(iso)) / 7) + 1;
}

export function resumenSemana(lunes, dias, marcasSemana, hoy) {
  const celdas = [];
  let peso = null, ultimoEstimado = null, hayDatos = false, hayMala = false;
  for (let i = 0; i < 7; i++) {
    const fecha = sumarDias(lunes, i);
    const dia = dias[fecha] || null;
    celdas.push({ fecha, dia });
    if (!dia) continue;
    if (dia.peso != null) {
      if (dia.estimado) ultimoEstimado = dia.peso;
      else peso = dia.peso;
    }
    if (dia.comida) {
      hayDatos = true;
      if (MALAS.has(dia.comida)) hayMala = true;
    }
  }
  // Promedio de los pesos reales (en décimas de kg, para que el redondeo no falle con decimales).
  const decimas = celdas.filter((c) => esReal(c.dia)).map((c) => Math.round(c.dia.peso * 10));
  const promedio = decimas.length ? Math.round(decimas.reduce((a, b) => a + b, 0) / decimas.length) / 10 : null;
  const estimada = peso == null && ultimoEstimado != null;
  if (estimada) peso = ultimoEstimado;
  const importada = (marcasSemana && marcasSemana[lunes]) || null;
  const marca = importada || (hayMala ? "✗" : hayDatos ? "✓" : null);
  return { lunes, dias: celdas, peso, promedio, estimada, marca, importada: !!importada, enCurso: lunes === lunesDe(hoy) };
}

export function listaSemanas(datos, desde, hasta, pesoBase, hoy) {
  const semanas = [];
  let anterior = pesoBase ?? null;
  for (let lunes = lunesDe(desde); lunes <= hasta; lunes = sumarDias(lunes, 7)) {
    const semana = resumenSemana(lunes, datos.dias, datos.marcasSemana, hoy);
    semana.diferencia = semana.peso != null && anterior != null ? redondear1(anterior - semana.peso) : null;
    if (semana.peso != null) anterior = semana.peso;
    semanas.push(semana);
  }
  return semanas;
}

// Kilos por semana de las últimas 4 semanas (solo pesos reales). null si no hay con qué comparar.
function ritmoUltimas4(semanas) {
  const conPeso = (s) => s && s.peso != null && !s.estimada;
  for (let i = semanas.length - 1; i >= 4; i--) {
    if (!conPeso(semanas[i])) continue;
    return conPeso(semanas[i - 4]) ? (semanas[i - 4].peso - semanas[i].peso) / 4 : null;
  }
  return null;
}

const DIAS_POR_MES = 30.4375;

// La estimación usa el ritmo del último mes (`ritmo4`, kg por semana), que dice mejor cómo venís ahora.
// estado: "logrado" | "vencido" | "bien" | "atrasado" | null (sin día objetivo).
function resumenMeta(meta, { pesoInicial, pesoActual, fechaActual, ritmo4, hoy }) {
  const faltan = redondear1(pesoActual - meta.peso);
  const total = pesoInicial - meta.peso;
  const avance = total > 0 ? Math.min(1, Math.max(0, (pesoInicial - pesoActual) / total)) : 1;
  const alcanzada = faltan <= 0;
  const semanas = !alcanzada && ritmo4 > 0 ? faltan / ritmo4 : null;
  const semanasParaLlegar = semanas == null ? null : redondear1(semanas);
  const mesesParaLlegar = semanas == null ? null : redondear1((semanas * 7) / DIAS_POR_MES);
  const fechaEstimada = semanas == null ? null : sumarDias(fechaActual, Math.ceil(semanas * 7));
  let semanasRestantes = null, kgPorSemana = null, vencida = false, estado = alcanzada ? "logrado" : null;
  if (meta.fecha) {
    vencida = !alcanzada && meta.fecha < hoy;
    semanasRestantes = redondear1(diasEntre(hoy, meta.fecha) / 7);
    if (!alcanzada && semanasRestantes > 0) kgPorSemana = Math.round((faltan / semanasRestantes) * 100) / 100;
    if (vencida) estado = "vencido";
    else if (!alcanzada) estado = ritmo4 != null && kgPorSemana != null && ritmo4 >= kgPorSemana ? "bien" : "atrasado";
  }
  return {
    meta, faltan, avance, alcanzada, semanasParaLlegar, mesesParaLlegar, fechaEstimada,
    semanasRestantes, kgPorSemana, vencida, estado,
  };
}

export function resumenEtapa(datos, etapa, hoy) {
  const { desde, hasta } = rangoEtapa(etapa, datos.etapas, hoy);
  const reales = Object.entries(datos.dias)
    .filter(([fecha, dia]) => fecha >= desde && fecha <= hasta && esReal(dia))
    .sort(([a], [b]) => a.localeCompare(b));
  const pesoInicial = etapa.pesoInicial;
  const ultimo = reales.at(-1);
  const pesoActual = ultimo ? ultimo[1].peso : pesoInicial;
  const fechaActual = ultimo ? ultimo[0] : etapa.inicio;
  const mejorPeso = reales.length ? Math.min(...reales.map(([, d]) => d.peso)) : pesoInicial;
  const semanasTranscurridas = diasEntre(etapa.inicio, fechaActual) / 7;
  const promedioSemanal = semanasTranscurridas > 0 ? (pesoInicial - pesoActual) / semanasTranscurridas : null;

  const ultimoDia = hasta < hoy ? hasta : hoy;
  const semanas = listaSemanas(datos, desde, ultimoDia, pesoInicial, hoy);
  const lunesHoy = lunesDe(hoy);
  const cerradas = semanas.filter((s) => s.lunes < lunesHoy);
  let racha = 0;
  for (let i = cerradas.length - 1; i >= 0 && cerradas[i].marca === "✓"; i--) racha++;

  const ritmo4 = ritmoUltimas4(semanas);
  const contexto = { pesoInicial, pesoActual, fechaActual, ritmo4, hoy };
  return {
    pesoInicial, pesoActual, fechaActual, mejorPeso,
    kilosPerdidos: redondear1(pesoInicial - pesoActual),
    porcentaje: pesoInicial ? redondear1(pesoInicial - pesoActual) / pesoInicial : 0,
    semanaNumero: numeroSemana(ultimoDia, etapa),
    promedioSemanal,
    ritmo4,
    semanasOk: cerradas.filter((s) => s.marca === "✓").length,
    semanasMal: cerradas.filter((s) => s.marca === "✗").length,
    racha,
    semanaEnCurso: semanas.find((s) => s.enCurso) || null,
    metas: (etapa.metas || []).map((meta) => resumenMeta(meta, contexto)),
  };
}

export function serieDiaria(datos, desde, hasta) {
  const fechas = [], valores = [];
  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    const dia = datos.dias[fecha];
    fechas.push(fecha);
    valores.push(esReal(dia) ? dia.peso : null);
  }
  return { fechas, valores };
}

export function diasObjetivo(etapas) {
  const mapa = new Map();
  for (const etapa of etapas) {
    for (const meta of etapa.metas || []) {
      if (!meta.fecha) continue;
      if (!mapa.has(meta.fecha)) mapa.set(meta.fecha, []);
      mapa.get(meta.fecha).push(meta);
    }
  }
  return mapa;
}
