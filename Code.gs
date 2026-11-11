/**
 * Др. Шерматов — дорихоналар тармоғи
 * Google Sheets НУСХАСИ (v5). Асосий база энди Supabase'да.
 *
 * Бу скрипт ҳар 6 соатда Supabase'дан ҳамма маълумотни олиб, шу жадвалга ёзади:
 * Ҳаракатлар, Қолдиқ, филиал варақлари, Маҳсулотлар, Филиаллар, Докторлар, Фойдаланувчилар (PIN'сиз), Созламалар.
 *
 * ⚠ Жадвал — фақат кўриш ва заҳира учун. Бу ердаги ўзгариш сайтга тушмайди.
 *   Нарх, маҳсулот, филиал, врач ва PIN — сайтдаги «Созламалар» бўлимида ўзгартирилади.
 *
 * Биринчи марта: Дорихона → «Ҳар 6 соатда нусха олишни ёқиш» (Google рухсат сўрайди).
 */

const VERSION = '5';
const SB_URL = 'https://hfrfskwglwnbcaymzbad.supabase.co';
const SB_KEY = 'sb_publishable_I0CJDGavnnEzWGiTD2ri9Q_XAtDfW52';
const EXPORT_KEY = '__EXPORT_KEY__'; // экспорт калити (GitHub'да сақланмайди)
const TZ = 'Asia/Tashkent';
const EVERY_HOURS = 6;

const SH = {
  MOV: 'Ҳаракатлар', STOCK: 'Қолдиқ', PROD: 'Маҳсулотлар', BR: 'Филиаллар',
  DOC: 'Докторлар', USR: 'Фойдаланувчилар', SET: 'Созламалар',
};
const MOV_COLS = ['Ҳужжат №', 'Сана', 'Вақт', 'Тури', 'Филиал', 'Маҳсулот', 'Сони', 'Нарх', 'Сумма',
  'Мижоз Ф.И.Ш', 'Юборган врач', 'Қаерга', 'Ҳолат', 'Оператор', 'Изоҳ'];
const MOV_W = [80, 90, 60, 80, 110, 280, 60, 90, 100, 200, 150, 110, 70, 110, 260];

/* ───────── menyu ───────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Дорихона')
    .addItem('Ҳозир нусха олиш (Supabase → Sheets)', 'menuMirror')
    .addItem('Ҳар ' + EVERY_HOURS + ' соатда нусха олишни ёқиш', 'menuInstall')
    .addItem('Автоматик нусхани ўчириш', 'menuUninstall')
    .addToUi();
}

function menuMirror() {
  const r = mirror();
  SpreadsheetApp.getUi().alert('Тайёр: ' + r.rows + ' та қатор, ' + r.at + ' ҳолатига кўра.');
}

function menuInstall() {
  removeTriggers_();
  ScriptApp.newTrigger('mirror').timeBased().everyHours(EVERY_HOURS).create();
  const r = mirror();
  SpreadsheetApp.getUi().alert('Ёқилди: жадвал ҳар ' + EVERY_HOURS + ' соатда Supabase\'дан янгиланади.\nҲозир ' + r.rows + ' та қатор ёзилди.');
}

function menuUninstall() {
  removeTriggers_();
  SpreadsheetApp.getUi().alert('Автоматик нусха ўчирилди.');
}

function removeTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'mirror') ScriptApp.deleteTrigger(t);
  });
}

/* Эски сайт нусхаси шу манзилга мурожаат қилса — янгилашни сўраймиз */
function doGet() {
  return out_({ ok: true, app: 'shermatov-mirror', v: VERSION, note: 'Сайт энди Supabase базасида ишлайди' });
}
function doPost() {
  return out_({ ok: false, error: 'Тизим янгиланди — саҳифани янгиланг (Ctrl+Shift+R)' });
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ───────── nusxa ───────── */

function fetchExport_() {
  const res = UrlFetchApp.fetch(SB_URL + '/rest/v1/rpc/app', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: SB_KEY },
    payload: JSON.stringify({ req: { action: 'export', key: EXPORT_KEY } }),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  let j;
  try { j = JSON.parse(res.getContentText()); } catch (e) { j = null; }
  if (code !== 200 || !j) throw new Error('Supabase жавоби нотўғри (' + code + '): ' + res.getContentText().slice(0, 300));
  if (!j.ok) throw new Error(j.error || 'Экспорт хатоси');
  return j;
}

function mirror() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Нусха олиш аллақачон ишлаяпти');
  try {
    const d = fetchExport_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const st = function (on) { return on ? 'Фаол' : 'Ўчирилган'; };

    // Ҳаракатлар
    const rows = (d.rows || []).map(function (r) { return r.map(function (v) { return v == null ? '' : v; }); });
    write_(ss, SH.MOV, MOV_COLS, rows, { color: '#12382d', widths: MOV_W, text: 'A:C', num: 'G:I' });

    // Филиал варақлари
    const brs = (d.cfg.branches || []).map(function (b) { return b.name; });
    brs.forEach(function (b) {
      write_(ss, b, MOV_COLS, rows.filter(function (r) { return r[4] === b || r[11] === b; }),
        { color: '#1e9e63', widths: MOV_W, text: 'A:C', num: 'G:I' });
    });

    // Номи ўзгарган ёки ўчирилган филиалнинг эски варағини олиб ташлаш
    // (фақат шу скрипт яратган варақлар: сарлавҳаси «Ҳужжат №» … «Изоҳ»)
    ss.getSheets().forEach(function (s) {
      const n = s.getName();
      if (n === SH.MOV || brs.indexOf(n) >= 0 || s.getLastColumn() < MOV_COLS.length) return;
      const h = s.getRange(1, 1, 1, MOV_COLS.length).getValues()[0];
      if (h[0] === MOV_COLS[0] && h[MOV_COLS.length - 1] === MOV_COLS[MOV_COLS.length - 1] && ss.getSheets().length > 1) {
        ss.deleteSheet(s);
      }
    });

    // Қолдиқ
    const prods = d.cfg.products || [];
    const sRows = prods.map(function (p) {
      const q = brs.map(function (b) { return (d.stock[b] && d.stock[b][p.name]) || 0; });
      return [p.name].concat(q, [q.reduce(function (a, c) { return a + c; }, 0), p.min]);
    });
    const tot = ['Жами'];
    for (let i = 1; i <= brs.length + 1; i++) tot.push(sRows.reduce(function (a, r) { return a + r[i]; }, 0));
    tot.push('');
    const sh = write_(ss, SH.STOCK, ['Маҳсулот'].concat(brs, ['Жами', 'Минимал']), sRows.concat([tot]),
      { color: '#12382d', widths: [300] });
    if (sRows.length) {
      const w = brs.length + 3;
      sh.getRange(2, 1, sRows.length, w).setBackgrounds(sRows.map(function (r) {
        return r.map(function (v, i) {
          if (i === 0 || i > brs.length) return null;
          return v <= 0 ? '#fce9e7' : (v <= r[w - 1] ? '#fdf1dc' : null);
        });
      }));
      sh.getRange(sRows.length + 2, 1, 1, w).setFontWeight('bold').setBackground('#edf4ef');
      sh.setFrozenColumns(1);
    }

    // Маълумотномалар
    write_(ss, SH.PROD, ['Маҳсулот', 'Нарх', 'Бирлик', 'Минимал қолдиқ', 'Изоҳ', 'Ҳолат'],
      (d.products || []).map(function (p) { return [p.name, Number(p.price) || 0, p.unit, p.min, p.note, st(p.active)]; }),
      { color: '#334155', widths: [300, 100, 70, 120, 200, 90], num: 'B:B' });
    write_(ss, SH.BR, ['Филиал', 'Манзил', 'Телефон', 'Ҳолат'],
      (d.branches || []).map(function (b) { return [b.name, b.addr, b.phone, st(b.active)]; }),
      { color: '#334155', widths: [160, 280, 140, 90] });
    write_(ss, SH.DOC, ['Врач', 'Изоҳ', 'Ҳолат'],
      (d.doctors || []).map(function (x) { return [x.name, x.note, st(x.active)]; }),
      { color: '#334155', widths: [220, 220, 90] });
    write_(ss, SH.USR, ['Исм', 'Роль', 'Филиал', 'Ҳолат'],
      (d.users || []).map(function (u) { return [u.name, u.role === 'admin' ? 'админ' : 'сотувчи', u.branch, st(u.active)]; }),
      { color: '#334155', widths: [180, 100, 140, 90] });
    write_(ss, SH.SET, ['Созлама', 'Қиймат'], [
      ['Тармоқ номи', d.cfg.name],
      ['Валюта', d.cfg.currency],
      ['Охирги нусха', d.at],
      ['Манба', 'Supabase — «shermatov apteka»'],
      ['Диққат', 'Бу жадвал фақат нусха (ҳар ' + EVERY_HOURS + ' соатда янгиланади). Ўзгартириш — сайтдаги «Созламалар» бўлимида.'],
    ], { color: '#334155', widths: [160, 560] });

    // тартиб
    [SH.MOV, SH.STOCK].concat(brs, [SH.PROD, SH.BR, SH.DOC, SH.USR, SH.SET]).forEach(function (n, i) {
      const s = ss.getSheetByName(n);
      if (s) { ss.setActiveSheet(s); ss.moveActiveSheet(i + 1); }
    });
    ss.setActiveSheet(ss.getSheetByName(SH.MOV));
    return { rows: rows.length, at: d.at };
  } finally {
    lock.releaseLock();
  }
}

function write_(ss, name, header, rows, o) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  sh.getRange(1, 1, 1, header.length).setValues([header])
    .setFontWeight('bold').setFontColor('#ffffff').setBackground(o.color || '#334155');
  if (o.text) sh.getRange(o.text).setNumberFormat('@');
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  if (o.num) sh.getRange(o.num).setNumberFormat('#,##0');
  sh.setFrozenRows(1);
  (o.widths || []).forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  // тасодифан таҳрирлашдан огоҳлантириш
  const prot = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  if (!prot.length) sh.protect().setDescription('Supabase нусхаси — сайтдан ўзгартиринг').setWarningOnly(true);
  return sh;
}
