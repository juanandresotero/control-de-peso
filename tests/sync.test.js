import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoNuevo, normalizarCodigo, derivar, cifrar, descifrar, crearSync } from "../js/sync.js";
import { vacio, guardarDia, iguales } from "../js/datos.js";
import worker from "../worker/index.js";
import { d1Falso } from "./d1-falso.js";

const FORMATO = /^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/;

test("codigoNuevo tiene el formato XXXXX-XXXXX-XXXXX-XXXXX", () => {
  for (let i = 0; i < 20; i++) assert.match(codigoNuevo(), FORMATO);
});

test("normalizarCodigo perdona minúsculas, espacios y letras parecidas", () => {
  assert.equal(normalizarCodigo("k7qf3 m9txw 2p8hd a4rnb"), "K7QF3-M9TXW-2P8HD-A4RNB");
  assert.equal(normalizarCodigo("abcde-fghij-kmnpq-rstvo"), "ABCDE-FGH1J-KMNPQ-RSTV0");
  assert.equal(normalizarCodigo("K7QF3-M9TXW-2P8HD"), null);
  assert.equal(normalizarCodigo("UUUUU-UUUUU-UUUUU-UUUUU"), null);
  assert.equal(normalizarCodigo(""), null);
});

test("derivar: mismo código → mismo id; distinto código → distinto id", async () => {
  const a = await derivar("K7QF3-M9TXW-2P8HD-A4RNB");
  const b = await derivar("K7QF3-M9TXW-2P8HD-A4RNB");
  const c = await derivar("K7QF3-M9TXW-2P8HD-A4RNC");
  assert.match(a.id, /^[0-9a-f]{32}$/);
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, c.id);
});

test("cifrar y descifrar ida y vuelta; con otra llave falla", async () => {
  const { key } = await derivar("K7QF3-M9TXW-2P8HD-A4RNB");
  const { key: otra } = await derivar("K7QF3-M9TXW-2P8HD-A4RNC");
  const datos = { hola: "mundo", n: 95.5 };
  const texto = await cifrar(datos, key);
  assert.ok(!texto.includes("mundo"));
  assert.deepEqual(await descifrar(texto, key), datos);
  await assert.rejects(descifrar(texto, otra));
});

function storageFalso() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function aparato(env, datosIniciales) {
  const yo = { datos: datosIniciales };
  yo.sync = crearSync({
    url: "https://sync.prueba/",
    storage: storageFalso(),
    fetch: (url, opciones) => worker.fetch(new Request(url, opciones), env),
    leer: () => yo.datos,
    aplicar: (nuevos) => { yo.datos = nuevos; },
  });
  return yo;
}

test("dos aparatos vinculados terminan con los mismos datos", async () => {
  const env = { SYNC: d1Falso() };
  const pc = aparato(env, guardarDia(vacio(), "2026-11-10", { peso: 96 }, 1000));
  const celu = aparato(env, vacio());

  const codigo = await pc.sync.crear();
  assert.match(codigo, FORMATO);
  assert.equal(pc.sync.estado().vinculado, true);

  const r = await celu.sync.vincular(codigo.toLowerCase());
  assert.equal(r.ok, true);
  assert.equal(celu.datos.dias["2026-11-10"].peso, 96);

  pc.datos = guardarDia(pc.datos, "2026-11-11", { peso: 95.8 }, 2000);
  celu.datos = guardarDia(celu.datos, "2026-11-12", { peso: 95.5 }, 3000);
  assert.equal((await pc.sync.sincronizar()).ok, true);
  assert.equal((await celu.sync.sincronizar()).ok, true);
  assert.equal((await pc.sync.sincronizar()).ok, true);
  assert.deepEqual(Object.keys(pc.datos.dias).sort(), ["2026-11-10", "2026-11-11", "2026-11-12"]);
  assert.ok(iguales(pc.datos, celu.datos));
});

test("vincular con un código que no tiene datos avisa y no vincula", async () => {
  const env = { SYNC: d1Falso() };
  const celu = aparato(env, vacio());
  const r = await celu.sync.vincular("K7QF3-M9TXW-2P8HD-A4RNB");
  assert.equal(r.ok, false);
  assert.match(r.error, /No encontré datos/);
  assert.equal(celu.sync.estado().vinculado, false);
});

test("vincular con código mal escrito avisa", async () => {
  const celu = aparato({ SYNC: d1Falso() }, vacio());
  const r = await celu.sync.vincular("hola");
  assert.equal(r.ok, false);
  assert.match(r.error, /20 letras/);
});

test("sin conexión: avisa y los datos quedan en el aparato", async () => {
  const yo = { datos: guardarDia(vacio(), "2026-11-10", { peso: 96 }, 1000) };
  const sync = crearSync({
    url: "https://sync.prueba/", storage: storageFalso(),
    fetch: async () => { throw new Error("sin red"); },
    leer: () => yo.datos, aplicar: (n) => { yo.datos = n; },
  });
  await sync.crear();
  const r = await sync.sincronizar();
  assert.equal(r.ok, false);
  assert.match(r.error, /No pude conectar/);
  assert.equal(yo.datos.dias["2026-11-10"].peso, 96);
  assert.equal(sync.estado().vinculado, true);
});
