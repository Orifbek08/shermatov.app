/**
 * Др. Шерматов — дорихоналар тармоғи
 * Server: Google Apps Script (Web App). Ма'lumotlar bazasi — шу Google Sheets жадвали.
 *
 * Varaqlar o'zi yaratiladi (birinchi so'rovda yoki menyudan «Ўрнатиш / янгилаш»).
 * Eski ma'lumot o'chirilmaydi, faqat yetishmagan varaq/ustun qo'shiladi.
 */

// Baza: «Др Шерматов аптека» — https://docs.google.com/spreadsheets/d/1Q-2g08ceeG_8CHRrpZ0opwXYOcKcX8NYUtnFXSk0ZdI
const SPREADSHEET_ID = '1Q-2g08ceeG_8CHRrpZ0opwXYOcKcX8NYUtnFXSk0ZdI';
const VERSION = '1';
const SCHEMA = '1';
const TZ = 'Asia/Tashkent';

const SH = {
  MOV: 'Ҳаракатлар',
  STOCK: 'Қолдиқ',
  PROD: 'Маҳсулотлар',
  BR: 'Филиаллар',
  DOC: 'Докторлар',
  USR: 'Фойдаланувчилар',
  SET: 'Созламалар',
};

const MOV_COLS = ['Ҳужжат №', 'Сана', 'Вақт', 'Тури', 'Филиал', 'Маҳсулот', 'Сони', 'Нарх', 'Сумма',
  'Мижоз Ф.И.Ш', 'Юборган врач', 'Қаерга', 'Ҳолат', 'Оператор', 'Изоҳ', 'rid'];
const I = { DOC: 0, DATE: 1, TIME: 2, TYPE: 3, BR: 4, PROD: 5, QTY: 6, PRICE: 7, SUM: 8, CLIENT: 9,
  DOCTOR: 10, TO: 11, STATUS: 12, OP: 13, NOTE: 14, RID: 15 };
const NC = MOV_COLS.length;

const T = { IN: 'Приход', OUT: 'Расход', TR: 'Ўтказма' };
const PREFIX = { 'Приход': 'П', 'Расход': 'С', 'Ўтказма': 'Ў' };
const ST = { OK: 'Фаол', CANCEL: 'Бекор' };

const PROD_COLS = ['Маҳсулот', 'Нарх', 'Бирлик', 'Минимал қолдиқ', 'Изоҳ'];
const PROD_SEED = [
  ['Омега-3 1000 мг (60 капсула)', 85000, 'дона', 5, 'БАД'],
  ['Витамин D3 2000 МЕ (60 таблетка)', 65000, 'дона', 5, 'БАД'],
  ['Магний B6 (50 таблетка)', 55000, 'дона', 5, 'БАД'],
  ['Цинк + Витамин C (30 таблетка)', 45000, 'дона', 5, 'БАД'],
  ['Коллаген + Гиалурон кислота (30 саше)', 120000, 'дона', 3, 'БАД'],
];
const BR_COLS = ['Филиал', 'Манзил', 'Телефон'];
const BR_SEED = [['1-филиал', '', ''], ['2-филиал', '', ''], ['3-филиал', '', ''], ['4-филиал', '', ''], ['5-филиал', '', '']];
const DOC_COLS = ['Врач', 'Изоҳ'];
const DOC_SEED = [['Др. Шерматов', '']];
const USR_COLS = ['Исм', 'PIN', 'Роль', 'Филиал'];
const USR_SEED = [
  ['Админ', '1234', 'админ', ''],
  ['Сотувчи 1', '1111', 'сотувчи', '1-филиал'],
  ['Сотувчи 2', '2222', 'сотувчи', '2-филиал'],
  ['Сотувчи 3', '3333', 'сотувчи', '3-филиал'],
  ['Сотувчи 4', '4444', 'сотувчи', '4-филиал'],
  ['Сотувчи 5', '5555', 'сотувчи', '5-филиал'],
];
const SET_COLS = ['Созлама', 'Қиймат'];
const SET_SEED = [['Тармоқ номи', 'Др. Шерматов дорихоналари'], ['Валюта', 'сўм']];
const CFG_SHEETS = [SH.PROD, SH.BR, SH.DOC, SH.USR, SH.SET];

/* ───────────────────────────── HTTP ───────────────────────────── */

function doGet() {
  try {
    const ss = ss_();
    ensure_(ss);
    return out_({ ok: true, app: 'shermatov', v: VERSION, sheet: ss.getName() });
  } catch (err) {
    return out_({ ok: false, error: msg_(err), v: VERSION });
  }
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return out_({ ok: false, error: 'Нотўғри сўров' });
  }
  try {
    return out_(handle_(req));
  } catch (err) {
    return out_({ ok: false, error: msg_(err) });
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function msg_(err) {
  return String((err && err.message) || err);
}

function fail_(m) {
  throw new Error(m);
}

function handle_(req) {
  const ss = ss_();
  ensure_(ss);
  const cfg = getCfg_(ss);
  const a = String(req.action || '');
  if (a === 'login') return login_(ss, cfg, req);
  if (a === 'ping') return { ok: true, v: VERSION };

  const user = checkToken_(req.t, cfg);
  if (!user) return { ok: false, auth: true, error: 'Сеанс тугади — қайта киринг' };

  switch (a) {
    case 'boot':
      return Object.assign({ ok: true, user: pubUser_(user), cfg: pubCfg_(cfg) }, state_(ss, cfg, user));
    case 'sync':
      return sync_(ss, cfg, user, req);
    case 'sale':
      return write_(ss, cfg, user, req, function () { return sale_(ss, cfg, user, req); });
    case 'income':
      return write_(ss, cfg, user, req, function () { return income_(ss, cfg, user, req); });
    case 'transfer':
      return write_(ss, cfg, user, req, function () { return transfer_(ss, cfg, user, req); });
    case 'cancel':
      return write_(ss, cfg, user, req, function () { return cancel_(ss, cfg, user, req); });
    case 'history':
      return history_(ss, cfg, user, req);
    case 'report':
      if (user.role !== 'admin') fail_('Фақат админ учун');
      return report_(ss, cfg, req);
    default:
      fail_('Номаълум амал: ' + a);
  }
}

/* ───────────────────────────── Jadval ───────────────────────────── */

function ss_() {
  const a = SpreadsheetApp.getActiveSpreadsheet();
  if (a && (!SPREADSHEET_ID || a.getId() === SPREADSHEET_ID)) return a;
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('ssId');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* yangisini yaratamiz */ }
  }
  const s = SpreadsheetApp.create('Др. Шерматов — дорихоналар базаси');
  p.setProperty('ssId', s.getId());
  return s;
}

function ensure_(ss, force) {
  const p = PropertiesService.getScriptProperties();
  if (!force && p.getProperty('schema') === SCHEMA) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!force && p.getProperty('schema') === SCHEMA) return;
    const existing = ss.getSheets();

    const mov = sheet_(ss, SH.MOV, MOV_COLS, null, '#0f766e');
    mov.getRange('A:C').setNumberFormat('@');
    mov.getRange('G:I').setNumberFormat('#,##0');
    mov.hideColumns(I.RID + 1);
    widths_(mov, [90, 90, 60, 80, 100, 260, 60, 90, 100, 200, 150, 100, 70, 110, 220]);

    sheet_(ss, SH.STOCK, ['Маҳсулот'], null, '#0f766e');
    const prod = sheet_(ss, SH.PROD, PROD_COLS, PROD_SEED, '#334155');
    prod.getRange('B:B').setNumberFormat('#,##0');
    widths_(prod, [300, 100, 70, 120, 200]);
    widths_(sheet_(ss, SH.BR, BR_COLS, BR_SEED, '#334155'), [160, 260, 140]);
    widths_(sheet_(ss, SH.DOC, DOC_COLS, DOC_SEED, '#334155'), [220, 220]);
    const usr = sheet_(ss, SH.USR, USR_COLS, null, '#334155');
    usr.getRange('B:B').setNumberFormat('@');
    if (usr.getLastRow() < 2) usr.getRange(2, 1, USR_SEED.length, USR_SEED[0].length).setValues(USR_SEED);
    widths_(usr, [160, 80, 100, 140]);
    widths_(sheet_(ss, SH.SET, SET_COLS, SET_SEED, '#334155'), [180, 320]);

    // Bo'sh standart varaqni (Sheet1 / Лист1) o'chirish
    existing.forEach(function (s) {
      const ours = [SH.MOV, SH.STOCK].concat(CFG_SHEETS).indexOf(s.getName()) >= 0;
      if (!ours && s.getLastRow() === 0 && s.getLastColumn() === 0 && ss.getSheets().length > 1) {
        try { ss.deleteSheet(s); } catch (e) { /* e'tiborsiz */ }
      }
    });

    CacheService.getScriptCache().remove('cfg');
    const cfg = getCfg_(ss);
    ensureViews_(ss, cfg);
    recompute_(ss, cfg);
    order_(ss, cfg);
    p.setProperty('schema', SCHEMA);
  } finally {
    lock.releaseLock();
  }
}

function sheet_(ss, name, headers, seed, color) {
  let sh = ss.getSheetByName(name);
  let created = false;
  if (!sh) {
    sh = ss.insertSheet(name);
    created = true;
  }
  const lastCol = sh.getLastColumn();
  const cur = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  if (!cur.length || cur.every(function (x) { return !x; })) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    headers.forEach(function (h) {
      if (cur.indexOf(h) < 0) {
        cur.push(h);
        sh.getRange(1, cur.length).setValue(h);
      }
    });
  }
  if (created && seed && seed.length) sh.getRange(2, 1, seed.length, seed[0].length).setValues(seed);
  const w = Math.max(headers.length, sh.getLastColumn());
  sh.getRange(1, 1, 1, w).setFontWeight('bold').setFontColor('#ffffff').setBackground(color || '#334155');
  sh.setFrozenRows(1);
  return sh;
}

function widths_(sh, ws) {
  ws.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

function order_(ss, cfg) {
  const names = [SH.MOV, SH.STOCK].concat(cfg.branches.map(function (b) { return b.name; })).concat(CFG_SHEETS);
  names.forEach(function (n, i) {
    const s = ss.getSheetByName(n);
    if (s) {
      ss.setActiveSheet(s);
      ss.moveActiveSheet(i + 1);
    }
  });
  const first = ss.getSheetByName(SH.MOV);
  if (first) ss.setActiveSheet(first);
}

/** Har filial uchun ko'rinish varag'i: FILTER formulasi bilan, qo'lda yozilmaydi. */
function ensureViews_(ss, cfg) {
  const last = String.fromCharCode(64 + NC - 1); // rid ustunisiz
  cfg.branches.forEach(function (b) {
    if ([SH.MOV, SH.STOCK].concat(CFG_SHEETS).indexOf(b.name) >= 0) return;
    let sh = ss.getSheetByName(b.name);
    if (!sh) {
      sh = ss.insertSheet(b.name);
      sh.getRange(1, 1, 1, NC - 1).setValues([MOV_COLS.slice(0, NC - 1)])
        .setFontWeight('bold').setFontColor('#ffffff').setBackground('#0e7490');
      sh.setFrozenRows(1);
      widths_(sh, [90, 90, 60, 80, 100, 260, 60, 90, 100, 200, 150, 100, 70, 110, 220]);
      sh.getRange('G:I').setNumberFormat('#,##0');
    }
    const q = String(b.name).replace(/"/g, '""');
    const m = "'" + SH.MOV + "'!";
    const f = '=IFERROR(FILTER(' + m + 'A2:' + last + ', (' + m + 'E2:E="' + q + '")+(' + m + 'L2:L="' + q + '")), "")';
    const cell = sh.getRange('A2');
    if (cell.getFormula() !== f) cell.setFormula(f);
  });
}

/* ───────────────────────────── Sozlamalar ───────────────────────────── */

function readTable_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues();
  const head = v[0].map(function (h) { return String(h).trim(); });
  return v.slice(1).map(function (r) {
    const o = {};
    head.forEach(function (h, i) { o[h] = r[i]; });
    return o;
  });
}

function getCfg_(ss) {
  const cache = CacheService.getScriptCache();
  const c = cache.get('cfg');
  if (c) return JSON.parse(c);

  const set = {};
  readTable_(ss, SH.SET).forEach(function (r) { set[clean_(r['Созлама'])] = clean_(r['Қиймат']); });
  const cfg = {
    name: set['Тармоқ номи'] || 'Др. Шерматов дорихоналари',
    currency: set['Валюта'] || 'сўм',
    products: readTable_(ss, SH.PROD).filter(function (r) { return clean_(r['Маҳсулот']); }).map(function (r) {
      return {
        name: clean_(r['Маҳсулот']),
        price: num_(r['Нарх']),
        unit: clean_(r['Бирлик']) || 'дона',
        min: r['Минимал қолдиқ'] === '' || r['Минимал қолдиқ'] == null ? 5 : num_(r['Минимал қолдиқ']),
        note: clean_(r['Изоҳ']),
      };
    }),
    branches: readTable_(ss, SH.BR).filter(function (r) { return clean_(r['Филиал']); }).map(function (r) {
      return { name: clean_(r['Филиал']), addr: clean_(r['Манзил']), phone: clean_(r['Телефон']) };
    }),
    doctors: readTable_(ss, SH.DOC).map(function (r) { return clean_(r['Врач']); }).filter(String),
    users: readTable_(ss, SH.USR).filter(function (r) { return clean_(r['Исм']) && clean_(r['PIN']); }).map(function (r) {
      const role = clean_(r['Роль']).toLowerCase();
      return {
        name: clean_(r['Исм']),
        pin: clean_(r['PIN']),
        role: role === 'админ' || role === 'admin' ? 'admin' : 'seller',
        branch: clean_(r['Филиал']),
      };
    }),
  };
  cfg.hash = hash_(JSON.stringify(pubCfg_(cfg)));
  cache.put('cfg', JSON.stringify(cfg), 600);
  try { ensureViews_(ss, cfg); } catch (e) { /* keyingi safar */ }
  return cfg;
}

function pubCfg_(cfg) {
  return { name: cfg.name, currency: cfg.currency, products: cfg.products, branches: cfg.branches, doctors: cfg.doctors };
}

function pubUser_(u) {
  return { name: u.name, role: u.role, branch: u.role === 'admin' ? '' : u.branch };
}

/** Sozlama varaqlari qo'lda o'zgartirilsa — kesh darhol tozalanadi. */
function onEdit(e) {
  try {
    const n = e && e.range && e.range.getSheet().getName();
    if (CFG_SHEETS.indexOf(n) >= 0) CacheService.getScriptCache().remove('cfg');
  } catch (err) { /* e'tiborsiz */ }
}

/* ───────────────────────────── Kirish ───────────────────────────── */

function secret_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('secret');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    p.setProperty('secret', s);
  }
  return s;
}

function sign_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, secret_())).replace(/=+$/, '');
}

function makeToken_(u) {
  const exp = Date.now() + 30 * 864e5;
  const payload = [u.name, exp, sign_('pin:' + u.pin).slice(0, 12)].join('|');
  return Utilities.base64EncodeWebSafe(payload, Utilities.Charset.UTF_8).replace(/=+$/, '') + '.' + sign_(payload);
}

function checkToken_(t, cfg) {
  if (!t) return null;
  const parts = String(t).split('.');
  if (parts.length !== 2) return null;
  let payload;
  try {
    let b = parts[0];
    while (b.length % 4) b += '=';
    payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString('UTF-8');
  } catch (e) {
    return null;
  }
  if (sign_(payload) !== parts[1]) return null;
  const f = payload.split('|');
  if (f.length !== 3 || Date.now() > Number(f[1])) return null;
  const u = cfg.users.filter(function (x) { return x.name === f[0]; })[0];
  if (!u || sign_('pin:' + u.pin).slice(0, 12) !== f[2]) return null;
  if (u.role !== 'admin' && !branchOk_(cfg, u.branch)) return null;
  return u;
}

function login_(ss, cfg, req) {
  const pin = clean_(req.pin);
  const u = cfg.users.filter(function (x) { return x.pin === pin; })[0];
  if (!pin || !u) {
    Utilities.sleep(700);
    return { ok: false, error: 'PIN нотўғри' };
  }
  if (u.role !== 'admin' && !branchOk_(cfg, u.branch)) {
    return { ok: false, error: 'Бу фойдаланувчига филиал бириктирилмаган («Фойдаланувчилар» варағи)' };
  }
  return Object.assign({ ok: true, token: makeToken_(u), user: pubUser_(u), cfg: pubCfg_(cfg) }, state_(ss, cfg, u));
}

/* ───────────────────────────── Holat / sinxron ───────────────────────────── */

function ver_() {
  return Number(PropertiesService.getScriptProperties().getProperty('ver') || 0);
}

function bumpVer_() {
  const p = PropertiesService.getScriptProperties();
  const v = Number(p.getProperty('ver') || 0) + 1;
  p.setProperty('ver', String(v));
  return v;
}

function state_(ss, cfg, user) {
  return { ver: ver_(), cfgHash: cfg.hash, stock: getStock_(ss, cfg), today: todayRows_(ss, user) };
}

function sync_(ss, cfg, user, req) {
  const v = ver_();
  const res = { ok: true, ver: v, cfgHash: cfg.hash };
  if (req.cfgHash !== cfg.hash) res.cfg = pubCfg_(cfg);
  if (Number(req.ver) === v && !res.cfg) {
    res.same = true;
    return res;
  }
  res.stock = getStock_(ss, cfg);
  res.today = todayRows_(ss, user);
  return res;
}

function todayRows_(ss, user) {
  const d = fmtD_(new Date());
  const rows = rowsRange_(ss, d, d).map(rowObj_);
  return user.role === 'admin' ? rows : rows.filter(function (r) { return r.branch === user.branch || r.to === user.branch; });
}

/* ───────────────────────────── Yozish ───────────────────────────── */

function write_(ss, cfg, user, req, fn) {
  const rid = clean_(req.rid);
  const cache = CacheService.getScriptCache();
  const dup = function () {
    const c = rid && cache.get('rid:' + rid);
    return c ? Object.assign({ ok: true, dup: true }, JSON.parse(c), state_(ss, cfg, user)) : null;
  };
  let d = dup();
  if (d) return d;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) fail_('Сервер band — бир оздан кейин қайта уриниб кўринг');
  try {
    d = dup();
    if (d) return d;
    const res = fn();
    SpreadsheetApp.flush();
    bumpVer_();
    if (rid) cache.put('rid:' + rid, JSON.stringify(res), 21600);
    return Object.assign({ ok: true }, res, state_(ss, cfg, user));
  } finally {
    lock.releaseLock();
  }
}

function opBranch_(cfg, user, b) {
  b = clean_(b);
  if (user.role !== 'admin') {
    if (b && b !== user.branch) fail_('Сиз фақат «' + user.branch + '» учун ёза оласиз');
    return user.branch;
  }
  if (!b) fail_('Филиални танланг');
  if (!branchOk_(cfg, b)) fail_('Филиал топилмади: ' + b);
  return b;
}

function branchOk_(cfg, b) {
  return cfg.branches.some(function (x) { return x.name === b; });
}

function normItems_(cfg, items, withPrice) {
  if (!Array.isArray(items) || !items.length) fail_('Камида битта маҳсулот қўшинг');
  if (items.length > 50) fail_('Битта ҳужжатда кўпи билан 50 қатор');
  return items.map(function (it, i) {
    const name = clean_(it.product);
    const p = cfg.products.filter(function (x) { return x.name === name; })[0];
    if (!p) fail_((i + 1) + '-қатор: маҳсулот танланмаган ёки топилмади');
    const qty = Number(it.qty);
    if (!(qty > 0) || Math.floor(qty) !== qty || qty > 1000000) fail_('«' + name + '»: сони нотўғри');
    const o = { product: name, qty: qty };
    if (withPrice) {
      const price = it.price === '' || it.price == null ? p.price : Number(it.price);
      if (!(price >= 0) || price > 1e10) fail_('«' + name + '»: нархи нотўғри');
      const sum = it.sum === '' || it.sum == null ? price * qty : Number(it.sum);
      if (!(sum >= 0) || sum > 1e12) fail_('«' + name + '»: суммаси нотўғри');
      o.price = price;
      o.sum = Math.round(sum);
    }
    return o;
  });
}

function checkAvail_(cfg, stock, branch, items) {
  const need = {};
  items.forEach(function (it) { need[it.product] = (need[it.product] || 0) + it.qty; });
  Object.keys(need).forEach(function (p) {
    const have = (stock[branch] && stock[branch][p]) || 0;
    if (need[p] > have) fail_('«' + p + '» — «' + branch + '»да етарли эмас: қолдиқ ' + have + ', керак ' + need[p]);
  });
}

function nextDoc_(type) {
  const p = PropertiesService.getScriptProperties();
  const n = Number(p.getProperty('doc') || 0) + 1;
  p.setProperty('doc', String(n));
  return PREFIX[type] + '-' + n;
}

function append_(ss, rows) {
  const sh = ss.getSheetByName(SH.MOV);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, NC).setValues(rows);
}

function base_(doc, type, branch, user, req) {
  const now = new Date();
  return function (it, extra) {
    const r = new Array(NC).fill('');
    r[I.DOC] = doc;
    r[I.DATE] = fmtD_(now);
    r[I.TIME] = Utilities.formatDate(now, TZ, 'HH:mm');
    r[I.TYPE] = type;
    r[I.BR] = branch;
    r[I.PROD] = it.product;
    r[I.QTY] = it.qty;
    r[I.STATUS] = ST.OK;
    r[I.OP] = user.name;
    r[I.NOTE] = clean_(req.note).slice(0, 500);
    r[I.RID] = clean_(req.rid);
    Object.keys(extra || {}).forEach(function (k) { r[I[k]] = extra[k]; });
    return r;
  };
}

/** Расход = сотув: mijoz, врач, маҳсулот, дона, нарх, сумма. Qoldiqdan ayriladi. */
function sale_(ss, cfg, user, req) {
  const br = opBranch_(cfg, user, req.branch);
  const client = clean_(req.client).slice(0, 120);
  if (!client) fail_('Мижоз Ф.И.Ш ни ёзинг');
  const doctor = clean_(req.doctor).slice(0, 120);
  const items = normItems_(cfg, req.items, true);
  const stock = getStock_(ss, cfg);
  checkAvail_(cfg, stock, br, items);
  const doc = nextDoc_(T.OUT);
  const mk = base_(doc, T.OUT, br, user, req);
  append_(ss, items.map(function (it) {
    return mk(it, { PRICE: it.price, SUM: it.sum, CLIENT: client, DOCTOR: doctor });
  }));
  if (doctor && !cfg.doctors.some(function (x) { return norm_(x) === norm_(doctor); })) {
    ss.getSheetByName(SH.DOC).appendRow([doctor, 'сотувдан қўшилди']);
    CacheService.getScriptCache().remove('cfg');
  }
  applyDelta_(ss, cfg, items.map(function (it) { return { b: br, p: it.product, q: -it.qty }; }));
  return { doc: doc, total: items.reduce(function (a, it) { return a + it.sum; }, 0) };
}

/** Приход: faqat mahsulot va dona (summa kerak emas). */
function income_(ss, cfg, user, req) {
  const br = opBranch_(cfg, user, req.branch);
  const items = normItems_(cfg, req.items, false);
  const doc = nextDoc_(T.IN);
  const mk = base_(doc, T.IN, br, user, req);
  append_(ss, items.map(function (it) { return mk(it); }));
  applyDelta_(ss, cfg, items.map(function (it) { return { b: br, p: it.product, q: it.qty }; }));
  return { doc: doc };
}

/** Filialdan filialga o'tkazma. */
function transfer_(ss, cfg, user, req) {
  const from = opBranch_(cfg, user, req.branch);
  const to = clean_(req.to);
  if (!branchOk_(cfg, to)) fail_('Қайси филиалга ўтказилишини танланг');
  if (to === from) fail_('Ўша филиалнинг ўзига ўтказиб бўлмайди');
  const items = normItems_(cfg, req.items, false);
  const stock = getStock_(ss, cfg);
  checkAvail_(cfg, stock, from, items);
  const doc = nextDoc_(T.TR);
  const mk = base_(doc, T.TR, from, user, req);
  append_(ss, items.map(function (it) { return mk(it, { TO: to }); }));
  const deltas = [];
  items.forEach(function (it) {
    deltas.push({ b: from, p: it.product, q: -it.qty });
    deltas.push({ b: to, p: it.product, q: it.qty });
  });
  applyDelta_(ss, cfg, deltas);
  return { doc: doc };
}

/** Bekor qilish: yozuv o'chmaydi, Ҳолат = Бекор, sababi Изоҳ'ga yoziladi, qoldiq qaytadi. */
function cancel_(ss, cfg, user, req) {
  const doc = clean_(req.doc);
  const reason = clean_(req.reason).slice(0, 300);
  if (!doc) fail_('Ҳужжат кўрсатилмаган');
  if (!reason) fail_('Бекор қилиш сабабини ёзинг');
  const sh = ss.getSheetByName(SH.MOV);
  const n = sh.getLastRow();
  if (n < 2) fail_('Ҳужжат топилмади');
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  let first = -1;
  let last = -1;
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === doc) {
      if (last < 0) last = i;
      first = i;
    } else if (last >= 0) {
      break;
    }
  }
  if (first < 0) fail_('Ҳужжат топилмади: ' + doc);
  const rng = sh.getRange(first + 2, 1, last - first + 1, NC);
  const rows = rng.getValues();
  if (rows.every(function (r) { return r[I.STATUS] === ST.CANCEL; })) fail_('Бу ҳужжат аллақачон бекор қилинган');
  const r0 = rows[0];
  const type = String(r0[I.TYPE]);
  const br = String(r0[I.BR]);
  const to = String(r0[I.TO]);
  if (user.role !== 'admin') {
    if (br !== user.branch) fail_('Бу ҳужжатни фақат «' + br + '» ёки админ бекор қила олади');
    if (toD_(r0[I.DATE]) !== fmtD_(new Date())) fail_('Фақат бугунги ҳужжатни бекор қилиш мумкин — админга мурожаат қилинг');
  }
  const deltas = [];
  rows.forEach(function (r) {
    if (r[I.STATUS] === ST.CANCEL) return;
    const p = String(r[I.PROD]);
    const q = Number(r[I.QTY]) || 0;
    if (type === T.IN) deltas.push({ b: br, p: p, q: -q });
    else if (type === T.OUT) deltas.push({ b: br, p: p, q: q });
    else if (type === T.TR) {
      deltas.push({ b: br, p: p, q: q });
      deltas.push({ b: to, p: p, q: -q });
    }
  });
  // Приход/ўтказмани бекор қилиш қолдиқни манфий қилмаслиги керак
  const stock = getStock_(ss, cfg);
  const after = {};
  deltas.forEach(function (d) {
    const k = d.b + '\u0001' + d.p;
    if (!(k in after)) after[k] = (stock[d.b] && stock[d.b][d.p]) || 0;
    after[k] += d.q;
  });
  Object.keys(after).forEach(function (k) {
    if (after[k] < 0) {
      const parts = k.split('\u0001');
      fail_('Бекор қилиб бўлмайди: «' + parts[0] + '»да «' + parts[1] + '» қолдиғи манфий бўлиб қолади (сотилиб кетган)');
    }
  });
  const stamp = 'Бекор: ' + reason + ' (' + user.name + ', ' + Utilities.formatDate(new Date(), TZ, 'dd.MM HH:mm') + ')';
  const status = rows.map(function () { return [ST.CANCEL]; });
  const notes = rows.map(function (r) { return [r[I.NOTE] ? r[I.NOTE] + ' · ' + stamp : stamp]; });
  sh.getRange(first + 2, I.STATUS + 1, rows.length, 1).setValues(status);
  sh.getRange(first + 2, I.NOTE + 1, rows.length, 1).setValues(notes);
  applyDelta_(ss, cfg, deltas);
  return { doc: doc, cancelled: true };
}

/* ───────────────────────────── Qoldiq ───────────────────────────── */

function getStock_(ss, cfg) {
  return readStock_(ss, cfg) || recompute_(ss, cfg);
}

function readStock_(ss, cfg) {
  const sh = ss.getSheetByName(SH.STOCK);
  if (!sh || sh.getLastRow() < 1) return null;
  const v = sh.getDataRange().getValues();
  const head = v[0].map(String);
  const brs = cfg.branches.map(function (b) { return b.name; });
  if (head[0] !== 'Маҳсулот' || head[brs.length + 1] !== 'Жами') return null;
  for (let i = 0; i < brs.length; i++) if (head[i + 1] !== brs[i]) return null;
  const st = {};
  brs.forEach(function (b) { st[b] = {}; });
  const seen = {};
  for (let r = 1; r < v.length; r++) {
    const p = String(v[r][0]);
    if (!p || p === 'Жами') continue;
    seen[p] = 1;
    brs.forEach(function (b, i) { st[b][p] = Number(v[r][i + 1]) || 0; });
  }
  if (cfg.products.some(function (p) { return !seen[p.name]; })) return null;
  return st;
}

/** Hamma harakatlardan qoldiqni noldan hisoblash. */
function recompute_(ss, cfg) {
  const st = {};
  cfg.branches.forEach(function (b) { st[b.name] = {}; });
  const add = function (b, p, q) {
    if (!st[b]) st[b] = {};
    st[b][p] = (st[b][p] || 0) + q;
  };
  const sh = ss.getSheetByName(SH.MOV);
  const n = sh ? sh.getLastRow() : 0;
  if (n >= 2) {
    const v = sh.getRange(2, I.TYPE + 1, n - 1, I.STATUS - I.TYPE + 1).getValues();
    const o = I.TYPE;
    v.forEach(function (r) {
      if (r[I.STATUS - o] === ST.CANCEL) return;
      const type = r[I.TYPE - o];
      const b = String(r[I.BR - o]);
      const p = String(r[I.PROD - o]);
      const q = Number(r[I.QTY - o]) || 0;
      if (type === T.IN) add(b, p, q);
      else if (type === T.OUT) add(b, p, -q);
      else if (type === T.TR) {
        add(b, p, -q);
        add(String(r[I.TO - o]), p, q);
      }
    });
  }
  writeStock_(ss, cfg, st);
  return st;
}

function applyDelta_(ss, cfg, deltas) {
  const st = readStock_(ss, cfg);
  if (!st) {
    recompute_(ss, cfg);
    return;
  }
  deltas.forEach(function (d) {
    if (!st[d.b]) st[d.b] = {};
    st[d.b][d.p] = (st[d.b][d.p] || 0) + d.q;
  });
  writeStock_(ss, cfg, st);
}

function writeStock_(ss, cfg, st) {
  const sh = ss.getSheetByName(SH.STOCK);
  const brs = cfg.branches.map(function (b) { return b.name; });
  const head = ['Маҳсулот'].concat(brs, ['Жами', 'Минимал']);
  const rows = cfg.products.map(function (p) {
    const q = brs.map(function (b) { return (st[b] && st[b][p.name]) || 0; });
    return [p.name].concat(q, [q.reduce(function (a, b) { return a + b; }, 0), p.min]);
  });
  const tot = ['Жами'];
  for (let i = 1; i <= brs.length + 1; i++) tot.push(rows.reduce(function (a, r) { return a + r[i]; }, 0));
  tot.push('');
  const all = [head].concat(rows, [tot]);
  sh.clear();
  sh.getRange(1, 1, all.length, head.length).setValues(all);
  sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setFontColor('#ffffff').setBackground('#0f766e');
  sh.getRange(all.length, 1, 1, head.length).setFontWeight('bold').setBackground('#e2e8f0');
  if (rows.length) {
    const bg = rows.map(function (r) {
      return head.map(function (h, i) {
        if (i === 0 || i > brs.length) return null;
        return r[i] <= 0 ? '#fecaca' : (r[i] <= r[head.length - 1] ? '#fef3c7' : null);
      });
    });
    sh.getRange(2, 1, rows.length, head.length).setBackgrounds(bg);
  }
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 300);
}

/* ───────────────────────────── O'qish: tarix, hisobot ───────────────────────────── */

function rowsRange_(ss, from, to) {
  const sh = ss.getSheetByName(SH.MOV);
  const n = sh.getLastRow();
  if (n < 2) return [];
  const dates = sh.getRange(2, I.DATE + 1, n - 1, 1).getValues();
  let s = -1;
  let e = -1;
  for (let i = 0; i < dates.length; i++) {
    const d = toD_(dates[i][0]);
    if (d >= from && d <= to) {
      if (s < 0) s = i;
      e = i;
    }
  }
  if (s < 0) return [];
  return sh.getRange(s + 2, 1, e - s + 1, NC).getValues().filter(function (r) {
    const d = toD_(r[I.DATE]);
    return r[I.DOC] !== '' && d >= from && d <= to;
  });
}

function rowObj_(r) {
  return {
    doc: String(r[I.DOC]), date: toD_(r[I.DATE]), time: toT_(r[I.TIME]), type: String(r[I.TYPE]),
    branch: String(r[I.BR]), product: String(r[I.PROD]), qty: Number(r[I.QTY]) || 0,
    price: r[I.PRICE] === '' ? null : Number(r[I.PRICE]) || 0, sum: r[I.SUM] === '' ? null : Number(r[I.SUM]) || 0,
    client: String(r[I.CLIENT]), doctor: String(r[I.DOCTOR]), to: String(r[I.TO]),
    status: String(r[I.STATUS]) || ST.OK, op: String(r[I.OP]), note: String(r[I.NOTE]),
  };
}

function period_(req, maxDays) {
  const from = toD_(req.from);
  const to = toD_(req.to);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) fail_('Давр нотўғри');
  const days = (Date.parse(to) - Date.parse(from)) / 864e5;
  if (days > maxDays) fail_('Давр ' + maxDays + ' кундан ошмасин');
  return { from: from, to: to };
}

function history_(ss, cfg, user, req) {
  const p = period_(req, 400);
  const type = clean_(req.type);
  const scope = user.role === 'admin' ? clean_(req.branch) : user.branch;
  const q = norm_(req.q);
  let rows = rowsRange_(ss, p.from, p.to).map(rowObj_).filter(function (r) {
    if (scope && r.branch !== scope && r.to !== scope) return false;
    if (type && r.type !== type) return false;
    if (q && norm_([r.doc, r.product, r.client, r.doctor, r.branch, r.to, r.op, r.note].join(' ')).indexOf(q) < 0) return false;
    return true;
  });
  rows.reverse();
  const total = rows.length;
  if (rows.length > 3000) rows = rows.slice(0, 3000);
  return { ok: true, rows: rows, total: total, from: p.from, to: p.to };
}

function report_(ss, cfg, req) {
  const p = period_(req, 400);
  const key = 'rep:' + ver_() + ':' + cfg.hash + ':' + p.from + ':' + p.to;
  const cache = CacheService.getScriptCache();
  const c = cache.get(key);
  if (c) return JSON.parse(c);

  const tot = { sum: 0, qty: 0, docs: 0, clients: 0, inQty: 0, trQty: 0, cancelled: 0 };
  const byBranch = {};
  const byProduct = {};
  const byDoctor = {};
  const byDay = {};
  const matrix = {};
  const docs = {};
  const clients = {};
  const cancelledDocs = {};
  const B = function (b) {
    if (!byBranch[b]) byBranch[b] = { sum: 0, qty: 0, docs: 0, inQty: 0, trIn: 0, trOut: 0 };
    return byBranch[b];
  };
  cfg.branches.forEach(function (b) { B(b.name); });

  rowsRange_(ss, p.from, p.to).map(rowObj_).forEach(function (r) {
    if (r.status === ST.CANCEL) {
      cancelledDocs[r.doc] = 1;
      return;
    }
    if (r.type === T.IN) {
      B(r.branch).inQty += r.qty;
      tot.inQty += r.qty;
    } else if (r.type === T.TR) {
      B(r.branch).trOut += r.qty;
      B(r.to).trIn += r.qty;
      tot.trQty += r.qty;
    } else if (r.type === T.OUT) {
      const s = r.sum || 0;
      tot.sum += s;
      tot.qty += r.qty;
      const b = B(r.branch);
      b.sum += s;
      b.qty += r.qty;
      if (!docs[r.doc]) {
        docs[r.doc] = 1;
        tot.docs++;
        b.docs++;
      }
      clients[norm_(r.client)] = 1;
      const pr = byProduct[r.product] || (byProduct[r.product] = { qty: 0, sum: 0 });
      pr.qty += r.qty;
      pr.sum += s;
      const dn = r.doctor || '— (врачсиз)';
      const dr = byDoctor[dn] || (byDoctor[dn] = { sum: 0, qty: 0, docs: 0, _d: {} });
      dr.sum += s;
      dr.qty += r.qty;
      if (!dr._d[r.doc]) {
        dr._d[r.doc] = 1;
        dr.docs++;
      }
      const dy = byDay[r.date] || (byDay[r.date] = { sum: 0, docs: 0, qty: 0, _d: {} });
      dy.sum += s;
      dy.qty += r.qty;
      if (!dy._d[r.doc]) {
        dy._d[r.doc] = 1;
        dy.docs++;
      }
      const m = matrix[r.product] || (matrix[r.product] = {});
      m[r.branch] = (m[r.branch] || 0) + r.qty;
    }
  });
  tot.clients = Object.keys(clients).length;
  tot.cancelled = Object.keys(cancelledDocs).length;
  Object.keys(byDoctor).forEach(function (k) { delete byDoctor[k]._d; });
  Object.keys(byDay).forEach(function (k) { delete byDay[k]._d; });
  const res = { ok: true, from: p.from, to: p.to, tot: tot, byBranch: byBranch, byProduct: byProduct,
    byDoctor: byDoctor, byDay: byDay, matrix: matrix };
  try { cache.put(key, JSON.stringify(res), 900); } catch (e) { /* katta bo'lsa keshlanmaydi */ }
  return res;
}

/* ───────────────────────────── Yordamchi ───────────────────────────── */

function clean_(v) {
  return v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
}

function norm_(v) {
  return clean_(v).toLowerCase().replace(/[ʻʼ'`‘’]/g, '');
}

function num_(v) {
  if (typeof v === 'number') return v;
  const n = Number(String(v || '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

function fmtD_(d) {
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function toD_(v) {
  if (v instanceof Date) return fmtD_(v);
  const s = clean_(v);
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? m[3] + '-' + m[2] + '-' + m[1] : s;
}

function toT_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'HH:mm');
  return clean_(v);
}

function hash_(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* ───────────────────────────── Menyu ───────────────────────────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Дорихона')
    .addItem('Ўрнатиш / янгилаш (варақлар)', 'menuSetup')
    .addItem('Қолдиқни қайта ҳисоблаш', 'menuRecompute')
    .addItem('Кешни тозалаш', 'menuClearCache')
    .addSeparator()
    .addItem('⚠ Синов маълумотларини тозалаш', 'menuClearData')
    .addToUi();
}

function menuSetup() {
  const ss = ss_();
  CacheService.getScriptCache().remove('cfg');
  ensure_(ss, true);
  bumpVer_();
  SpreadsheetApp.getUi().alert('Тайёр: ҳамма варақлар ва устунлар текширилди.');
}

function menuRecompute() {
  const ss = ss_();
  CacheService.getScriptCache().remove('cfg');
  recompute_(ss, getCfg_(ss));
  bumpVer_();
  SpreadsheetApp.getUi().alert('Қолдиқ ҳамма ҳаракатлардан қайта ҳисобланди.');
}

function menuClearCache() {
  CacheService.getScriptCache().remove('cfg');
  bumpVer_();
  SpreadsheetApp.getUi().alert('Кеш тозаланди — ўзгаришлар сайтга дарҳол тушади.');
}

function menuClearData() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('⚠ Синов маълумотларини тозалаш',
    'Ҳамма приход, расход ва ўтказмалар ўчирилади (олдин заҳира нусха яратилади).\n' +
    'Маҳсулотлар, филиаллар, врачлар, фойдаланувчилар қолади.\n\nТасдиқлаш учун 1234 ёзинг:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK || r.getResponseText().trim() !== '1234') {
    ui.alert('Бекор қилинди.');
    return;
  }
  const ss = ss_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ss.copy(ss.getName() + ' — заҳира ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'));
    const sh = ss.getSheetByName(SH.MOV);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    PropertiesService.getScriptProperties().setProperty('doc', '0');
    CacheService.getScriptCache().remove('cfg');
    recompute_(ss, getCfg_(ss));
    bumpVer_();
  } finally {
    lock.releaseLock();
  }
  ui.alert('Тозаланди. Заҳира нусха Google Drive\'да сақланди.');
}
