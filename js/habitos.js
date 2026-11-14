// Hábitos de comida: cuántos días comiste bien y mal, y cuál es tu día de la semana más difícil.
// Plato malo = 1 día malo; tentación = medio día malo; "no fue falta de voluntad" = día bien.
import { aFecha } from "./fechas.js";

const NOMBRES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]; // getUTCDay()
const PESO_MALO = { plato: 1, tentacion: 0.5 };

export function balanceComidas(datos, desde, hasta) {
  let total = 0, mal = 0;
  const porDia = NOMBRES.map((nombre) => ({ nombre, mal: 0, total: 0 }));
  for (const [fecha, dia] of Object.entries(datos.dias)) {
    if (fecha < desde || fecha > hasta || !dia.comida) continue;
    const malo = PESO_MALO[dia.comida] || 0;
    const semana = porDia[aFecha(fecha).getUTCDay()];
    total++; mal += malo;
    semana.total++; semana.mal += malo;
  }
  let peorDia = null;
  for (const d of porDia) {
    if (!d.mal) continue;
    if (!peorDia || d.mal / d.total > peorDia.mal / peorDia.total) peorDia = d;
  }
  return { total, bien: total - mal, mal, peorDia };
}
