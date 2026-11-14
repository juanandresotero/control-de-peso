# Control de Peso — Diseño

Fecha: 2026-11-13
Estado: aprobado por el usuario ("metele con todo")

## Objetivo

Reemplazar el Excel "Control de peso unificacion 2025-2026.xlsx" por una app web que se use igual
desde el celu y la PC, con los datos sincronizados, que registre el peso diario y las marcas del día,
y que muestre semanas, resumen de objetivos y gráficas **bien calculados** (el panel del Excel tenía
fórmulas rotas: peso actual, kilos perdidos, semanas restantes y promedio).

## Arquitectura

- **App**: página web estática (HTML + CSS + JavaScript con módulos ES, sin frameworks ni build).
  Publicada con GitHub Pages en un repo **público** `juanandresotero/control-de-peso`.
  El repo NO contiene datos personales (`.gitignore` excluye `*.xlsx`, `.~lock*` e `importado/`).
- **Instalable (PWA)**: `manifest.webmanifest` + `sw.js` que cachea los archivos de la app → abre
  sin internet. Chart.js se guarda dentro del repo (`vendor/`) para que también funcione offline.
- **Datos**: se guardan en el aparato (`localStorage`) y se sincronizan con un **Cloudflare Worker
  propio** (`control-peso-sync`) con una base D1 propia (`control-peso-sync`), en la misma cuenta
  de Cloudflare que usa Parecidas pero **separado** de Parecidas.
- **Vinculación por código** (mismo esquema que Parecidas, `Parecidas/sync.js`):
  - Código de 20 caracteres (`XXXXX-XXXXX-XXXXX-XXXXX`, alfabeto sin I/L/O/U).
  - Del código salen por HKDF-SHA256 (salt `control-peso-sync-v1`) un `id` de 128 bits (lo único
    que ve el servidor) y una llave AES-GCM-256 (nunca sale del aparato).
  - El servidor guarda un blob cifrado con número de versión. `GET ?sync=<id>` baja;
    `POST {blob, base}` sube si `base` coincide, si no responde 409 y la app vuelve a bajar y mezclar.
  - Sin cuentas, sin contraseñas, nada vence.
  - Sincroniza: al abrir, al volver a la app, al volver internet, cada 1 min con la app visible,
    y 3 s después de cada cambio.
  - Link para vincular: `…/#vincular=CODIGO` (rellena el código, no vincula solo).
- **Riesgo aceptado**: si se pierde el código y todos los aparatos, los datos no se recuperan.
  Mitigación: botón "Ver código" en Ajustes + "Descargar respaldo" (JSON) + "Descargar para Excel" (CSV).

## Modelo de datos

```js
{
  version: 1,
  dias: {
    "2026-11-13": {
      peso: 95.5,              // número con 1 decimal, o null si ese día no se pesó
      comida: "bien",          // "bien" | "tentacion" | "plato" | "justificado"
      ejercicio: false,
      estimado: false,         // true = número de relleno (importado del Excel)
      mod: 1763040000000       // última modificación (ms), para mezclar entre aparatos
    }
  },
  etapas: [
    {
      id: "e2026", nombre: "Dieta 2026",
      inicio: "2026-03-02", fin: null,       // fin opcional; si es null termina donde empieza la siguiente
      pesoInicial: 108.5,
      metas: [ { id: "m1", nombre: "Salir de obesidad", peso: 83.6, fecha: null } ],
      mod: 1763040000000
    }
  ],
  marcasSemana: { "2026-03-02": "✓" },       // solo semanas importadas del Excel (lunes → marca manual)
  tombs: { "etapa:e2025": 1763040000000 }    // borrados, para que el otro aparato también borre (60 días)
}
```

Significado de `comida`:
- `bien` — todo perfecto (celda blanca en el Excel).
- `tentacion` — me tenté con algo chico (número rojo en el Excel).
- `plato` — un plato completo de mala comida o todo el día (celda roja en el Excel).
- `justificado` — comí algo que no debía pero no fue por falta de voluntad. **No rompe la semana perfecta.**

`ejercicio` es independiente de `comida` (celeste en el Excel).

**Mezcla entre aparatos**: por cada día (clave = fecha) y cada etapa (clave = id) gana el `mod` más
reciente; `marcasSemana` no se edita desde la app (solo importación). Los borrados usan lápidas.

## Reglas de cálculo (`js/calculos.js`, funciones puras con tests)

- **Semana** = lunes a domingo.
- **Etapa de un día**: la etapa con `inicio <= día` más reciente, y `día <= fin` si `fin` existe.
- **Número de semana** dentro de la etapa: Semana 1 = la semana (lun–dom) que contiene `inicio`.
- **Peso de la semana** = peso del último día de la semana que tenga peso real (no estimado).
  Si la semana solo tiene pesos estimados, usa el último estimado y la semana queda marcada "estimada".
- **Diferencia semanal** = peso de la semana anterior − peso de esta semana (positivo = bajó).
  La primera semana de una etapa se compara con `pesoInicial`.
- **Semana ✓/✗**:
  - Si la semana tiene marca importada en `marcasSemana`, se usa esa.
  - Si no: ✗ si algún día tiene `comida` = `tentacion` o `plato`; ✓ si hay al menos un día cargado
    y ninguno es malo; sin marca si no hay días cargados.
  - La semana en curso se muestra igual pero como "en curso".
- **Resumen de la etapa** (la etapa elegida, por defecto la última):
  - Peso inicial, peso actual (último peso real), mejor peso (mínimo real).
  - Kilos perdidos = inicial − actual; % perdido = kilos / inicial.
  - Semana N de la etapa.
  - Promedio real por semana = kilos perdidos / semanas transcurridas (días/7).
  - Ritmo últimas 4 semanas = (peso de la semana de hace 4 − peso de la última semana) / 4.
  - Semanas ✓ y ✗ (solo semanas cerradas) y racha actual de semanas ✓ seguidas.
  - Por cada meta: kg que faltan, % de avance (de `pesoInicial` a `meta.peso`) con barra,
    fecha estimada al promedio real (si el promedio ≤ 0: "a este ritmo no llegás"),
    y si tiene `fecha`: semanas que faltan y kg por semana necesarios (si ya pasó: "vencida").

## Pantallas

1. **Cargar** (pantalla de inicio): fecha (hoy por defecto, se puede cambiar para editar días previos),
   peso con teclado numérico y decimal (acepta coma o punto), 4 botones de comida, botón ejercicio,
   Guardar. Si el día ya existe, se precarga para editar. Opción "Borrar este día".
2. **Semanas**: tabla tipo Excel, la más reciente arriba. Por fila: Semana N, fechas, 7 días con colores,
   peso de la semana, diferencia vs la anterior (verde si bajó, rojo si subió), ✓/✗.
   Colores de cada día:
   - fondo rojo = `plato`; fondo naranja/dorado = `justificado`; fondo celeste = ejercicio (si no hay
     plato/justificado; si los hay, se ve un ícono 🏃); número rojo = `tentacion`;
   - borde/fondo amarillo = **día objetivo** de alguna meta;
   - número gris en cursiva = estimado.
   Filtro: etapa actual / otra etapa / todo. Tocar un día abre Cargar en esa fecha.
3. **Resumen**: los datos de la sección "Resumen de la etapa", con la barra de progreso por meta.
4. **Gráficas** (cambio pedido por el usuario el 2026-11-13):
   - Dieta actual (etapa de hoy), desde su inicio hasta hoy, se actualiza sola: "semana a semana" y "día a día".
   - "Por fechas": rango con Desde / Hasta (por defecto: primer registro → hoy) y botón "Todo" para volver al defecto.
   Solo se dibujan pesos reales; donde faltan días (o son estimados) la línea se une **punteada**.
   Líneas horizontales en cada meta de la dieta actual; el día objetivo marcado.
5. **Ajustes**: etapas (crear / editar nombre, inicio, fin, peso inicial / borrar), metas por etapa
   (nombre, peso, día objetivo opcional), vinculación (crear código, vincular con código, ver código,
   copiar link, sincronizar ahora, desvincular), respaldo (descargar JSON, descargar CSV,
   cargar respaldo JSON — sirve también para la importación inicial).

## Importación del Excel (una sola vez)

Script `tools/importar_excel.py` (openpyxl) → genera `importado/respaldo-inicial.json` (ignorado por git)
y un informe en pantalla. Luego se carga en la app con "Cargar respaldo".

- Fechas: la fila 3 es la semana del lunes 2025-03-17; cada fila siguiente suma 7 días
  (fila 53 = 2026-03-02, fila 89 = 2026-11-09). Columnas J..P = lunes..domingo.
- Valores escritos como texto con coma ("91,5") se convierten a número.
- Colores → marcas: fondo rojo `FFFF0000` = `plato`; fuente roja = `tentacion`;
  fondo celeste (tema 4 o `FF00B0F0`) = ejercicio; fondo tema 7 = `justificado`;
  amarillo = se ignora (era el día objetivo de metas viejas). Colores no reconocidos se listan en el informe.
- **Estimados** (relleno): 2025-09-08 a 2025-11-16 y 2025-12-15 a 2026-03-01. Se marcan `estimado: true`.
  El informe lista estos rangos para que el usuario confirme (duda: 2026-02-02 a 2026-02-04 podrían ser reales).
- Columna Q (✓/✗) → `marcasSemana` con la fecha del lunes.
- Etapas: "Dieta 2025" (inicio 2025-03-22, peso inicial 104.8) y "Dieta 2026"
  (inicio 2026-03-02, peso inicial 108.5) con metas "Salir de obesidad" 83.6 y "Peso ideal" 75,
  **sin fecha** (las del Excel ya vencieron; el usuario pone las nuevas).
- Chequeos del informe: 2026-03-02 = 108.5, 2026-11-13 = 95.5, Dieta 2026 con 19 ✓ y 17 ✗ en semanas cerradas (la semana en curso va aparte).

## Estructura de archivos

```
index.html  styles.css  manifest.webmanifest  sw.js  icon-192.png  icon-512.png
js/calculos.js   — reglas de cálculo (puras)
js/datos.js      — leer/guardar en el aparato, crear/editar/borrar días y etapas, mezcla
js/sync.js       — código, cifrado, hablar con el Worker
js/app.js        — arranque y navegación entre pantallas
js/cargar.js  js/semanas.js  js/resumen.js  js/graficas.js  js/ajustes.js — una pantalla cada uno
js/respaldo.js   — descargar/cargar JSON y CSV
vendor/chart.umd.min.js
worker/index.js  worker/schema.sql  worker/wrangler.toml
tools/importar_excel.py
tests/*.test.js  (node --test, sin dependencias)   tools/test_importar.py
package.json     — solo `"type": "module"` y el script de tests
```

## Manejo de errores

- Sin internet: todo se guarda en el aparato; Ajustes muestra "pendiente de subir" y se sube solo.
- Código inválido o que no abre los datos: mensaje claro, el aparato queda como estaba.
- Conflicto (409): reintenta bajar-mezclar-subir hasta 3 veces.
- Peso fuera de rango (< 30 o > 300) o vacío: no deja guardar y explica por qué (un día sin peso
  pero con marcas sí se puede guardar).
- Respaldo inválido al cargar: no toca los datos actuales.

## Pruebas

- `node --test`: cálculos (semanas, número de semana, peso semanal, diferencias, ✓/✗ con marcas importadas,
  justificado no rompe, resumen y fecha estimada), mezcla entre aparatos, validación de peso, CSV.
- Python: el importador con el Excel real verifica los chequeos del informe.
- Worker: prueba local con `wrangler dev` (GET vacío, POST versión 1, POST con base vieja → 409).
- Prueba final en navegador (escritorio y tamaño celu) con Playwright.

## Fuera de alcance (YAGNI)

IMC, notas por día, fotos, recordatorios/notificaciones, varios usuarios.
