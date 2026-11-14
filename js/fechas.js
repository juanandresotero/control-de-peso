// Fechas como texto "YYYY-MM-DD" (sin horas ni husos horarios: un día es un día).

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MS_DIA = 86400000;

const dos = (n) => String(n).padStart(2, "0");

export function aFecha(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function aIso(fecha) {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(iso, n) {
  const f = aFecha(iso);
  f.setUTCDate(f.getUTCDate() + n);
  return aIso(f);
}

export function diasEntre(desde, hasta) {
  return Math.round((aFecha(hasta) - aFecha(desde)) / MS_DIA);
}

export function lunesDe(iso) {
  const diaSemana = (aFecha(iso).getUTCDay() + 6) % 7; // lunes = 0 … domingo = 6
  return sumarDias(iso, -diaSemana);
}

export function hoyIso(ahora = new Date()) {
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

export function formatoCorto(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function formatoLargo(iso) {
  const [y, m, d] = iso.split("-");
  return `${DIAS_CORTOS[aFecha(iso).getUTCDay()]} ${d}/${m}/${y}`;
}
