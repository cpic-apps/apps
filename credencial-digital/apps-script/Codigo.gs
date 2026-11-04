/**
 * CREDENCIAL DIGITAL CPIC — Apps Script
 * =====================================
 * Va en una Hoja de cálculo de Google NUEVA y vacía ("Credenciales CPIC"),
 * creada con la cuenta institucional. Extensiones → Apps Script → pegar este código.
 *
 * FUENTES (no se modifican, sólo se leen):
 *   - Base matriculado.xlsx  → hojas "Base" (un registro por Código SN) y "Titulos"
 *   - Estados CPIC.xlsx      → traduce Estado SAP → Estado Credencial
 *   - Carpeta de fotos       → archivos "{Código SN}_foto.jpg" (mayúsculas o minúsculas)
 *
 * QUÉ HACE:
 *   1) "Sincronizar" lee las tres fuentes y arma la hoja "Credenciales" (una fila por
 *      registro de la Base). Los códigos de cada persona se CONSERVAN entre
 *      sincronizaciones: el link y el QR no cambian aunque se actualice la Base.
 *   2) Responde a las páginas de GitHub Pages:
 *        ?accion=credencial&cod=CODIGO → datos + foto (credencial personal)
 *        ?accion=verificar&v=CODIGO    → datos mínimos (página pública del QR)
 *   3) Acceso del profesional: en la página de la credencial carga Matrícula + Registro + DNI
 *        (?accion=acceso) y, si coinciden, recibe su código personal. No se envían correos.
 *   4) Menú "Credenciales" para sincronizar, ver el link de una persona y anular credenciales.
 *
 * REQUISITO: en el editor de Apps Script, "Servicios" (+) → agregar "Drive API" (v3).
 */

// ───────────────────────── CONFIGURACIÓN ─────────────────────────
const CONFIG = {
  ID_BASE: '1jF9WV9HD3ZWtdiSMnBy_1tznrJz84NIv',        // Base matriculado.xlsx
  ID_ESTADOS: '1LdkuEpZgcIV5PTIbVzNiQVk5f604fOMM',     // Estados CPIC.xlsx
  ID_CARPETA_FOTOS: '1s4bKpS7MNUabBTJpy0VPG3t08tZQhI-1',
  URL_CREDENCIAL: 'https://cpic-apps.github.io/apps/credencial/',
  ZONA_HORARIA: 'America/Argentina/Buenos_Aires',
  INTENTOS_MAX: 5,                 // intentos fallidos de ingreso por matrícula antes de bloquear
  MINUTOS_BLOQUEO: 30,
  HORA_SINCRONIZACION: 6,          // sincronización automática diaria (hora local)
  ESTADO_SI_NO_FIGURA: 'No Activo', // para estados SAP que no están en Estados CPIC.xlsx
  // Valores de "Estado Credencial" que dan una credencial VÁLIDA. Cualquier otro valor se muestra
  // como "MATRÍCULA NO ACTIVA" y queda avisado en la pestaña Revisar si no es No Activo / Fallecido.
  ESTADOS_VIGENTES: ['Activo', 'Vitalicio', 'Adherente'],
  // Estados SAP que faltan en Estados CPIC.xlsx (si después se agregan al Excel, manda lo del Excel).
  ESTADOS_EXTRA: {},
  // Estados SAP que se muestran siempre así, aunque el Excel diga otra cosa.
  ESTADOS_FIJOS: {
    NF: { detalle: 'Fallecido', cred: 'Fallecido' },
  },
};
// ─────────────────────────────────────────────────────────────────

const HOJA = 'Credenciales';
const HOJA_REVISAR = 'Revisar';
const ENC = ['Código SN', 'Matrícula', 'Registro', 'Apellido', 'Nombre', 'DNI', 'Título', 'Otorgado por',
  'Fecha Título', 'Fecha Matriculación', 'Estado SAP', 'Detalle Estado', 'Estado Credencial',
  'ID Foto', 'Código Credencial', 'Código Verificación'];
const C = {}; ENC.forEach((h, i) => C[h] = i);          // índice de cada columna
let ZONA_ORIGEN = null;   // zona horaria del Excel convertido (para no correr las fechas un día)

// ══════════════════ 1) RESPUESTA A LAS PÁGINAS ══════════════════

function doGet(e) {
  const p = (e && e.parameter) || {};
  let r;
  try {
    // Ojo: "c" y "sid" son parámetros reservados por Apps Script; por eso el código va en "cod".
    if (p.accion === 'credencial') r = respuestaCredencialSinFoto_(p.cod);
    else if (p.accion === 'verificar') r = conCache_('v', p.v, () => respuestaVerificar_(p.v));
    else if (p.accion === 'acceso') r = respuestaAcceso_(p.m, p.r, p.d);
    else r = { ok: false, error: 'accion_invalida' };
  } catch (err) {
    console.error(err);
    r = { ok: false, error: 'error_interno' };
  }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

/** Caché corta de respuestas: reduce lecturas de la hoja cuando muchos consultan a la vez. */
function conCache_(tipo, codigo, calcular) {
  const cache = CacheService.getScriptCache();
  const clave = tipo + '_' + versionDatos_() + '_' + txt_(codigo).toUpperCase();
  const g = cache.get(clave);
  if (g) return JSON.parse(g);
  const r = calcular();
  const s = JSON.stringify(r);
  if (s.length < 99000) cache.put(clave, s, 600);       // 10 minutos
  return r;
}

function versionDatos_() {
  return PropertiesService.getScriptProperties().getProperty('versionDatos') || '0';
}

function nuevaVersionDatos_() {
  PropertiesService.getScriptProperties().setProperty('versionDatos', String(Date.now()));
}

function respuestaCredencial_(codigo) {
  const f = buscar_('Código Credencial', codigo);
  if (!f) return { ok: false, error: 'no_encontrado' };
  return {
    ok: true,
    matricula: txt_(f[C['Matrícula']]),
    registro: txt_(f[C['Registro']]),
    apellido: txt_(f[C['Apellido']]).toUpperCase(),
    nombre: txt_(f[C['Nombre']]),
    dni: txt_(f[C['DNI']]),
    titulo: txt_(f[C['Título']]),
    institucion: txt_(f[C['Otorgado por']]),
    fechaTitulo: fecha_(f[C['Fecha Título']]),
    fechaInscripcion: fecha_(f[C['Fecha Matriculación']]),
    estadoCredencial: estadoParaPagina_(f[C['Estado Credencial']]),
    estadoDetalle: txt_(f[C['Detalle Estado']]),
    idFoto: txt_(f[C['ID Foto']]),
    codigoVerificacion: txt_(f[C['Código Verificación']]),
  };
}

/** Datos en caché; la foto se agrega aparte (tiene su propia caché de 6 h). */
function respuestaCredencialSinFoto_(codigo) {
  const r = conCache_('c', codigo, () => respuestaCredencial_(codigo));
  if (!r.ok) return r;
  const salida = Object.assign({}, r, { foto: foto_(r.idFoto) });
  delete salida.idFoto;
  return salida;
}

function respuestaVerificar_(codigo) {
  const f = buscar_('Código Verificación', codigo);
  if (!f) return { ok: true, encontrado: false };
  // Lo mínimo: sin DNI, sin foto, sin correo.
  return {
    ok: true, encontrado: true,
    apellido: txt_(f[C['Apellido']]).toUpperCase(),
    nombre: txt_(f[C['Nombre']]),
    matricula: txt_(f[C['Matrícula']]),
    registro: txt_(f[C['Registro']]),
    titulo: txt_(f[C['Título']]),
    estadoCredencial: estadoParaPagina_(f[C['Estado Credencial']]),
    estadoDetalle: txt_(f[C['Detalle Estado']]),
  };
}

/**
 * Ingreso del profesional: Matrícula + Registro (U/T) + DNI deben coincidir con la Base.
 * Devuelve sólo su código personal. Tras varios intentos fallidos sobre la misma
 * matrícula, se bloquea un rato para impedir que se prueben DNI al azar.
 */
function respuestaAcceso_(mat, reg, dni) {
  mat = txt_(mat).replace(/\D/g, '').replace(/^0+/, '');
  reg = txt_(reg).toUpperCase().charAt(0);              // U o T
  dni = formatoDni_(dni).replace(/\D/g, '');
  if (!mat || !/^[UT]$/.test(reg) || dni.length < 6) return { ok: false, error: 'datos_incompletos' };

  const cache = CacheService.getScriptCache();
  const clave = 'acc_' + reg + mat;
  const fallas = Number(cache.get(clave) || 0);
  if (fallas >= CONFIG.INTENTOS_MAX) return { ok: false, error: 'bloqueado', minutos: CONFIG.MINUTOS_BLOQUEO };

  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJA);
  let encontrado = null;
  if (hoja && hoja.getLastRow() > 1) {
    const celdas = hoja.getRange(2, C['Matrícula'] + 1, hoja.getLastRow() - 1, 1)
      .createTextFinder(mat).matchEntireCell(true).findAll();
    const registro = reg === 'U' ? 'universitario' : 'técnico';
    for (const celda of celdas) {
      const f = hoja.getRange(celda.getRow(), 1, 1, ENC.length).getValues()[0];
      if (txt_(f[C['Registro']]).toLowerCase() !== registro) continue;
      if (txt_(f[C['DNI']]).replace(/\D/g, '').replace(/^0+/, '') !== dni) continue;
      encontrado = f; break;
    }
  }
  if (!encontrado) {
    cache.put(clave, String(fallas + 1), CONFIG.MINUTOS_BLOQUEO * 60);
    return { ok: false, error: 'no_coincide', restantes: Math.max(CONFIG.INTENTOS_MAX - fallas - 1, 0) };
  }
  cache.remove(clave);
  if (/^fallecido$/i.test(txt_(encontrado[C['Estado Credencial']]))) return { ok: false, error: 'no_disponible' };
  const cod = txt_(encontrado[C['Código Credencial']]);
  if (!cod) return { ok: false, error: 'no_disponible' };
  return { ok: true, c: cod };
}

/** Busca un código exacto con TextFinder (rápido aunque haya 30.000 filas). */
function buscar_(columna, codigo) {
  codigo = txt_(codigo).toUpperCase();
  if (!/^[A-Z0-9-]{8,20}$/.test(codigo)) return null;
  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJA);
  if (!hoja || hoja.getLastRow() < 2) return null;
  const col = C[columna] + 1;
  const celda = hoja.getRange(2, col, hoja.getLastRow() - 1, 1)
    .createTextFinder(codigo).matchEntireCell(true).matchCase(true).findNext();
  if (!celda) return null;
  return hoja.getRange(celda.getRow(), 1, 1, ENC.length).getValues()[0];
}

function foto_(idArchivo) {
  if (!idArchivo) return '';
  const cache = CacheService.getScriptCache();
  const guardada = cache.get('f_' + idArchivo);
  if (guardada) return guardada;
  try {
    const blob = DriveApp.getFileById(idArchivo).getBlob();
    const url = 'data:' + (blob.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(blob.getBytes());
    if (url.length < 99000) cache.put('f_' + idArchivo, url, 21600);
    return url;
  } catch (e) {
    console.warn('Foto no accesible: ' + idArchivo);
    return '';
  }
}

// ══════════════════ 2) SINCRONIZACIÓN CON LA BASE SAP ══════════════════

function sincronizar() {
  const t0 = Date.now();
  const res = sincronizar_();
  const msg = 'Sincronización terminada en ' + Math.round((Date.now() - t0) / 1000) + ' s.\n\n' +
    '• Credenciales en la hoja: ' + res.total + '\n' +
    '• Activos: ' + res.activos + ' · Vitalicios: ' + res.vitalicios + ' · Adherentes: ' + res.adherentes + ' · No activos: ' + res.noActivos + ' · Fallecidos: ' + res.fallecidos + '\n' +
    '• Credenciales nuevas en esta sincronización: ' + res.nuevos + '\n' +
    '• Sin foto en la carpeta: ' + res.sinFoto + '\n' +
    (res.revisar ? '\n⚠ ' + res.revisar + ' casos para revisar en la pestaña "' + HOJA_REVISAR + '".' : '');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }
}

function sincronizar_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // --- Fuentes ---
    const libroBase = abrirExcel_(CONFIG.ID_BASE);
    const libroEst = abrirExcel_(CONFIG.ID_ESTADOS);
    let base, titulos, estados;
    try {
      ZONA_ORIGEN = libroBase.ss.getSpreadsheetTimeZone() || CONFIG.ZONA_HORARIA;
      base = tablaPorEncabezado_(libroBase.ss.getSheetByName('Base'));
      titulos = tablaPorEncabezado_(libroBase.ss.getSheetByName('Titulos'));
      estados = tablaPorEncabezado_(libroEst.ss.getSheets()[0]);
    } finally {
      libroBase.borrar(); libroEst.borrar();
    }

    // Estado SAP → { detalle, credencial }
    const mapaEst = {};
    Object.keys(CONFIG.ESTADOS_EXTRA || {}).forEach(k => mapaEst[k.toUpperCase()] = CONFIG.ESTADOS_EXTRA[k]);
    estados.filas.forEach(f => {
      const cod = txt_(f[estados.col('Estado SAP')]).toUpperCase();
      if (cod) mapaEst[cod] = { detalle: txt_(f[estados.col('Detalle')]), cred: txt_(f[estados.col('Estado Credencial')]) };
    });
    Object.keys(CONFIG.ESTADOS_FIJOS || {}).forEach(k => mapaEst[k.toUpperCase()] = CONFIG.ESTADOS_FIJOS[k]);

    // Título a mostrar por Código SN: el Predeterminado = SI (si hay más de uno, el "Título de Grado")
    const mapaTit = {};
    titulos.filas.forEach(f => {
      const sn = txt_(f[titulos.col('Código SN')]);
      if (!sn || txt_(f[titulos.col('Predeterminado')]).toUpperCase() !== 'SI') return;
      const t = { titulo: txt_(f[titulos.col('Titulo')]), emisor: txt_(f[titulos.col('Emisor')]),
                  fecha: f[titulos.col('Fecha')], tipo: txt_(f[titulos.col('Tipo')]) };
      if (!mapaTit[sn] || (mapaTit[sn].tipo !== 'Título de Grado' && t.tipo === 'Título de Grado')) mapaTit[sn] = t;
    });

    const fotos = indiceFotos_();

    // Lo que ya existe (para conservar los códigos de cada persona)
    const hoja = hojaCredenciales_();
    const previo = {};
    if (hoja.getLastRow() > 1) {
      hoja.getRange(2, 1, hoja.getLastRow() - 1, ENC.length).getValues().forEach(f => {
        previo[txt_(f[C['Código SN']])] = f;
      });
    }
    const usados = new Set();
    Object.keys(previo).forEach(sn => {
      usados.add(txt_(previo[sn][C['Código Credencial']])); usados.add(txt_(previo[sn][C['Código Verificación']]));
    });

    const salida = [], revisar = [];
    const res = { total: 0, activos: 0, adherentes: 0, vitalicios: 0, noActivos: 0, fallecidos: 0, nuevos: 0, sinFoto: 0, revisar: 0 };
    const b = n => base.col(n);

    base.filas.forEach(f => {
      const sn = txt_(f[b('Código SN')]);
      const mat = txt_(f[b('Matricula')]);
      if (!sn) return;
      if (!mat) revisar.push([sn, '', nombreSN_(f, b), 'Sin número de matrícula: la credencial se genera con la matrícula vacía']);
      const estSap = txt_(f[b('Estado CPIC')]).toUpperCase();
      let est = mapaEst[estSap];
      if (!est) {
        est = { detalle: estSap ? 'Estado ' + estSap : 'Sin estado', cred: CONFIG.ESTADO_SI_NO_FIGURA };
        revisar.push([sn, mat, nombreSN_(f, b), 'Estado SAP "' + (estSap || 'vacío') + '" no figura en Estados CPIC.xlsx']);
      }
      const t = mapaTit[sn] || {};
      const vigente = esVigente_(est.cred);
      if (!vigente && !/^(no activo|fallecido)$/i.test(est.cred))
        revisar.push([sn, mat, nombreSN_(f, b), 'Estado Credencial "' + est.cred + '" no reconocido: se muestra como No Activo']);
      const ant = previo[sn];
      let codC = ant ? txt_(ant[C['Código Credencial']]) : '';
      let codV = ant ? txt_(ant[C['Código Verificación']]) : '';
      // Se genera credencial para TODOS los registros de la Base (el estado se muestra en la credencial)
      if (!codC) { codC = nuevoCodigo_(12, usados); res.nuevos++; }
      if (!codV) codV = nuevoCodigo_(8, usados);
      const idFoto = fotos[sn] || '';

      if (!idFoto) res.sinFoto++;
      if (vigente) {
        if (!t.titulo) revisar.push([sn, mat, nombreSN_(f, b), 'Sin título predeterminado en la hoja Titulos']);
        if (!txt_(f[b('Apellido')])) revisar.push([sn, mat, nombreSN_(f, b), 'Sin Apellido/Nombre separados (se usa Nombre SN)']);
        const largoDni = formatoDni_(f[b('ID fiscal federal unificado')]).replace(/\D/g, '').length;
        if (largoDni < 6) revisar.push([sn, mat, nombreSN_(f, b), 'DNI vacío o incompleto: no podrá ingresar a su credencial']);
        else if (largoDni > 8) revisar.push([sn, mat, nombreSN_(f, b), 'DNI de más de 8 dígitos: verificar (deberá ingresarlo tal cual)']);
        if (/[0-9_]/.test(txt_(f[b('Apellido')]) + txt_(f[b('Nombre')])))
          revisar.push([sn, mat, nombreSN_(f, b), 'Apellido o nombre con números o símbolos']);
      }
      if (/^activo$/i.test(est.cred)) res.activos++;
      else if (/^vitalicio$/i.test(est.cred)) res.vitalicios++;
      else if (/^adherente$/i.test(est.cred)) res.adherentes++;
      else if (/^fallecido$/i.test(est.cred)) res.fallecidos++;
      else res.noActivos++;

      let ape = txt_(f[b('Apellido')]).replace(/\s+/g, ' '), nom = txt_(f[b('Nombre')]).replace(/\s+/g, ' ');
      if (!ape) { ape = txt_(f[b('Nombre SN')]).replace(/\s+/g, ' '); nom = ''; }

      const fila = new Array(ENC.length).fill('');
      fila[C['Código SN']] = sn;
      fila[C['Matrícula']] = mat;
      fila[C['Registro']] = { U: 'Universitario', T: 'Técnico' }[txt_(f[b('Tipo de Graduación')]).toUpperCase()] || txt_(f[b('Tipo de Graduación')]);
      fila[C['Apellido']] = ape.toUpperCase();
      fila[C['Nombre']] = nombrePropio_(nom);
      fila[C['DNI']] = formatoDni_(f[b('ID fiscal federal unificado')]);
      fila[C['Título']] = t.titulo || '';
      fila[C['Otorgado por']] = t.emisor || '';
      fila[C['Fecha Título']] = fecha_(t.fecha || f[b('Fecha del Título')]);
      fila[C['Fecha Matriculación']] = fecha_(f[b('Fecha de Alta')]);
      fila[C['Estado SAP']] = estSap;
      fila[C['Detalle Estado']] = est.detalle;
      fila[C['Estado Credencial']] = est.cred;
      fila[C['ID Foto']] = idFoto;
      fila[C['Código Credencial']] = codC;
      fila[C['Código Verificación']] = codV;
      salida.push(fila);
    });

    // Personas que tenían credencial y ya no están en la Base: se conservan como No Activo
    const enBase = new Set(salida.map(f => f[C['Código SN']]));
    Object.keys(previo).forEach(sn => {
      if (enBase.has(sn) || !txt_(previo[sn][C['Código Credencial']])) return;
      const f = previo[sn].slice();
      f[C['Estado Credencial']] = 'No Activo'; f[C['Detalle Estado']] = 'No figura en la Base';
      salida.push(f);
      revisar.push([sn, txt_(f[C['Matrícula']]), txt_(f[C['Apellido']]), 'Tenía credencial y ya no figura en la Base']);
    });

    res.total = salida.length;
    res.revisar = revisar.length;
    escribir_(hoja, salida);
    nuevaVersionDatos_();
    escribirRevisar_(revisar);
    PropertiesService.getScriptProperties().setProperty('ultimaSync', new Date().toISOString());
    return res;
  } finally {
    lock.releaseLock();
  }
}

/** Convierte un .xlsx de Drive a una Hoja de Google temporal para poder leerlo. */
function abrirExcel_(id) {
  const archivo = DriveApp.getFileById(id);
  const mime = archivo.getMimeType();
  if (mime === MimeType.GOOGLE_SHEETS) return { ss: SpreadsheetApp.openById(id), borrar: () => {} };
  const tmp = Drive.Files.create(
    { name: '_tmp_credenciales_' + archivo.getName(), mimeType: MimeType.GOOGLE_SHEETS },
    archivo.getBlob(), { supportsAllDrives: true });
  return {
    ss: SpreadsheetApp.openById(tmp.id),
    borrar: () => { try { DriveApp.getFileById(tmp.id).setTrashed(true); } catch (e) {} }
  };
}

function tablaPorEncabezado_(hoja) {
  if (!hoja) throw new Error('No se encontró una de las hojas de origen (Base / Titulos / Estados).');
  const v = hoja.getDataRange().getValues();
  const enc = v[0].map(normalizar_);
  return {
    filas: v.slice(1),
    col: nombre => {
      const i = enc.indexOf(normalizar_(nombre));
      if (i < 0) throw new Error('Falta la columna "' + nombre + '" en la hoja "' + hoja.getName() + '"');
      return i;
    }
  };
}

/** Código SN → ID del archivo de foto. Acepta _foto / _FOTO, .jpg / .jpeg / .png. */
function indiceFotos_() {
  const mapa = {};
  const it = DriveApp.getFolderById(CONFIG.ID_CARPETA_FOTOS).getFiles();
  while (it.hasNext()) {
    const f = it.next();
    const m = f.getName().match(/^\s*([A-Za-z0-9]+)\s*_\s*foto\s*\.(jpe?g|png)$/i);
    if (!m) continue;
    const sn = m[1];
    // si hay dos fotos del mismo SN, queda la más reciente
    if (!mapa[sn] || f.getLastUpdated() > mapa[sn].fecha) mapa[sn] = { id: f.getId(), fecha: f.getLastUpdated() };
  }
  const salida = {};
  Object.keys(mapa).forEach(k => salida[k] = mapa[k].id);
  return salida;
}

function hojaCredenciales_() {
  const ss = SpreadsheetApp.getActive();
  let h = ss.getSheetByName(HOJA);
  if (!h) {
    h = ss.insertSheet(HOJA, 0);
    h.getRange(1, 1, 1, ENC.length).setValues([ENC]).setFontWeight('bold').setBackground('#05785b').setFontColor('#ffffff');
    h.setFrozenRows(1); h.setFrozenColumns(2);
  }
  return h;
}

/**
 * Escribe todo como TEXTO (para que Sheets no convierta DNI, códigos o fechas) y sobrescribe
 * en el lugar, sin borrar antes: así las consultas que llegan durante la sincronización
 * nunca encuentran la hoja vacía. Sólo se borran las filas sobrantes del final.
 */
function escribir_(hoja, filas) {
  const ultima = hoja.getLastRow();
  if (filas.length) {
    if (hoja.getMaxRows() < filas.length + 1) hoja.insertRowsAfter(hoja.getMaxRows(), filas.length + 1 - hoja.getMaxRows());
    const rango = hoja.getRange(2, 1, filas.length, ENC.length);
    rango.setNumberFormat('@');
    rango.setValues(filas.map(f => f.map(v => v instanceof Date ? fecha_(v) : txt_(v))));
  }
  const sobrantes = ultima - 1 - filas.length;
  if (sobrantes > 0) hoja.getRange(filas.length + 2, 1, sobrantes, ENC.length).clearContent();
  SpreadsheetApp.flush();
}

function escribirRevisar_(filas) {
  const ss = SpreadsheetApp.getActive();
  let h = ss.getSheetByName(HOJA_REVISAR) || ss.insertSheet(HOJA_REVISAR);
  h.clear();
  h.getRange(1, 1, 1, 4).setValues([['Código SN', 'Matrícula', 'Nombre', 'Qué revisar']]).setFontWeight('bold');
  if (filas.length) h.getRange(2, 1, filas.length, 4).setValues(filas);
}

// ══════════════════ 3) MENÚ ══════════════════

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Credenciales')
    .addItem('Sincronizar ahora con la Base SAP', 'sincronizar')
    .addItem('Programar sincronización diaria', 'programarSincronizacion')
    .addSeparator()
    .addItem('Ver link personal de la fila seleccionada', 'verLinkSeleccionado')
    .addSeparator()
    .addItem('Anular y regenerar credenciales seleccionadas', 'regenerarSeleccionados')
    .addToUi();
}

function programarSincronizacion() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sincronizarAutomatico')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sincronizarAutomatico').timeBased().everyDays(1).atHour(CONFIG.HORA_SINCRONIZACION)
    .inTimezone(CONFIG.ZONA_HORARIA).create();
  SpreadsheetApp.getUi().alert('Listo: se sincronizará todos los días alrededor de las ' + CONFIG.HORA_SINCRONIZACION + ' h.');
}

function sincronizarAutomatico() { console.log(JSON.stringify(sincronizar_())); }

function verLinkSeleccionado() {
  const ui = SpreadsheetApp.getUi();
  const filas = filasSeleccionadas_();
  if (!filas.length) return ui.alert('Seleccioná una fila en la pestaña "' + HOJA + '".');
  const f = filaHoja_(filas[0]);
  const cod = txt_(f[C['Código Credencial']]);
  if (!cod) return ui.alert('Esa fila todavía no tiene credencial. Ejecutá "Sincronizar ahora".');
  ui.alert(txt_(f[C['Apellido']]) + ', ' + txt_(f[C['Nombre']]), linkPersonal_(cod), ui.ButtonSet.OK);
}

function regenerarSeleccionados() {
  const ui = SpreadsheetApp.getUi();
  const filas = filasSeleccionadas_();
  if (!filas.length) return ui.alert('Seleccioná al menos una fila en la pestaña "' + HOJA + '".');
  if (ui.alert('Anular credenciales', 'Se anularán ' + filas.length + ' credencial(es): sus links y QR actuales dejarán ' +
      'de funcionar. El profesional vuelve a ingresar con sus datos y obtiene la nueva. ¿Continuar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const h = hojaCredenciales_();
  const todos = h.getRange(2, C['Código Credencial'] + 1, Math.max(h.getLastRow() - 1, 1), 2).getValues();
  const usados = new Set(); todos.forEach(r => { usados.add(txt_(r[0])); usados.add(txt_(r[1])); });
  filas.forEach(nf => {
    h.getRange(nf, C['Código Credencial'] + 1, 1, 2).setValues([[nuevoCodigo_(12, usados), nuevoCodigo_(8, usados)]]);
  });
  SpreadsheetApp.flush();
  nuevaVersionDatos_();
  ui.alert('Credenciales regeneradas.');
}

// ══════════════════ APOYO ══════════════════

function filasSeleccionadas_() {
  const hoja = SpreadsheetApp.getActive().getActiveSheet();
  if (hoja.getName() !== HOJA) return [];
  const s = new Set();
  const lista = hoja.getActiveRangeList();
  if (!lista) return [];
  lista.getRanges().forEach(r => { for (let f = r.getRow(); f < r.getRow() + r.getNumRows(); f++) if (f >= 2) s.add(f); });
  return Array.from(s);
}

function filaHoja_(nf) { return hojaCredenciales_().getRange(nf, 1, 1, ENC.length).getValues()[0]; }

/** Código aleatorio sin caracteres confundibles (0/O, 1/I/L), en grupos de 4. */
function nuevoCodigo_(largo, usados) {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c;
  do {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
    c = '';
    for (let i = 0; i < largo; i++) c += abc[(bytes[i] + 256) % abc.length];
    c = c.match(/.{1,4}/g).join('-');
  } while (usados.has(c));
  usados.add(c);
  return c;
}

function esVigente_(cred) {
  const c = txt_(cred).toLowerCase();
  return (CONFIG.ESTADOS_VIGENTES || []).some(v => v.toLowerCase() === c);
}

/** Valor de "Estado Credencial" tal como lo entienden las páginas (Activo, Vitalicio, Adherente, Fallecido o No Activo). */
function estadoParaPagina_(cred) {
  const c = txt_(cred);
  if (esVigente_(c) || /^fallecido$/i.test(c)) return c;
  return 'No Activo';
}

function linkPersonal_(cod) { return CONFIG.URL_CREDENCIAL + '?c=' + encodeURIComponent(cod); }

function nombreSN_(f, b) { return txt_(f[b('Nombre SN')]); }

function nombrePropio_(s) {
  const menores = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'di', 'van', 'von'];
  return txt_(s).toLowerCase().split(/\s+/).filter(Boolean).map((p, i) =>
    (i > 0 && menores.indexOf(p) >= 0) ? p : p.replace(/(^|[-'’])(\p{L})/gu, (m, a, l) => a + l.toUpperCase())
  ).join(' ');
}


function formatoDni_(v) {
  let s = String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
  if (s.length === 11 && /^(20|23|24|27|30|33|34)/.test(s)) s = s.slice(2, 10);   // CUIT/CUIL → DNI
  s = s.replace(/^0+/, '');
  return s ? s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
}

function txt_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return fecha_(v);
  if (typeof v === 'number') return String(v);
  return String(v).trim();
}

function fecha_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, ZONA_ORIGEN || CONFIG.ZONA_HORARIA, 'dd/MM/yyyy');
  return v ? String(v).trim() : '';
}

function normalizar_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

