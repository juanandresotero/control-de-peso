import { test } from "node:test";
import assert from "node:assert/strict";
import { limpiarDesliz, momentoDe, comidasUsadas, patronesDeslices, textoDesliz } from "../js/deslices.js";
import { vacio, guardarDia } from "../js/datos.js";

test("limpiarDesliz saca filas vacías, recorta texto y da null si no queda nada", () => {
  assert.equal(limpiarDesliz(null), null);
  assert.equal(limpiarDesliz({ cuanto: null, comidas: [{ hora: "", que: "  " }] }), null);
  assert.deepEqual(limpiarDesliz({ cuanto: "todo", comidas: [{ hora: "21:30", que: " pizza " }, { hora: "", que: "" }] }),
    { cuanto: "todo", comidas: [{ hora: "21:30", que: "pizza" }] });
  assert.deepEqual(limpiarDesliz({ cuanto: "cualquiera", comidas: [{ hora: "16:00", que: "" }] }),
    { cuanto: null, comidas: [{ hora: "16:00", que: "" }] });
});

test("limpiarDesliz ordena las comidas por hora (las sin hora al final)", () => {
  const d = limpiarDesliz({ cuanto: null, comidas: [{ hora: "", que: "helado" }, { hora: "21:00", que: "pizza" }, { hora: "16:00", que: "alfajor" }] });
  assert.deepEqual(d.comidas.map((c) => c.que), ["alfajor", "pizza", "helado"]);
});

test("momentoDe agrupa la hora en mañana, mediodía, tarde y noche", () => {
  assert.equal(momentoDe("08:15"), "Mañana");
  assert.equal(momentoDe("12:00"), "Mediodía");
  assert.equal(momentoDe("17:40"), "Tarde");
  assert.equal(momentoDe("21:30"), "Noche");
  assert.equal(momentoDe("02:00"), "Noche");
  assert.equal(momentoDe(""), null);
});

test("guardarDia guarda el desliz solo en días que no son 'bien'", () => {
  const desliz = { cuanto: "solo", comidas: [{ hora: "21:30", que: "pizza" }] };
  const malo = guardarDia(vacio(), "2026-11-14", { peso: 95, comida: "plato", desliz }, 1);
  assert.deepEqual(malo.dias["2026-11-14"].desliz, desliz);
  const bien = guardarDia(vacio(), "2026-11-14", { peso: 95, comida: "bien", desliz }, 1);
  assert.equal("desliz" in bien.dias["2026-11-14"], false);
});

function datosEjemplo() {
  let d = vacio();
  d = guardarDia(d, "2026-11-10", { comida: "plato", desliz: { cuanto: "todo", comidas: [{ hora: "21:00", que: "Pizza" }, { hora: "16:30", que: "alfajor" }] } }, 1);
  d = guardarDia(d, "2026-11-11", { comida: "tentacion", desliz: { cuanto: "solo", comidas: [{ hora: "22:10", que: "pizza " }] } }, 1);
  d = guardarDia(d, "2026-11-12", { comida: "tentacion" }, 1); // sin detalle: no cuenta
  d = guardarDia(d, "2026-10-01", { comida: "plato", desliz: { cuanto: "todo", comidas: [{ hora: "09:00", que: "medialunas" }] } }, 1);
  return d;
}

test("patronesDeslices cuenta momentos, comidas (sin importar mayúsculas) y cuánto, dentro del período", () => {
  const p = patronesDeslices(datosEjemplo(), "2026-11-01", "2026-11-30");
  assert.equal(p.dias, 2);
  assert.deepEqual(p.momentos, [{ nombre: "Noche", n: 2 }, { nombre: "Tarde", n: 1 }]);
  assert.deepEqual(p.comidas, [{ nombre: "Pizza", n: 2 }, { nombre: "alfajor", n: 1 }]);
  assert.deepEqual(p.cuanto, [{ nombre: "Todo el día", n: 1 }, { nombre: "Solo eso, el resto bien", n: 1 }]);
});

test("comidasUsadas lista lo ya escrito, lo más repetido primero (empates por fecha)", () => {
  assert.deepEqual(comidasUsadas(datosEjemplo()), ["Pizza", "medialunas", "alfajor"]);
});

test("textoDesliz arma las líneas para el pop-up y el Excel", () => {
  assert.deepEqual(textoDesliz({ cuanto: "todo", comidas: [{ hora: "21:00", que: "pizza" }, { hora: "", que: "helado" }] }),
    { comidas: "21:00 pizza; helado", cuanto: "Todo el día" });
  assert.deepEqual(textoDesliz(undefined), { comidas: "", cuanto: "" });
});
