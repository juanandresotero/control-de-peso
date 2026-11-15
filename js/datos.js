// Los datos de la app: guardarlos en el aparato, editarlos y mezclar lo de dos aparatos.
// Cada día y cada etapa llevan `mod` (cuándo se tocó por última vez): al mezclar gana el más reciente.
// Los borrados dejan una "lápida" en `tombs` para que el otro aparato también borre.

import { limpiarDesliz } from "./deslices.js";

const CLAVE = "control_peso_datos";
const DIAS_LAPIDA = 60;
const MS_DIA = 86400000;

export const COMIDAS = {
  bien: "bien",
  tentacion: "tentación",
  plato: "plato malo",
  justificado: "no fue falta de voluntad",
};

export function vacio() {
  return { version: 1, dias: {}, etapas: [], marcasSemana: {}, medidas: {}, perfil: null, tombs: {} };
}

export function validarRespaldo(obj) {
  return !!obj && typeof obj === "object" && !!obj.dias && typeof obj.dias === "object" && Array.isArray(obj.etapas);
}

export function cargar(storage = globalThis.localStorage) {
  try {
    const texto = storage.getItem(CLAVE);
    const datos = texto ? JSON.parse(texto) : null;
    return validarRespaldo(datos) ? { ...vacio(), ...datos } : vacio();
  } catch {
    return vacio();
  }
}

export function guardarTodo(datos, storage = globalThis.localStorage) {
  storage.setItem(CLAVE, JSON.stringify(datos));
}

export function leerPeso(texto) {
  const limpio = String(texto ?? "").trim().replace(",", ".");
  if (!limpio) return { ok: true, valor: null };
  if (!/^\d{1,3}(\.\d+)?$/.test(limpio)) return { ok: false, error: "Escribí el peso con números, por ejemplo 95,5." };
  const valor = Math.round(Number(limpio) * 10) / 10;
  if (valor < 30 || valor > 300) return { ok: false, error: "El peso tiene que estar entre 30 y 300 kg." };
  return { ok: true, valor };
}

// movimiento = no hice ejercicio pero no estuve sentado todo el día (si hubo ejercicio, ya está incluido).
// desliz = detalle de qué comiste (ver deslices.js); solo se guarda si el día no fue "bien".
export function guardarDia(datos, fecha, { peso = null, comida = "bien", ejercicio = false, movimiento = false, desliz = null }, ahora = Date.now()) {
  const dia = { peso, comida, ejercicio: !!ejercicio, movimiento: !ejercicio && !!movimiento, estimado: false, mod: ahora };
  const detalle = comida !== "bien" ? limpiarDesliz(desliz) : null;
  if (detalle) dia.desliz = detalle;
  return { ...datos, dias: { ...datos.dias, [fecha]: dia } };
}

export function borrarDia(datos, fecha, ahora = Date.now()) {
  const dias = { ...datos.dias };
  delete dias[fecha];
  return { ...datos, dias, tombs: { ...datos.tombs, ["dia:" + fecha]: ahora } };
}

const porInicio = (a, b) => a.inicio.localeCompare(b.inicio);

export function guardarEtapa(datos, etapa, ahora = Date.now()) {
  const otras = datos.etapas.filter((e) => e.id !== etapa.id);
  return { ...datos, etapas: [...otras, { ...etapa, mod: ahora }].sort(porInicio) };
}

export function borrarEtapa(datos, id, ahora = Date.now()) {
  return {
    ...datos,
    etapas: datos.etapas.filter((e) => e.id !== id),
    tombs: { ...datos.tombs, ["etapa:" + id]: ahora },
  };
}

// Medidas del cuerpo de un día (cm por zona). Sin ningún valor = se borra ese día.
export function guardarMedidas(datos, fecha, valores, ahora = Date.now()) {
  const limpias = Object.fromEntries(Object.entries(valores).filter(([, v]) => v != null));
  if (!Object.keys(limpias).length) return borrarMedidas(datos, fecha, ahora);
  return { ...datos, medidas: { ...datos.medidas, [fecha]: { ...limpias, mod: ahora } } };
}

export function borrarMedidas(datos, fecha, ahora = Date.now()) {
  const medidas = { ...datos.medidas };
  delete medidas[fecha];
  return { ...datos, medidas, tombs: { ...datos.tombs, ["medida:" + fecha]: ahora } };
}

// Perfil: altura (cm) y factores de nutrición.
export function guardarPerfil(datos, perfil, ahora = Date.now()) {
  return { ...datos, perfil: { ...(datos.perfil || {}), ...perfil, mod: ahora } };
}

export function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Junta dos versiones de los datos. Ante empate se queda con la de `a` (este aparato).
export function mezclar(a, b, ahora = Date.now()) {
  const corte = ahora - DIAS_LAPIDA * MS_DIA;
  const tombs = {};
  for (const fuente of [a.tombs || {}, b.tombs || {}]) {
    for (const [clave, cuando] of Object.entries(fuente)) {
      if (cuando >= corte) tombs[clave] = Math.max(tombs[clave] || 0, cuando);
    }
  }
  const vivo = (clave, item) => !(tombs[clave] && tombs[clave] >= (item.mod || 0));

  // Días y medidas: por fecha, gana el `mod` más reciente; después se aplican las lápidas.
  const porFecha = (deA, deB, prefijo) => {
    const juntos = { ...(deA || {}) };
    for (const [fecha, item] of Object.entries(deB || {})) {
      if (!juntos[fecha] || (item.mod || 0) > (juntos[fecha].mod || 0)) juntos[fecha] = item;
    }
    for (const fecha of Object.keys(juntos)) if (!vivo(prefijo + fecha, juntos[fecha])) delete juntos[fecha];
    return juntos;
  };
  const dias = porFecha(a.dias, b.dias, "dia:");
  const medidas = porFecha(a.medidas, b.medidas, "medida:");
  const perfil = !a.perfil ? b.perfil || null : !b.perfil ? a.perfil : (b.perfil.mod || 0) > (a.perfil.mod || 0) ? b.perfil : a.perfil;

  const etapas = new Map((a.etapas || []).map((e) => [e.id, e]));
  for (const etapa of b.etapas || []) {
    const actual = etapas.get(etapa.id);
    if (!actual || (etapa.mod || 0) > (actual.mod || 0)) etapas.set(etapa.id, etapa);
  }

  return {
    version: 1,
    dias,
    etapas: [...etapas.values()].filter((e) => vivo("etapa:" + e.id, e)).sort(porInicio),
    marcasSemana: { ...(b.marcasSemana || {}), ...(a.marcasSemana || {}) },
    medidas,
    perfil,
    tombs,
  };
}

function estable(valor) {
  if (Array.isArray(valor)) return "[" + valor.map(estable).join(",") + "]";
  if (valor && typeof valor === "object") {
    return "{" + Object.keys(valor).sort().map((k) => JSON.stringify(k) + ":" + estable(valor[k])).join(",") + "}";
  }
  return JSON.stringify(valor);
}

export function iguales(a, b) {
  return estable(a) === estable(b);
}

