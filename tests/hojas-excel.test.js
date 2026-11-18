import { test } from "node:test";
import assert from "node:assert/strict";
import { hojasExcel } from "../js/hojas-excel.js";
import { vacio, guardarDia, guardarEtapa, guardarMedidas, guardarPerfil } from "../js/datos.js";

function datosEjemplo() {
  let d = vacio();
  d = guardarEtapa(d, { id: "e", nombre: "Dieta 2026", inicio: "2026-11-02", fin: null, pesoInicial: 97,
    metas: [{ id: "m", nombre: "Peso ideal", peso: 75, fecha: "2027-06-30" }] }, 1);
  d = guardarDia(d, "2026-11-08", { peso: 96, comida: "plato", ejercicio: true,
    desliz: { cuanto: "todo", comidas: [{ hora: "21:30", que: "pizza" }], nota: "Cumpleaños" } }, 1);
  d = guardarDia(d, "2026-11-13", { peso: 95.5, comida: "bien", movimiento: true }, 1);
  d = guardarMedidas(d, "2026-11-10", { cintura: 105, cuello: 41, tobillo: 24 }, 1);
  return guardarPerfil(d, { altura: 167 }, 1);
}

test("hojasExcel arma Días, Semanas, Medidas y Etapas y metas", () => {
  const hojas = hojasExcel(datosEjemplo(), "2026-11-14");
  assert.deepEqual(hojas.map((h) => h.nombre), ["Días", "Semanas", "Medidas", "Etapas y metas"]);
  const [dias, semanas, medidas, etapas] = hojas;

  assert.deepEqual(dias.filas[0], ["Fecha", "Peso (kg)", "Comida", "Ejercicio", "Día activo", "Qué comí", "Cuánto", "Nota", "Relleno", "Dieta", "Semana"]);
  assert.deepEqual(dias.filas[1], [{ fecha: "2026-11-08" }, 96, "plato malo", "sí", "no", "21:30 pizza", "Todo el día", "Cumpleaños", "no", "Dieta 2026", 1]);
  assert.deepEqual(dias.filas[2].slice(3, 5), ["no", "sí"]);
  assert.equal(dias.filas.length, 3);

  assert.deepEqual(semanas.filas[0], ["Dieta", "Semana", "Desde", "Hasta", "Peso último día (kg)", "Promedio (kg)", "Bajó (kg)", "Semana perfecta"]);
  assert.deepEqual(semanas.filas[1], ["Dieta 2026", 1, { fecha: "2026-11-02" }, { fecha: "2026-11-08" }, 96, 96, 1, "✗"]);
  assert.deepEqual(semanas.filas[2].slice(4), [95.5, 95.5, 0.5, "✓"]);

  assert.equal(medidas.filas[0][1], "% grasa");
  assert.ok(medidas.filas[0].includes("Tobillo (cm)"));
  assert.equal(medidas.filas[1][1], 29.9);

  assert.deepEqual(etapas.filas[1], ["Dieta 2026", { fecha: "2026-11-02" }, "", 97, "Peso ideal", 75, { fecha: "2027-06-30" }]);
});
