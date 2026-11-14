// Pantalla Resumen: los números que importan de la dieta actual, con poco texto.
import { resumenEtapa } from "./calculos.js";
import { formatoCorto } from "./fechas.js";
import { esc, kg, etapaPorDefecto, sinEtapas } from "./ui.js";

let raiz;

export function iniciar(ctx, elemento) {
  raiz = elemento;
  raiz.addEventListener("click", (e) => {
    if (!e.target.closest("[data-ir-ajustes]")) return;
    e.preventDefault();
    ctx.irA("ajustes");
  });
}

const stat = (etiqueta, valor, extra = "", clase = "") =>
  `<div class="stat ${clase}"><span>${etiqueta}</span><b>${valor}</b>${extra ? `<small>${extra}</small>` : ""}</div>`;

export function pintar(ctx) {
  const datos = ctx.datos();
  const hoy = ctx.hoy();
  const etapa = etapaPorDefecto(datos, hoy);
  if (!etapa) { raiz.innerHTML = sinEtapas(); return; }
  const r = resumenEtapa(datos, etapa, hoy);
  const bajo = r.kilosPerdidos >= 0;

  raiz.innerHTML = `
    ${alertaRitmo(r)}
    <div class="tarjeta">
      <div class="stats">
        ${stat("Peso actual", `${kg(r.pesoActual)} kg`, formatoCorto(r.fechaActual), "destacado")}
        ${stat(bajo ? "Bajaste" : "Subiste", `${kg(Math.abs(r.kilosPerdidos))} kg`, `${kg(Math.abs(r.porcentaje) * 100)}% · semana ${r.semanaNumero}`)}
        ${stat("Ritmo último mes", ritmo(r.ritmo4), "por semana")}
      </div>
    </div>
    ${r.metas.length ? r.metas.map(tarjetaMeta).join("")
      : `<div class="tarjeta sutil">Sin metas. <a href="#" data-ir-ajustes>Agregalas en Ajustes</a>.</div>`}
    <div class="tarjeta">
      <div class="stats">
        ${stat("Semanas perfectas", `<span style="color:var(--verde)">${r.semanasOk} ✓</span> · <span style="color:var(--rojo)">${r.semanasMal} ✗</span>`)}
        ${stat("Racha", `${r.racha} ${r.racha === 1 ? "semana" : "semanas"}`, estaSemana(r))}
      </div>
    </div>`;
}

// "−0,45 kg" si bajó, "+0,02 kg" si subió
const ritmo = (n) => (n == null ? "—" : `${n > 0 ? "−" : n < 0 ? "+" : ""}${kg(Math.abs(n), 2)} kg`);

function alertaRitmo(r) {
  if (r.ritmo4 == null || r.ritmo4 > 0.1) return "";
  return `<div class="alerta ancho-completo">⚠️ ${r.ritmo4 < 0 ? "El último mes subiste" : "Estás estancado"}</div>`;
}

function estaSemana(r) {
  const s = r.semanaEnCurso;
  if (!s || !s.marca) return "";
  return s.marca === "✗" ? "esta semana ✗" : "esta semana ✓ por ahora";
}

const ESTADOS = {
  logrado: ["ok", "🎉 Logrado"],
  bien: ["ok", "✅ Vas bien"],
  atrasado: ["mal", "⏳ Atrasado"],
  vencido: ["mal", "⛔ Fecha vencida"],
};

function tarjetaMeta(m) {
  const { meta } = m;
  const pct = Math.round(m.avance * 100);
  const llegada = m.alcanzada ? "¡Listo!"
    : m.semanasParaLlegar == null ? "—"
    : `${kg(m.semanasParaLlegar, m.semanasParaLlegar < 10 ? 1 : 0)} sem`;
  const llegadaExtra = m.alcanzada || m.semanasParaLlegar == null
    ? (m.alcanzada ? "" : "el último mes no bajaste")
    : `${kg(m.mesesParaLlegar)} meses · ${formatoCorto(m.fechaEstimada)}/${m.fechaEstimada.slice(2, 4)}`;

  let objetivo;
  if (!meta.fecha) {
    objetivo = `<p class="sutil" style="margin:10px 0 0"><a href="#" data-ir-ajustes>Poné un día objetivo</a> para saber si vas bien.</p>`;
  } else {
    const [clase, texto] = ESTADOS[m.estado];
    const necesita = m.kgPorSemana != null ? `Necesitás <b>−${kg(m.kgPorSemana, 2)} kg</b> por semana` : "";
    objetivo = `<div class="objetivo-fila">
      <span class="chip ${clase}">${texto}</span>
      <span class="sutil">Objetivo ${formatoCorto(meta.fecha)}/${meta.fecha.slice(2, 4)}</span>
      ${necesita ? `<span>${necesita}</span>` : ""}
    </div>`;
  }

  return `<div class="tarjeta">
    <h2>🎯 ${esc(meta.nombre)} · ${kg(meta.peso)} kg</h2>
    <div class="fila"><div class="barra crece"><div style="width:${pct}%"></div></div><b>${pct}%</b></div>
    <div class="stats">
      ${stat("Faltan", m.alcanzada ? "0 kg" : `${kg(m.faltan)} kg`)}
      ${stat("Llegás en", llegada, llegadaExtra)}
    </div>
    ${objetivo}
  </div>`;
}
