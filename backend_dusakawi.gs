// ================================================================
//  DUSAKAWI EPSI — Backend Google Apps Script
// ================================================================
//  PASOS PARA DESPLEGAR:
//  1. script.google.com → Nuevo proyecto → pegar este código
//  2. Implementar → Nueva implementación
//  3. Tipo: Aplicación web
//  4. Ejecutar como: Yo
//  5. Quién tiene acceso: Cualquier persona, incluso anónima
//  6. Implementar → copiar URL → pegar en el HTML
//
//  NOTA: La carpeta "Dusakawi EPSI - Registros" se crea
//  automáticamente en el Drive de la cuenta que despliega.
// ================================================================

const FILE_NAME   = 'dusakawi_registros_discapacidad.json';
const FOLDER_ID   = '19f6yhpAN2qu6Jns68gsUOo1_QKoFzi17';

// ── Obtiene la carpeta de trabajo ──────────────────────────────
function getFolder() {
  try {
    return DriveApp.getFolderById(FOLDER_ID);
  } catch(e) {
    // Si no tiene acceso, crea una carpeta propia como respaldo
    const name = 'Dusakawi EPSI - Registros';
    const iter = DriveApp.getFoldersByName(name);
    return iter.hasNext() ? iter.next() : DriveApp.createFolder(name);
  }
}

// ── Punto de entrada ───────────────────────────────────────────
function doGet(e) {
  if (!e) e = { parameter: {} };

  // Headers CORS para permitir fetch desde cualquier origen
  const action = (e.parameter && e.parameter.action) || 'load';
  let result;

  try {
    switch (action) {

      case 'ping':
        result = { ok: true, msg: 'Dusakawi EPSI API activa',
                   ts: new Date().toISOString(),
                   carpeta: getFolder().getName() };
        break;

      case 'load':
        result = { ok: true, records: getRecords() };
        break;

      case 'save': {
        const record = JSON.parse(e.parameter.data);
        const recs   = getRecords();
        recs.push(record);
        saveRecords(recs);
        result = { ok: true, total: recs.length };
        break;
      }

      case 'saveAll': {
        const all = JSON.parse(e.parameter.data);
        saveRecords(all);
        result = { ok: true, total: all.length };
        break;
      }

      case 'delete': {
        const id  = Number(e.parameter.id);
        const rem = getRecords().filter(r => r.id !== id);
        saveRecords(rem);
        result = { ok: true, total: rem.length };
        break;
      }

      default:
        result = { ok: false, error: 'Acción desconocida: ' + action };
    }
  } catch (err) {
    result = { ok: false, error: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Leer registros ─────────────────────────────────────────────
function getRecords() {
  const folder = getFolder();
  const iter   = folder.getFilesByName(FILE_NAME);
  if (iter.hasNext()) {
    const txt = iter.next().getBlob().getDataAsString('UTF-8');
    return txt ? JSON.parse(txt) : [];
  }
  return [];
}

// ── Guardar registros ──────────────────────────────────────────
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
