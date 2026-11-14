// Pantalla Gráficas: peso semana a semana y día a día (Chart.js, cargado en index.html como window.Chart).
// Solo se dibujan pesos reales; donde faltan días o eran relleno, la línea se une punteada.
import { listaSemanas, rangoEtapa, serieDiaria, numeroSemana, etapaDe } from "./calculos.js";
import { formatoCorto, lunesDe, sumarDias } from "./fechas.js";
import { kg, etapaPorDefecto, opcionesEtapa, sinEtapas } from "./ui.js";

const COLOR_LINEA = "#2e7d32";
const COLORES_META = ["#f57c00", "#6a1b9a", "#0277bd", "#c62828"];
const COLOR_DIA = { plato: "#e53935", tentacion: "#ff8a80", justificado: "#ffb74d" };
let raiz, elegida = null, graficas = [];

export function iniciar(ctx, elemento) {
  raiz = elemento;
  raiz.addEventListener("change", (e) => {
    if (e.target.id === "g-etapa") { elegida = e.target.value; pintar(ctx); }
  });
}

const punteadoEnHuecos = { borderDash: (c) => (c.p0.skip || c.p1.skip ? [6, 6] : undefined) };

function opcionesBase() {
  return {
    responsive: true, maintainAspectRatio: false, animation: false, spanGaps: true,
    interaction: { mode: "nearest", intersect: false },
    plugins: {
      legend: { labels: { boxWidth: 14, filter: (item) => !item.text.startsWith("_") } },
      tooltip: { callbacks: { label: (c) => (c.parsed.y == null ? "" : `${c.dataset.label.replace(/^_/, "")}: ${kg(c.parsed.y)} kg`) } },
    },
    scales: { y: { ticks: { callback: (v) => kg(v) } }, x: { ticks: { maxRotation: 0, autoSkipPadding: 12 } } },
  };
}

// Líneas horizontales de las metas + estrella amarilla en el día objetivo.
function capasDeMetas(metas, cantidad, indiceDeFecha) {
  const capas = [];
  metas.forEach((meta, i) => {
    const color = COLORES_META[i % COLORES_META.length];
    capas.push({
      label: `Meta ${meta.nombre}`, data: Array(cantidad).fill(meta.peso), borderColor: color,
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

export function pintar(ctx) {
  const datos = ctx.datos();
  const hoy = ctx.hoy();
  graficas.forEach((g) => g.destroy());
  graficas = [];
  if (!Object.keys(datos.dias).length) { raiz.innerHTML = sinEtapas(); return; }
  if (elegida !== "todo" && !datos.etapas.some((e) => e.id === elegida)) {
    elegida = etapaPorDefecto(datos, hoy)?.id || "todo";
  }

  let desde, hasta, pesoBase = null, etapa = null;
  if (elegida === "todo") {
    desde = Object.keys(datos.dias).sort()[0];
    hasta = hoy;
  } else {
    etapa = datos.etapas.find((e) => e.id === elegida);
    ({ desde, hasta } = rangoEtapa(etapa, datos.etapas, hoy));
    if (hasta > hoy) hasta = hoy;
    pesoBase = etapa.pesoInicial;
  }
  const metas = (etapa || datos.etapas.at(-1))?.metas || [];

  raiz.innerHTML = `
    <div class="tarjeta"><select id="g-etapa">${opcionesEtapa(datos, elegida, true)}</select></div>
    <div class="tarjeta"><h2>Semana a semana</h2><div class="grafica"><canvas id="g-semanal"></canvas></div></div>
    <div class="tarjeta"><h2>Día a día</h2><div class="grafica"><canvas id="g-diaria"></canvas></div>
      <p class="sutil" style="margin:8px 0 0">Puntos rojos: plato malo · rosados: tentación · naranjas: no fue falta de voluntad. La línea punteada une días sin pesarte.</p></div>`;

  if (typeof window.Chart !== "function") {
    raiz.insertAdjacentHTML("beforeend", `<div class="alerta">No se pudo cargar el motor de gráficas.</div>`);
    return;
  }

  // Semana a semana
  const semanas = listaSemanas(datos, desde, hasta, pesoBase, hoy);
  const etiquetasSem = semanas.map((s) => {
    const e = etapa || etapaDe(sumarDias(s.lunes, 6), datos.etapas);
    return etapa ? `Sem ${numeroSemana(s.lunes, e)}` : formatoCorto(s.lunes) + "/" + s.lunes.slice(2, 4);
  });
  const indiceSemana = (fecha) => semanas.findIndex((s) => s.lunes === lunesDe(fecha));
  graficas.push(new window.Chart(raiz.querySelector("#g-semanal"), {
    type: "line",
    data: {
      labels: etiquetasSem,
      datasets: [
        {
          label: "Peso de la semana", data: semanas.map((s) => (s.estimada ? null : s.peso)),
          borderColor: COLOR_LINEA, backgroundColor: COLOR_LINEA, pointRadius: 3, tension: 0.2, segment: punteadoEnHuecos,
        },
        ...capasDeMetas(metas, semanas.length, indiceSemana),
      ],
    },
    options: opcionesBase(),
  }));

  // Día a día
  const serie = serieDiaria(datos, desde, hasta);
  const indiceDia = (fecha) => serie.fechas.indexOf(fecha);
  const colorPunto = serie.fechas.map((f) => COLOR_DIA[datos.dias[f]?.comida] || COLOR_LINEA);
  graficas.push(new window.Chart(raiz.querySelector("#g-diaria"), {
    type: "line",
    data: {
      labels: serie.fechas.map((f) => (elegida === "todo" ? `${formatoCorto(f)}/${f.slice(2, 4)}` : formatoCorto(f))),
      datasets: [
        {
          label: "Peso del día", data: serie.valores, borderColor: COLOR_LINEA, borderWidth: 1.5,
          pointRadius: serie.fechas.length > 200 ? 1.5 : 2.5, pointBackgroundColor: colorPunto, pointBorderColor: colorPunto,
          segment: punteadoEnHuecos,
        },
        ...capasDeMetas(metas, serie.fechas.length, indiceDia),
      ],
    },
    options: opcionesBase(),
  }));
}
