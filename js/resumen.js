// Pantalla Resumen: los números que importan de la dieta actual, con poco texto.
import { resumenEtapa, rangoEtapa, etiquetaBase, BASE_RITMO_INICIAL, RITMO_MINIMO } from "./calculos.js";
import { guardarPerfil } from "./datos.js";
import { balanceComidas } from "./habitos.js";
import { patronesDeslices } from "./deslices.js";
import { formatoCorto } from "./fechas.js";
import { esc, kg, etapaPorDefecto, sinEtapas } from "./ui.js";
import { imc, claseImc, claseGrasa, diagnostico, ultimaGrasa, resumenMedidas } from "./cuerpo.js";

let raiz;

export function iniciar(ctx, elemento) {
  raiz = elemento;
  raiz.addEventListener("click", (e) => {
    if (e.target.closest("[data-ir-ajustes]")) {
      e.preventDefault();
      return ctx.irA("ajustes");
    }
    if (e.target.closest("[data-elegir-base]")) return abrirBase(ctx);
    if (e.target.closest("#r-cancelar")) return raiz.querySelector("#r-base").close();
    if (e.target.closest("#r-confirmar")) return confirmarBase(ctx);
  });
  // Escribir en la caja de semanas elige esa opción.
  raiz.addEventListener("focusin", (e) => { if (e.target.id === "r-n") raiz.querySelector("#r-otra").checked = true; });
}

// --- Pop-up: sobre qué período se calcula el ritmo (vale para todas las metas) ---
const baseDe = (datos) => datos.perfil?.baseRitmo || BASE_RITMO_INICIAL;

function dialogoBase() {
  return `<dialog id="r-base" class="dialogo-base" aria-label="Calcular el ritmo con">
    <h2>Calcular el ritmo con…</h2>
    <label><input type="radio" name="r-base" value="1"> Últimos 7 días</label>
    <label><input type="radio" name="r-base" value="4"> Últimos 30 días</label>
    <label><input type="radio" name="r-base" value="inicio"> Desde que arrancó la dieta</label>
    <label><input type="radio" name="r-base" value="otra" id="r-otra"> Últimas
      <input type="number" id="r-n" min="1" max="104" step="1" inputmode="numeric"> semanas</label>
    <p class="sutil">Primer peso del período − último peso, por semana.</p>
    <div class="mensaje error" id="r-msg"></div>
    <div class="fila" style="justify-content:flex-end">
      <button class="boton" type="button" id="r-cancelar">Cancelar</button>
      <button class="boton principal" type="button" id="r-confirmar">Confirmar</button>
    </div>
  </dialog>`;
}

function abrirBase(ctx) {
  const base = baseDe(ctx.datos());
  const valor = base.modo === "inicio" ? "inicio" : [1, 4].includes(base.semanas) ? String(base.semanas) : "otra";
  raiz.querySelector(`[name=r-base][value="${valor}"]`).checked = true;
  raiz.querySelector("#r-n").value = base.modo === "semanas" && valor === "otra" ? base.semanas : 8;
  raiz.querySelector("#r-msg").textContent = "";
  raiz.querySelector("#r-base").showModal();
}

function confirmarBase(ctx) {
  const elegido = raiz.querySelector("[name=r-base]:checked")?.value;
  let base;
  if (elegido === "inicio") base = { modo: "inicio" };
  else if (elegido === "otra") {
    const n = Number(raiz.querySelector("#r-n").value);
    if (!Number.isInteger(n) || n < 1 || n > 104) {
      raiz.querySelector("#r-msg").textContent = "Poné una cantidad de semanas entre 1 y 104.";
      return;
    }
    base = { modo: "semanas", semanas: n };
  } else base = { modo: "semanas", semanas: Number(elegido) };
  raiz.querySelector("#r-base").close();
  ctx.cambiar(guardarPerfil(ctx.datos(), { baseRitmo: base }));
  ctx.avisar(`✓ Ritmo: ${etiquetaBase(base)}`);
}

const stat = (etiqueta, valor, extra = "", clase = "") =>
  `<div class="stat ${clase}"><span>${etiqueta}</span><b>${valor}</b>${extra ? `<small>${extra}</small>` : ""}</div>`;
// Igual que stat, pero se toca para elegir sobre qué período se calcula el ritmo.
const statBoton = (etiqueta, valor, extra = "") =>
  `<button type="button" class="stat clic" data-elegir-base><span>${etiqueta}</span><b>${valor}</b>${extra ? `<small>${extra}</small>` : ""}</button>`;

export function pintar(ctx) {
  const datos = ctx.datos();
  const hoy = ctx.hoy();
  const etapa = etapaPorDefecto(datos, hoy);
  if (!etapa) { raiz.innerHTML = sinEtapas(); return; }
  const base = baseDe(datos);
  const etiqueta = etiquetaBase(base);
  const r = resumenEtapa(datos, etapa, hoy, base);
  const bajo = r.kilosPerdidos >= 0;

  raiz.innerHTML = `
    ${alertaRitmo(r, etiqueta)}
    <div class="tarjeta">
      <div class="stats">
        ${stat("Peso actual", `${kg(r.pesoActual)} kg`, formatoCorto(r.fechaActual), "destacado")}
        ${stat(bajo ? "Bajaste" : "Subiste", `${kg(Math.abs(r.kilosPerdidos))} kg`, `${kg(Math.abs(r.porcentaje) * 100)}% · semana ${r.semanaNumero}`)}
        ${statBoton(`Ritmo · ${etiqueta} ✎`, ritmo(r.ritmo), comparacion(r.detalleRitmo))}
      </div>
    </div>
    ${r.metas.length ? r.metas.map((m) => tarjetaMeta(m, etiqueta, r.ritmo)).join("")
      : `<div class="tarjeta sutil">Sin metas. <a href="#" data-ir-ajustes>Agregalas en Ajustes</a>.</div>`}
    <div class="tarjeta">
      <div class="stats">
        ${stat("Semanas perfectas", `<span style="color:var(--verde)">${r.semanasOk} ✓</span> · <span style="color:var(--rojo)">${r.semanasMal} ✗</span>`)}
        ${stat("Racha", `${r.racha} ${r.racha === 1 ? "semana" : "semanas"}`, estaSemana(r))}
      </div>
    </div>
    ${tarjetaComidas(datos, etapa, hoy)}
    ${tarjetaPatrones(datos, etapa, hoy)}
    ${tarjetaCuerpo(datos, r.pesoActual)}
    ${tarjetaMedidas(datos)}
    ${dialogoBase()}`;
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

// Qué pasa en los días malos: a qué hora, con qué comida y cuánto. Solo cuenta días con detalle cargado.
function tarjetaPatrones(datos, etapa, hoy) {
  const { desde, hasta } = rangoEtapa(etapa, datos.etapas, hoy);
  const p = patronesDeslices(datos, desde, hasta < hoy ? hasta : hoy);
  if (!p.dias) return "";
  const lista = (items) => items.length ? items.slice(0, 5).map((i) => `${esc(i.nombre)} <b>${i.n}</b>`).join(" · ") : "—";
  return `<div class="tarjeta">
    <h2>Días malos: qué pasó <span class="sutil" style="font-weight:400">(${p.dias} ${p.dias === 1 ? "día" : "días"} con detalle)</span></h2>
    <p class="patron"><span>Cuándo</span>${lista(p.momentos)}</p>
    <p class="patron"><span>Qué</span>${lista(p.comidas)}</p>
    <p class="patron"><span>Cuánto</span>${lista(p.cuanto)}</p>
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

// Las dos pesadas que compara el ritmo, para poder verificarlo: "95,9 → 95,1" y "08/11 → 14/11".
function comparacion(d) {
  if (!d) return "por semana";
  return `por semana<br>${kg(d.desde.peso)} → ${kg(d.hasta.peso)}<br>${formatoCorto(d.desde.fecha)} → ${formatoCorto(d.hasta.fecha)}`;
}

// "−0,45 kg" si bajó, "+0,02 kg" si subió
const ritmo = (n) => (n == null ? "—" : `${n > 0 ? "−" : n < 0 ? "+" : ""}${kg(Math.abs(n), 2)} kg`);

function alertaRitmo(r, etiqueta) {
  if (r.ritmo == null || r.ritmo >= RITMO_MINIMO) return "";
  return `<div class="alerta ancho-completo">⚠️ ${r.ritmo < 0 ? "Subiendo" : "Estancado"} (${etiqueta})</div>`;
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

function tarjetaMeta(m, etiqueta, ritmoActual) {
  const { meta } = m;
  const pct = Math.round(m.avance * 100);
  const llegada = m.alcanzada ? "¡Listo!"
    : m.semanasParaLlegar == null ? "—"
    : `${kg(m.semanasParaLlegar, m.semanasParaLlegar < 10 ? 1 : 0)} sem`;
  const llegadaExtra = m.alcanzada || m.semanasParaLlegar == null
    ? (m.alcanzada ? "" : `${!m.estancado ? "sin datos" : ritmoActual < 0 ? "subiendo" : "estancado"} (${etiqueta})`)
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
