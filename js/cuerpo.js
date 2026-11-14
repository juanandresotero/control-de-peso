// Cuerpo: IMC, % de grasa (fórmula de la Marina de EE.UU., hombres, en cm) y medidas por zona. Funciones puras.

// [clave, nombre, letra en la guía de medición (img/guia-medidas.jpg)]. El cuello no está en la guía.
export const ZONAS = [
  ["cuello", "Cuello", ""], ["hombros", "Hombros", "A"], ["pecho", "Pecho", "B"],
  ["bicepRelajado", "Bíceps relajado", "C1"], ["bicepContraido", "Bíceps contraído", "C2"], ["antebrazo", "Antebrazo", "D"],
  ["muneca", "Muñeca", "E"], ["abdomen", "Abdomen", "F"], ["cintura", "Cintura", "G"], ["cadera", "Cadera", "H"],
  ["muslo", "Muslo", "I"], ["rodilla", "Rodilla", "J"], ["gemelos", "Gemelos", "K"], ["tobillo", "Tobillo", "L"],
];

const redondear1 = (n) => Math.round(n * 10) / 10;

export function leerCm(texto) {
  const limpio = String(texto ?? "").trim().replace(",", ".");
  if (!limpio) return { ok: true, valor: null };
  if (!/^\d{1,3}(\.\d+)?$/.test(limpio)) return { ok: false, error: "Escribí las medidas con números, por ejemplo 43,5." };
  const valor = redondear1(Number(limpio));
  if (valor < 5 || valor > 250) return { ok: false, error: "Las medidas van en centímetros (entre 5 y 250)." };
  return { ok: true, valor };
}

export function grasaNavy(alturaCm, cinturaCm, cuelloCm) {
  if (!alturaCm || !cinturaCm || !cuelloCm || cinturaCm <= cuelloCm) return null;
  const densidad = 1.0324 - 0.19077 * Math.log10(cinturaCm - cuelloCm) + 0.15456 * Math.log10(alturaCm);
  return redondear1(495 / densidad - 450);
}

export function imc(pesoKg, alturaCm) {
  if (!pesoKg || !alturaCm) return null;
  const metros = alturaCm / 100;
  return redondear1(pesoKg / (metros * metros));
}

export function claseImc(valor) {
  if (valor < 18.5) return "Bajo peso";
  if (valor < 25) return "Normal";
  if (valor < 30) return "Sobrepeso";
  if (valor < 35) return "Obesidad grado I";
  if (valor < 40) return "Obesidad grado II";
  return "Obesidad grado III";
}

// Rangos para hombres (American Council on Exercise).
export function claseGrasa(valor) {
  if (valor < 6) return "Esencial";
  if (valor < 14) return "Atlético";
  if (valor < 18) return "En forma";
  if (valor < 25) return "Aceptable";
  return "Obesidad";
}

// Los grados de obesidad los define el IMC; el % de grasa dice si ese peso de más es grasa o músculo.
export function diagnostico(valorImc, grasa) {
  const clase = claseImc(valorImc);
  if (grasa == null) return `${clase} (por IMC). Cargá cintura y cuello para un diagnóstico más preciso.`;
  const grasaAlta = grasa >= 25;
  if (valorImc >= 30) return grasaAlta ? `${clase}, confirmada por el % de grasa` : "IMC de obesidad, pero tu grasa es aceptable: el peso de más es músculo";
  if (valorImc >= 25) return grasaAlta ? "Sobrepeso con grasa alta: en la práctica, obesidad por grasa" : "Sobrepeso por IMC, con grasa aceptable";
  if (valorImc >= 18.5) return grasaAlta ? "Peso normal pero con grasa alta (obesidad oculta)" : "Normal";
  return "Bajo peso";
}

export function grasaDe(registro, alturaCm) {
  return grasaNavy(alturaCm, registro.cintura, registro.cuello) ?? registro.grasa ?? null;
}

export function ultimaGrasa(medidas, alturaCm) {
  for (const fecha of Object.keys(medidas).sort().reverse()) {
    const valor = grasaDe(medidas[fecha], alturaCm);
    if (valor != null) return { valor, fecha };
  }
  return null;
}

export function resumenMedidas(medidas) {
  const fechas = Object.keys(medidas).sort();
  const resultado = [];
  for (const [zona, etiqueta] of ZONAS) {
    const tomas = fechas.filter((f) => medidas[f][zona] != null).map((f) => ({ fecha: f, valor: medidas[f][zona] }));
    if (!tomas.length) continue;
    const primera = tomas[0], ultima = tomas.at(-1);
    const diferencia = tomas.length > 1 ? redondear1(ultima.valor - primera.valor) : null;
    resultado.push({ zona, etiqueta, primera, ultima, diferencia });
  }
  return resultado;
}

