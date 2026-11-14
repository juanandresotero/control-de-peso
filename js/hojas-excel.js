// Qué va en el Excel descargable (para guardar en un pendrive): todas las hojas armadas como filas.
import { COMIDAS } from "./datos.js";
import { etapaDe, numeroSemana, listaSemanas, rangoEtapa } from "./calculos.js";
import { ZONAS, grasaDe } from "./cuerpo.js";
import { sumarDias } from "./fechas.js";

const siNo = (v) => (v ? "sí" : "no");
const fecha = (iso) => (iso ? { fecha: iso } : "");

function hojaDias(datos) {
  const filas = [["Fecha", "Peso (kg)", "Comida", "Ejercicio", "Relleno", "Dieta", "Semana"]];
  for (const f of Object.keys(datos.dias).sort()) {
    const d = datos.dias[f];
    const etapa = etapaDe(f, datos.etapas);
    filas.push([fecha(f), d.peso ?? "", COMIDAS[d.comida] || "", siNo(d.ejercicio), siNo(d.estimado),
      etapa ? etapa.nombre : "", etapa ? numeroSemana(f, etapa) : ""]);
  }
  return { nombre: "Días", filas };
}

function hojaSemanas(datos, hoy) {
  const filas = [["Dieta", "Semana", "Desde", "Hasta", "Peso (kg)", "Bajó (kg)", "Semana perfecta"]];
  for (const etapa of datos.etapas) {
    const { desde, hasta } = rangoEtapa(etapa, datos.etapas, hoy);
    for (const s of listaSemanas(datos, desde, hasta < hoy ? hasta : hoy, etapa.pesoInicial, hoy)) {
      filas.push([etapa.nombre, numeroSemana(s.lunes, etapa), fecha(s.lunes), fecha(sumarDias(s.lunes, 6)),
        s.peso ?? "", s.diferencia ?? "", s.marca || ""]);
    }
  }
  return { nombre: "Semanas", filas };
}

function hojaMedidas(datos) {
  const altura = datos.perfil?.altura;
  const filas = [["Fecha", "% grasa", ...ZONAS.map(([, nombre]) => `${nombre} (cm)`)]];
  for (const f of Object.keys(datos.medidas || {}).sort()) {
    const m = datos.medidas[f];
    filas.push([fecha(f), grasaDe(m, altura) ?? "", ...ZONAS.map(([clave]) => m[clave] ?? "")]);
  }
  return { nombre: "Medidas", filas };
}

function hojaEtapas(datos) {
  const filas = [["Dieta", "Inicio", "Fin", "Peso inicial (kg)", "Meta", "Peso meta (kg)", "Día objetivo"]];
  for (const e of datos.etapas) {
    const base = [e.nombre, fecha(e.inicio), fecha(e.fin), e.pesoInicial];
    const metas = e.metas || [];
    if (!metas.length) filas.push(base);
    for (const m of metas) filas.push([...base, m.nombre, m.peso, fecha(m.fecha)]);
  }
  return { nombre: "Etapas y metas", filas };
}

export function hojasExcel(datos, hoy) {
  return [hojaDias(datos), hojaSemanas(datos, hoy), hojaMedidas(datos), hojaEtapas(datos)];
}
