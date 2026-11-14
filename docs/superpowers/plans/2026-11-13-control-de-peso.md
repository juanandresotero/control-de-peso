# Control de Peso — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, misma sesión). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web instalable (celu + PC) para registrar el peso diario con marcas, ver semanas, resumen y gráficas, sincronizada por código cifrado.

**Architecture:** Sitio estático (ES modules, sin build) en GitHub Pages. Lógica pura en `js/fechas.js`, `js/calculos.js`, `js/datos.js` (testeadas con `node --test`); pantallas en un módulo cada una. Sincronización con un Cloudflare Worker + D1 propio (`control-peso-sync`), mismo esquema que Parecidas (código → HKDF → id + llave AES-GCM).

**Tech Stack:** HTML/CSS/JS vanilla, Chart.js 4.4.1 (vendorizado), Node 24 `node:test`, Python 3.13 + openpyxl (importador), Cloudflare Workers + D1 (wrangler).

**Spec:** `docs/superpowers/specs/2026-11-13-control-de-peso-design.md`

**Nota de ejecución:** se ejecuta inline en la misma sesión; el plan fija interfaces, casos de prueba y criterios de aceptación. El código se escribe directo en los archivos (TDD: test primero en la lógica pura).

---

## Interfaces (contrato entre módulos)

`js/fechas.js`
- `aFecha(iso) → Date(UTC)`, `aIso(date) → "YYYY-MM-DD"`, `sumarDias(iso, n) → iso`,
  `diasEntre(a, b) → int` (b − a), `lunesDe(iso) → iso`, `hoyIso(now = new Date()) → iso local`,
  `formatoCorto(iso) → "13/11"`, `formatoLargo(iso) → "vie 13/11/2026"`.

`js/calculos.js`
- `MALAS = new Set(["tentacion", "plato"])`
- `etapaDe(iso, etapas) → etapa | null`
- `rangoEtapa(etapa, etapas, hoy) → { desde, hasta }` (hasta = fin ?? día antes de la siguiente ?? hoy)
- `numeroSemana(iso, etapa) → int` (Semana 1 = semana que contiene `etapa.inicio`)
- `resumenSemana(lunes, dias, marcasSemana, hoy) → { lunes, dias: [{fecha, dia}]×7, peso, estimada, marca, importada, enCurso }`
- `listaSemanas(datos, desde, hasta, pesoBase, hoy) → semanas[]` con `diferencia` (anterior − actual, 1 decimal; la primera contra `pesoBase` si existe)
- `resumenEtapa(datos, etapa, hoy) → { pesoInicial, pesoActual, fechaActual, mejorPeso, kilosPerdidos, porcentaje, semanaNumero, promedioSemanal, ritmo4, semanasOk, semanasMal, racha, semanaEnCurso, metas: [...] }`
  - meta: `{ meta, faltan, avance (0..1), alcanzada, fechaEstimada, semanasRestantes, kgPorSemana, vencida }`
- `serieDiaria(datos, desde, hasta) → { fechas, valores }` (solo pesos reales, null en el resto)
- `diaObjetivoSet(etapas) → Map(iso → [metas])`

`js/datos.js`
- `vacio()`, `cargar(storage)`, `guardarTodo(datos, storage)`
- `leerPeso(texto) → { ok, valor, error }` (acepta coma; vacío → `{ok:true, valor:null}`; fuera de 30–300 → error)
- `guardarDia(datos, fecha, {peso, comida, ejercicio}, ahora) → datos nuevos`
- `borrarDia(datos, fecha, ahora)`, `guardarEtapa(datos, etapa, ahora)`, `borrarEtapa(datos, id, ahora)`, `nuevoId()`
- `mezclar(a, b, ahora) → datos` (por día/etapa gana `mod` mayor, empate → a; lápidas 60 días)
- `iguales(a, b) → bool` (JSON estable), `validarRespaldo(obj) → bool`, `aCsv(datos) → string`

`js/sync.js` (adaptado de `Parecidas/sync.js`)
- `codigoNuevo()`, `normalizarCodigo(texto) → código | null`, `derivar(codigo) → {id, key}`,
  `cifrar(obj, key)`, `descifrar(texto, key)`
- `configurarSync({ url, leer, aplicar, alCambiar })`, `crear()`, `vincular(texto)`, `sincronizar()`,
  `desvincular()`, `estado()`, `avisarCambio()`, `arrancarAuto()`

`worker/index.js`: `export default { fetch(request, env) }` — `GET ?sync=<32 hex>` → `{ok, v, blob}`; `POST {blob, base}` → `{ok, v}` o 409 `{error:"version", v}`.

---

### Task 1: Esqueleto del proyecto
**Files:** `package.json`, `vendor/chart.umd.min.js`, `icon-192.png`, `icon-512.png`, `tools/hacer_iconos.py`
- [x] `package.json` con `{"type":"module","scripts":{"test":"node --test tests/"}}`
- [x] Bajar Chart.js 4.4.1 de cdnjs a `vendor/`
- [x] Generar íconos con PIL (`tools/hacer_iconos.py`)
- [x] Commit

### Task 2: `js/fechas.js` (TDD)
**Test:** `tests/fechas.test.js` — casos: `lunesDe("2026-11-13") === "2026-11-09"`, `lunesDe("2026-11-09")` igual, `lunesDe("2026-11-15") === "2026-11-09"`; `sumarDias("2026-02-28", 1) === "2026-03-01"`; `diasEntre("2026-03-02","2026-11-13") === 256`; `formatoCorto("2026-03-02") === "02/03"`; `formatoLargo("2026-11-13") === "vie 13/11/2026"`; `hoyIso(new Date(2026,10,13,23,59)) === "2026-11-13"`.
- [x] Test que falla → implementar → pasa → commit

### Task 3: `js/calculos.js` (TDD)
**Test:** `tests/calculos.test.js` con datos de ejemplo:
- `numeroSemana("2026-03-02", e2026) === 1`, `("2026-03-08") === 1`, `("2026-03-09") === 2`, `("2026-11-13") === 37`.
- `etapaDe`: día antes de la primera etapa → null; con `fin` pasado → null; dos etapas → la última que empezó.
- `resumenSemana`: peso = último real; si solo hay estimados → último estimado y `estimada:true`; marca ✗ con tentación, ✗ con plato, ✓ con justificado + bien, null sin días; marca importada gana; `enCurso` si el lunes es el de hoy.
- `listaSemanas`: diferencia contra la anterior (1 decimal), primera contra `pesoBase`, semana vacía no corta la comparación (compara con la última con peso).
- `resumenEtapa`: kilos, %, promedio (kilos / (días/7)), ritmo4, conteo ✓/✗ solo de semanas cerradas, racha, meta con fecha estimada, meta alcanzada, meta vencida, promedio ≤ 0 → `fechaEstimada:null`.
- `serieDiaria`: estimados → null.
- [x] Test que falla → implementar → pasa → commit

### Task 4: `js/datos.js` (TDD)
**Test:** `tests/datos.test.js`:
- `leerPeso("95,5")` → 95.5; `"95.55"` → 95.6 (redondeo a 1 decimal); `""` → null ok; `"abc"`, `"20"`, `"400"` → error.
- `guardarDia` pone `mod`, `estimado:false`, no muta el original.
- `borrarDia` deja lápida; `mezclar` con el otro aparato que todavía lo tiene → borrado; si el otro lo editó DESPUÉS de la lápida → vuelve.
- `mezclar`: día editado en ambos → gana `mod` mayor; días distintos → unión; etapas por id; `marcasSemana` unión; lápidas de más de 60 días se limpian.
- `iguales` ignora orden de claves. `validarRespaldo` rechaza `{}` y `null`. `aCsv` tiene encabezado `fecha;peso;comida;ejercicio;estimado` y decimales con coma.
- [x] Test que falla → implementar → pasa → commit

### Task 5: Worker de sincronización (TDD con D1 falso)
**Files:** `worker/index.js`, `worker/schema.sql`, `worker/wrangler.toml`, `tests/worker.test.js`
- Casos: GET id nuevo → `{v:0, blob:null}`; POST base 0 → v 1; POST base 1 → v 2; POST base vieja → 409; id inválido → 400; blob muy grande → 400; OPTIONS → CORS.
- [x] Test que falla → implementar → pasa → commit

### Task 6: `js/sync.js` (TDD de las partes puras)
**Test:** `tests/sync.test.js`: `normalizarCodigo` (minúsculas/espacios/O→0/I,L→1; largo incorrecto → null); `codigoNuevo` cumple el formato; `derivar` mismo código → mismo id (32 hex), distinto código → distinto id; `cifrar`/`descifrar` ida y vuelta; descifrar con otra llave falla; `sincronizar` contra un `fetch` falso con el worker real en memoria: aparato A sube, aparato B vincula y recibe los datos, ambos editan días distintos y quedan iguales.
- [x] Test que falla → implementar → pasa → commit

### Task 7: Importador del Excel
**Files:** `tools/importar_excel.py`, `tools/test_importar.py`
- Fila r → lunes = 2025-03-17 + (r−3)·7; columnas J..P; colores según spec; texto con coma → número; estimados en los rangos del spec; Q → `marcasSemana`; etapas e2025/e2026 con metas sin fecha.
- Test (se saltea si no está el Excel): 2026-03-02 = 108.5 real; 2026-11-13 = 95.5; 2025-10-01 estimado; semanas cerradas Dieta 2026: 19 ✓ / 17 ✗; 2025-08-04..10 tiene `plato`; 2026-04-11 `justificado`.
- [x] Test → implementar → pasa → generar `importado/respaldo-inicial.json` e informe → commit (sin datos)

### Task 8: Interfaz — esqueleto, navegación y Cargar
**Files:** `index.html`, `styles.css`, `js/app.js`, `js/cargar.js`
- 5 pestañas abajo (Cargar, Semanas, Resumen, Gráficas, Ajustes), indicador de sync arriba.
- Cargar: fecha (hoy, ← →), peso (`inputmode="decimal"`), 4 botones de comida, ejercicio, Guardar, Borrar día; precarga si existe; muestra "Semana N · Dieta X".
- [x] Implementar → probar en navegador → commit

### Task 9: Semanas
**Files:** `js/semanas.js`, estilos
- Selector de etapa + "Todo"; tarjeta por semana (más reciente arriba): Sem N, fechas, peso, diferencia ▼ verde / ▲ roja, ✓/✗ (en curso "…"), 7 celdas con colores del spec; tocar celda → Cargar esa fecha.
- [x] Implementar → probar → commit

### Task 10: Resumen
**Files:** `js/resumen.js`
- Tarjetas: peso inicial/actual/mejor, kilos y %, semana N, promedio y ritmo 4 sem (con aviso "estancado" si ritmo4 ≤ 0.1), ✓/✗ y racha, por meta barra + faltan + fecha estimada + día objetivo y kg/semana necesarios o "vencida".
- [x] Implementar → probar → commit

### Task 11: Gráficas
**Files:** `js/graficas.js`
- Selector etapa/todo; "Semana a semana" y "Día a día" con Chart.js, `spanGaps:true` + `segment.borderDash` en tramos sin datos; líneas de metas; punto amarillo en el día objetivo.
- [x] Implementar → probar → commit

### Task 12: Ajustes, respaldo y sync en la interfaz
**Files:** `js/ajustes.js`, `js/respaldo.js`
- Etapas y metas (crear/editar/borrar con doble toque), vinculación (crear, vincular, ver código, copiar link, sincronizar ahora, desvincular, estado), respaldo (descargar JSON/CSV, cargar JSON con `mezclar`).
- [x] Implementar → probar → commit

### Task 13: PWA
**Files:** `manifest.webmanifest`, `sw.js`, registro en `js/app.js`
- Cache del shell con nombre versionado; red primero para los archivos de la app, cache si no hay red.
- [x] Implementar → probar offline → commit

### Task 14: Publicación
- [x] `wrangler d1 create control-peso-sync` → id en `wrangler.toml` → `wrangler d1 execute --remote --file schema.sql` → `wrangler deploy` → URL en `js/sync.js`
- [x] `gh repo create juanandresotero/control-de-peso --public` (verificar antes que no hay datos personales en git) → push → activar Pages
- [x] Prueba final con Playwright en la URL publicada (escritorio y celu) → commit

### Task 15: Carga del historial y entrega
- [ ] Guiar al usuario: abrir la app → Ajustes → Cargar respaldo (`importado/respaldo-inicial.json`) → crear código → vincular el celu.
