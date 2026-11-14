import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { d1Falso } from "./d1-falso.js";

const ID = "0123456789abcdef0123456789abcdef";
const URL_BASE = "https://control-peso-sync.ejemplo.workers.dev/";

const pedir = (env, metodo, id, cuerpo) =>
  worker.fetch(new Request(URL_BASE + "?sync=" + id, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  }), env);

test("GET de un id nuevo devuelve versión 0 y sin datos", async () => {
  const env = { SYNC: d1Falso() };
  const r = await pedir(env, "GET", ID);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, v: 0, blob: null });
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "*");
});

test("POST sube con control de versión", async () => {
  const env = { SYNC: d1Falso() };
  assert.deepEqual(await (await pedir(env, "POST", ID, { blob: "uno", base: 0 })).json(), { ok: true, v: 1 });
  assert.deepEqual(await (await pedir(env, "POST", ID, { blob: "dos", base: 1 })).json(), { ok: true, v: 2 });
  const viejo = await pedir(env, "POST", ID, { blob: "tres", base: 1 });
  assert.equal(viejo.status, 409);
  assert.deepEqual(await viejo.json(), { error: "version", v: 2 });
  assert.deepEqual(await (await pedir(env, "GET", ID)).json(), { ok: true, v: 2, blob: "dos" });
});

test("rechaza id inválido, blob vacío o enorme, y métodos raros", async () => {
  const env = { SYNC: d1Falso() };
  assert.equal((await pedir(env, "GET", "no-es-hex")).status, 400);
  assert.equal((await pedir(env, "POST", ID, { blob: "", base: 0 })).status, 400);
  assert.equal((await pedir(env, "POST", ID, { blob: "x".repeat(3_000_001), base: 0 })).status, 400);
  assert.equal((await pedir(env, "PUT", ID, { blob: "x", base: 0 })).status, 405);
});

test("OPTIONS responde CORS y sin ?sync da 404", async () => {
  const env = { SYNC: d1Falso() };
  const r = await worker.fetch(new Request(URL_BASE + "?sync=" + ID, { method: "OPTIONS" }), env);
  assert.equal(r.status, 204);
  assert.match(r.headers.get("Access-Control-Allow-Methods"), /POST/);
  assert.equal((await worker.fetch(new Request(URL_BASE), env)).status, 404);
});
