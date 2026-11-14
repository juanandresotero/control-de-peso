// Respaldo: bajar todo a un archivo (JSON para volver a cargar, Excel para guardar en un pendrive) y cargar un respaldo.
import { validarRespaldo } from "./datos.js";
import { crearXlsx } from "./excel.js";
import { hojasExcel } from "./hojas-excel.js";

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

export function descargarExcel(datos, hoy) {
  descargar(`control-peso-${hoy}.xlsx`, crearXlsx(hojasExcel(datos, hoy)),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

// Devuelve los datos del archivo, o lanza un Error con un mensaje para el usuario.
export async function leerRespaldo(archivo) {
  let obj;
  try { obj = JSON.parse(await archivo.text()); } catch { throw new Error("Ese archivo no es un respaldo de Control de Peso."); }
  if (!validarRespaldo(obj)) throw new Error("Ese archivo no es un respaldo de Control de Peso.");
  return obj;
}
