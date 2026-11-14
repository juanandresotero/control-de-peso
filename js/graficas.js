// Pantalla Gráficas (Chart.js, cargado en index.html como window.Chart):
//   1 y 2) La dieta actual, desde su inicio hasta hoy: semana a semana y día a día (se actualizan solas).
//   3)     Por fechas: el rango que elijas; por defecto, desde el primer registro hasta hoy.
// Solo se dibujan pesos reales; donde faltan días o eran relleno, la línea se une punteada.
import { listaSemanas, rangoEtapa, serieDiaria, numeroSemana } from "./calculos.js";
import { formatoCorto, formatoLargo, lunesDe, diasEntre } from "./fechas.js";
import { leerPeso } from "./datos.js";
import { esc, kg, etapaPorDefecto, sinEtapas } from "./ui.js";

const COLOR_LINEA = "#2e7d32";
const COLORES_META = ["#f57c00", "#6a1b9a", "#0277bd", "#c62828"];
const CLAVE_EJE = "control_peso_eje"; // máximo y mínimo del eje de peso, guardado en este aparato

let raiz;
let graficasDieta = [], graficaRango = null;
let rangoElegido = { desde: null, hasta: null }; // null = por defecto (primer registro / hoy)
let eje = leerEje();

function leerEje() {
  try { return { min: null, max: null, ...JSON.parse(localStorage.getItem(CLAVE_EJE)) }; } catch { return { min: null, max: null }; }
}

function cambiarEje(ctx) {
  const max = leerPeso(raiz.querySelector("#g-max").value);
  const min = leerPeso(raiz.querySelector("#g-min").value);
  const msg = raiz.querySelector("#g-eje-msg");
  if (!max.ok || !min.ok) { msg.textContent = (max.ok ? min : max).error; return; }
  if (max.valor != null && min.valor != null && min.valor >= max.valor) { msg.textContent = "El mínimo tiene que ser menor que el máximo."; return; }
  eje = { min: min.valor, max: max.valor };
  try { localStorage.setItem(CLAVE_EJE, JSON.stringify(eje)); } catch { /* sin guardado: igual se aplica */ }
  pintar(ctx);
}

export function iniciar(ctx, elemento) {
  raiz = elemento;
  raiz.addEventListener("change", (e) => {
    if (e.target.id === "g-max" || e.target.id === "g-min") return cambiarEje(ctx);
    if (e.target.id === "g-desde") rangoElegido.desde = e.target.value || null;
    else if (e.target.id === "g-hasta") rangoElegido.hasta = e.target.value || null;
    else return;
    pintarRango(ctx);
  });
  raiz.addEventListener("click", (e) => {
    if (e.target.closest("[data-accion=eje-auto]")) {
      raiz.querySelector("#g-max").value = "";
      raiz.querySelector("#g-min").value = "";
      return cambiarEje(ctx);
    }
    if (!e.target.closest("[data-accion=rango-todo]")) return;
    rangoElegido = { desde: null, hasta: null };
    pintarRango(ctx);
  });
}

// Solo la línea: el punto aparece recién al pasar el mouse o el dedo (para ver el valor).
const sinPuntos = { pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 8 };
const punteadoEnHuecos = { borderDash: (c) => (c.p0.skip || c.p1.skip ? [6, 6] : undefined) };

function opcionesBase() {
  return {
    responsive: true, maintainAspectRatio: false, animation: false, spanGaps: true,
    interaction: { mode: "nearest", intersect: false },
    plugins: {
      legend: { labels: { boxWidth: 14, filter: (item) => !item.text.startsWith("_") } },
      tooltip: { callbacks: { label: (c) => (c.parsed.y == null ? "" : `${c.dataset.label.replace(/^_/, "")}: ${kg(c.parsed.y)} kg`) } },
    },
    scales: {
      y: { min: eje.min ?? undefined, max: eje.max ?? undefined, ticks: { callback: (v) => kg(v) } },
      x: { ticks: { maxRotation: 0, autoSkipPadding: 12 } },
    },
  };
}

// Líneas horizontales de las metas + estrella amarilla en el día objetivo.
function capasDeMetas(metas, cantidad, indiceDeFecha) {
  const capas = [];
  metas.forEach((meta, i) => {
    const color = COLORES_META[i % COLORES_META.length];
    capas.push({
      label: `Meta ${meta.nombre}`, data: Array(cantidad).fill(meta.peso), borderColor: color, backgroundColor: color,
      borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, fill: false,
    });
    const indice = meta.fecha ? indiceDeFecha(meta.fecha) : -1;
    if (indice >= 0) {
      const datos = Array(cantidad).fill(null);
      datos[indice] = meta.peso;
      capas.push({
        label: `_Día objetivo ${meta.nombre}`, data: datos, showLine: false, pointStyle: "star",
        pointRadius: 12, pointBorderWidth: 2, borderColor: "#f9a825", backgroundColor: "#fdd835",
      });
    }
  });
  return capas;
}

function graficaSemanal(canvas, datos, etapa, desde, hasta, hoy) {
  const semanas = listaSemanas(datos, desde, hasta, etapa.pesoInicial, hoy);
  const indiceSemana = (fecha) => semanas.findIndex((s) => s.lunes === lunesDe(fecha));
  return new window.Chart(canvas, {
    type: "line",
    data: {
      labels: semanas.map((s) => `Sem ${numeroSemana(s.lunes, etapa)}`),
      datasets: [
        {
          label: "Promedio de la semana", data: semanas.map((s) => s.promedio),
          borderColor: COLOR_LINEA, backgroundColor: COLOR_LINEA, borderWidth: 2.5, ...sinPuntos, tension: 0.2, segment: punteadoEnHuecos,
        },
        ...capasDeMetas(etapa.metas || [], semanas.length, indiceSemana),
      ],
    },
    options: opcionesBase(),
  });
}

function graficaDiaria(canvas, datos, desde, hasta, metas) {
  const serie = serieDiaria(datos, desde, hasta);
  const conAnio = diasEntre(desde, hasta) > 300;
  return new window.Chart(canvas, {
    type: "line",
    data: {
      labels: serie.fechas.map((f) => (conAnio ? `${formatoCorto(f)}/${f.slice(2, 4)}` : formatoCorto(f))),
      datasets: [
        {
          label: "Peso del día", data: serie.valores, borderColor: COLOR_LINEA, backgroundColor: COLOR_LINEA, borderWidth: 2,
          ...sinPuntos, tension: 0.15,
          segment: punteadoEnHuecos,
        },
        ...capasDeMetas(metas, serie.fechas.length, (fecha) => serie.fechas.indexOf(fecha)),
      ],
    },
    options: opcionesBase(),
  });
}

const ayudaColores = `<p class="sutil" style="margin:8px 0 0">La línea punteada une días sin pesarte.</p>`;

export function pintar(ctx) {
  const datos = ctx.datos();
  const hoy = ctx.hoy();
  graficasDieta.forEach((g) => g.destroy());
  graficasDieta = [];
  if (!Object.keys(datos.dias).length) { raiz.innerHTML = sinEtapas(); return; }
  const etapa = etapaPorDefecto(datos, hoy);

  raiz.innerHTML = `
    <div class="tarjeta">
      <div class="eje">
        <span class="sutil">Escala del peso (las 3 gráficas)</span>
        <div><label class="sutil" for="g-max">Máximo</label><input type="text" inputmode="decimal" id="g-max" placeholder="auto" value="${eje.max != null ? kg(eje.max) : ""}"></div>
        <div><label class="sutil" for="g-min">Mínimo</label><input type="text" inputmode="decimal" id="g-min" placeholder="auto" value="${eje.min != null ? kg(eje.min) : ""}"></div>
        <button class="boton" data-accion="eje-auto">Automático</button>
      </div>
      <div class="mensaje error" id="g-eje-msg"></div>
    </div>
    ${etapa ? `
    <div class="tarjeta">
      <h2>${esc(etapa.nombre)} · semana a semana (promedio)</h2>
      <p class="sutil" style="margin-top:0">Desde el ${formatoLargo(etapa.inicio)} hasta hoy</p>
      <div class="grafica"><canvas id="g-semanal"></canvas></div>
    </div>
    <div class="tarjeta">
      <h2>${esc(etapa.nombre)} · día a día</h2>
      <div class="grafica"><canvas id="g-diaria"></canvas></div>
      ${ayudaColores}
    </div>` : sinEtapas()}
    <div class="tarjeta">
      <h2>Por fechas</h2>
      <div class="rango">
        <div><label class="sutil" for="g-desde">Desde</label><input type="date" id="g-desde"></div>
        <div><label class="sutil" for="g-hasta">Hasta</label><input type="date" id="g-hasta"></div>
        <button class="boton" data-accion="rango-todo">Todo</button>
      </div>
      <div class="mensaje error" id="g-rango-msg"></div>
      <div class="grafica"><canvas id="g-rango"></canvas></div>
      ${ayudaColores}
    </div>`;

  if (typeof window.Chart !== "function") {
    raiz.insertAdjacentHTML("afterbegin", `<div class="alerta">No se pudo cargar el motor de gráficas.</div>`);
    return;
  }
  if (etapa) {
    const { desde, hasta } = rangoEtapa(etapa, datos.etapas, hoy);
    const fin = hasta < hoy ? hasta : hoy;
    graficasDieta.push(graficaSemanal(raiz.querySelector("#g-semanal"), datos, etapa, desde, fin, hoy));
    graficasDieta.push(graficaDiaria(raiz.querySelector("#g-diaria"), datos, desde, fin, etapa.metas || []));
  }
  pintarRango(ctx);
}

function pintarRango(ctx) {
  const datos = ctx.datos();
  const hoy = ctx.hoy();
  if (graficaRango) { graficaRango.destroy(); graficaRango = null; }
  const canvas = raiz.querySelector("#g-rango");
  if (!canvas || typeof window.Chart !== "function") return;

  const primera = Object.keys(datos.dias).sort()[0] || hoy;
  const desde = rangoElegido.desde || primera;
  const hasta = rangoElegido.hasta || hoy;
  raiz.querySelector("#g-desde").value = desde;
  raiz.querySelector("#g-hasta").value = hasta;
  const mensaje = raiz.querySelector("#g-rango-msg");
  if (desde > hasta) { mensaje.textContent = "La fecha \"desde\" es posterior a \"hasta\"."; return; }
  mensaje.textContent = "";
  const metas = etapaPorDefecto(datos, hoy)?.metas || [];
  graficaRango = graficaDiaria(canvas, datos, desde, hasta, metas);
}
