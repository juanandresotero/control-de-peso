// Ayudas chicas que comparten las pantallas.
import { etapaDe } from "./calculos.js";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (texto) => String(texto ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

// 95.5 → "95,5"
export const kg = (n, decimales = 1) => (n == null || Number.isNaN(n) ? "—" : n.toFixed(decimales).replace(".", ","));

export function etapaPorDefecto(datos, hoy) {
  return etapaDe(hoy, datos.etapas) || datos.etapas.at(-1) || null;
}

// <option>s para elegir etapa. `elegida` = id de etapa o "todo".
export function opcionesEtapa(datos, elegida, conTodo) {
  const opciones = [...datos.etapas].reverse()
    .map((e) => `<option value="${esc(e.id)}" ${e.id === elegida ? "selected" : ""}>${esc(e.nombre)}</option>`);
  if (conTodo) opciones.push(`<option value="todo" ${elegida === "todo" ? "selected" : ""}>Todo el historial</option>`);
  return opciones.join("");
}

export function sinEtapas() {
  return `<div class="tarjeta"><h2>Todavía no hay etapas</h2>
    <p class="sutil">Creá tu etapa (por ejemplo "Dieta 2026") en ⚙️ Ajustes, o cargá tu respaldo.</p></div>`;
}
