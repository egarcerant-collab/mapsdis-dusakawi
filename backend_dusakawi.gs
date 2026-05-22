// ================================================================
//  DUSAKAWI EPSI — Backend Google Apps Script
// ================================================================
//  DESPLIEGUE:
//  1. script.google.com → nuevo proyecto
//  2. Pegar este código en Código.gs
//  3. Archivo > Nuevo > HTML → nombre: formulario → pegar formulario.html
//  4. Implementar > Nueva implementación
//     - Tipo: Aplicación web
//     - Ejecutar como: Yo (heidyveira@dusakawiepsi.com)
//     - Acceso: Cualquier persona, incluso anónima
//  5. Copiar la URL del Web App → configurarla en Admin > Configuración del Servidor
// ================================================================

const FILE_NAME = 'dusakawi_registros_discapacidad.json';
const FOLDER_ID = '19f6yhpAN2qu6Jns68gsUOo1_QKoFzi17';

// ── Sirve HTML o datos vía GET ─────────────────────────────────
function doGet(e) {
  const action = (e.parameter || {}).action;

  if (action === 'load') {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      return buildResponse({ ok: true, data: getRecords() });
    } finally {
      lock.releaseLock();
    }
  }

  return HtmlService.createHtmlOutputFromFile('formulario')
    .setTitle('Dusakawi EPSI — Registro de Discapacidad')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── API HTTP desde GitHub Pages u otros orígenes (POST text/plain) ──
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const body = JSON.parse(e.postData.contents);
    let result;

    if (body.action === 'save') {
      result = saveRecordSafe(body.record);
    } else if (body.action === 'delete') {
      result = deleteRecordSafe(body.id);
    } else if (body.action === 'saveAll') {
      saveRecords(body.records);
      result = body.records.length;
    } else {
      throw new Error('Acción desconocida: ' + body.action);
    }

    return buildResponse({ ok: true, data: result });
  } catch (err) {
    return buildResponse({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ── Funciones llamadas desde HTML vía google.script.run ────────
function loadRecords() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return JSON.stringify(getRecords());
  } finally {
    lock.releaseLock();
  }
}

function saveRecord(recordJson) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return saveRecordSafe(JSON.parse(recordJson));
  } finally {
    lock.releaseLock();
  }
}

function deleteRecord(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return deleteRecordSafe(id);
  } finally {
    lock.releaseLock();
  }
}

function saveAllRecords(dataJson) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const records = JSON.parse(dataJson);
    saveRecords(records);
    return records.length;
  } finally {
    lock.releaseLock();
  }
}

// ── Lógica de negocio con deduplicación por ID ─────────────────
function saveRecordSafe(record) {
  const records = getRecords();
  const idx = records.findIndex(r => String(r.id) === String(record.id));
  if (idx >= 0) {
    records[idx] = record;
  } else {
    records.push(record);
  }
  saveRecords(records);
  return records.length;
}

function deleteRecordSafe(id) {
  const records = getRecords().filter(r => String(r.id) !== String(id));
  saveRecords(records);
  return records.length;
}

// ── Acceso a la carpeta de Drive ───────────────────────────────
function getFolder() {
  try {
    return DriveApp.getFolderById(FOLDER_ID);
  } catch (e) {
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

// ── Respuesta HTTP JSON ────────────────────────────────────────
function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
