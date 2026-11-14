// Servidor de sincronización de Control de Peso — Cloudflare Worker (gratis).
// Guarda los datos de cada usuario YA CIFRADOS por la app: este servidor no los puede leer.
// Cada usuario es un `id` (32 hex) que sale de su código; la llave para descifrar nunca llega acá.
//   GET  ?sync=<id>                 → { ok, v, blob }   (v = 0 y blob = null si todavía no hay nada)
//   POST ?sync=<id> { blob, base }  → { ok, v }          o 409 { error: "version", v } si otro aparato subió antes
// Mismo esquema que el de Parecidas, pero en un Worker y una base propios.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const MAX_BLOB = 3000000;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

async function manejarSync(request, env, id) {
  if (!/^[0-9a-f]{32}$/.test(id)) return json({ error: "id inválido" }, 400);
  if (request.method === "GET") {
    const fila = await env.SYNC.prepare("SELECT blob, v FROM vaults WHERE id = ?").bind(id).first();
    return json({ ok: true, v: fila ? fila.v : 0, blob: fila ? fila.blob : null });
  }
  if (request.method !== "POST") return json({ error: "método" }, 405);
  let cuerpo;
  try { cuerpo = await request.json(); } catch { return json({ error: "json" }, 400); }
  if (!cuerpo || typeof cuerpo.blob !== "string" || !cuerpo.blob || cuerpo.blob.length > MAX_BLOB) {
    return json({ error: "blob" }, 400);
  }
  const base = Number(cuerpo.base) || 0, ahora = Date.now();
  const r = base === 0
    ? await env.SYNC.prepare("INSERT OR IGNORE INTO vaults (id, blob, v, updated) VALUES (?, ?, 1, ?)").bind(id, cuerpo.blob, ahora).run()
    : await env.SYNC.prepare("UPDATE vaults SET blob = ?, v = v + 1, updated = ? WHERE id = ? AND v = ?").bind(cuerpo.blob, ahora, id, base).run();
  if (!r.meta.changes) {
    const fila = await env.SYNC.prepare("SELECT blob, v FROM vaults WHERE id = ?").bind(id).first();
    return json({ error: "version", v: fila ? fila.v : 0 }, 409);
  }
  return json({ ok: true, v: base + 1 });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const id = new URL(request.url).searchParams.get("sync");
    if (!id) return json({ error: "no encontrado" }, 404);
    return manejarSync(request, env, id);
  },
};
