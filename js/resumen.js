// Pantalla Resumen: los números que importan de la dieta actual, con poco texto.
import { resumenEtapa, rangoEtapa } from "./calculos.js";
import { balanceComidas } from "./habitos.js";
import { formatoCorto } from "./fechas.js";
import { esc, kg, etapaPorDefecto, sinEtapas } from "./ui.js";
import { imc, claseImc, claseGrasa, diagnostico, ultimaGrasa, resumenMedidas } from "./cuerpo.js";

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
    </div>
    ${tarjetaComidas(datos, etapa, hoy)}
    ${tarjetaCuerpo(datos, r.pesoActual)}
    ${tarjetaMedidas(datos)}`;
}

// Días que comiste bien y mal en esta dieta (tentación = medio día malo) y tu día más difícil.
function tarjetaComidas(datos, etapa, hoy) {
  const { desde, hasta } = rangoEtapa(etapa, datos.etapas, hoy);
  const b = balanceComidas(datos, desde, hasta < hoy ? hasta : hoy);
  if (!b.total) return "";
  const pct = (n) => `${Math.round((n / b.total) * 100)}%`;
  const dias = (n) => `${kg(n, Number.isInteger(n) ? 0 : 1)}`;
  const peor = b.peorDia
    ? stat("Día más difícil", b.peorDia.nombre[0].toUpperCase() + b.peorDia.nombre.slice(1),
      `${Math.round((b.peorDia.mal / b.peorDia.total) * 100)}% de esos días con desliz`)
    : stat("Día más difícil", "—", "sin deslices");
  return `<div class="tarjeta">
    <div class="stats">
      ${stat("Días que comiste bien", `<span style="color:var(--verde)">${dias(b.bien)}</span>`, pct(b.bien))}
      ${stat("Días que comiste mal", `<span style="color:var(--rojo)">${dias(b.mal)}</span>`, `${pct(b.mal)} · tentación = ½ día`)}
      ${peor}
    </div>
  </div>`;
}

// --- Debajo de lo principal: cuerpo y medidas ---

function tarjetaCuerpo(datos, pesoActual) {
  const altura = datos.perfil?.altura;
  if (!altura) return `<div class="tarjeta sutil">Para ver IMC y % de grasa, <a href="#" data-ir-ajustes>poné tu altura en Ajustes</a>.</div>`;
  const valorImc = imc(pesoActual, altura);
  const grasa = ultimaGrasa(datos.medidas || {}, altura);
  return `<div class="tarjeta">
    <h2>Cuerpo</h2>
    <div class="stats">
      ${stat("IMC", kg(valorImc), claseImc(valorImc))}
      ${stat("% de grasa", grasa ? `${kg(grasa.valor)}%` : "—",
        grasa ? `${claseGrasa(grasa.valor)} · medido ${formatoCorto(grasa.fecha)}/${grasa.fecha.slice(2, 4)}` : "cargá cintura y cuello")}
    </div>
    <p class="diagnostico">${esc(diagnostico(valorImc, grasa ? grasa.valor : null))}</p>
  </div>`;
}


function tarjetaMedidas(datos) {
  const zonas = resumenMedidas(datos.medidas || {});
  if (!zonas.length) return "";
  const dif = (d) => (d == null ? "" : `<span class="${d < 0 ? "baja" : d > 0 ? "sube" : ""}">${d > 0 ? "+" : ""}${kg(d)}</span>`);
  const fecha = (f) => `${formatoCorto(f)}/${f.slice(2, 4)}`;
  return `<div class="tarjeta ancho-completo">
    <h2>Medidas <span class="sutil" style="font-weight:400">(cm)</span></h2>
    <table class="tabla-medidas">
      <thead><tr><th>Zona</th><th>Primera</th><th>Última</th><th>Cambio</th></tr></thead>
      <tbody>${zonas.map((z) => `<tr>
        <td>${esc(z.etiqueta)}</td>
        <td>${kg(z.primera.valor)} <small>${fecha(z.primera.fecha)}</small></td>
        <td>${z.diferencia == null ? "" : `${kg(z.ultima.valor)} <small>${fecha(z.ultima.fecha)}</small>`}</td>
        <td>${dif(z.diferencia)}</td></tr>`).join("")}</tbody>
    </table>
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
