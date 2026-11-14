import { test } from "node:test";
import assert from "node:assert/strict";
import { crearXlsx, crc32, serialExcel, columna } from "../js/excel.js";

const texto = (bytes) => new TextDecoder().decode(bytes);

test("crc32 da el valor de control estándar", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("serialExcel convierte fechas al número que usa Excel", () => {
  assert.equal(serialExcel("1900-03-01"), 61);
  assert.equal(serialExcel("2026-11-14"), 46340);
});

test("columna: A, Z, AA", () => {
  assert.equal(columna(0), "A");
  assert.equal(columna(25), "Z");
  assert.equal(columna(26), "AA");
});

test("crearXlsx arma un ZIP con las partes de un libro de Excel", () => {
  const bytes = crearXlsx([
    { nombre: "Días", filas: [["Fecha", "Peso"], [{ fecha: "2026-11-14" }, 95.5]] },
    { nombre: "Medidas & más", filas: [["Zona"], ["Cintura <cm>"]] },
  ]);
  assert.equal(texto(bytes.slice(0, 2)), "PK");
  const todo = texto(bytes);
  for (const parte of ["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) {
    assert.ok(todo.includes(parte), parte);
  }
  assert.ok(todo.includes('<sheet name="Medidas &amp; más"'));
  assert.ok(todo.includes("Cintura &lt;cm&gt;"));
  assert.ok(todo.includes("<v>46340</v>"));
  assert.ok(todo.includes("<v>95.5</v>"));
});
