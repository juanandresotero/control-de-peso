// Arranque de la app: datos, sincronización y navegación entre pantallas.
import { cargar, guardarTodo } from "./datos.js";
import { crearSync } from "./sync.js";
import { hoyIso } from "./fechas.js";
import * as pantallaCargar from "./cargar.js";
import * as pantallaSemanas from "./semanas.js";
import * as pantallaResumen from "./resumen.js";
import * as pantallaGraficas from "./graficas.js";
import * as pantallaAjustes from "./ajustes.js";

const PANTALLAS = {
  cargar: pantallaCargar, semanas: pantallaSemanas, resumen: pantallaResumen,
  graficas: pantallaGraficas, ajustes: pantallaAjustes,
};

let datos = cargar();
let actual = "cargar";
let timerAviso = null;

const sync = crearSync({
  leer: () => datos,
  aplicar: (nuevos) => { datos = nuevos; guardarTodo(datos); pintarActual(); },
  alCambiar: () => { pintarSync(); if (actual === "ajustes") pantallaAjustes.pintarSync?.(ctx); },
});

const ctx = {
  datos: () => datos,
  hoy: () => hoyIso(),
  sync,
  // Una edición del usuario: guardar en el aparato, pintar y subir.
  cambiar(nuevos) {
    datos = nuevos;
    guardarTodo(datos);
    sync.avisarCambio();
    pintarActual();
  },
  irA(nombre, opciones = {}) {
    actual = nombre;
    for (const [n] of Object.entries(PANTALLAS)) {
      document.getElementById("pantalla-" + n).hidden = n !== nombre;
    }
    document.querySelectorAll(".pestanas button").forEach((b) => b.classList.toggle("activa", b.dataset.ir === nombre));
    PANTALLAS[nombre].pintar(ctx, opciones);
    window.scrollTo(0, 0);
  },
  avisar(texto) {
    const caja = document.getElementById("aviso");
    caja.textContent = texto;
    caja.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { caja.hidden = true; }, 2500);
  },
};

function pintarActual() {
  PANTALLAS[actual].pintar(ctx, {});
}

function pintarSync() {
  const st = sync.estado();
  const boton = document.getElementById("estado-sync");
  boton.className = "estado-sync " + (!st.vinculado ? "" : st.error ? "error" : st.pendiente ? "pendiente" : "ok");
  boton.title = !st.vinculado ? "Sin vincular" : st.error || (st.pendiente ? "Pendiente de subir" : "Sincronizado");
}

for (const [nombre, modulo] of Object.entries(PANTALLAS)) {
  modulo.iniciar(ctx, document.getElementById("pantalla-" + nombre));
}
document.querySelectorAll(".pestanas button").forEach((b) => b.addEventListener("click", () => ctx.irA(b.dataset.ir)));
document.getElementById("estado-sync").addEventListener("click", () => ctx.irA("ajustes"));

// Link para vincular (#vincular=CODIGO): deja el código escrito en Ajustes; NO vincula solo.
const vincularLink = /[#&]vincular=([A-Za-z0-9-]+)/.exec(location.hash);
if (vincularLink) {
  history.replaceState(null, "", location.pathname + location.search);
  ctx.irA("ajustes", { codigo: vincularLink[1] });
} else {
  ctx.irA("cargar");
}
pintarSync();
sync.arrancarAuto();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
