// Pantalla Semanas: como el Excel, una fila por semana (lunes a domingo) con colores, peso y ✓/✗.
import { listaSemanas, rangoEtapa, etapaDe, numeroSemana, diasObjetivo } from "./calculos.js";
import { formatoCorto, formatoLargo, sumarDias } from "./fechas.js";
import { COMIDAS } from "./datos.js";
import { textoDesliz } from "./deslices.js";
import { esc, kg, etapaPorDefecto, opcionesEtapa, sinEtapas } from "./ui.js";

const LETRAS = ["L", "M", "X", "J", "V", "S", "D"];
const MALOS = ["tentacion", "plato", "justificado"];
const MS_APRETADO = 500;
let raiz, elegida = null, timer = null, recienAbierto = false;

export function iniciar(ctx, elemento) {
  raiz = elemento;
  raiz.addEventListener("change", (e) => {
    if (e.target.id === "s-etapa") { elegida = e.target.value; pintar(ctx); }
  });
  raiz.addEventListener("click", (e) => {
    if (e.target.closest("#s-cerrar")) return raiz.querySelector("#s-detalle").close();
    if (e.target.closest("#s-editar")) {
      raiz.querySelector("#s-detalle").close();
      return ctx.irA("cargar", { fecha: raiz.querySelector("#s-detalle").dataset.fecha });
    }
    if (e.target.id === "s-detalle") return e.target.close(); // tocar afuera cierra
    if (recienAbierto) { recienAbierto = false; return; } // el click que sigue a mantener apretado no abre Cargar
    const dia = e.target.closest("[data-fecha]");
    if (dia) ctx.irA("cargar", { fecha: dia.dataset.fecha });
  });

  // Mantener apretado un día malo abre el pop-up con lo que comiste.
  const soltar = () => clearTimeout(timer);
  raiz.addEventListener("pointerdown", (e) => {
    const dia = e.target.closest("[data-malo]");
    if (!dia) return;
    recienAbierto = false;
    timer = setTimeout(() => { recienAbierto = true; abrirDetalle(ctx, dia.dataset.fecha); }, MS_APRETADO);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((t) => raiz.addEventListener(t, soltar, true));
  raiz.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-malo]")) e.preventDefault(); });
}

function abrirDetalle(ctx, fecha) {
  const dia = ctx.datos().dias[fecha];
  if (!dia) return;
  const dialogo = raiz.querySelector("#s-detalle");
  const comidas = dia.desliz?.comidas || [];
  const { cuanto, nota } = textoDesliz(dia.desliz);
  dialogo.dataset.fecha = fecha;
  dialogo.querySelector("#s-titulo").textContent = `${formatoLargo(fecha)} · ${COMIDAS[dia.comida]}`;
  dialogo.querySelector("#s-cuerpo").innerHTML = comidas.length || cuanto || nota
    ? `${nota ? `<p class="nota-texto">${esc(nota)}</p>` : ""}${comidas.map((c) => `<p>${c.hora ? `<b>${esc(c.hora)}</b> ` : "• "}${esc(c.que)}</p>`).join("")}${cuanto ? `<p class="sutil">${esc(cuanto)}</p>` : ""}`
    : `<p class="sutil">Sin detalle.</p>`;
  if (!dialogo.open) dialogo.showModal();
}

function rango(ctx, datos) {
  const hoy = ctx.hoy();
  if (elegida === "todo") {
    const primera = Object.keys(datos.dias).sort()[0] || hoy;
    return { desde: primera, hasta: hoy, pesoBase: null, etapa: null };
  }
  const etapa = datos.etapas.find((e) => e.id === elegida);
  const { desde, hasta } = rangoEtapa(etapa, datos.etapas, hoy);
  return { desde, hasta: hasta < hoy ? hasta : hoy, pesoBase: etapa.pesoInicial, etapa };
}

export function pintar(ctx) {
  const datos = ctx.datos();
  if (!datos.etapas.length && !Object.keys(datos.dias).length) { raiz.innerHTML = sinEtapas(); return; }
  if (elegida !== "todo" && !datos.etapas.some((e) => e.id === elegida)) {
    elegida = etapaPorDefecto(datos, ctx.hoy())?.id || "todo";
  }
  const { desde, hasta, pesoBase, etapa } = rango(ctx, datos);
  const semanas = listaSemanas(datos, desde, hasta, pesoBase, ctx.hoy()).reverse();
  const objetivos = diasObjetivo(datos.etapas);

  raiz.innerHTML = `
    <div class="tarjeta ancho-completo">
      <select id="s-etapa">${opcionesEtapa(datos, elegida, true)}</select>
      <div class="leyenda" style="margin-top:10px">
        <span>Bien</span>
        <span style="color:var(--rojo);font-weight:700">Tentación</span>
        <span style="background:var(--rojo-fondo);color:#fff">Plato malo</span>
        <span style="background:var(--naranja)">No fue falta de voluntad</span>
        <span style="background:var(--azul)">Ejercicio</span>
        <span style="background:var(--celeste)">Día activo</span>
        <span style="box-shadow:inset 0 0 0 3px var(--amarillo)">Día objetivo</span>
        <span style="color:#9e9e9e;font-style:italic">Relleno</span>
      </div>
      <p class="sutil" style="margin:8px 0 0">Tocá un día para cargarlo. Mantené apretado un día malo para ver qué comiste.</p>
    </div>
    ${semanas.map((s) => tarjetaSemana(s, etapa || etapaDe(sumarDias(s.lunes, 6), datos.etapas), objetivos, ctx.hoy())).join("")}
    <dialog id="s-detalle" class="dialogo-base" aria-label="Qué comiste">
      <h2 id="s-titulo"></h2>
      <div id="s-cuerpo"></div>
      <div class="fila" style="justify-content:flex-end">
        <button class="boton" type="button" id="s-cerrar">Cerrar</button>
        <button class="boton principal" type="button" id="s-editar">Editar</button>
      </div>
    </dialog>`;
}

function tarjetaSemana(semana, etapa, objetivos, hoy) {
  const numero = etapa && sumarDias(semana.lunes, 6) >= etapa.inicio ? `Sem ${numeroSemana(semana.lunes, etapa)}` : "";
  let dif = "";
  if (semana.diferencia != null) {
    dif = semana.diferencia > 0 ? `<span class="dif baja">▼ ${kg(semana.diferencia)}</span>`
      : semana.diferencia < 0 ? `<span class="dif sube">▲ ${kg(-semana.diferencia)}</span>`
      : `<span class="dif">= 0</span>`;
  }
  const marca = semana.enCurso
    ? `<span class="marca curso" title="Semana en curso">${semana.marca === "✗" ? "✗" : "…"}</span>`
    : semana.marca === "✓" ? `<span class="marca ok">✓</span>`
    : semana.marca === "✗" ? `<span class="marca mal">✗</span>` : `<span class="marca"></span>`;
  const peso = semana.peso == null ? "" : `<span class="peso-sem" ${semana.estimada ? 'style="color:#9e9e9e;font-style:italic"' : ""}>${kg(semana.peso)}</span>`;

  return `<div class="tarjeta semana ${semana.enCurso ? "en-curso" : ""}">
    <div class="sem-cab">
      <span class="num">${esc(numero)}</span>
      <span class="sutil">${formatoCorto(semana.lunes)} – ${formatoCorto(sumarDias(semana.lunes, 6))}</span>
      ${peso}${dif}${marca}
    </div>
    <div class="sem-dias">${semana.dias.map((c, i) => celdaDia(c, LETRAS[i], objetivos, hoy)).join("")}</div>
  </div>`;
}

function celdaDia({ fecha, dia }, letra, objetivos, hoy) {
  const clases = ["dia"];
  if (dia) {
    if (dia.comida === "plato") clases.push("plato");
    else if (dia.comida === "justificado") clases.push("justificado");
    else if (dia.ejercicio) clases.push("ejercicio");
    else if (dia.movimiento) clases.push("movimiento");
    if (dia.comida === "tentacion") clases.push("tentacion");
    if (dia.estimado) clases.push("estimado");
  }
  if (objetivos.has(fecha)) clases.push("objetivo");
  if (fecha === hoy) clases.push("hoy");
  // En días rojos/naranjas el color de fondo ya está usado: el ejercicio o movimiento va como iconito.
  const tapado = dia && (dia.comida === "plato" || dia.comida === "justificado");
  const corre = tapado && dia.ejercicio ? `<span class="corre">🏃</span>`
    : tapado && dia.movimiento ? `<span class="corre">🚶</span>` : "";
  const malo = dia && MALOS.includes(dia.comida);
  const nota = malo && dia.desliz ? `<span class="nota">💬</span>` : "";
  const valor = dia && dia.peso != null ? kg(dia.peso) : "";
  const titulo = objetivos.has(fecha) ? ` title="Día objetivo: ${esc(objetivos.get(fecha).map((m) => m.nombre).join(", "))}"` : "";
  return `<button class="${clases.join(" ")}" data-fecha="${fecha}"${malo ? " data-malo" : ""}${titulo}>${nota}${corre}<span class="letra">${letra} ${fecha.slice(8)}</span><span class="valor">${valor}</span></button>`;
}
