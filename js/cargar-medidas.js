// Parte de la pantalla Cargar: medidas del cuerpo del día (cm por zona). Con cintura y cuello calcula el % de grasa.
import { guardarMedidas } from "./datos.js";
import { ZONAS, leerCm, grasaNavy, claseGrasa } from "./cuerpo.js";
import { kg } from "./ui.js";

let raiz, fechaActual = () => null;

export const htmlMedidas = () => `
  <details class="tarjeta zona-cuerpo" id="m-caja">
    <summary><b>📏 Medidas del cuerpo</b> <span class="sutil">(opcional)</span></summary>
    <div class="medidas-cab">
      <p class="sutil">En centímetros. Con <b>cintura</b> y <b>cuello</b> se calcula el % de grasa. Completá solo lo que mediste.</p>
      <button class="boton" type="button" id="m-guia">📐 Guía</button>
    </div>
    <div class="medidas-grid">
      ${ZONAS.map(([clave, etiqueta, letra]) => `<label><span>${letra ? `<b>${letra}</b> · ` : ""}${etiqueta}</span>
        <input type="text" inputmode="decimal" data-zona="${clave}" autocomplete="off"></label>`).join("")}
    </div>
    <p id="m-grasa" class="grasa-vivo"></p>
    <button class="boton principal" id="m-guardar">Guardar medidas</button>
    <div class="mensaje" id="m-msg"></div>
  </details>
  <dialog id="m-dialogo" class="dialogo-guia" aria-label="Guía de medición">
    <button class="boton" type="button" id="m-cerrar" aria-label="Cerrar">✕ Cerrar</button>
    <a href="img/guia-medidas.jpg" target="_blank" rel="noopener">
      <img src="img/guia-medidas.jpg" alt="Guía de medición de perímetros: dónde medir cada zona, de la A (hombros) a la L (tobillo)">
    </a>
    <p class="sutil" style="margin:6px 0 0;text-align:center">Tocá la imagen para verla más grande.</p>
  </dialog>`;

export function iniciarMedidas(ctx, elemento, obtenerFecha) {
  raiz = elemento;
  fechaActual = obtenerFecha;
  raiz.querySelector("#m-caja").addEventListener("input", () => pintarGrasa(ctx));
  raiz.querySelector("#m-guardar").addEventListener("click", () => guardar(ctx));
  const dialogo = raiz.querySelector("#m-dialogo");
  raiz.querySelector("#m-guia").addEventListener("click", () => dialogo.showModal());
  raiz.querySelector("#m-cerrar").addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("click", (e) => { if (e.target === dialogo) dialogo.close(); }); // tocar afuera cierra
}

export function prellenarMedidas(ctx) {
  const registro = ctx.datos().medidas[fechaActual()] || {};
  raiz.querySelectorAll("[data-zona]").forEach((input) => {
    const valor = registro[input.dataset.zona];
    input.value = valor != null ? kg(valor) : "";
  });
  if (Object.keys(registro).length) raiz.querySelector("#m-caja").open = true;
  mensaje("");
  pintarGrasa(ctx);
}

function leerTodo() {
  const valores = {};
  for (const input of raiz.querySelectorAll("[data-zona]")) {
    const r = leerCm(input.value);
    if (!r.ok) return { error: r.error };
    valores[input.dataset.zona] = r.valor;
  }
  return { valores };
}

function pintarGrasa(ctx) {
  const { valores } = leerTodo();
  const altura = ctx.datos().perfil?.altura;
  const caja = raiz.querySelector("#m-grasa");
  const grasa = valores ? grasaNavy(altura, valores.cintura, valores.cuello) : null;
  if (grasa != null) caja.innerHTML = `% de grasa: <b>${kg(grasa)}%</b> · ${claseGrasa(grasa)}`;
  else if (!altura) caja.textContent = "Poné tu altura en ⚙️ Ajustes para calcular el % de grasa.";
  else caja.textContent = "";
}

function mensaje(texto, tipo = "") {
  const caja = raiz.querySelector("#m-msg");
  caja.textContent = texto;
  caja.className = "mensaje " + tipo;
}

function guardar(ctx) {
  const r = leerTodo();
  if (r.error) return mensaje(r.error, "error");
  const registroPrevio = ctx.datos().medidas[fechaActual()] || {};
  // Si ese día tenía un % de grasa guardado a mano (del historial) y no se cargó cintura/cuello, se conserva.
  const valores = { ...r.valores, grasa: r.valores.cintura && r.valores.cuello ? null : registroPrevio.grasa ?? null };
  const hayAlgo = Object.values(valores).some((v) => v != null);
  ctx.cambiar(guardarMedidas(ctx.datos(), fechaActual(), valores));
  mensaje(hayAlgo ? "✓ Medidas guardadas" : "Medidas de este día borradas", "ok");
}
