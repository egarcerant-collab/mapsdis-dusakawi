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

const FILE_NAME       = 'dusakawi_registros_discapacidad.json';
const USERS_FILE_NAME = 'dusakawi_usuarios.json';
const FOLDER_ID       = '19f6yhpAN2qu6Jns68gsUOo1_QKoFzi17';

// ── API unificada vía GET (evita problema de redirect con POST) ─
function doGet(e) {
  const params = e.parameter || {};
  const action = params.action;

  if (!action) {
    return HtmlService.createHtmlOutputFromFile('formulario')
      .setTitle('Dusakawi EPSI — Registro de Discapacidad')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (action === 'load') {
      return buildResponse({ ok: true, data: getRecords() });
    } else if (action === 'save') {
      const record = JSON.parse(params.record);
      return buildResponse({ ok: true, data: saveRecordSafe(record) });
    } else if (action === 'delete') {
      return buildResponse({ ok: true, data: deleteRecordSafe(params.id) });
    } else if (action === 'saveAll') {
      const records = JSON.parse(params.records);
      saveRecords(records);
      return buildResponse({ ok: true, data: records.length });
    } else if (action === 'loadUsers') {
      return buildResponse({ ok: true, data: getUsersFromDrive() });
    } else if (action === 'saveUser') {
      const user = JSON.parse(params.user);
      return buildResponse({ ok: true, data: saveUserSafe(user) });
    } else if (action === 'deleteUser') {
      return buildResponse({ ok: true, data: deleteUserSafe(params.id) });
    } else if (action === 'checkUpload') {
      const cached = CacheService.getScriptCache().get('dusa_cert_' + params.uploadId);
      return buildResponse({ ok: true, data: cached || null });
    } else {
      throw new Error('Acción desconocida: ' + action);
    }
  } catch (err) {
    return buildResponse({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ── doPost: upload de certificados y respaldo de otras acciones ─
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.action === 'uploadCertificado') {
      const url = saveCertificado(body.recordId, body.fileName, body.base64Data, body.mimeType);
      if (body.uploadId) {
        CacheService.getScriptCache().put('dusa_cert_' + body.uploadId, url, 600);
      }
      return buildResponse({ ok: true, data: url });
    }

    // Otras acciones con lock
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
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
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return buildResponse({ ok: false, error: err.message });
  }
}

// ── Guardar certificado en subcarpeta Drive ────────────────────
function saveCertificado(recordId, fileName, base64Data, mimeType) {
  const folder = getCertificadosFolder();
  const safeName = 'cert_' + recordId + '_' + fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Eliminar versión previa si existe
  const iter = folder.getFilesByName(safeName);
  if (iter.hasNext()) iter.next().setTrashed(true);
  // Crear archivo
  const decoded = Utilities.base64Decode(base64Data);
  const blob    = Utilities.newBlob(decoded, mimeType, safeName);
  const file    = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/file/d/' + file.getId() + '/view';
}

function getCertificadosFolder() {
  const parent = getFolder();
  const iter   = parent.getFoldersByName('certificados');
  return iter.hasNext() ? iter.next() : parent.createFolder('certificados');
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

// ── Funciones expuestas a google.script.run ────────────────────
// Necesarias para que el frontend las llame directamente cuando
// se ejecuta dentro del contexto de GAS (sin necesidad de fetch).

function loadUsersGAS() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return JSON.stringify(getUsersFromDrive());
  } finally {
    lock.releaseLock();
  }
}

function saveUserGAS(userJson) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return saveUserSafe(JSON.parse(userJson));
  } finally {
    lock.releaseLock();
  }
}

function deleteUserGAS(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return deleteUserSafe(id);
  } finally {
    lock.releaseLock();
  }
}

// ── Gestión de Usuarios en Drive ──────────────────────────────
function getUsersFromDrive() {
  const folder = getFolder();
  const iter   = folder.getFilesByName(USERS_FILE_NAME);
  if (iter.hasNext()) {
    const txt = iter.next().getBlob().getDataAsString('UTF-8');
    return txt ? JSON.parse(txt) : [];
  }
  return [];
}

function saveUserSafe(user) {
  const users = getUsersFromDrive();
  const idx   = users.findIndex(u => String(u.id) === String(user.id));
  if (idx >= 0) { users[idx] = user; } else { users.push(user); }
  saveUsersFile(users);
  return users.length;
}

function deleteUserSafe(id) {
  const users = getUsersFromDrive().filter(u => String(u.id) !== String(id));
  saveUsersFile(users);
  return users.length;
}

function saveUsersFile(users) {
  const folder  = getFolder();
  const iter    = folder.getFilesByName(USERS_FILE_NAME);
  const content = JSON.stringify(users, null, 2);
  if (iter.hasNext()) { iter.next().setContent(content); }
  else { folder.createFile(USERS_FILE_NAME, content, MimeType.PLAIN_TEXT); }
}

// ── Respuesta HTTP JSON ────────────────────────────────────────
function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
