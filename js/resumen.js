// Pantalla Resumen: el panel de objetivos del Excel, pero bien calculado.
import { resumenEtapa } from "./calculos.js";
import { formatoLargo, diasEntre } from "./fechas.js";
import { esc, kg, etapaPorDefecto, opcionesEtapa, sinEtapas } from "./ui.js";

let raiz, elegida = null;

export function iniciar(ctx, elemento) {
  raiz = elemento;
  raiz.addEventListener("change", (e) => {
    if (e.target.id === "r-etapa") { elegida = e.target.value; pintar(ctx); }
  });
}

export function pintar(ctx) {
  const datos = ctx.datos();
  const hoy = ctx.hoy();
  if (!datos.etapas.length) { raiz.innerHTML = sinEtapas(); return; }
  if (!datos.etapas.some((e) => e.id === elegida)) elegida = etapaPorDefecto(datos, hoy).id;
  const etapa = datos.etapas.find((e) => e.id === elegida);
  const r = resumenEtapa(datos, etapa, hoy);

  raiz.innerHTML = `
    <div class="tarjeta"><select id="r-etapa">${opcionesEtapa(datos, elegida, false)}</select></div>

    <div class="tarjeta">
      <div class="sutil">Peso actual · ${formatoLargo(r.fechaActual)}</div>
      <div class="grande">${kg(r.pesoActual)} kg</div>
      <div>${r.kilosPerdidos >= 0 ? "Bajaste" : "Subiste"} <b>${kg(Math.abs(r.kilosPerdidos))} kg</b>
        (${kg(Math.abs(r.porcentaje) * 100)}%) desde ${kg(r.pesoInicial)} kg</div>
      <div class="sutil" style="margin-top:4px">Semana ${r.semanaNumero} de ${esc(etapa.nombre)} · empezó el ${formatoLargo(etapa.inicio)}</div>
    </div>

    ${alertaRitmo(r)}

    <div class="tarjeta">
      <div class="datos-grid">
        <div class="dato"><span class="sutil">Promedio por semana</span><b>${kgSemana(r.promedioSemanal)}</b></div>
        <div class="dato"><span class="sutil">Últimas 4 semanas</span><b>${kgSemana(r.ritmo4)}</b></div>
        <div class="dato"><span class="sutil">Mejor peso</span><b>${kg(r.mejorPeso)} kg</b></div>
        <div class="dato"><span class="sutil">Peso inicial</span><b>${kg(r.pesoInicial)} kg</b></div>
      </div>
    </div>

    <div class="tarjeta">
      <h2>Semanas perfectas</h2>
      <div class="datos-grid">
        <div class="dato"><span class="sutil">Perfectas</span><b style="color:var(--verde)">${r.semanasOk} ✓</b></div>
        <div class="dato"><span class="sutil">Con algún desliz</span><b style="color:var(--rojo)">${r.semanasMal} ✗</b></div>
        <div class="dato"><span class="sutil">Racha actual</span><b>${r.racha} ${r.racha === 1 ? "semana" : "semanas"}</b></div>
        <div class="dato"><span class="sutil">Esta semana</span><b>${estaSemana(r)}</b></div>
      </div>
    </div>

    ${r.metas.length ? r.metas.map((m) => tarjetaMeta(m, hoy)).join("") : `<div class="tarjeta sutil">Sin metas. Agregalas en ⚙️ Ajustes.</div>`}`;
}

const kgSemana = (n) => (n == null ? "—" : `${n > 0 ? "−" : n < 0 ? "+" : ""}${kg(Math.abs(n), 2)} kg`);

function alertaRitmo(r) {
  if (r.ritmo4 == null) return "";
  if (r.ritmo4 < 0) return `<div class="alerta">⚠️ En las últimas 4 semanas <b>subiste</b> ${kg(-r.ritmo4, 2)} kg por semana.</div>`;
  if (r.ritmo4 <= 0.1) return `<div class="alerta">⚠️ Estás <b>estancado</b>: en las últimas 4 semanas bajaste ${kg(r.ritmo4, 2)} kg por semana.</div>`;
  return "";
}

function estaSemana(r) {
  const s = r.semanaEnCurso;
  if (!s || !s.marca) return "—";
  return s.marca === "✗" ? "✗" : "✓ por ahora";
}

function tarjetaMeta(m, hoy) {
  const { meta } = m;
  let ritmo;
  if (m.alcanzada) ritmo = `🎉 ¡Meta alcanzada!`;
  else if (m.fechaEstimada) {
    const semanas = Math.round(diasEntre(hoy, m.fechaEstimada) / 7);
    ritmo = `A tu ritmo llegás aprox. el <b>${formatoLargo(m.fechaEstimada)}</b> (en ${semanas} ${semanas === 1 ? "semana" : "semanas"})`;
  } else ritmo = `A este ritmo no llegás: hace falta volver a bajar.`;

  let objetivo = "";
  if (meta.fecha) {
    if (m.alcanzada) objetivo = `Día objetivo: ${formatoLargo(meta.fecha)}`;
    else if (m.vencida) objetivo = `Día objetivo: ${formatoLargo(meta.fecha)} · <b style="color:var(--rojo)">vencido</b>. Poné una fecha nueva en Ajustes.`;
    else {
      const comparacion = m.fechaEstimada && m.fechaEstimada <= meta.fecha ? "✅ vas a tiempo" : "⏳ vas atrasado";
      objetivo = `Día objetivo: <b>${formatoLargo(meta.fecha)}</b> (faltan ${kg(m.semanasRestantes)} semanas) · necesitás bajar ${kg(m.kgPorSemana, 2)} kg por semana · ${comparacion}`;
    }
  }
  return `<div class="tarjeta">
    <h2>🎯 ${esc(meta.nombre)}: ${kg(meta.peso)} kg</h2>
    <div class="barra"><div style="width:${Math.round(m.avance * 100)}%"></div></div>
    <div class="fila"><span class="crece">${Math.round(m.avance * 100)}% del camino</span>
      <b>${m.alcanzada ? "" : `Faltan ${kg(m.faltan)} kg`}</b></div>
    <p style="margin:8px 0 0">${ritmo}</p>
    ${objetivo ? `<p class="sutil" style="margin:6px 0 0">${objetivo}</p>` : ""}
  </div>`;
}
