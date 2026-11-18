// Detalle de los días que comiste mal: a qué hora, qué comiste y cuánto (un plato o todo el día).
// Sirve para sacar patrones: en qué momento del día y con qué comida te pasa más.
// Se guarda en el día como `desliz: { cuanto, comidas: [{ hora: "21:30", que: "pizza" }], nota? }`.
// `que` = la comida, corta (para poder contarla); `nota` = la situación ("Cumpleaños de Martín").

export const CUANTO = {
  solo: "Solo eso, el resto bien",
  varias: "Varias comidas",
  todo: "Todo el día",
};

// Deja solo lo que tiene contenido; null si no queda nada.
export function limpiarDesliz(desliz) {
  if (!desliz) return null;
  const comidas = (desliz.comidas || [])
    .map((c) => ({ hora: String(c.hora || "").trim(), que: String(c.que || "").trim() }))
    .filter((c) => c.hora || c.que)
    .sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99")); // por hora; sin hora al final
  const cuanto = CUANTO[desliz.cuanto] ? desliz.cuanto : null;
  const nota = String(desliz.nota || "").trim();
  if (!comidas.length && !cuanto && !nota) return null;
  return nota ? { cuanto, comidas, nota } : { cuanto, comidas };
}

// "21:30" → "Noche". Mañana 5–12, Mediodía 12–16, Tarde 16–20, Noche 20–5.
export function momentoDe(hora) {
  const h = Number(String(hora || "").slice(0, 2));
  if (!hora || Number.isNaN(h)) return null;
  if (h >= 5 && h < 12) return "Mañana";
  if (h >= 12 && h < 16) return "Mediodía";
  if (h >= 16 && h < 20) return "Tarde";
  return "Noche";
}

const clave = (texto) => texto.trim().toLowerCase();

// Cuenta repeticiones; muestra la primera forma en que se escribió. Más repetido primero.
function contar(valores) {
  const mapa = new Map();
  for (const v of valores) {
    const k = clave(v);
    if (!k) continue;
    const item = mapa.get(k) || { nombre: v.trim(), n: 0 };
    item.n++;
    mapa.set(k, item);
  }
  return [...mapa.values()].sort((a, b) => b.n - a.n);
}

const deslicesDe = (datos, desde = "", hasta = "9999") =>
  Object.keys(datos.dias).sort()
    .filter((f) => f >= desde && f <= hasta && datos.dias[f].comida !== "bien" && datos.dias[f].desliz)
    .map((f) => datos.dias[f].desliz);

export function comidasUsadas(datos) {
  return contar(deslicesDe(datos).flatMap((d) => d.comidas.map((c) => c.que))).map((c) => c.nombre);
}

export function patronesDeslices(datos, desde, hasta) {
  const deslices = deslicesDe(datos, desde, hasta);
  const comidas = deslices.flatMap((d) => d.comidas);
  return {
    dias: deslices.length,
    momentos: contar(comidas.map((c) => momentoDe(c.hora) || "")),
    comidas: contar(comidas.map((c) => c.que)),
    cuanto: contar(deslices.map((d) => CUANTO[d.cuanto] || "")),
  };
}

export function textoDesliz(desliz) {
  if (!desliz) return { comidas: "", cuanto: "", nota: "" };
  return {
    comidas: desliz.comidas.map((c) => [c.hora, c.que].filter(Boolean).join(" ")).join("; "),
    cuanto: CUANTO[desliz.cuanto] || "",
    nota: desliz.nota || "",
  };
}
