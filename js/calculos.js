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

// Base del ritmo: { modo: "semanas", semanas: N } (últimas N semanas) o { modo: "inicio" } (desde que arrancó la dieta).
export const BASE_RITMO_INICIAL = { modo: "semanas", semanas: 4 };

export function etiquetaBase(base) {
  if (base.modo === "inicio") return "desde el inicio";
  if (base.semanas === 1) return "última semana";
  if (base.semanas === 4) return "último mes";
  return `últimas ${base.semanas} semanas`;
}

// Kilos por semana que venís bajando (negativo = subiendo), con el PROMEDIO de cada semana terminada
// (un día suelto sube o baja medio kilo por agua; el promedio de la semana es más confiable).
// La semana en curso no cuenta hasta que termina. null si no hay con qué comparar.
export function calcularRitmo(semanas, etapa, base, hoy) {
  const lunesHoy = lunesDe(hoy);
  const conPromedio = semanas.filter((s) => s.lunes < lunesHoy && s.promedio != null);
  const ultima = conPromedio.at(-1);
  if (!ultima) return null;
  if (base.modo === "inicio") {
    const semanasDesdeInicio = (diasEntre(etapa.inicio, ultima.lunes) + 3) / 7; // el promedio cae a mitad de semana
    return semanasDesdeInicio > 0 ? (etapa.pesoInicial - ultima.promedio) / semanasDesdeInicio : null;
  }
  // La semana de hace N semanas; si no tiene pesos, la anterior más cercana que tenga.
  const objetivo = sumarDias(ultima.lunes, -7 * base.semanas);
  const referencia = conPromedio.filter((s) => s.lunes <= objetivo).at(-1);
  if (!referencia) return null;
  return (referencia.promedio - ultima.promedio) / (diasEntre(referencia.lunes, ultima.lunes) / 7);
}

const DIAS_POR_MES = 30.4375;

// La estimación usa el ritmo (kg por semana) calculado con la base que eligió el usuario.
// estado: "logrado" | "vencido" | "bien" | "atrasado" | null (sin día objetivo).
function resumenMeta(meta, { pesoInicial, pesoActual, fechaActual, ritmo, hoy }) {
  const faltan = redondear1(pesoActual - meta.peso);
  const total = pesoInicial - meta.peso;
  const avance = total > 0 ? Math.min(1, Math.max(0, (pesoInicial - pesoActual) / total)) : 1;
  const alcanzada = faltan <= 0;
  const semanas = !alcanzada && ritmo > 0 ? faltan / ritmo : null;
  const semanasParaLlegar = semanas == null ? null : redondear1(semanas);
  const mesesParaLlegar = semanas == null ? null : redondear1((semanas * 7) / DIAS_POR_MES);
  const fechaEstimada = semanas == null ? null : sumarDias(fechaActual, Math.ceil(semanas * 7));
  let semanasRestantes = null, kgPorSemana = null, vencida = false, estado = alcanzada ? "logrado" : null;
  if (meta.fecha) {
    vencida = !alcanzada && meta.fecha < hoy;
    semanasRestantes = redondear1(diasEntre(hoy, meta.fecha) / 7);
    if (!alcanzada && semanasRestantes > 0) kgPorSemana = Math.round((faltan / semanasRestantes) * 100) / 100;
    if (vencida) estado = "vencido";
    else if (!alcanzada) estado = ritmo != null && kgPorSemana != null && ritmo >= kgPorSemana ? "bien" : "atrasado";
  }
  return {
    meta, faltan, avance, alcanzada, semanasParaLlegar, mesesParaLlegar, fechaEstimada,
    semanasRestantes, kgPorSemana, vencida, estado,
  };
}

export function resumenEtapa(datos, etapa, hoy, base = BASE_RITMO_INICIAL) {
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

  const ritmo = calcularRitmo(semanas, etapa, base, hoy);
  const contexto = { pesoInicial, pesoActual, fechaActual, ritmo, hoy };
  return {
    pesoInicial, pesoActual, fechaActual, mejorPeso,
    kilosPerdidos: redondear1(pesoInicial - pesoActual),
    porcentaje: pesoInicial ? redondear1(pesoInicial - pesoActual) / pesoInicial : 0,
    semanaNumero: numeroSemana(ultimoDia, etapa),
    promedioSemanal,
    ritmo,
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
