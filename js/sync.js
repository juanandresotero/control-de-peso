// Vincular aparatos con un código (mismo esquema que Parecidas): la PC y el celu quedan con los MISMOS datos.
// Sin cuentas ni contraseñas, y nada vence:
//   · El código (20 letras/números) se crea en un aparato y se escribe en el otro.
//   · Del código salen DOS cosas que nunca viajan juntas: un id (lo único que ve el servidor) y la llave que
//     cifra los datos (AES-256, en el aparato). El servidor guarda texto ilegible.
//   · Al mezclar gana el cambio más reciente de cada día (ver datos.js → mezclar).
// Servidor: worker/index.js (?sync=<id>, GET baja / POST sube con control de versión).
import { mezclar, iguales, vacio } from "./datos.js";

export const SYNC_URL = "https://control-peso-sync.cualcaxsiempre.workers.dev/";
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // sin I, L, O, U (no se confunden al copiar)
const CLAVE_ESTADO = "control_peso_sync";
const ESPERA_MS = 3000;   // un cambio se sube a los 3 s (junta varios cambios seguidos)
const CADA_MS = 60000;    // con la app abierta y a la vista, revisa cada 1 minuto

const utf8 = (s) => new TextEncoder().encode(s);
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const b64 = (bytes) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
const deB64 = (texto) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));

export function codigoNuevo() {
  const azar = crypto.getRandomValues(new Uint8Array(20));
  const texto = Array.from(azar, (b) => ALFABETO[b & 31]).join("");
  return texto.match(/.{5}/g).join("-");
}

export function normalizarCodigo(texto) {
  const t = String(texto || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (t.length !== 20 || [...t].some((c) => !ALFABETO.includes(c))) return null;
  return t.match(/.{5}/g).join("-");
}

const derivados = new Map();
export async function derivar(codigo) {
  if (derivados.has(codigo)) return derivados.get(codigo);
  const base = await crypto.subtle.importKey("raw", utf8(codigo), "HKDF", false, ["deriveBits", "deriveKey"]);
  const salt = utf8("control-peso-sync-v1");
  const idBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: utf8("id") }, base, 128);
  const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: utf8("clave") }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const resultado = { id: hex(idBits), key };
  derivados.set(codigo, resultado);
  return resultado;
}

export async function cifrar(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8(JSON.stringify(obj))));
  const todo = new Uint8Array(12 + cifrado.length);
  todo.set(iv, 0);
  todo.set(cifrado, 12);
  return b64(todo);
}

export async function descifrar(texto, key) {
  const todo = deB64(texto);
  const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: todo.slice(0, 12) }, key, todo.slice(12));
  return JSON.parse(new TextDecoder().decode(plano));
}

// Crea el sincronizador de este aparato.
//   leer()        → los datos actuales de la app
//   aplicar(d)    → la app adopta los datos mezclados (sin contarlo como edición)
//   alCambiar()   → avisa a la pantalla que cambió el estado (para pintar "sincronizado hace…")
export function crearSync({
  url = SYNC_URL, leer, aplicar, alCambiar = () => {},
  storage = globalThis.localStorage, fetch = (...a) => globalThis.fetch(...a), ahora = () => Date.now(),
}) {
  const leerEstado = () => {
    try { return JSON.parse(storage.getItem(CLAVE_ESTADO)) || null; } catch { return null; }
  };
  const escribirEstado = (st) => { storage.setItem(CLAVE_ESTADO, JSON.stringify(st)); alCambiar(); };
  const actualizarEstado = (cambios) => { const st = leerEstado(); if (st) escribirEstado({ ...st, ...cambios }); };
  const urlDe = (id) => url + (url.includes("?") ? "&" : "?") + "sync=" + id;

  async function hacerSync({ exigirDatos = false } = {}) {
    const st = leerEstado();
    if (!st) return { ok: false, error: "Este aparato no está vinculado." };
    try {
      const { id, key } = await derivar(st.codigo);
      for (let intento = 0; intento < 3; intento++) {
        const r = await fetch(urlDe(id));
        if (!r.ok) throw new Error("http " + r.status);
        const j = await r.json();
        if (exigirDatos && j.v === 0) {
          return { ok: false, error: "No encontré datos con ese código. Revisalo (son 20 letras y números)." };
        }
        let remoto;
        try { remoto = j.blob ? await descifrar(j.blob, key) : vacio(); } catch {
          const error = "No pude abrir los datos con ese código.";
          actualizarEstado({ error });
          return { ok: false, error };
        }
        const local = leer();
        const mezcla = mezclar(local, remoto, ahora());
        if (!iguales(mezcla, local)) aplicar(mezcla);
        if (j.v !== 0 && iguales(mezcla, remoto)) {
          actualizarEstado({ v: j.v, ultima: ahora(), error: "", pendiente: false });
          return { ok: true };
        }
        const p = await fetch(urlDe(id), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blob: await cifrar(mezcla, key), base: j.v }),
        });
        if (p.status === 409) continue; // otro aparato subió justo antes: volver a bajar y mezclar
        if (!p.ok) throw new Error("http " + p.status);
        const pj = await p.json();
        actualizarEstado({ v: pj.v, ultima: ahora(), error: "", pendiente: false });
        return { ok: true };
      }
      return { ok: false, error: "Otro aparato estaba guardando a la vez. Probá de nuevo." };
    } catch {
      const error = "No pude conectar. Tus datos siguen guardados en este aparato.";
      actualizarEstado({ error });
      return { ok: false, error };
    }
  }

  let enCurso = null, timer = null;
  function sincronizar(opciones) {
    if (!enCurso) enCurso = hacerSync(opciones).finally(() => { enCurso = null; alCambiar(); });
    return enCurso;
  }

  async function crear() {
    const codigo = codigoNuevo();
    escribirEstado({ codigo, v: 0, ultima: 0, error: "", pendiente: true });
    await sincronizar();
    return codigo;
  }

  async function vincular(texto) {
    const codigo = normalizarCodigo(texto);
    if (!codigo) return { ok: false, error: "El código no es válido. Son 20 letras y números, por ejemplo K7QF3-M9TXW-2P8HD-A4RNB." };
    const anterior = leerEstado();
    escribirEstado({ codigo, v: 0, ultima: 0, error: "", pendiente: false });
    if (enCurso) await enCurso;
    const r = await sincronizar({ exigirDatos: true });
    if (!r.ok) {
      if (anterior) escribirEstado(anterior);
      else { storage.removeItem(CLAVE_ESTADO); alCambiar(); }
    }
    return r;
  }

  function desvincular() {
    clearTimeout(timer);
    storage.removeItem(CLAVE_ESTADO);
    alCambiar();
  }

  function estado() {
    const st = leerEstado();
    return {
      vinculado: !!st, codigo: st ? st.codigo : "", ultima: st ? st.ultima : 0,
      error: st ? st.error : "", pendiente: !!(st && st.pendiente),
    };
  }

  // Algo cambió en este aparato: subirlo en unos segundos.
  function avisarCambio() {
    if (!leerEstado()) return;
    actualizarEstado({ pendiente: true });
    clearTimeout(timer);
    timer = setTimeout(() => sincronizar(), ESPERA_MS);
  }

  // Sincronizar solo: al abrir, al volver a la app, al volver internet y cada minuto (máximo 1 vez cada 20 s).
  function arrancarAuto() {
    let ultimaVez = 0;
    const auto = () => {
      if (!leerEstado() || Date.now() - ultimaVez < 20000) return;
      ultimaVez = Date.now();
      sincronizar();
    };
    setTimeout(auto, 1000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) auto();
      else if (estado().pendiente) { clearTimeout(timer); sincronizar(); }
    });
    window.addEventListener("online", auto);
    setInterval(() => { if (!document.hidden) auto(); }, CADA_MS);
  }

  return { crear, vincular, sincronizar, desvincular, estado, avisarCambio, arrancarAuto };
}
