// ================================================================
//  DUSAKAWI EPSI — Backend + Servidor HTML
//  Google Apps Script
// ================================================================
//  ARCHIVOS NECESARIOS EN EL PROYECTO:
//  1. backend_dusakawi.gs  (este archivo)
//  2. formulario.html      (el formulario HTML)
//
//  DESPLIEGUE:
//  1. Crear proyecto en script.google.com
//  2. Pegar este código en Código.gs
//  3. Crear archivo HTML → Archivo > Nuevo > HTML → nombre: formulario
//  4. Pegar el contenido de formulario.html
//  5. Implementar > Nueva implementación
//     - Tipo: Aplicación web
//     - Ejecutar como: Yo (heidyveira@dusakawiepsi.com)
//     - Acceso: Cualquier persona, incluso anónima
//  6. Copiar la URL → esa es la URL del formulario
// ================================================================

const FILE_NAME = 'dusakawi_registros_discapacidad.json';
const FOLDER_ID = '19f6yhpAN2qu6Jns68gsUOo1_QKoFzi17';

// ── Sirve el formulario HTML ───────────────────────────────────
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('formulario')
    .setTitle('Dusakawi EPSI — Registro de Discapacidad')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Funciones llamadas desde el HTML via google.script.run ─────

function loadRecords() {
  return JSON.stringify(getRecords());
}

function saveRecord(recordJson) {
  const record  = JSON.parse(recordJson);
  const records = getRecords();
  records.push(record);
  saveRecords(records);
  return records.length;
}

function deleteRecord(id) {
  const records = getRecords().filter(r => r.id !== Number(id));
  saveRecords(records);
  return records.length;
}

function saveAllRecords(dataJson) {
  const records = JSON.parse(dataJson);
  saveRecords(records);
  return records.length;
}

// ── Acceso a la carpeta de Drive ───────────────────────────────
function getFolder() {
  try {
    return DriveApp.getFolderById(FOLDER_ID);
  } catch(e) {
    const name = 'Dusakawi EPSI - Registros';
    const iter = DriveApp.getFoldersByName(name);
    return iter.hasNext() ? iter.next() : DriveApp.createFolder(name);
  }
}

// ── Leer JSON de Drive ─────────────────────────────────────────
function getRecords() {
  const folder = getFolder();
  const iter   = folder.getFilesByName(FILE_NAME);
  if (iter.hasNext()) {
    const txt = iter.next().getBlob().getDataAsString('UTF-8');
    return txt ? JSON.parse(txt) : [];
  }
  return [];
}

// ── Escribir JSON en Drive ─────────────────────────────────────
function saveRecords(records) {
  const folder  = getFolder();
  const iter    = folder.getFilesByName(FILE_NAME);
  const content = JSON.stringify(records, null, 2);
  if (iter.hasNext()) {
    iter.next().setContent(content);
  } else {
    folder.createFile(FILE_NAME, content, MimeType.PLAIN_TEXT);
  }
}
