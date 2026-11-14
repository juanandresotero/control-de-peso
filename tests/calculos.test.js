import { test } from "node:test";
import assert from "node:assert/strict";
import {
  etapaDe, rangoEtapa, numeroSemana, resumenSemana, listaSemanas, resumenEtapa, serieDiaria, diasObjetivo,
} from "../js/calculos.js";

const dia = (peso, comida = "bien", extra = {}) => ({ peso, comida, ejercicio: false, estimado: false, mod: 1, ...extra });
const e2025 = { id: "e2025", nombre: "Dieta 2025", inicio: "2025-03-22", fin: null, pesoInicial: 104.8, metas: [] };
const e2026 = { id: "e2026", nombre: "Dieta 2026", inicio: "2026-03-02", fin: null, pesoInicial: 108.5, metas: [] };

test("numeroSemana: semana 1 es la que contiene el inicio", () => {
  assert.equal(numeroSemana("2026-03-02", e2026), 1);
  assert.equal(numeroSemana("2026-03-08", e2026), 1);
  assert.equal(numeroSemana("2026-03-09", e2026), 2);
  assert.equal(numeroSemana("2026-11-13", e2026), 37);
  assert.equal(numeroSemana("2025-03-17", e2025), 1); // lunes de la semana del sábado 22/3
});

test("etapaDe elige la última etapa empezada y respeta fin", () => {
  assert.equal(etapaDe("2025-01-01", [e2025, e2026]), null);
  assert.equal(etapaDe("2025-10-01", [e2026, e2025]).id, "e2025");
  assert.equal(etapaDe("2026-03-02", [e2025, e2026]).id, "e2026");
  const cerrada = { ...e2025, fin: "2025-09-07" };
  assert.equal(etapaDe("2025-10-01", [cerrada, e2026]), null);
});

test("rangoEtapa termina el día antes de la siguiente, o en fin, o hoy", () => {
  assert.deepEqual(rangoEtapa(e2025, [e2025, e2026], "2026-11-13"), { desde: "2025-03-22", hasta: "2026-03-01" });
  assert.deepEqual(rangoEtapa(e2026, [e2025, e2026], "2026-11-13"), { desde: "2026-03-02", hasta: "2026-11-13" });
  assert.deepEqual(rangoEtapa({ ...e2025, fin: "2025-09-07" }, [e2025, e2026], "2026-11-13"), { desde: "2025-03-22", hasta: "2025-09-07" });
});

test("resumenSemana: peso = último real de la semana", () => {
  const dias = { "2026-11-09": dia(96.6), "2026-11-12": dia(95.2), "2026-11-13": dia(95.5) };
  const s = resumenSemana("2026-11-09", dias, {}, "2026-11-20");
  assert.equal(s.peso, 95.5);
  assert.equal(s.estimada, false);
  assert.equal(s.dias.length, 7);
  assert.equal(s.dias[4].fecha, "2026-11-13");
  assert.equal(s.dias[6].dia, null);
  assert.equal(s.enCurso, false);
});

test("resumenSemana: si solo hay estimados, usa el último y marca estimada", () => {
  const dias = { "2025-10-06": dia(95.2, null, { estimado: true }), "2025-10-12": dia(96, null, { estimado: true }) };
  const s = resumenSemana("2025-10-06", dias, {}, "2026-11-13");
  assert.equal(s.peso, 96);
  assert.equal(s.estimada, true);
  assert.equal(s.marca, null);
});

test("resumenSemana: marca ✓/✗", () => {
  const hoy = "2026-12-31";
  assert.equal(resumenSemana("2026-11-09", { "2026-11-10": dia(95, "tentacion") }, {}, hoy).marca, "✗");
  assert.equal(resumenSemana("2026-11-09", { "2026-11-10": dia(95, "plato") }, {}, hoy).marca, "✗");
  assert.equal(resumenSemana("2026-11-09", { "2026-11-10": dia(95, "justificado"), "2026-11-11": dia(95) }, {}, hoy).marca, "✓");
  assert.equal(resumenSemana("2026-11-09", {}, {}, hoy).marca, null);
  const importada = resumenSemana("2026-11-09", { "2026-11-10": dia(95, "plato") }, { "2026-11-09": "✓" }, hoy);
  assert.equal(importada.marca, "✓");
  assert.equal(importada.importada, true);
  assert.equal(resumenSemana("2026-11-09", {}, {}, "2026-11-13").enCurso, true);
});

test("listaSemanas: diferencia contra la anterior y la primera contra el peso base", () => {
  const datos = {
    dias: { "2026-03-08": dia(105.2), "2026-03-15": dia(103.8), "2026-03-29": dia(101.3) },
    marcasSemana: {},
  };
  const s = listaSemanas(datos, "2026-03-02", "2026-03-29", 108.5, "2026-11-13");
  assert.equal(s.length, 4);
  assert.equal(s[0].diferencia, 3.3);
  assert.equal(s[1].diferencia, 1.4);
  assert.equal(s[2].peso, null);
  assert.equal(s[2].diferencia, null);
  assert.equal(s[3].diferencia, 2.5); // compara con la última semana con peso
  const sinBase = listaSemanas(datos, "2026-03-02", "2026-03-15", null, "2026-11-13");
  assert.equal(sinBase[0].diferencia, null);
});

function datosEjemplo(metas) {
  const etapa = { id: "e", nombre: "Prueba", inicio: "2026-01-05", fin: null, pesoInicial: 100, metas };
  return {
    etapa,
    datos: {
      etapas: [etapa],
      marcasSemana: {},
      dias: {
        "2026-01-05": dia(99.5), "2026-01-11": dia(99.0),
        "2026-01-14": dia(98.5, "tentacion"), "2026-01-18": dia(98.0),
        "2026-01-25": dia(97.0),
        "2026-02-01": dia(96.5, "justificado"),
        "2026-02-08": dia(96.0, "bien", { ejercicio: true }),
        "2026-02-10": dia(95.6),
      },
    },
  };
}

test("resumenEtapa: números principales", () => {
  const { datos, etapa } = datosEjemplo([]);
  const r = resumenEtapa(datos, etapa, "2026-02-11");
  assert.equal(r.pesoInicial, 100);
  assert.equal(r.pesoActual, 95.6);
  assert.equal(r.fechaActual, "2026-02-10");
  assert.equal(r.mejorPeso, 95.6);
  assert.equal(r.kilosPerdidos, 4.4);
  assert.ok(Math.abs(r.porcentaje - 0.044) < 1e-9);
  assert.ok(Math.abs(r.promedioSemanal - 4.4 / (36 / 7)) < 1e-9);
  assert.ok(Math.abs(r.ritmo4 - 0.6) < 1e-9);
  assert.equal(r.semanaNumero, 6);
  assert.equal(r.semanasOk, 4);
  assert.equal(r.semanasMal, 1);
  assert.equal(r.racha, 3);
  assert.equal(r.semanaEnCurso.lunes, "2026-02-09");
});

test("resumenEtapa: metas", () => {
  const { datos, etapa } = datosEjemplo([
    { id: "a", nombre: "A", peso: 90, fecha: null },
    { id: "b", nombre: "B", peso: 96, fecha: null },
    { id: "c", nombre: "C", peso: 92, fecha: "2026-02-01" },
    { id: "d", nombre: "D", peso: 92, fecha: "2026-03-11" },
    { id: "e", nombre: "E", peso: 95, fecha: "2026-03-11" },
  ]);
  const [a, b, c, d, e] = resumenEtapa(datos, etapa, "2026-02-11").metas;
  assert.equal(a.faltan, 5.6);
  assert.ok(Math.abs(a.avance - 0.44) < 1e-9);
  assert.equal(a.alcanzada, false);
  // La estimación usa el ritmo del último mes (0,6 kg/sem): 5,6 / 0,6 = 9,3 semanas ≈ 2,1 meses.
  assert.equal(a.semanasParaLlegar, 9.3);
  assert.equal(a.mesesParaLlegar, 2.1);
  assert.equal(a.fechaEstimada, "2026-04-17");
  assert.equal(a.estado, null); // sin fecha objetivo no hay "bien / atrasado"
  assert.equal(b.alcanzada, true);
  assert.equal(b.avance, 1);
  assert.equal(b.fechaEstimada, null);
  assert.equal(b.estado, "logrado");
  assert.equal(c.vencida, true);
  assert.equal(c.kgPorSemana, null);
  assert.equal(c.estado, "vencido");
  assert.equal(d.vencida, false);
  assert.equal(d.semanasRestantes, 4);
  assert.equal(d.kgPorSemana, 0.9);
  assert.equal(d.estado, "atrasado"); // necesita 0,9 kg/sem y viene bajando 0,6
  assert.equal(e.kgPorSemana, 0.15);
  assert.equal(e.estado, "bien");
});

test("resumenEtapa: si subiste, no hay fecha estimada", () => {
  const etapa = { id: "e", nombre: "x", inicio: "2026-01-05", fin: null, pesoInicial: 100, metas: [{ id: "a", nombre: "A", peso: 90, fecha: null }] };
  const datos = { etapas: [etapa], marcasSemana: {}, dias: { "2026-01-20": dia(101) } };
  const r = resumenEtapa(datos, etapa, "2026-01-21");
  assert.ok(r.promedioSemanal < 0);
  assert.equal(r.metas[0].fechaEstimada, null);
  assert.equal(r.metas[0].semanasParaLlegar, null);
});

test("resumenEtapa: si el último mes subiste, no hay estimación aunque el promedio total sea bueno", () => {
  const etapa = { id: "e", nombre: "x", inicio: "2026-01-05", fin: null, pesoInicial: 100, metas: [{ id: "a", nombre: "A", peso: 80, fecha: null }] };
  const dias = {};
  ["2026-01-11", "2026-01-18", "2026-01-25", "2026-02-01", "2026-02-08"].forEach((f, i) => { dias[f] = dia([90, 89, 89.5, 90, 91][i]); });
  const r = resumenEtapa({ etapas: [etapa], marcasSemana: {}, dias }, etapa, "2026-02-09");
  assert.ok(r.promedioSemanal > 0);
  assert.ok(r.ritmo4 < 0);
  assert.equal(r.metas[0].fechaEstimada, null);
  assert.equal(r.metas[0].semanasParaLlegar, null);
});

test("resumenEtapa ignora estimados para el peso actual", () => {
  const etapa = { id: "e", nombre: "x", inicio: "2026-01-05", fin: null, pesoInicial: 100, metas: [] };
  const datos = { etapas: [etapa], marcasSemana: {}, dias: { "2026-01-06": dia(99), "2026-01-07": dia(98, null, { estimado: true }) } };
  assert.equal(resumenEtapa(datos, etapa, "2026-01-08").pesoActual, 99);
});

test("serieDiaria: solo pesos reales", () => {
  const datos = { dias: { "2026-01-05": dia(99), "2026-01-07": dia(98, null, { estimado: true }) } };
  assert.deepEqual(serieDiaria(datos, "2026-01-05", "2026-01-08"), {
    fechas: ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"],
    valores: [99, null, null, null],
  });
});

test("diasObjetivo junta las fechas de las metas", () => {
  const etapas = [{ ...e2026, metas: [{ id: "a", nombre: "A", peso: 90, fecha: "2026-12-01" }, { id: "b", nombre: "B", peso: 75, fecha: null }] }];
  const m = diasObjetivo(etapas);
  assert.equal(m.size, 1);
  assert.equal(m.get("2026-12-01")[0].nombre, "A");
});
