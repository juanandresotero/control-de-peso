"""Pasa el Excel viejo de control de peso al formato de la app (una sola vez).

Uso:  python tools/importar_excel.py ["Control de peso unificacion 2025-2026.xlsx"]
Genera importado/respaldo-inicial.json (NO se sube a GitHub) y muestra un informe.
Después, en la app: Ajustes → Cargar respaldo → elegir ese archivo.
"""
import json
import sys
import time
import warnings
from datetime import date, timedelta
from pathlib import Path

import openpyxl

RAIZ = Path(__file__).resolve().parent.parent
EXCEL = RAIZ / "Control de peso unificacion 2025-2026.xlsx"
SALIDA = RAIZ / "importado" / "respaldo-inicial.json"

PRIMERA_FILA, ULTIMA_FILA = 3, 96
LUNES_PRIMERA_FILA = date(2025, 3, 17)
COLUMNAS_DIAS = range(10, 17)  # J..P = lunes..domingo
COLUMNA_MARCA = 17  # Q
ROJO, CELESTE, AMARILLO = "FFFF0000", "FF00B0F0", "FFFFFF00"

# Tramos que el usuario rellenó a mano para que la gráfica no quede con huecos.
ESTIMADOS = [(date(2025, 9, 8), date(2025, 11, 16)), (date(2025, 12, 15), date(2026, 3, 1))]


def lunes_de_fila(fila):
    return LUNES_PRIMERA_FILA + timedelta(weeks=fila - PRIMERA_FILA)


def es_estimado(dia):
    return any(desde <= dia <= hasta for desde, hasta in ESTIMADOS)


def leer_numero(valor):
    if isinstance(valor, (int, float)):
        return round(float(valor), 1)
    if isinstance(valor, str) and valor.strip():
        return round(float(valor.strip().replace(",", ".")), 1)
    return None


def color_fondo(celda):
    """Devuelve ('rgb', 'FFFF0000') o ('tema', 4) o None."""
    relleno = celda.fill
    if not relleno or not relleno.fill_type:
        return None
    color = relleno.fgColor
    if color.type == "rgb":
        return ("rgb", color.rgb)
    if color.type == "theme":
        return ("tema", color.theme)
    return None


def fuente_roja(celda):
    color = celda.font.color if celda.font else None
    return color is not None and color.type == "rgb" and color.rgb == ROJO


def marcas_del_dia(celda, estimado, informe, fecha):
    fondo = color_fondo(celda)
    comida = None if estimado else "bien"
    ejercicio = False
    if fondo == ("rgb", ROJO):
        comida = "plato"
    elif fondo and fondo[0] == "tema" and fondo[1] == 7:
        comida = "justificado"
    elif fondo in (("rgb", CELESTE), ("tema", 4)):
        ejercicio = True
    elif fondo == ("rgb", AMARILLO):
        informe["amarillos"].append(fecha)
    elif fondo and fondo not in (("tema", 0), ("tema", 9)):
        informe["colores_raros"].append(f"{fecha} {fondo}")
    if fuente_roja(celda) and comida not in ("plato", "justificado"):
        comida = "tentacion"
    return comida, ejercicio


def importar(ruta_excel, hoy=None, ahora_ms=None):
    hoy = hoy or date.today()
    ahora_ms = ahora_ms or int(time.time() * 1000)
    lunes_hoy = hoy - timedelta(days=hoy.weekday())
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        hoja = openpyxl.load_workbook(ruta_excel).active

    dias, marcas = {}, {}
    informe = {"amarillos": [], "colores_raros": [], "estimados": 0, "reales": 0}
    for fila in range(PRIMERA_FILA, ULTIMA_FILA + 1):
        lunes = lunes_de_fila(fila)
        for i, columna in enumerate(COLUMNAS_DIAS):
            celda = hoja.cell(fila, columna)
            peso = leer_numero(celda.value)
            if peso is None:
                continue
            fecha = lunes + timedelta(days=i)
            estimado = es_estimado(fecha)
            comida, ejercicio = marcas_del_dia(celda, estimado, informe, fecha.isoformat())
            dias[fecha.isoformat()] = {
                "peso": peso, "comida": comida, "ejercicio": ejercicio, "estimado": estimado, "mod": ahora_ms,
            }
            informe["estimados" if estimado else "reales"] += 1
        marca = hoja.cell(fila, COLUMNA_MARCA).value
        if marca in ("✓", "✗") and lunes < lunes_hoy:  # la semana en curso la calcula la app
            marcas[lunes.isoformat()] = marca

    etapas = [
        {"id": "e2025", "nombre": "Dieta 2025", "inicio": "2025-03-22", "fin": None, "pesoInicial": 104.8,
         "metas": [], "mod": ahora_ms},
        {"id": "e2026", "nombre": "Dieta 2026", "inicio": "2026-03-02", "fin": None, "pesoInicial": 108.5,
         "metas": [
             {"id": "m-obesidad", "nombre": "Salir de obesidad", "peso": 83.6, "fecha": None},
             {"id": "m-ideal", "nombre": "Peso ideal", "peso": 75, "fecha": None},
         ], "mod": ahora_ms},
    ]
    datos = {"version": 1, "dias": dias, "etapas": etapas, "marcasSemana": marcas, "tombs": {}}
    return datos, informe


def contar_semanas(marcas, desde, hasta):
    elegidas = [m for lunes, m in marcas.items() if desde <= lunes <= hasta]
    return elegidas.count("✓"), elegidas.count("✗")


def main():
    ruta = Path(sys.argv[1]) if len(sys.argv) > 1 else EXCEL
    datos, informe = importar(ruta)
    SALIDA.parent.mkdir(exist_ok=True)
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    ok, mal = contar_semanas(datos["marcasSemana"], "2026-03-02", "9999")
    print(f"Listo: {SALIDA}")
    print(f"Días reales: {informe['reales']}  ·  días de relleno (estimados): {informe['estimados']}")
    print("Tramos marcados como relleno: " + ", ".join(f"{d} a {h}" for d, h in ESTIMADOS))
    print(f"Dieta 2026, semanas cerradas: {ok} ✓ y {mal} ✗")
    print(f"Celdas amarillas (días objetivo viejos, no se importan): {', '.join(informe['amarillos']) or '—'}")
    print(f"Colores que no reconocí: {', '.join(informe['colores_raros']) or '—'}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
