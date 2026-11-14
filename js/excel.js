// Arma un archivo de Excel (.xlsx) sin librerías: un .xlsx es un ZIP con archivos XML adentro.
// crearXlsx([{ nombre, filas: [[celda, ...], ...] }]) → Uint8Array
//   celda: número, texto, { fecha: "YYYY-MM-DD" } o null. La primera fila va en negrita y queda fija.

const utf8 = (s) => new TextEncoder().encode(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Días desde el 30/12/1899 (así cuenta Excel las fechas).
export function serialExcel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

export function columna(i) {
  let nombre = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) nombre = String.fromCharCode(65 + ((n - 1) % 26)) + nombre;
  return nombre;
}

// ZIP sin comprimir ("stored"): alcanza y Excel lo abre igual.
function zip(archivos) {
  const partes = [], central = [];
  let desplazamiento = 0;
  for (const { nombre, datos } of archivos) {
    const nombreBytes = utf8(nombre), crc = crc32(datos), tam = datos.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true); local.setUint32(18, tam, true); local.setUint32(22, tam, true);
    local.setUint16(26, nombreBytes.length, true);
    const cabecera = new DataView(new ArrayBuffer(46));
    cabecera.setUint32(0, 0x02014b50, true); cabecera.setUint16(4, 20, true); cabecera.setUint16(6, 20, true);
    cabecera.setUint16(8, 0x0800, true); cabecera.setUint32(16, crc, true); cabecera.setUint32(20, tam, true);
    cabecera.setUint32(24, tam, true); cabecera.setUint16(28, nombreBytes.length, true);
    cabecera.setUint32(42, desplazamiento, true);
    partes.push(new Uint8Array(local.buffer), nombreBytes, datos);
    central.push(new Uint8Array(cabecera.buffer), nombreBytes);
    desplazamiento += 30 + nombreBytes.length + tam;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, desplazamiento, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of todo) { salida.set(p, i); i += p.length; }
  return salida;
}

function celda(valor, ref, esCabecera) {
  if (valor == null || valor === "") return "";
  if (typeof valor === "number") return `<c r="${ref}"><v>${valor}</v></c>`;
  if (typeof valor === "object" && valor.fecha) return `<c r="${ref}" s="1"><v>${serialExcel(valor.fecha)}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${esCabecera ? ' s="2"' : ""}><is><t>${esc(valor)}</t></is></c>`;
}

function hojaXml(filas) {
  const ancho = Math.max(1, ...filas.map((f) => f.length));
  const cuerpo = filas.map((fila, r) =>
    `<row r="${r + 1}">${fila.map((v, c) => celda(v, columna(c) + (r + 1), r === 0)).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols><col min="1" max="${ancho}" width="15" customWidth="1"/></cols>
<sheetData>${cuerpo}</sheetData></worksheet>`;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`;

export function crearXlsx(hojas) {
  const n = hojas.length;
  const tipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  const libro = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${hojas.map((h, i) => `<sheet name="${esc(h.nombre.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`;
  const librosRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  return zip([
    { nombre: "[Content_Types].xml", datos: utf8(tipos) },
    { nombre: "_rels/.rels", datos: utf8(rels) },
    { nombre: "xl/workbook.xml", datos: utf8(libro) },
    { nombre: "xl/_rels/workbook.xml.rels", datos: utf8(librosRels) },
    { nombre: "xl/styles.xml", datos: utf8(ESTILOS) },
    ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, datos: utf8(hojaXml(h.filas)) })),
  ]);
}
