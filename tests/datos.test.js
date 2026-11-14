import { test } from "node:test";
import assert from "node:assert/strict";
import {
  vacio, cargar, guardarTodo, leerPeso, guardarDia, borrarDia, guardarEtapa, borrarEtapa, mezclar, iguales,
  validarRespaldo, aCsv,
} from "../js/datos.js";

const DIA_MS = 86400000;
const AHORA = 1_800_000_000_000;

function storageFalso() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test("leerPeso acepta coma y punto, redondea a 1 decimal", () => {
  assert.deepEqual(leerPeso("95,5"), { ok: true, valor: 95.5 });
  assert.deepEqual(leerPeso(" 95.55 "), { ok: true, valor: 95.6 });
  assert.deepEqual(leerPeso("108"), { ok: true, valor: 108 });
  assert.deepEqual(leerPeso(""), { ok: true, valor: null });
});

test("leerPeso rechaza basura y valores fuera de rango", () => {
  for (const malo of ["abc", "20", "400", "9,5,5"]) {
    const r = leerPeso(malo);
    assert.equal(r.ok, false, malo);
    assert.ok(r.error.length > 0);
  }
});

test("cargar/guardarTodo ida y vuelta; storage vacío o roto da datos vacíos", () => {
  const s = storageFalso();
  assert.deepEqual(cargar(s), vacio());
  const d = guardarDia(vacio(), "2026-11-13", { peso: 95.5, comida: "bien", ejercicio: false }, AHORA);
  guardarTodo(d, s);
  assert.deepEqual(cargar(s), d);
  s.setItem("control_peso_datos", "{roto");
  assert.deepEqual(cargar(s), vacio());
});

test("guardarDia no muta el original y marca mod", () => {
  const original = vacio();
  const d = guardarDia(original, "2026-11-13", { peso: 95.5, comida: "tentacion", ejercicio: true }, AHORA);
  assert.deepEqual(original.dias, {});
  assert.deepEqual(d.dias["2026-11-13"], { peso: 95.5, comida: "tentacion", ejercicio: true, estimado: false, mod: AHORA });
});

test("mezclar: gana la edición más reciente de cada día y se unen días distintos", () => {
  const base = guardarDia(vacio(), "2026-11-10", { peso: 96, comida: "bien" }, AHORA);
  const pc = guardarDia(base, "2026-11-10", { peso: 96, comida: "plato" }, AHORA + 1000);
  const celu = guardarDia(base, "2026-11-11", { peso: 95.8, comida: "bien" }, AHORA + 500);
  const m = mezclar(celu, pc, AHORA + 2000);
  assert.equal(m.dias["2026-11-10"].comida, "plato");
  assert.equal(m.dias["2026-11-11"].peso, 95.8);
  assert.ok(iguales(m, mezclar(pc, celu, AHORA + 2000)));
});

test("mezclar: borrar un día se propaga, pero una edición posterior lo revive", () => {
  const base = guardarDia(vacio(), "2026-11-10", { peso: 96, comida: "bien" }, AHORA);
  const borrado = borrarDia(base, "2026-11-10", AHORA + 1000);
  assert.equal(borrado.dias["2026-11-10"], undefined);
  assert.equal(mezclar(base, borrado, AHORA + 2000).dias["2026-11-10"], undefined);
  const editadoDespues = guardarDia(base, "2026-11-10", { peso: 95, comida: "bien" }, AHORA + 1500);
  assert.equal(mezclar(borrado, editadoDespues, AHORA + 2000).dias["2026-11-10"].peso, 95);
});

test("mezclar: etapas por id, marcas de semana unidas, lápidas viejas se limpian", () => {
  const etapa = { id: "e1", nombre: "Dieta", inicio: "2026-03-02", fin: null, pesoInicial: 108.5, metas: [] };
  const a = guardarEtapa(vacio(), etapa, AHORA);
  const b = guardarEtapa(vacio(), { ...etapa, nombre: "Dieta 2026" }, AHORA + 10);
  b.marcasSemana = { "2026-03-02": "✓" };
  const m = mezclar(a, b, AHORA + 20);
  assert.equal(m.etapas.length, 1);
  assert.equal(m.etapas[0].nombre, "Dieta 2026");
  assert.equal(m.marcasSemana["2026-03-02"], "✓");

  const sinEtapa = borrarEtapa(m, "e1", AHORA + 30);
  assert.equal(mezclar(m, sinEtapa, AHORA + 40).etapas.length, 0);

  const vieja = { ...vacio(), tombs: { "dia:2020-01-01": AHORA - 61 * DIA_MS } };
  assert.deepEqual(mezclar(vieja, vacio(), AHORA).tombs, {});
});

test("iguales ignora el orden de las claves", () => {
  assert.ok(iguales({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }));
  assert.ok(!iguales({ a: 1 }, { a: 2 }));
});

test("validarRespaldo", () => {
  assert.equal(validarRespaldo(null), false);
  assert.equal(validarRespaldo({}), false);
  assert.equal(validarRespaldo({ dias: {}, etapas: "x" }), false);
  assert.equal(validarRespaldo(vacio()), true);
});

test("aCsv para abrir en Excel", () => {
  let d = guardarDia(vacio(), "2026-11-13", { peso: 95.5, comida: "plato", ejercicio: true }, AHORA);
  d = guardarDia(d, "2026-11-12", { peso: null, comida: "justificado", ejercicio: false }, AHORA);
  const lineas = aCsv(d).trim().split("\r\n");
  assert.equal(lineas[0], "fecha;peso;comida;ejercicio;estimado");
  assert.equal(lineas[1], "2026-11-12;;no fue falta de voluntad;no;no");
  assert.equal(lineas[2], "2026-11-13;95,5;plato malo;sí;no");
});

test("medidas: guardar, borrar y mezclar entre aparatos", async () => {
  const { guardarMedidas, borrarMedidas, guardarPerfil } = await import("../js/datos.js");
  let d = guardarMedidas(vacio(), "2026-08-04", { cintura: 105, cuello: 41, pecho: null }, AHORA);
  assert.deepEqual(d.medidas["2026-08-04"], { cintura: 105, cuello: 41, mod: AHORA });
  assert.equal(guardarMedidas(d, "2026-08-04", { cintura: null }, AHORA + 1).medidas["2026-08-04"], undefined); // vacío = borrar
  const otro = guardarMedidas(vacio(), "2026-09-01", { pecho: 110 }, AHORA + 5);
  const m = mezclar(d, otro, AHORA + 10);
  assert.deepEqual(Object.keys(m.medidas).sort(), ["2026-08-04", "2026-09-01"]);
  const borrado = borrarMedidas(m, "2026-09-01", AHORA + 20);
  assert.equal(mezclar(m, borrado, AHORA + 30).medidas["2026-09-01"], undefined);

  const p1 = guardarPerfil(vacio(), { altura: 167 }, AHORA);
  const p2 = guardarPerfil(vacio(), { altura: 168 }, AHORA + 1);
  assert.equal(mezclar(p1, p2, AHORA + 2).perfil.altura, 168);
  assert.equal(mezclar(p1, vacio(), AHORA + 2).perfil.altura, 167);
});
