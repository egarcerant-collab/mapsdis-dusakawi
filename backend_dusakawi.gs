// ================================================================
//  DUSAKAWI EPSI — Backend Google Apps Script
//  Carpeta Drive destino: 1V8MzO5JalyWMXNwGmV47lzqhzyVoUYdj
// ================================================================
//  PASOS PARA DESPLEGAR:
//  1. Ir a https://script.google.com → Nuevo proyecto
//  2. Pegar TODO este código (reemplazar el contenido por defecto)
//  3. Menú: Implementar → Nueva implementación
//  4. Tipo: Aplicación web
//  5. Ejecutar como: Yo (tu cuenta Google)
//  6. Quién tiene acceso: Cualquier persona
//  7. Implementar → Copiar la URL generada
//  8. Pegar esa URL en el formulario HTML (variable SCRIPT_URL)
// ================================================================

const FOLDER_ID = '1V8MzO5JalyWMXNwGmV47lzqhzyVoUYdj';
const FILE_NAME  = 'dusakawi_registros_discapacidad.json';

// Punto de entrada — soporta JSONP via ?callback=
function doGet(e) {
  if (!e) e = { parameter: {} }; // Protección ejecución manual desde editor
  const action   = (e.parameter && e.parameter.action)   || 'load';
  const callback = (e.parameter && e.parameter.callback) || null;

  let result;
  try {
    switch (action) {

      case 'load':
        result = { ok: true, records: getRecords() };
        break;

      case 'save': {
        const record  = JSON.parse(e.parameter.data);
        const recs    = getRecords();
        recs.push(record);
        saveRecords(recs);
        result = { ok: true, total: recs.length };
        break;
      }

      case 'saveAll': {
        const allData = JSON.parse(e.parameter.data);
        saveRecords(allData);
        result = { ok: true, total: allData.length };
        break;
      }

      case 'delete': {
        const id  = Number(e.parameter.id);
        const rem = getRecords().filter(r => r.id !== id);
        saveRecords(rem);
        result = { ok: true, total: rem.length };
        break;
      }

      case 'ping':
        result = { ok: true, msg: 'Dusakawi EPSI API activa', ts: new Date().toISOString() };
        break;

      default:
        result = { ok: false, error: 'Acción desconocida: ' + action };
    }
  } catch (err) {
    result = { ok: false, error: err.toString() };
  }

  const out = ContentService.createTextOutput();
  if (callback) {
    out.setMimeType(ContentService.MimeType.JAVASCRIPT);
    out.setContent(callback + '(' + JSON.stringify(result) + ');');
  } else {
    out.setMimeType(ContentService.MimeType.JSON);
    out.setContent(JSON.stringify(result));
  }
  return out;
}

// ── Lectura del archivo JSON en Drive ──────────────────────────
function getRecords() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const iter   = folder.getFilesByName(FILE_NAME);
  if (iter.hasNext()) {
    const txt = iter.next().getBlob().getDataAsString('UTF-8');
    return txt ? JSON.parse(txt) : [];
  }
  return [];
}

// ── Escritura del archivo JSON en Drive ────────────────────────
function saveRecords(records) {
  const folder  = DriveApp.getFolderById(FOLDER_ID);
  const iter    = folder.getFilesByName(FILE_NAME);
  const content = JSON.stringify(records, null, 2);
  if (iter.hasNext()) {
    iter.next().setContent(content);
  } else {
    folder.createFile(FILE_NAME, content, MimeType.PLAIN_TEXT);
  }
}
