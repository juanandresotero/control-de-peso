import { test } from "node:test";
import assert from "node:assert/strict";
import { lunesDe, sumarDias, diasEntre, formatoCorto, formatoLargo, hoyIso, aIso, aFecha } from "../js/fechas.js";

test("lunesDe devuelve el lunes de la semana", () => {
  assert.equal(lunesDe("2026-11-13"), "2026-11-09");
  assert.equal(lunesDe("2026-11-09"), "2026-11-09");
  assert.equal(lunesDe("2026-11-15"), "2026-11-09");
  assert.equal(lunesDe("2026-03-02"), "2026-03-02");
});

test("sumarDias cruza meses y años", () => {
  assert.equal(sumarDias("2026-02-28", 1), "2026-03-01");
  assert.equal(sumarDias("2025-12-31", 1), "2026-01-01");
  assert.equal(sumarDias("2026-03-02", -1), "2026-03-01");
});

test("diasEntre", () => {
  assert.equal(diasEntre("2026-03-02", "2026-11-13"), 256);
  assert.equal(diasEntre("2026-11-13", "2026-03-02"), -256);
});

test("formatos", () => {
  assert.equal(formatoCorto("2026-03-02"), "02/03");
  assert.equal(formatoLargo("2026-11-13"), "vie 13/11/2026");
  assert.equal(aIso(aFecha("2026-07-04")), "2026-07-04");
});

test("hoyIso usa la fecha local", () => {
  assert.equal(hoyIso(new Date(2026, 10, 13, 23, 59)), "2026-11-13");
  assert.equal(hoyIso(new Date(2026, 0, 5, 0, 1)), "2026-01-05");
});
