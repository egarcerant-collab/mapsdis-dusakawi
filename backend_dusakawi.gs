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
const MAX_BACKUPS     = 10;   // Máximo de copias de respaldo por archivo

// ── API unificada vía GET ──────────────────────────────────────
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
    } else if (action === 'listBackups') {
      return buildResponse({ ok: true, data: listBackups() });
    } else if (action === 'restoreBackup') {
      return buildResponse({ ok: true, data: restoreBackup(params.fileName, params.tipo) });
    } else {
      throw new Error('Acción desconocida: ' + action);
    }
  } catch (err) {
    return buildResponse({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ── doPost: upload de certificados ────────────────────────────
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

// ── Upload directo desde google.script.run ────────────────────
function uploadCertificadoGAS(recordId, fileName, base64Data, mimeType) {
  return saveCertificado(recordId, fileName, base64Data, mimeType);
}

// ── Guardar certificado en subcarpeta Drive ───────────────────
function saveCertificado(recordId, fileName, base64Data, mimeType) {
  const folder = getCertificadosFolder();
  const safeName = 'cert_' + recordId + '_' + fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const iter = folder.getFilesByName(safeName);
  if (iter.hasNext()) iter.next().setTrashed(true);
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

// ── Funciones expuestas a google.script.run ───────────────────
function loadRecords() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return JSON.stringify(getRecords()); }
  finally { lock.releaseLock(); }
}

function saveRecord(recordJson) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return saveRecordSafe(JSON.parse(recordJson)); }
  finally { lock.releaseLock(); }
}

function deleteRecord(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return deleteRecordSafe(id); }
  finally { lock.releaseLock(); }
}

function saveAllRecords(dataJson) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const records = JSON.parse(dataJson);
    saveRecords(records);
    return records.length;
  } finally { lock.releaseLock(); }
}

function loadUsersGAS() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return JSON.stringify(getUsersFromDrive()); }
  finally { lock.releaseLock(); }
}

function saveUserGAS(userJson) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return saveUserSafe(JSON.parse(userJson)); }
  finally { lock.releaseLock(); }
}

function deleteUserGAS(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return deleteUserSafe(id); }
  finally { lock.releaseLock(); }
}

// ── Lógica de negocio ─────────────────────────────────────────
function saveRecordSafe(record) {
  const records = getRecords();
  const idx = records.findIndex(r => String(r.id) === String(record.id));
  if (idx >= 0) { records[idx] = record; } else { records.push(record); }
  saveRecords(records);
  return records.length;
}

function deleteRecordSafe(id) {
  const records = getRecords().filter(r => String(r.id) !== String(id));
  saveRecords(records);
  return records.length;
}

// ── Acceso a carpetas de Drive ────────────────────────────────
function getFolder() {
  try {
    return DriveApp.getFolderById(FOLDER_ID);
  } catch (e) {
    const name = 'Dusakawi EPSI - Registros';
    const iter = DriveApp.getFoldersByName(name);
    return iter.hasNext() ? iter.next() : DriveApp.createFolder(name);
  }
}

function getBackupsFolder() {
  const parent = getFolder();
  const iter   = parent.getFoldersByName('backups');
  return iter.hasNext() ? iter.next() : parent.createFolder('backups');
}

// ── Leer registros de Drive ───────────────────────────────────
function getRecords() {
  const folder = getFolder();
  const iter   = folder.getFilesByName(FILE_NAME);
  if (iter.hasNext()) {
    const txt = iter.next().getBlob().getDataAsString('UTF-8');
    return txt ? JSON.parse(txt) : [];
  }
  return [];
}

// ── Guardar registros + backup automático ─────────────────────
function saveRecords(records) {
  const folder  = getFolder();
  const iter    = folder.getFilesByName(FILE_NAME);
  const content = JSON.stringify(records, null, 2);
  if (iter.hasNext()) {
    iter.next().setContent(content);
  } else {
    folder.createFile(FILE_NAME, content, MimeType.PLAIN_TEXT);
  }
  // Crear backup automático
  crearBackup('registros', content);
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

// ── Guardar usuarios + backup automático ──────────────────────
function saveUsersFile(users) {
  const folder  = getFolder();
  const iter    = folder.getFilesByName(USERS_FILE_NAME);
  const content = JSON.stringify(users, null, 2);
  if (iter.hasNext()) { iter.next().setContent(content); }
  else { folder.createFile(USERS_FILE_NAME, content, MimeType.PLAIN_TEXT); }
  // Crear backup automático
  crearBackup('usuarios', content);
}

// ── Sistema de Backups ────────────────────────────────────────
function crearBackup(tipo, content) {
  try {
    const folder    = getBackupsFolder();
    const zona      = 'America/Bogota';
    const ahora     = new Date();
    const formatter = Utilities.formatDate(ahora, zona, 'yyyyMMdd_HHmmss');
    const nombre    = 'backup_' + tipo + '_' + formatter + '.json';

    // Crear archivo de backup
    folder.createFile(nombre, content, MimeType.PLAIN_TEXT);

    // Limpiar backups antiguos — conservar solo los últimos MAX_BACKUPS
    limpiarBackupsAntiguos(folder, tipo);
  } catch(e) {
    // El backup nunca debe interrumpir el guardado principal
    Logger.log('Error en backup: ' + e.message);
  }
}

function limpiarBackupsAntiguos(folder, tipo) {
  try {
    const iter  = folder.getFilesByName('backup_' + tipo + '_*');
    // getFilesByName con wildcard no funciona, usamos búsqueda por prefijo
    const todos = [];
    const allFiles = folder.getFiles();
    while (allFiles.hasNext()) {
      const f = allFiles.next();
      if (f.getName().startsWith('backup_' + tipo + '_')) {
        todos.push({ file: f, date: f.getDateCreated() });
      }
    }
    // Ordenar de más nuevo a más antiguo
    todos.sort((a, b) => b.date - a.date);
    // Eliminar los que superan el máximo
    for (let i = MAX_BACKUPS; i < todos.length; i++) {
      todos[i].file.setTrashed(true);
    }
  } catch(e) {
    Logger.log('Error limpiando backups: ' + e.message);
  }
}

// ── Listar backups disponibles ────────────────────────────────
function listBackups() {
  const folder  = getBackupsFolder();
  const allFiles = folder.getFiles();
  const lista   = [];
  while (allFiles.hasNext()) {
    const f = allFiles.next();
    const name = f.getName();
    if (name.startsWith('backup_')) {
      lista.push({
        nombre:   name,
        tipo:     name.includes('_registros_') ? 'registros' : 'usuarios',
        fecha:    f.getDateCreated().toISOString(),
        tamanio:  f.getSize(),
        id:       f.getId()
      });
    }
  }
  // Ordenar de más nuevo a más antiguo
  lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return lista;
}

// ── Restaurar desde backup ────────────────────────────────────
function restoreBackup(fileName, tipo) {
  const folder   = getBackupsFolder();
  const iter     = folder.getFilesByName(fileName);
  if (!iter.hasNext()) throw new Error('Archivo de backup no encontrado: ' + fileName);

  const content  = iter.next().getBlob().getDataAsString('UTF-8');
  const datos    = JSON.parse(content);

  if (tipo === 'registros') {
    // Antes de restaurar, hacer backup del estado actual
    crearBackup('registros_prerestauracion', JSON.stringify(getRecords(), null, 2));
    saveRecords(datos);
    return { tipo: 'registros', total: datos.length };
  } else if (tipo === 'usuarios') {
    crearBackup('usuarios_prerestauracion', JSON.stringify(getUsersFromDrive(), null, 2));
    saveUsersFile(datos);
    return { tipo: 'usuarios', total: datos.length };
  } else {
    throw new Error('Tipo de backup desconocido: ' + tipo);
  }
}

// ── Trigger diario de backup ──────────────────────────────────
// Ejecutar manualmente UNA VEZ para activar el respaldo automático diario:
//   En GAS → Ejecutar → crearTriggerDiario
function crearTriggerDiario() {
  // Eliminar triggers previos del mismo tipo para no duplicar
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'backupDiario') ScriptApp.deleteTrigger(t);
  });
  // Crear trigger a las 2 AM hora Colombia todos los días
  ScriptApp.newTrigger('backupDiario')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .inTimezone('America/Bogota')
    .create();
  Logger.log('✅ Trigger diario creado: backup a las 2 AM (Bogotá)');
}

function backupDiario() {
  try {
    const registros = getRecords();
    const usuarios  = getUsersFromDrive();
    crearBackup('registros', JSON.stringify(registros, null, 2));
    crearBackup('usuarios',  JSON.stringify(usuarios,  null, 2));
    Logger.log('✅ Backup diario completado: ' + registros.length + ' registros, ' + usuarios.length + ' usuarios');
  } catch(e) {
    Logger.log('❌ Error en backup diario: ' + e.message);
  }
}

// ── Respuesta HTTP JSON ───────────────────────────────────────
function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
