# Control de Peso

App para anotar el peso de cada día, desde el celu o la PC, con los mismos datos en los dos.

**Abrir:** https://juanandresotero.github.io/control-de-peso/
En el celu: abrir el link → menú del navegador → "Agregar a pantalla de inicio" (queda como una app).

## Qué hace
- **Cargar**: peso con decimal + cómo comiste (bien / tentación / plato malo / no fue falta de voluntad) + ejercicio. Se pueden corregir días anteriores.
- **Semanas**: como el Excel, con colores, peso de la semana, cuánto bajaste o subiste y la semana perfecta ✓/✗ (automática).
- **Resumen**: peso actual, kilos bajados, promedio real, ritmo de las últimas 4 semanas (avisa si estás estancado), semanas perfectas, y por cada meta cuánto falta y cuándo llegás a tu ritmo.
- **Gráficas**: semana a semana y día a día. Los días sin pesarte se unen con línea punteada.
- **Etapas**: cada dieta es una etapa con su propio contador de semanas y sus metas.

## Cómo se guardan los datos
- En el aparato, y se sincronizan con un código de 20 letras (sin cuentas ni contraseñas, no vence).
- Viajan **cifrados**: el servidor (`worker/`, Cloudflare) guarda texto ilegible.
- Ajustes → Respaldo → **Descargar Excel**: todos los datos en un .xlsx (para guardar en un pendrive).
- **El código es la única llave**: anotalo en un lugar seguro y bajá un respaldo cada tanto (Ajustes → Respaldo).
- Este repositorio **no** contiene datos personales.

## Para desarrollar
- Tests: `node --test` (lógica, sincronización y servidor) y `python tools/test_importar.py` (importador del Excel).
- Importar el Excel viejo: `python tools/importar_excel.py` → `importado/respaldo-inicial.json` → Ajustes → Cargar respaldo.
- Servidor de sincronización: `cd worker && npx wrangler deploy`.
- Al cambiar archivos de la app, subir el número en `CACHE` de `sw.js`.
