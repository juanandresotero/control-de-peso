// Pantalla Cargar: peso del día + cómo comí + ejercicio. Sirve también para corregir días anteriores.
import { leerPeso, guardarDia, borrarDia } from "./datos.js";
import { etapaDe, numeroSemana } from "./calculos.js";
import { sumarDias, formatoLargo } from "./fechas.js";
import { kg } from "./ui.js";

const OPCIONES_COMIDA = [
  { valor: "bien", icono: "✅", texto: "Comí bien" },
  { valor: "tentacion", icono: "🍬", texto: "Me tenté con algo chico" },
  { valor: "plato", icono: "🍔", texto: "Plato malo / día malo" },
  { valor: "justificado", icono: "🤷", texto: "No fue falta de voluntad" },
];

let raiz, fecha = null, comida = "bien", ejercicio = false, confirmandoBorrar = false;

export function iniciar(ctx, elemento) {
  raiz = elemento;
  raiz.innerHTML = `
    <div class="tarjeta zona-fecha">
      <div class="fecha-nav">
        <button class="boton" data-mover="-1" aria-label="Día anterior">◀</button>
        <input type="date" id="c-fecha">
        <button class="boton" data-mover="1" aria-label="Día siguiente">▶</button>
      </div>
      <div class="contexto sutil" id="c-contexto"></div>
    </div>
    <div class="tarjeta zona-peso">
      <div class="peso-entrada">
        <input id="c-peso" type="text" inputmode="decimal" autocomplete="off" placeholder="00,0" aria-label="Peso">
        <span>kg</span>
      </div>
      <p class="sutil" style="text-align:center;margin:6px 0 0" id="c-anterior"></p>
    </div>
    <div class="tarjeta zona-comida">
      <h2>¿Cómo comiste?</h2>
      <div class="opciones">
        ${OPCIONES_COMIDA.map((o) => `<button class="opcion" data-comida="${o.valor}"><span class="icono">${o.icono}</span>${o.texto}</button>`).join("")}
        <button class="opcion ejercicio" id="c-ejercicio"><span class="icono">🏃</span>Hice ejercicio</button>
      </div>
    </div>
    <div class="zona-acciones">
      <button class="boton principal ancho" id="c-guardar">Guardar</button>
      <div class="mensaje" id="c-mensaje"></div>
      <button class="boton peligro" id="c-borrar" hidden>Borrar este día</button>
    </div>`;

  raiz.querySelector("#c-fecha").addEventListener("change", (e) => {
    if (e.target.value) { fecha = e.target.value; prellenar(ctx); }
  });
  raiz.querySelectorAll("[data-mover]").forEach((b) => b.addEventListener("click", () => {
    fecha = sumarDias(fecha, Number(b.dataset.mover));
    prellenar(ctx);
  }));
  raiz.querySelectorAll("[data-comida]").forEach((b) => b.addEventListener("click", () => {
    comida = b.dataset.comida;
    pintarOpciones();
  }));
  raiz.querySelector("#c-ejercicio").addEventListener("click", () => { ejercicio = !ejercicio; pintarOpciones(); });
  raiz.querySelector("#c-peso").addEventListener("keydown", (e) => { if (e.key === "Enter") guardar(ctx); });
  raiz.querySelector("#c-guardar").addEventListener("click", () => guardar(ctx));
  raiz.querySelector("#c-borrar").addEventListener("click", () => borrar(ctx));
}

export function pintar(ctx, opciones = {}) {
  if (opciones.fecha) fecha = opciones.fecha;
  if (!fecha) fecha = ctx.hoy();
  prellenar(ctx, !opciones.fecha);
}

function prellenar(ctx, conservarMensaje = false) {
  const datos = ctx.datos();
  const dia = datos.dias[fecha];
  raiz.querySelector("#c-fecha").value = fecha;
  raiz.querySelector("#c-peso").value = dia && dia.peso != null ? kg(dia.peso) : "";
  comida = (dia && dia.comida) || "bien";
  ejercicio = !!(dia && dia.ejercicio);
  confirmandoBorrar = false;
  const borrarBtn = raiz.querySelector("#c-borrar");
  borrarBtn.hidden = !dia;
  borrarBtn.textContent = "Borrar este día";
  if (!conservarMensaje) mensaje("");

  const etapa = etapaDe(fecha, datos.etapas);
  const esHoy = fecha === ctx.hoy() ? "Hoy · " : "";
  raiz.querySelector("#c-contexto").textContent =
    esHoy + formatoLargo(fecha) + (etapa ? ` · Semana ${numeroSemana(fecha, etapa)} de ${etapa.nombre}` : "");

  const anterior = ultimoPesoAntes(datos, fecha);
  raiz.querySelector("#c-anterior").textContent = anterior
    ? `Último peso: ${kg(anterior.peso)} kg (${formatoLargo(anterior.fecha)})` + (dia && dia.estimado ? " · este día era de relleno" : "")
    : "";
  pintarOpciones();
}

function ultimoPesoAntes(datos, hasta) {
  const fechas = Object.keys(datos.dias).filter((f) => f < hasta && datos.dias[f].peso != null && !datos.dias[f].estimado).sort();
  const ultima = fechas.at(-1);
  return ultima ? { fecha: ultima, peso: datos.dias[ultima].peso } : null;
}

function pintarOpciones() {
  raiz.querySelectorAll("[data-comida]").forEach((b) => b.classList.toggle("elegida", b.dataset.comida === comida));
  raiz.querySelector("#c-ejercicio").classList.toggle("elegida", ejercicio);
}

function mensaje(texto, tipo = "") {
  const caja = raiz.querySelector("#c-mensaje");
  caja.textContent = texto;
  caja.className = "mensaje " + tipo;
}

function guardar(ctx) {
  const peso = leerPeso(raiz.querySelector("#c-peso").value);
  if (!peso.ok) return mensaje(peso.error, "error");
  ctx.cambiar(guardarDia(ctx.datos(), fecha, { peso: peso.valor, comida, ejercicio }));
  const anterior = ultimoPesoAntes(ctx.datos(), fecha);
  let extra = "";
  if (peso.valor != null && anterior) {
    const dif = Math.round((peso.valor - anterior.peso) * 10) / 10;
    extra = dif === 0 ? " · igual que la vez anterior" : ` · ${dif < 0 ? "▼" : "▲"} ${kg(Math.abs(dif))} kg vs la vez anterior`;
  }
  mensaje("✓ Guardado" + extra, "ok");
}

function borrar(ctx) {
  const boton = raiz.querySelector("#c-borrar");
  if (!confirmandoBorrar) {
    confirmandoBorrar = true;
    boton.textContent = "¿Seguro? Tocá otra vez para borrar";
    return;
  }
  ctx.cambiar(borrarDia(ctx.datos(), fecha));
  mensaje(`Borrado el ${formatoLargo(fecha)}`, "ok");
}
