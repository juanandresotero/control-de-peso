import { test } from "node:test";
import assert from "node:assert/strict";
import { balanceComidas } from "../js/habitos.js";

const dia = (comida, extra = {}) => ({ peso: 95, comida, ejercicio: false, estimado: false, mod: 1, ...extra });

// 2026-11-02 es lunes; 2026-11-08 domingo.
const datos = {
  dias: {
    "2026-11-02": dia("bien"),
    "2026-11-03": dia("tentacion"),     // medio día malo
    "2026-11-04": dia("justificado"),   // cuenta como bien
    "2026-11-05": dia("bien"),
    "2026-11-06": dia("bien"),
    "2026-11-07": dia("plato"),         // día malo completo
    "2026-11-08": dia("plato"),
    "2026-11-09": dia("bien"),
    "2026-11-15": dia("plato"),
    "2026-10-31": dia("plato"),         // fuera del rango
    "2026-11-10": dia(null, { estimado: true }), // relleno: no cuenta
  },
};

test("balanceComidas: plato = día malo, tentación = medio día", () => {
  const b = balanceComidas(datos, "2026-11-01", "2026-11-15");
  assert.equal(b.total, 9);
  assert.equal(b.mal, 3.5);
  assert.equal(b.bien, 5.5);
});

test("balanceComidas: el día más difícil sale de los datos", () => {
  const b = balanceComidas(datos, "2026-11-01", "2026-11-15");
  assert.equal(b.peorDia.nombre, "domingo");
  assert.equal(b.peorDia.mal, 2);
  assert.equal(b.peorDia.total, 2);
});

test("balanceComidas: sin deslices no hay día más difícil; sin días, todo en cero", () => {
  const limpio = { dias: { "2026-11-02": dia("bien"), "2026-11-03": dia("justificado") } };
  assert.equal(balanceComidas(limpio, "2026-11-01", "2026-11-30").peorDia, null);
  assert.deepEqual(balanceComidas({ dias: {} }, "2026-11-01", "2026-11-30"), { total: 0, bien: 0, mal: 0, peorDia: null });
});
