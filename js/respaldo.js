// Respaldo: bajar todo a un archivo (JSON para volver a cargar, CSV para abrir en Excel) y cargar un respaldo.
import { aCsv, validarRespaldo } from "./datos.js";

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const enlace = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function descargarJson(datos, hoy) {
  descargar(`control-peso-respaldo-${hoy}.json`, JSON.stringify(datos), "application/json");
}

export function descargarCsv(datos, hoy) {
  // El "﻿" al principio hace que Excel reconozca los acentos.
  descargar(`control-peso-${hoy}.csv`, "﻿" + aCsv(datos), "text/csv;charset=utf-8");
}

// Devuelve los datos del archivo, o lanza un Error con un mensaje para el usuario.
export async function leerRespaldo(archivo) {
  let obj;
  try { obj = JSON.parse(await archivo.text()); } catch { throw new Error("Ese archivo no es un respaldo de Control de Peso."); }
  if (!validarRespaldo(obj)) throw new Error("Ese archivo no es un respaldo de Control de Peso.");
  return obj;
}
