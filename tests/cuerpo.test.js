import { test } from "node:test";
import assert from "node:assert/strict";
import {
  grasaNavy, imc, claseImc, claseGrasa, diagnostico, grasaDe, ultimaGrasa, resumenMedidas, leerCm, ZONAS,
} from "../js/cuerpo.js";

test("grasaNavy: fórmula de la Marina de EE.UU. para hombres, en centímetros", () => {
  assert.equal(grasaNavy(167, 124, 41), 40.2);
  assert.equal(grasaNavy(167, 105, 41), 29.9);
  assert.equal(grasaNavy(167, 40, 41), null); // cintura menor que cuello: no se puede calcular
  assert.equal(grasaNavy(null, 105, 41), null);
});

test("imc con la altura en cm", () => {
  assert.equal(imc(95.5, 167), 34.2);
  assert.equal(imc(83.6, 167), 30);
  assert.equal(imc(95.5, null), null);
});

test("claseImc", () => {
  assert.equal(claseImc(18.4), "Bajo peso");
  assert.equal(claseImc(24.9), "Normal");
  assert.equal(claseImc(25), "Sobrepeso");
  assert.equal(claseImc(34.2), "Obesidad grado I");
  assert.equal(claseImc(35), "Obesidad grado II");
  assert.equal(claseImc(40), "Obesidad grado III");
});

test("claseGrasa (hombres)", () => {
  assert.equal(claseGrasa(4), "Esencial");
  assert.equal(claseGrasa(10), "Atlético");
  assert.equal(claseGrasa(15), "En forma");
  assert.equal(claseGrasa(20), "Aceptable");
  assert.equal(claseGrasa(29.9), "Obesidad");
});

test("diagnostico combina IMC y % de grasa", () => {
  assert.match(diagnostico(34.2, 29.9), /Obesidad grado I.*confirmada/);
  assert.match(diagnostico(31, 20), /músculo/);
  assert.match(diagnostico(27, 28), /grasa alta/);
  assert.match(diagnostico(27, 20), /Sobrepeso/);
  assert.match(diagnostico(23, 27), /oculta/);
  assert.equal(diagnostico(22, 18), "Normal");
  assert.match(diagnostico(34.2, null), /cintura y cuello/);
});

test("grasaDe: calcula con cintura y cuello; si no, usa el % guardado", () => {
  assert.equal(grasaDe({ cintura: 105, cuello: 41 }, 167), 29.9);
  assert.equal(grasaDe({ grasa: 37.2 }, 167), 37.2);
  assert.equal(grasaDe({ hombros: 51 }, 167), null);
});

test("ultimaGrasa toma la medición más reciente que tenga % de grasa", () => {
  const medidas = {
    "2026-03-02": { cintura: 124, cuello: 41 },
    "2026-04-27": { hombros: 51, cintura: 120 },
    "2026-08-04": { cintura: 105, cuello: 41 },
    "2026-09-01": { pecho: 110 },
  };
  assert.deepEqual(ultimaGrasa(medidas, 167), { valor: 29.9, fecha: "2026-08-04" });
  assert.equal(ultimaGrasa({}, 167), null);
});

test("resumenMedidas: primera y última medición de cada zona, con diferencia", () => {
  const medidas = {
    "2026-03-02": { cintura: 124, cuello: 41 },
    "2026-04-27": { hombros: 51, cintura: 120 },
    "2026-08-04": { cintura: 105, cuello: 41 },
  };
  const r = resumenMedidas(medidas);
  const cintura = r.find((z) => z.zona === "cintura");
  assert.deepEqual(cintura.primera, { fecha: "2026-03-02", valor: 124 });
  assert.deepEqual(cintura.ultima, { fecha: "2026-08-04", valor: 105 });
  assert.equal(cintura.diferencia, -19);
  const hombros = r.find((z) => z.zona === "hombros");
  assert.equal(hombros.diferencia, null); // una sola medición
  assert.equal(r.some((z) => z.zona === "pecho"), false);
  assert.deepEqual(r.map((z) => z.zona), ["cuello", "hombros", "cintura"]); // en el orden de ZONAS
});

test("leerCm", () => {
  assert.deepEqual(leerCm("43,5"), { ok: true, valor: 43.5 });
  assert.deepEqual(leerCm(""), { ok: true, valor: null });
  assert.equal(leerCm("abc").ok, false);
  assert.equal(leerCm("400").ok, false);
});

test("ZONAS incluye cuello y cintura (los que usa el % de grasa)", () => {
  const claves = ZONAS.map(([clave]) => clave);
  assert.ok(claves.includes("cuello") && claves.includes("cintura"));
  assert.equal(claves.length, 13);
});

test("metasNutricion: tus fórmulas del Excel (por kilo de peso)", async () => {
  const { metasNutricion, NUTRICION_INICIAL } = await import("../js/cuerpo.js");
  assert.deepEqual(metasNutricion(95.5, NUTRICION_INICIAL), { kcal: 3343, proteinas: 191, grasas: 86, fibra: 48, carbohidratos: 451 });
  assert.equal(metasNutricion(null, NUTRICION_INICIAL), null);
  const otra = metasNutricion(100, { kcalPorKg: 25, protPorKg: 1.6, grasaPorKg: 0.8, fibraPorKg: 0.3 });
  assert.deepEqual(otra, { kcal: 2500, proteinas: 160, grasas: 80, fibra: 30, carbohidratos: 285 });
});
