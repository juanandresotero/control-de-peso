// Pantalla Ajustes: vincular aparatos, etapas y metas, respaldo.
import { guardarEtapa, borrarEtapa, nuevoId, leerPeso, mezclar, guardarPerfil } from "./datos.js";
import { NUTRICION_INICIAL, leerCm } from "./cuerpo.js";
import { esc, kg } from "./ui.js";
import { descargarJson, descargarCsv, leerRespaldo } from "./respaldo.js";

let raiz, mostrarCodigo = false, confirmandoDesvincular = false, codigoPrecargado = "", etapaNueva = null;
const confirmandoBorrar = new Set();

export function iniciar(ctx, elemento) {
  raiz = elemento;
  raiz.addEventListener("click", (e) => alTocar(ctx, e));
  raiz.addEventListener("change", (e) => alCambiarArchivo(ctx, e));
  raiz.addEventListener("input", (e) => {
    if (e.target.id !== "a-codigo") return;
    // Mayúsculas y un guion cada 5 (no hace falta escribirlo).
    const t = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 20);
    e.target.value = (t.match(/.{1,5}/g) || []).join("-");
  });
}

export function pintar(ctx, opciones = {}) {
  if (opciones.codigo) codigoPrecargado = opciones.codigo;
  const datos = ctx.datos();
  const etapas = [...(etapaNueva ? [etapaNueva] : []), ...[...datos.etapas].reverse()];
  raiz.innerHTML = `
    <div class="tarjeta zona-sync" id="a-sync"></div>
    <div class="tarjeta zona-etapas">
      <h2>Etapas y metas</h2>
      <p class="sutil" style="margin-top:0">Cada dieta es una etapa: el contador de semanas arranca en 1 en cada una.
        El <b>día objetivo</b> de una meta se ve en amarillo en Semanas.</p>
      ${etapas.map(formEtapa).join("")}
      <button class="boton" data-accion="nueva-etapa">+ Nueva etapa</button>
    </div>
    ${formPerfil(datos.perfil)}
    <div class="tarjeta zona-respaldo">
      <h2>Respaldo</h2>
      <p class="sutil" style="margin-top:0">Bajá una copia de todo cada tanto. "Cargar respaldo" junta el archivo con lo que ya tenés (no borra nada).</p>
      <div class="botones">
        <button class="boton" data-accion="bajar-json">⬇️ Descargar respaldo</button>
        <button class="boton" data-accion="bajar-csv">⬇️ Descargar para Excel</button>
        <label class="boton" style="text-align:center">⬆️ Cargar respaldo<input type="file" id="a-archivo" accept=".json,application/json" hidden></label>
      </div>
    </div>`;
  pintarSync(ctx);
}

export function pintarSync(ctx) {
  const caja = raiz && raiz.querySelector("#a-sync");
  if (!caja) return;
  const st = ctx.sync.estado();
  if (!st.vinculado) {
    caja.innerHTML = `
      <h2>Celu y PC con los mismos datos</h2>
      <p class="sutil" style="margin-top:0">Se vinculan con un código. Sin cuentas ni contraseñas, y no vence nunca.
        Tus datos viajan cifrados: nadie más los puede leer.</p>
      <div class="botones">
        <button class="boton principal" data-accion="crear-codigo">Crear código (en el primer aparato)</button>
      </div>
      <h3>¿Ya tenés un código? Escribilo acá:</h3>
      <input type="text" id="a-codigo" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" autocomplete="off" style="width:100%" value="${esc(codigoPrecargado)}">
      <div class="botones"><button class="boton" data-accion="vincular">Vincular con este código</button></div>
      <div class="mensaje" id="a-msg"></div>`;
    return;
  }
  const cuando = st.ultima ? `sincronizado ${hace(st.ultima)}` : "todavía sin sincronizar";
  caja.innerHTML = `
    <h2>Celu y PC con los mismos datos</h2>
    <p style="margin-top:0">${st.error ? "⚠️ " + esc(st.error) : `✓ Vinculado · ${cuando}`}${st.pendiente && !st.error ? " · subiendo cambios…" : ""}</p>
    ${mostrarCodigo ? `<div class="codigo">${esc(st.codigo)}</div>
      <p class="sutil">Anotá este código en un lugar seguro: es la única llave de tus datos. Si lo perdés y se rompen tus aparatos, no se puede recuperar.</p>` : ""}
    <div class="botones">
      <button class="boton" data-accion="ver-codigo">${mostrarCodigo ? "Ocultar código" : "Ver código"}</button>
      <button class="boton" data-accion="copiar-link">Copiar link para el otro aparato</button>
      <button class="boton" data-accion="sincronizar">Sincronizar ahora</button>
      <button class="boton peligro" data-accion="desvincular">${confirmandoDesvincular ? "¿Seguro? Tocá otra vez para desvincular" : "Desvincular este aparato"}</button>
    </div>
    <div class="mensaje" id="a-msg"></div>`;
}

function hace(ms) {
  const minutos = Math.round((Date.now() - ms) / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  return horas < 24 ? `hace ${horas} h` : `hace ${Math.round(horas / 24)} días`;
}

function formEtapa(etapa) {
  const metas = etapa.metas || [];
  return `<div class="etapa-form" data-etapa="${esc(etapa.id)}">
    <div class="campos">
      <div style="grid-column:1/-1"><label>Nombre</label><input type="text" data-campo="nombre" value="${esc(etapa.nombre)}" placeholder="Dieta 2027"></div>
      <div><label>Empieza</label><input type="date" data-campo="inicio" value="${esc(etapa.inicio)}"></div>
      <div><label>Peso inicial (kg)</label><input type="text" inputmode="decimal" data-campo="peso" value="${etapa.pesoInicial != null ? kg(etapa.pesoInicial) : ""}"></div>
      <div><label>Termina (opcional)</label><input type="date" data-campo="fin" value="${esc(etapa.fin || "")}"></div>
    </div>
    <label>Metas (nombre · peso · día objetivo opcional)</label>
    <div data-metas>${metas.map(filaMeta).join("")}</div>
    <div class="fila" style="margin-top:8px">
      <button class="boton" data-accion="agregar-meta">+ Meta</button>
      <span class="crece"></span>
      <button class="boton peligro" data-accion="borrar-etapa">${confirmandoBorrar.has(etapa.id) ? "¿Seguro? Tocá otra vez" : "Borrar"}</button>
      <button class="boton principal" data-accion="guardar-etapa">Guardar</button>
    </div>
    <div class="mensaje" data-msg></div>
  </div>`;
}

function filaMeta(meta = {}) {
  return `<div class="meta-fila" data-meta="${esc(meta.id || nuevoId())}">
    <input type="text" data-m="nombre" placeholder="Peso ideal" value="${esc(meta.nombre || "")}">
    <input type="text" inputmode="decimal" data-m="peso" placeholder="75" value="${meta.peso != null ? kg(meta.peso) : ""}">
    <input type="date" data-m="fecha" value="${esc(meta.fecha || "")}">
    <button class="boton" data-accion="quitar-meta" aria-label="Quitar meta">✕</button>
  </div>`;
}

function leerFormEtapa(form) {
  const valor = (campo) => form.querySelector(`[data-campo="${campo}"]`).value.trim();
  const nombre = valor("nombre"), inicio = valor("inicio"), fin = valor("fin") || null;
  const peso = leerPeso(valor("peso"));
  if (!nombre) return { error: "Poné un nombre para la etapa." };
  if (!inicio) return { error: "Poné la fecha en que empieza." };
  if (!peso.ok || peso.valor == null) return { error: "Poné el peso inicial (por ejemplo 108,5)." };
  if (fin && fin < inicio) return { error: "La fecha de fin es anterior al inicio." };
  const metas = [];
  for (const fila of form.querySelectorAll("[data-meta]")) {
    const m = (campo) => fila.querySelector(`[data-m="${campo}"]`).value.trim();
    if (!m("nombre") && !m("peso")) continue; // fila vacía: se ignora
    const pesoMeta = leerPeso(m("peso"));
    if (!m("nombre")) return { error: "Cada meta necesita un nombre." };
    if (!pesoMeta.ok || pesoMeta.valor == null) return { error: `Poné el peso de la meta "${m("nombre")}".` };
    metas.push({ id: fila.dataset.meta, nombre: m("nombre"), peso: pesoMeta.valor, fecha: m("fecha") || null });
  }
  return { etapa: { id: form.dataset.etapa, nombre, inicio, fin, pesoInicial: peso.valor, metas } };
}

function mensaje(texto, tipo = "") {
  const caja = raiz.querySelector("#a-msg");
  if (caja) { caja.textContent = texto; caja.className = "mensaje " + tipo; }
}

async function alTocar(ctx, e) {
  const boton = e.target.closest("[data-accion]");
  if (!boton) return;
  const accion = boton.dataset.accion;
  const form = boton.closest("[data-etapa]");
  const sync = ctx.sync;

  if (accion === "crear-codigo") {
    mensaje("Creando tu código…");
    mostrarCodigo = true;
    await sync.crear();
    pintarSync(ctx);
    mensaje("✓ Listo. Anotá el código: lo necesitás para vincular el otro aparato.", "ok");
  } else if (accion === "vincular") {
    mensaje("Vinculando…");
    const r = await sync.vincular(raiz.querySelector("#a-codigo").value);
    if (r.ok) { codigoPrecargado = ""; ctx.irA("ajustes"); ctx.avisar("✓ Vinculado. Tus datos ya están acá."); }
    else mensaje(r.error, "error");
  } else if (accion === "ver-codigo") {
    mostrarCodigo = !mostrarCodigo;
    pintarSync(ctx);
  } else if (accion === "copiar-link") {
    const link = location.origin + location.pathname + "#vincular=" + sync.estado().codigo;
    try { await navigator.clipboard.writeText(link); mensaje("✓ Link copiado. Abrilo en el otro aparato y tocá Vincular.", "ok"); }
    catch { mostrarCodigo = true; pintarSync(ctx); mensaje("No pude copiar: escribí el código a mano en el otro aparato."); }
  } else if (accion === "sincronizar") {
    mensaje("Sincronizando…");
    const r = await sync.sincronizar();
    mensaje(r.ok ? "✓ Todo al día." : r.error, r.ok ? "ok" : "error");
  } else if (accion === "desvincular") {
    if (!confirmandoDesvincular) {
      confirmandoDesvincular = true;
      pintarSync(ctx);
      setTimeout(() => { confirmandoDesvincular = false; pintarSync(ctx); }, 4000);
      return;
    }
    confirmandoDesvincular = false;
    mostrarCodigo = false;
    sync.desvincular();
    ctx.avisar("Este aparato ya no está vinculado. Tus datos siguen acá.");
  } else if (accion === "nueva-etapa") {
    etapaNueva = { id: nuevoId(), nombre: "", inicio: ctx.hoy(), fin: null, pesoInicial: null, metas: [] };
    pintar(ctx);
  } else if (accion === "agregar-meta") {
    form.querySelector("[data-metas]").insertAdjacentHTML("beforeend", filaMeta());
  } else if (accion === "quitar-meta") {
    boton.closest("[data-meta]").remove();
  } else if (accion === "guardar-etapa") {
    const r = leerFormEtapa(form);
    const caja = form.querySelector("[data-msg]");
    if (r.error) { caja.textContent = r.error; caja.className = "mensaje error"; return; }
    if (etapaNueva && etapaNueva.id === r.etapa.id) etapaNueva = null;
    ctx.cambiar(guardarEtapa(ctx.datos(), r.etapa));
    ctx.avisar("✓ Etapa guardada");
  } else if (accion === "borrar-etapa") {
    const id = form.dataset.etapa;
    if (etapaNueva && etapaNueva.id === id) { etapaNueva = null; pintar(ctx); return; }
    if (!confirmandoBorrar.has(id)) { confirmandoBorrar.add(id); boton.textContent = "¿Seguro? Tocá otra vez"; return; }
    confirmandoBorrar.delete(id);
    ctx.cambiar(borrarEtapa(ctx.datos(), id));
    ctx.avisar("Etapa borrada (los días cargados siguen estando)");
  } else if (accion === "bajar-json") {
    descargarJson(ctx.datos(), ctx.hoy());
  } else if (accion === "bajar-csv") {
    descargarCsv(ctx.datos(), ctx.hoy());
  } else if (accion === "guardar-perfil") {
    const r = leerFormPerfil();
    const caja = raiz.querySelector("#p-msg");
    if (r.error) { caja.textContent = r.error; caja.className = "mensaje error"; return; }
    ctx.cambiar(guardarPerfil(ctx.datos(), r.perfil));
    ctx.avisar("✓ Perfil guardado");
  }
}

async function alCambiarArchivo(ctx, e) {
  if (e.target.id !== "a-archivo" || !e.target.files.length) return;
  try {
    const respaldo = await leerRespaldo(e.target.files[0]);
    ctx.cambiar(mezclar(ctx.datos(), respaldo));
    ctx.avisar(`✓ Respaldo cargado: ${Object.keys(respaldo.dias).length} días`);
  } catch (error) {
    ctx.avisar(error.message);
  }
}

// --- Perfil: altura y factores de comida por kilo ---
const FACTORES = [
  ["kcalPorKg", "Calorías por kg"], ["protPorKg", "Proteínas (g por kg)"],
  ["grasaPorKg", "Grasas (g por kg)"], ["fibraPorKg", "Fibra (g por kg)"],
];

function formPerfil(perfil) {
  const nutricion = perfil?.nutricion || NUTRICION_INICIAL;
  const numero = (n) => (n == null ? "" : String(n).replace(".", ","));
  return `<div class="tarjeta zona-perfil">
    <h2>Perfil</h2>
    <div class="campos-perfil">
      <label><span>Altura (cm)</span><input type="text" inputmode="decimal" id="p-altura" value="${numero(perfil?.altura)}" placeholder="167"></label>
      ${FACTORES.map(([clave, etiqueta]) => `<label><span>${etiqueta}</span>
        <input type="text" inputmode="decimal" data-factor="${clave}" value="${numero(nutricion[clave])}"></label>`).join("")}
    </div>
    <p class="sutil">Los carbohidratos son las calorías que sobran. La comida por día se recalcula sola con tu peso.</p>
    <button class="boton principal" data-accion="guardar-perfil">Guardar perfil</button>
    <div class="mensaje" id="p-msg"></div>
  </div>`;
}

function leerFormPerfil() {
  const altura = leerCm(raiz.querySelector("#p-altura").value);
  if (!altura.ok || altura.valor == null || altura.valor < 100) return { error: "Poné tu altura en centímetros, por ejemplo 167." };
  const nutricion = {};
  for (const input of raiz.querySelectorAll("[data-factor]")) {
    const valor = Number(input.value.trim().replace(",", "."));
    if (!input.value.trim() || !Number.isFinite(valor) || valor < 0 || valor > 100) return { error: "Revisá los números de comida (por ejemplo 35 o 0,9)." };
    nutricion[input.dataset.factor] = valor;
  }
  return { perfil: { altura: altura.valor, nutricion } };
}
