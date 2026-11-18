// Bloque "¿Qué comiste?" de Cargar: aparece en los días que no fueron "bien".
// Una fila por comida (hora + qué), "+ Otra" para sumar filas, "¿Cuánto?" con 3 opciones y una nota libre.
import { CUANTO, comidasUsadas } from "./deslices.js";
import { esc } from "./ui.js";

let raiz, cuanto = null;

export function htmlDesliz() {
  return `<div class="desliz" id="d-bloque" hidden>
    <h3>¿Qué comiste?</h3>
    <div id="d-filas"></div>
    <button type="button" class="boton chico" id="d-otra">+ Otra</button>
    <h3>¿Cuánto?</h3>
    <div class="cuanto">
      ${Object.entries(CUANTO).map(([valor, texto]) => `<button type="button" class="opcion" data-cuanto="${valor}">${texto}</button>`).join("")}
    </div>
    <h3>Nota</h3>
    <input type="text" id="d-nota" class="d-nota" maxlength="160" placeholder="Ej: cumpleaños, 3 porciones" aria-label="Nota">
    <datalist id="d-sugeridas"></datalist>
  </div>`;
}

const fila = (c = { hora: "", que: "" }) => `<div class="desliz-fila">
  <input type="time" class="d-hora" value="${esc(c.hora)}" aria-label="Hora">
  <input type="text" class="d-que" value="${esc(c.que)}" list="d-sugeridas" maxlength="80" placeholder="Ej: pizza" aria-label="Qué comiste">
  <button type="button" class="boton chico" data-quitar aria-label="Quitar">✕</button>
</div>`;

export function iniciarDesliz(elemento) {
  raiz = elemento;
  raiz.querySelector("#d-otra").addEventListener("click", () => {
    raiz.querySelector("#d-filas").insertAdjacentHTML("beforeend", fila());
    raiz.querySelector("#d-filas .desliz-fila:last-child .d-hora").focus();
  });
  raiz.querySelector("#d-filas").addEventListener("click", (e) => {
    if (!e.target.closest("[data-quitar]")) return;
    const filas = raiz.querySelector("#d-filas");
    e.target.closest(".desliz-fila").remove();
    if (!filas.children.length) filas.innerHTML = fila(); // siempre queda una fila para escribir
  });
  raiz.querySelectorAll("[data-cuanto]").forEach((b) => b.addEventListener("click", () => {
    cuanto = cuanto === b.dataset.cuanto ? null : b.dataset.cuanto; // tocar de nuevo la desmarca
    pintarCuanto();
  }));
}

export function prellenarDesliz(datos, desliz) {
  const comidas = desliz?.comidas?.length ? desliz.comidas : [undefined];
  raiz.querySelector("#d-filas").innerHTML = comidas.map(fila).join("");
  cuanto = desliz?.cuanto || null;
  pintarCuanto();
  raiz.querySelector("#d-nota").value = desliz?.nota || "";
  raiz.querySelector("#d-sugeridas").innerHTML = comidasUsadas(datos).map((c) => `<option value="${esc(c)}">`).join("");
}

export function mostrarDesliz(visible) {
  raiz.querySelector("#d-bloque").hidden = !visible;
}

export function leerDesliz() {
  const comidas = [...raiz.querySelectorAll(".desliz-fila")].map((f) => ({
    hora: f.querySelector(".d-hora").value,
    que: f.querySelector(".d-que").value,
  }));
  return { cuanto, comidas, nota: raiz.querySelector("#d-nota").value };
}

function pintarCuanto() {
  raiz.querySelectorAll("[data-cuanto]").forEach((b) => b.classList.toggle("elegida", b.dataset.cuanto === cuanto));
}
