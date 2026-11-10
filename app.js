/* Др. Шерматов — дорихоналар тармоғи · сайт (оддий JS, framework йўқ) */
'use strict';

// Apps Script Web App манзили (…/exec). Бўш бўлса — кириш саҳифасида бир марта киритилади.
const DEFAULT_API_URL = '';

const LS = { api: 'sh_api', token: 'sh_token', cache: 'sh_cache', branch: 'sh_branch', page: 'sh_page' };
const TZ = 'Asia/Tashkent';
const T = { IN: 'Приход', OUT: 'Расход', TR: 'Ўтказма' };
const CANCEL = 'Бекор';

const PAGES = [
  { id: 'sale', t: 'Сотув', ic: '🛒' },
  { id: 'income', t: 'Приход', ic: '📥' },
  { id: 'transfer', t: 'Ўтказма', ic: '🔁' },
  { id: 'stock', t: 'Қолдиқ', ic: '📦' },
  { id: 'history', t: 'Тарих', ic: '🧾' },
  { id: 'report', t: 'Ҳисобот', ic: '📊', admin: true },
];

const S = {
  api: lsGet(LS.api) || DEFAULT_API_URL,
  token: lsGet(LS.token) || '',
  user: null, cfg: null, stock: {}, today: [], ver: -1, cfgHash: '',
  branch: '', page: lsGet(LS.page) || 'sale',
  net: 'idle', lastSync: 0, syncing: false,
  forms: {},
  hist: { preset: 'today', from: '', to: '', type: '', q: '', data: null, loading: false },
  rep: { preset: 'month', from: '', to: '', data: null, loading: false },
  stockQ: '',
};

/* ───────────── yordamchilar ───────────── */

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* */ } }
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[^\d]/g, '')); return isFinite(n) ? n : 0; };
const fmt = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const isAdmin = () => S.user && S.user.role === 'admin';
const cur = () => (S.cfg && S.cfg.currency) || 'сўм';
const money = (n) => fmt(n) + ' ' + cur();

function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dLabel(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso || ''); }
function nowHM() { return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date()); }

const PRESETS = [
  ['today', 'Бугун'], ['yday', 'Кеча'], ['7d', '7 кун'], ['month', 'Шу ой'], ['pmonth', 'Ўтган ой'], ['custom', 'Давр'],
];
function presetRange(p, from, to) {
  const t = todayISO();
  if (p === 'today') return [t, t];
  if (p === 'yday') { const y = addDays(t, -1); return [y, y]; }
  if (p === '7d') return [addDays(t, -6), t];
  if (p === 'month') return [t.slice(0, 8) + '01', t];
  if (p === 'pmonth') { const end = addDays(t.slice(0, 8) + '01', -1); return [end.slice(0, 8) + '01', end]; }
  return [from || t, to || t];
}

function product(name) { return (S.cfg.products || []).find((p) => p.name === name); }
function stockOf(branch, prod) { return (S.stock[branch] && S.stock[branch][prod]) || 0; }
function branchNames() { return (S.cfg.branches || []).map((b) => b.name); }

/* ───────────── server ───────────── */

async function api(action, data = {}) {
  if (!S.api) throw new Error('Сервер манзили киритилмаган');
  let res;
  try {
    res = await fetch(S.api, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action, t: S.token }, data)),
    });
  } catch (e) {
    setNet('off');
    throw new Error('Интернет ёки сервер билан алоқа йўқ');
  }
  const txt = await res.text();
  let j;
  try { j = JSON.parse(txt); } catch (e) {
    setNet('off');
    throw new Error('Сервер жавоби нотўғри (Code.gs ва Deploy ни текширинг)');
  }
  setNet('ok');
  if (!j.ok) {
    if (j.auth) { logout(true); }
    throw new Error(j.error || 'Хато');
  }
  return j;
}

function applyState(j) {
  if (j.user) S.user = j.user;
  if (j.cfg) S.cfg = j.cfg;
  if (j.cfgHash) S.cfgHash = j.cfgHash;
  if (j.stock) S.stock = j.stock;
  if (j.today) S.today = j.today;
  if (j.ver != null) S.ver = j.ver;
  if (S.user && !isAdmin()) S.branch = S.user.branch;
  if (S.branch && S.cfg && !branchNames().includes(S.branch)) S.branch = '';
  S.lastSync = Date.now();
  lsSet(LS.cache, JSON.stringify({ user: S.user, cfg: S.cfg, cfgHash: S.cfgHash, stock: S.stock, today: S.today, ver: S.ver }));
}

function setNet(n) {
  S.net = n;
  const el = $('#net');
  if (el) el.outerHTML = netHTML();
}
function netHTML() {
  const t = S.lastSync ? new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(S.lastSync)) : '';
  if (S.net === 'off') return `<span id="net" class="net off" title="Алоқа йўқ">● алоқа йўқ</span>`;
  if (S.syncing) return `<span id="net" class="net busy">● янгиланмоқда…</span>`;
  return `<span id="net" class="net ok">● ${t ? 'янгиланди ' + t : 'онлайн'}</span>`;
}

async function sync(force) {
  if (!S.token || S.syncing) return;
  S.syncing = true; setNet(S.net);
  try {
    const j = await api('sync', { ver: force ? -1 : S.ver, cfgHash: force ? '' : S.cfgHash });
    S.lastSync = Date.now();
    if (!j.same) {
      const cfgChanged = !!j.cfg;
      applyState(j);
      if (cfgChanged) renderApp(); else softRefresh();
    }
  } catch (e) { /* holat belgisi ko'rsatadi */ } finally {
    S.syncing = false; setNet(S.net);
  }
}

/* ───────────── kirish ───────────── */

function renderLogin(msg) {
  const needUrl = !S.api;
  $('#app').innerHTML = `
  <div class="login">
    <form class="login-card" id="login-form" autocomplete="off">
      <div class="logo">✚</div>
      <h1>Др. Шерматов</h1>
      <p class="muted">Дорихоналар тармоғи</p>
      <div id="url-box" class="${needUrl ? '' : 'hidden'}">
        <label>Сервер манзили (Apps Script Web App)
          <input id="api-url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(S.api)}">
        </label>
      </div>
      <label>PIN
        <input id="pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" placeholder="••••" ${needUrl ? '' : 'autofocus'}>
      </label>
      <div class="err" id="login-err">${esc(msg || '')}</div>
      <button class="btn primary big" type="submit" id="login-btn">Кириш</button>
      <button class="link" type="button" id="toggle-url">⚙ Сервер манзили</button>
    </form>
  </div>`;
  $('#toggle-url').onclick = () => $('#url-box').classList.toggle('hidden');
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const url = $('#api-url').value.trim();
    if (url) { S.api = url; lsSet(LS.api, url); }
    const pin = $('#pin').value.trim();
    if (!S.api) { $('#login-err').textContent = 'Сервер манзилини киритинг'; $('#url-box').classList.remove('hidden'); return; }
    if (!pin) { $('#login-err').textContent = 'PIN ни киритинг'; return; }
    const btn = $('#login-btn'); btn.disabled = true; btn.textContent = 'Кирилмоқда…';
    try {
      const j = await api('login', { pin });
      S.token = j.token; lsSet(LS.token, j.token);
      applyState(j);
      if (isAdmin()) S.branch = lsGet(LS.branch) || '';
      if (S.branch && !branchNames().includes(S.branch)) S.branch = '';
      renderApp();
    } catch (err) {
      $('#login-err').textContent = err.message;
      btn.disabled = false; btn.textContent = 'Кириш';
    }
  };
}

function logout(expired) {
  S.token = ''; S.user = null; S.forms = {};
  S.hist.data = null; S.rep.data = null;
  lsSet(LS.token, null); lsSet(LS.cache, null);
  renderLogin(expired ? 'Сеанс тугади — қайта киринг' : '');
}

/* ───────────── asosiy ko'rinish ───────────── */

function renderApp() {
  if (!S.user || !S.cfg) return renderLogin();
  const pages = PAGES.filter((p) => !p.admin || isAdmin());
  if (!pages.some((p) => p.id === S.page)) S.page = 'sale';
  const brSel = isAdmin()
    ? `<select id="branch-sel" class="branch-sel" aria-label="Филиал">
        <option value="">Ҳамма филиаллар</option>
        ${branchNames().map((b) => `<option ${b === S.branch ? 'selected' : ''}>${esc(b)}</option>`).join('')}
      </select>`
    : `<span class="branch-chip">📍 ${esc(S.user.branch)}</span>`;
  $('#app').innerHTML = `
  <header class="top">
    <div class="brand"><span class="logo-s">✚</span><span class="brand-t">${esc(S.cfg.name)}</span></div>
    <div class="top-mid">${brSel}</div>
    <div class="top-r">
      ${netHTML()}
      <span class="who">${esc(S.user.name)}${isAdmin() ? ' · админ' : ''}</span>
      <button class="btn ghost sm" id="logout">Чиқиш</button>
    </div>
  </header>
  <nav class="tabs" id="tabs">
    ${pages.map((p) => `<button data-page="${p.id}" class="${p.id === S.page ? 'on' : ''}"><span>${p.ic}</span>${p.t}</button>`).join('')}
  </nav>
  <main id="view"></main>`;
  $('#logout').onclick = async () => { if (await confirmBox('Тизимдан чиқасизми?', 'Чиқиш')) logout(); };
  $('#tabs').onclick = (e) => {
    const b = e.target.closest('[data-page]');
    if (!b) return;
    S.page = b.dataset.page; lsSet(LS.page, S.page);
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
    renderView();
  };
  const bs = $('#branch-sel');
  if (bs) bs.onchange = () => {
    S.branch = bs.value; lsSet(LS.branch, S.branch);
    S.hist.data = null;
    renderView();
  };
  renderView();
}

function renderView() {
  const v = $('#view');
  if (!v) return;
  const fn = { sale: viewSale, income: viewIncome, transfer: viewTransfer, stock: viewStock, history: viewHistory, report: viewReport }[S.page];
  v.innerHTML = fn ? fn() : '';
  if (['sale', 'income', 'transfer'].includes(S.page) && $('#f-total')) {
    form(S.page).lines.forEach((_, j) => updateLineMeta(S.page, j));
    updateTotals(S.page);
  }
  after();
}

/** Sinxrondan keyin: yozilayotgan formani buzmasdan faqat yon panel va qoldiqlarni yangilash. */
function softRefresh() {
  if (['sale', 'income', 'transfer'].includes(S.page)) {
    const side = $('#side');
    if (side) side.innerHTML = sideHTML(S.page);
    document.querySelectorAll('[data-stockbadge]').forEach((el) => {
      const i = Number(el.dataset.stockbadge);
      updateLineMeta(S.page, i);
    });
  } else if (S.page === 'stock') {
    renderView();
  }
}

function after() {
  if (S.page === 'history' && !S.hist.data && !S.hist.loading) loadHistory();
  if (S.page === 'report' && !S.rep.data && !S.rep.loading) loadReport();
}

/* ───────────── filial tanlash (admin) ───────────── */

function needBranch(title) {
  if (S.branch) return '';
  return `<section class="card pick">
    <h2>${esc(title)}</h2>
    <p class="muted">Қайси филиал учун ёзасиз?</p>
    <div class="pick-grid">${branchNames().map((b) => `<button class="btn" data-act="pick-branch" data-b="${esc(b)}">📍 ${esc(b)}</button>`).join('')}</div>
  </section>`;
}

/* ───────────── formalar: sotuv / prixod / o'tkazma ───────────── */

function newLine() { return { product: '', qty: '1', price: '', sum: '', manual: false }; }
function form(id) {
  if (!S.forms[id]) S.forms[id] = { lines: [newLine()], client: '', doctor: '', note: '', to: '', rid: uid(), busy: false };
  return S.forms[id];
}

function linesHTML(kind) {
  const f = form(kind);
  const sale = kind === 'sale';
  const prods = S.cfg.products || [];
  const head = `<div class="line head ${sale ? 'sale' : ''}">
      <span>Маҳсулот</span><span>Қолдиқ</span><span>Сони</span>${sale ? '<span>Нарх</span><span>Сумма</span>' : ''}<span></span></div>`;
  const rows = f.lines.map((l, i) => `
    <div class="line ${sale ? 'sale' : ''}" data-line="${i}">
      <select data-f="product" data-i="${i}" aria-label="Маҳсулот">
        <option value="">— маҳсулотни танланг —</option>
        ${prods.map((p) => `<option ${p.name === l.product ? 'selected' : ''} value="${esc(p.name)}">${esc(p.name)} · ${stockOf(S.branch, p.name)}</option>`).join('')}
      </select>
      <span class="stock-b" data-stockbadge="${i}"></span>
      <input data-f="qty" data-i="${i}" inputmode="numeric" value="${esc(l.qty)}" aria-label="Сони" placeholder="Сони">
      ${sale ? `<input data-f="price" data-i="${i}" inputmode="numeric" value="${l.price === '' ? '' : fmt(l.price)}" aria-label="Нарх" placeholder="Нарх">
      <input data-f="sum" data-i="${i}" inputmode="numeric" value="${l.sum === '' ? '' : fmt(l.sum)}" aria-label="Сумма" placeholder="Сумма" class="${l.manual ? 'manual' : ''}">` : ''}
      <button class="x" data-act="del-line" data-i="${i}" title="Ўчириш" aria-label="Қаторни ўчириш">×</button>
    </div>`).join('');
  return `<div class="lines" id="lines">${head}${rows}</div>
    <button class="btn ghost" data-act="add-line">+ Маҳсулот қўшиш</button>`;
}

function updateLineMeta(kind, i) {
  const f = form(kind);
  const l = f.lines[i];
  const el = document.querySelector(`[data-stockbadge="${i}"]`);
  if (!l || !el) return;
  if (!l.product) { el.textContent = ''; el.className = 'stock-b'; return; }
  const have = stockOf(S.branch, l.product);
  const need = f.lines.filter((x) => x.product === l.product).reduce((a, x) => a + num(x.qty), 0);
  el.textContent = have + ' ' + ((product(l.product) || {}).unit || 'дона');
  el.className = 'stock-b' + (kind !== 'income' && need > have ? ' bad' : (have <= ((product(l.product) || {}).min || 0) ? ' low' : ''));
  if (kind === 'income') el.className = 'stock-b';
}

function updateTotals(kind) {
  const f = form(kind);
  const el = $('#f-total');
  if (!el) return;
  const qty = f.lines.reduce((a, l) => a + (l.product ? num(l.qty) : 0), 0);
  if (kind === 'sale') {
    const sum = f.lines.reduce((a, l) => a + (l.product ? num(l.sum) : 0), 0);
    el.innerHTML = `${fmt(qty)} дона · <b>${money(sum)}</b>`;
  } else {
    el.innerHTML = `<b>${fmt(qty)} дона</b>`;
  }
}

function viewSale() {
  const nb = needBranch('Сотув (расход)');
  if (nb) return nb;
  const f = form('sale');
  return `<div class="grid2">
    <section class="card">
      <div class="card-h"><h2>🛒 Сотув <small>· расход</small></h2><span class="pill">📍 ${esc(S.branch)}</span></div>
      <div class="row2">
        <label><span>Мижоз Ф.И.Ш <b class="req">*</b></span>
          <input id="f-client" data-ff="client" value="${esc(f.client)}" placeholder="Масалан: Каримов Алишер" autocomplete="off">
        </label>
        <label>Юборган врач
          <input id="f-doctor" data-ff="doctor" list="dl-doctors" value="${esc(f.doctor)}" placeholder="Танланг ёки ёзинг" autocomplete="off">
          <datalist id="dl-doctors">${(S.cfg.doctors || []).map((d) => `<option value="${esc(d)}">`).join('')}</datalist>
        </label>
      </div>
      ${linesHTML('sale')}
      <label>Изоҳ <input data-ff="note" value="${esc(f.note)}" placeholder="ихтиёрий"></label>
      <div class="foot">
        <div class="total">Жами: <span id="f-total"></span></div>
        <button class="btn primary big" data-act="submit" data-kind="sale" ${f.busy ? 'disabled' : ''}>${f.busy ? 'Сақланмоқда…' : 'Сотиш ✓'}</button>
      </div>
    </section>
    <aside class="card side" id="side">${sideHTML('sale')}</aside>
  </div>`;
}

function viewIncome() {
  const nb = needBranch('Приход');
  if (nb) return nb;
  const f = form('income');
  return `<div class="grid2">
    <section class="card">
      <div class="card-h"><h2>📥 Приход <small>· товар келди</small></h2><span class="pill">📍 ${esc(S.branch)}</span></div>
      <p class="muted sm">Фақат маҳсулот ва сони ёзилади — сумма керак эмас. Қолдиққа қўшилади.</p>
      ${linesHTML('income')}
      <label>Изоҳ <input data-ff="note" value="${esc(f.note)}" placeholder="масалан: қаердан келди, накладной №"></label>
      <div class="foot">
        <div class="total">Жами: <span id="f-total"></span></div>
        <button class="btn primary big" data-act="submit" data-kind="income" ${f.busy ? 'disabled' : ''}>${f.busy ? 'Сақланмоқда…' : 'Приход қилиш ✓'}</button>
      </div>
    </section>
    <aside class="card side" id="side">${sideHTML('income')}</aside>
  </div>`;
}

function viewTransfer() {
  const nb = needBranch('Ўтказма');
  if (nb) return nb;
  const f = form('transfer');
  const others = branchNames().filter((b) => b !== S.branch);
  if (f.to && !others.includes(f.to)) f.to = '';
  return `<div class="grid2">
    <section class="card">
      <div class="card-h"><h2>🔁 Ўтказма <small>· филиалдан филиалга</small></h2></div>
      <div class="row2 tr">
        <label>Қаердан <input value="${esc(S.branch)}" disabled></label>
        <span class="arrow">→</span>
        <label><span>Қаерга <b class="req">*</b></span>
          <select data-ff="to" id="f-to">
            <option value="">— филиални танланг —</option>
            ${others.map((b) => `<option ${b === f.to ? 'selected' : ''}>${esc(b)}</option>`).join('')}
          </select>
        </label>
      </div>
      ${linesHTML('transfer')}
      <div id="to-hint" class="muted sm">${toHint()}</div>
      <label>Изоҳ <input data-ff="note" value="${esc(f.note)}" placeholder="ихтиёрий"></label>
      <div class="foot">
        <div class="total">Жами: <span id="f-total"></span></div>
        <button class="btn primary big" data-act="submit" data-kind="transfer" ${f.busy ? 'disabled' : ''}>${f.busy ? 'Сақланмоқда…' : 'Ўтказиш ✓'}</button>
      </div>
    </section>
    <aside class="card side" id="side">${sideHTML('transfer')}</aside>
  </div>`;
}

function toHint() {
  const f = form('transfer');
  if (!f.to) return '';
  const ps = [...new Set(f.lines.filter((l) => l.product).map((l) => l.product))];
  if (!ps.length) return '';
  return '«' + esc(f.to) + '»даги қолдиқ: ' + ps.map((p) => `${esc(p)} — <b>${stockOf(f.to, p)}</b>`).join(', ');
}

/* yon panel: bugungi hujjatlar */

function groupDocs(rows) {
  const m = new Map();
  rows.forEach((r) => {
    let g = m.get(r.doc);
    if (!g) {
      g = { doc: r.doc, date: r.date, time: r.time, type: r.type, branch: r.branch, to: r.to, client: r.client,
        doctor: r.doctor, op: r.op, note: r.note, status: r.status, lines: [], sum: 0, qty: 0 };
      m.set(r.doc, g);
    }
    g.lines.push(r);
    if (r.status !== CANCEL) { g.sum += r.sum || 0; g.qty += r.qty; }
    if (r.status === CANCEL) g.status = CANCEL;
  });
  return [...m.values()];
}

function canCancel(g) {
  if (g.status === CANCEL) return false;
  if (isAdmin()) return true;
  return g.branch === S.user.branch && g.date === todayISO();
}

function docCard(g) {
  const off = g.status === CANCEL;
  const lines = g.lines.map((l) => `<li><span>${esc(l.product)}</span><span>× ${fmt(l.qty)}${l.sum != null && g.type === T.OUT ? ' · ' + fmt(l.sum) : ''}</span></li>`).join('');
  let sub = '';
  if (g.type === T.OUT) sub = `👤 ${esc(g.client)}${g.doctor ? ` · 🩺 ${esc(g.doctor)}` : ''}`;
  if (g.type === T.TR) sub = `${esc(g.branch)} → ${esc(g.to)}`;
  if (g.type === T.IN && g.note) sub = esc(g.note);
  return `<div class="doc ${off ? 'off' : ''}">
    <div class="doc-h"><b>${esc(g.doc)}</b><span class="muted">${esc(g.time)}${!S.branch || g.type === T.TR ? ' · ' + esc(g.branch) : ''}</span>
      ${off ? '<span class="tag red">бекор</span>' : ''}
      ${canCancel(g) ? `<button class="link danger" data-act="cancel" data-doc="${esc(g.doc)}">бекор қилиш</button>` : ''}</div>
    ${sub ? `<div class="doc-sub">${sub}</div>` : ''}
    <ul>${lines}</ul>
    <div class="doc-f">${g.type === T.OUT ? `<b>${money(g.sum)}</b>` : `<b>${fmt(g.qty)} дона</b>`}<span class="muted">${esc(g.op)}</span></div>
  </div>`;
}

function sideHTML(kind) {
  const type = { sale: T.OUT, income: T.IN, transfer: T.TR }[kind];
  const rows = S.today.filter((r) => r.type === type && (!S.branch || r.branch === S.branch || (type === T.TR && r.to === S.branch)));
  const docs = groupDocs(rows).reverse();
  const title = { sale: 'Бугунги сотувлар', income: 'Бугунги приход', transfer: 'Бугунги ўтказмалар' }[kind];
  let sum = '';
  if (kind === 'sale') {
    const act = docs.filter((d) => d.status !== CANCEL);
    sum = `<div class="side-sum"><div><small>Чеклар</small><b>${act.length}</b></div><div><small>Дона</small><b>${fmt(act.reduce((a, d) => a + d.qty, 0))}</b></div><div><small>Сумма</small><b>${fmt(act.reduce((a, d) => a + d.sum, 0))}</b></div></div>`;
  }
  return `<h3>${title}${S.branch ? '' : ' · ҳамма филиаллар'}</h3>${sum}
    ${docs.length ? docs.map(docCard).join('') : '<p class="empty">Ҳали йўқ</p>'}`;
}

/* form hodisalari */

function onViewInput(e) {
  const t = e.target;
  const kind = S.page;
  if (!['sale', 'income', 'transfer'].includes(kind)) {
    if (t.id === 'stock-q') { S.stockQ = t.value; filterStock(); }
    if (t.id === 'h-q') S.hist.q = t.value;
    return;
  }
  const f = form(kind);
  if (t.dataset.ff) {
    f[t.dataset.ff] = t.value;
    if (t.dataset.ff === 'to') { const h = $('#to-hint'); if (h) h.innerHTML = toHint(); }
    return;
  }
  const i = Number(t.dataset.i);
  const l = f.lines[i];
  if (!l || !t.dataset.f) return;
  const fld = t.dataset.f;
  if (fld === 'product') {
    l.product = t.value;
    const p = product(l.product);
    l.price = p ? p.price : '';
    l.manual = false;
    l.sum = l.price === '' ? '' : num(l.qty) * num(l.price);
    const row = t.closest('.line');
    if (row && kind === 'sale') {
      row.querySelector('[data-f="price"]').value = l.price === '' ? '' : fmt(l.price);
      const s = row.querySelector('[data-f="sum"]'); s.value = l.sum === '' ? '' : fmt(l.sum); s.classList.remove('manual');
    }
    f.lines.forEach((_, j) => updateLineMeta(kind, j));
    if (kind === 'transfer') { const h = $('#to-hint'); if (h) h.innerHTML = toHint(); }
  } else if (fld === 'qty' || fld === 'price') {
    l[fld] = fld === 'price' ? num(t.value) : t.value.replace(/[^\d]/g, '');
    if (kind === 'sale' && !l.manual && l.product) {
      l.sum = num(l.qty) * num(l.price);
      const s = t.closest('.line').querySelector('[data-f="sum"]');
      if (s) s.value = fmt(l.sum);
    }
    f.lines.forEach((_, j) => updateLineMeta(kind, j));
  } else if (fld === 'sum') {
    l.sum = num(t.value);
    l.manual = true;
    t.classList.add('manual');
  }
  updateTotals(kind);
}

function onViewBlur(e) {
  const t = e.target;
  if (t.dataset && (t.dataset.f === 'price' || t.dataset.f === 'sum') && t.value !== '') t.value = fmt(num(t.value));
}

async function onViewClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  const kind = S.page;
  if (act === 'pick-branch') {
    S.branch = b.dataset.b; lsSet(LS.branch, S.branch);
    const bs = $('#branch-sel'); if (bs) bs.value = S.branch;
    renderView();
  } else if (act === 'add-line') {
    form(kind).lines.push(newLine());
    rerenderLines(kind);
    const sels = document.querySelectorAll('#lines select');
    if (sels.length) sels[sels.length - 1].focus();
  } else if (act === 'del-line') {
    const f = form(kind);
    f.lines.splice(Number(b.dataset.i), 1);
    if (!f.lines.length) f.lines.push(newLine());
    rerenderLines(kind);
  } else if (act === 'submit') {
    submit(b.dataset.kind);
  } else if (act === 'cancel') {
    cancelDoc(b.dataset.doc);
  } else if (act === 'h-preset') {
    S.hist.preset = b.dataset.p; S.hist.data = null; renderView();
  } else if (act === 'h-load') {
    readHistFilters(); S.hist.data = null; loadHistory();
  } else if (act === 'r-preset') {
    S.rep.preset = b.dataset.p; S.rep.data = null; renderView();
  } else if (act === 'r-load') {
    S.rep.from = $('#r-from') ? $('#r-from').value : ''; S.rep.to = $('#r-to') ? $('#r-to').value : '';
    S.rep.data = null; loadReport();
  } else if (act === 'print') {
    window.print();
  } else if (act === 'refresh') {
    await sync(true); renderView();
  } else if (act === 'go-transfer') {
    S.page = 'transfer'; lsSet(LS.page, S.page);
    renderApp();
  }
}

function rerenderLines(kind) {
  const wrap = $('#lines');
  if (!wrap) return renderView();
  const tmp = document.createElement('div');
  tmp.innerHTML = linesHTML(kind);
  wrap.replaceWith(tmp.firstElementChild);
  form(kind).lines.forEach((_, j) => updateLineMeta(kind, j));
  updateTotals(kind);
  if (kind === 'transfer') { const h = $('#to-hint'); if (h) h.innerHTML = toHint(); }
}

async function submit(kind) {
  const f = form(kind);
  if (f.busy) return;
  const lines = f.lines.filter((l) => l.product);
  if (!lines.length) return toast('Камида битта маҳсулот танланг', 'err');
  for (const l of lines) if (!(num(l.qty) > 0)) return toast(`«${l.product}»: сонини ёзинг`, 'err');
  const payload = { branch: S.branch, note: f.note, rid: f.rid };
  if (kind === 'sale') {
    if (!f.client.trim()) { toast('Мижоз Ф.И.Ш ни ёзинг', 'err'); const c = $('#f-client'); if (c) c.focus(); return; }
    payload.client = f.client; payload.doctor = f.doctor;
    payload.items = lines.map((l) => ({ product: l.product, qty: num(l.qty), price: num(l.price), sum: num(l.sum) }));
  } else {
    payload.items = lines.map((l) => ({ product: l.product, qty: num(l.qty) }));
  }
  if (kind === 'transfer') {
    if (!f.to) return toast('Қайси филиалга ўтказишни танланг', 'err');
    payload.to = f.to;
  }
  if (kind !== 'income') {
    const need = {};
    lines.forEach((l) => { need[l.product] = (need[l.product] || 0) + num(l.qty); });
    for (const p of Object.keys(need)) {
      const have = stockOf(S.branch, p);
      if (need[p] > have) return toast(`«${p}» етарли эмас: қолдиқ ${have}, керак ${need[p]}`, 'err');
    }
  }
  if (kind === 'transfer' && !(await confirmBox(`«${S.branch}» → «${f.to}» га ${fmt(payload.items.reduce((a, x) => a + x.qty, 0))} дона ўтказилади. Тасдиқлайсизми?`, 'Ўтказиш'))) return;
  f.busy = true; setSubmitBusy(kind, true);
  try {
    const j = await api(kind, payload);
    applyState(j);
    S.forms[kind] = null;
    const label = { sale: 'Сотилди', income: 'Приход қилинди', transfer: 'Ўтказилди' }[kind];
    toast(`${label}: ${j.doc}${kind === 'sale' && j.total != null ? ' · ' + money(j.total) : ''}${j.dup ? ' (аввал сақланган)' : ''}`, 'ok');
    S.hist.data = null; S.rep.data = null;
    renderView();
    const first = document.querySelector(kind === 'sale' ? '#f-client' : '#lines select');
    if (first) first.focus();
  } catch (err) {
    f.busy = false; setSubmitBusy(kind, false);
    toast(err.message, 'err');
  }
}

function setSubmitBusy(kind, busy) {
  const b = document.querySelector(`[data-act="submit"][data-kind="${kind}"]`);
  if (!b) return;
  b.disabled = busy;
  b.textContent = busy ? 'Сақланмоқда…' : { sale: 'Сотиш ✓', income: 'Приход қилиш ✓', transfer: 'Ўтказиш ✓' }[kind];
}

async function cancelDoc(doc) {
  const reason = await modal({
    title: 'Ҳужжатни бекор қилиш',
    body: `<b>${esc(doc)}</b> бекор қилинади. Ёзув ўчмайди, «Бекор» деб белгиланади, қолдиқ қайтарилади.`,
    input: 'Сабаби', ok: 'Бекор қилиш', danger: true,
  });
  if (reason == null) return;
  if (!reason.trim()) return toast('Сабабини ёзинг', 'err');
  try {
    const j = await api('cancel', { doc, reason, rid: uid() });
    applyState(j);
    toast(`${doc} бекор қилинди`, 'ok');
    S.rep.data = null;
    if (S.page === 'history') { S.hist.data = null; loadHistory(); } else renderView();
  } catch (err) { toast(err.message, 'err'); }
}

/* ───────────── qoldiq ───────────── */

function viewStock() {
  const brs = branchNames();
  const prods = S.cfg.products || [];
  const me = S.branch;
  const scope = me ? [me] : brs;
  const low = [];
  prods.forEach((p) => scope.forEach((b) => {
    const q = stockOf(b, p.name);
    if (q <= p.min) {
      const donor = brs.filter((x) => x !== b).map((x) => [x, stockOf(x, p.name)]).sort((a, c) => c[1] - a[1])[0];
      low.push({ b, p, q, donor: donor && donor[1] > p.min ? donor : null });
    }
  }));
  const totals = brs.map((b) => prods.reduce((a, p) => a + stockOf(b, p.name), 0));
  return `
  ${low.length ? `<section class="card warn">
    <h3>⚠ Кам қолган маҳсулотлар${me ? ' · ' + esc(me) : ''}</h3>
    <ul class="low">${low.map((x) => `<li><span><b>${esc(x.p.name)}</b>${me ? '' : ' — ' + esc(x.b)}: <b class="${x.q <= 0 ? 'red' : 'amber'}">${x.q}</b> ${esc(x.p.unit)} <span class="muted">(минимал ${x.p.min})</span></span>
      ${x.donor ? `<span class="muted">«${esc(x.donor[0])}»да ${x.donor[1]} бор</span>` : ''}</li>`).join('')}</ul>
    ${me ? '<button class="btn ghost sm" data-act="go-transfer">🔁 Ўтказма қилиш</button>' : ''}
  </section>` : ''}
  <section class="card">
    <div class="card-h"><h2>📦 Қолдиқ <small>· ҳамма филиаллар</small></h2>
      <div class="h-tools"><input id="stock-q" placeholder="🔍 Маҳсулот қидириш" value="${esc(S.stockQ)}"><button class="btn ghost sm" data-act="refresh">↻ Янгилаш</button></div></div>
    <div class="tbl-wrap"><table class="tbl stock" id="stock-tbl">
      <thead><tr><th class="sticky">Маҳсулот</th>${brs.map((b) => `<th class="num ${b === me ? 'me' : ''}">${esc(b)}</th>`).join('')}<th class="num">Жами</th><th class="num">Мин.</th></tr></thead>
      <tbody>${prods.map((p) => {
        const qs = brs.map((b) => stockOf(b, p.name));
        return `<tr data-name="${esc(p.name.toLowerCase())}"><td class="sticky">${esc(p.name)}<div class="muted sm">${fmt(p.price)} ${cur()}</div></td>
          ${qs.map((q, i) => `<td class="num ${brs[i] === me ? 'me' : ''} ${q <= 0 ? 'zero' : q <= p.min ? 'lowc' : ''}">${fmt(q)}</td>`).join('')}
          <td class="num b">${fmt(qs.reduce((a, c) => a + c, 0))}</td><td class="num muted">${p.min}</td></tr>`;
      }).join('')}</tbody>
      <tfoot><tr><td class="sticky">Жами</td>${totals.map((t, i) => `<td class="num ${brs[i] === me ? 'me' : ''}">${fmt(t)}</td>`).join('')}<td class="num">${fmt(totals.reduce((a, c) => a + c, 0))}</td><td></td></tr></tfoot>
    </table></div>
    <p class="muted sm legend"><span class="sw lowc"></span> минимал ёки кам · <span class="sw zero"></span> тугаган</p>
  </section>`;
}

function filterStock() {
  const q = S.stockQ.trim().toLowerCase();
  document.querySelectorAll('#stock-tbl tbody tr').forEach((tr) => { tr.style.display = !q || tr.dataset.name.includes(q) ? '' : 'none'; });
}

/* ───────────── tarix ───────────── */

function periodBar(prefix, st) {
  const [from, to] = presetRange(st.preset, st.from, st.to);
  return `<div class="chips">${PRESETS.map(([k, t]) => `<button class="chip ${st.preset === k ? 'on' : ''}" data-act="${prefix}-preset" data-p="${k}">${t}</button>`).join('')}</div>
    ${st.preset === 'custom' ? `<div class="dates"><input type="date" id="${prefix}-from" value="${from}"> — <input type="date" id="${prefix}-to" value="${to}"></div>` : ''}`;
}

function readHistFilters() {
  const h = S.hist;
  if ($('#h-from')) h.from = $('#h-from').value;
  if ($('#h-to')) h.to = $('#h-to').value;
  if ($('#h-type')) h.type = $('#h-type').value;
  if ($('#h-q')) h.q = $('#h-q').value;
}

function viewHistory() {
  const h = S.hist;
  const [from, to] = presetRange(h.preset, h.from, h.to);
  let body = '<p class="empty">Юкланмоқда…</p>';
  if (h.data && !h.loading) body = histTable(h.data);
  if (h.error) body = `<p class="empty err">${esc(h.error)}</p>`;
  return `<section class="card">
    <div class="card-h"><h2>🧾 Тарих <small>· ${S.branch ? esc(S.branch) : 'ҳамма филиаллар'} · ${dLabel(from)}${from !== to ? ' — ' + dLabel(to) : ''}</small></h2></div>
    <div class="filters">
      ${periodBar('h', h)}
      <div class="f-row">
        <select id="h-type"><option value="">Ҳамма турлар</option>${[T.OUT, T.IN, T.TR].map((t) => `<option ${h.type === t ? 'selected' : ''} value="${t}">${t === T.OUT ? 'Расход (сотув)' : t}</option>`).join('')}</select>
        <input id="h-q" placeholder="🔍 мижоз, врач, маҳсулот, № …" value="${esc(h.q)}">
        <button class="btn primary" data-act="h-load">Кўрсатиш</button>
      </div>
    </div>
    <div id="h-body">${body}</div>
  </section>`;
}

async function loadHistory() {
  const h = S.hist;
  readHistFilters();
  const [from, to] = presetRange(h.preset, h.from, h.to);
  h.loading = true; h.error = '';
  const hb = $('#h-body'); if (hb) hb.innerHTML = '<p class="empty">Юкланмоқда…</p>';
  try {
    h.data = await api('history', { from, to, type: h.type, q: h.q, branch: S.branch });
  } catch (e) { h.error = e.message; h.data = null; }
  h.loading = false;
  if (S.page === 'history') {
    const b = $('#h-body');
    if (b) b.innerHTML = h.error ? `<p class="empty err">${esc(h.error)}</p>` : histTable(h.data);
  }
}

function histTable(d) {
  if (!d || !d.rows.length) return '<p class="empty">Бу даврда ёзув йўқ</p>';
  const act = d.rows.filter((r) => r.status !== CANCEL);
  const sales = act.filter((r) => r.type === T.OUT);
  const sDocs = new Set(sales.map((r) => r.doc)).size;
  const sum = sales.reduce((a, r) => a + (r.sum || 0), 0);
  const inQ = act.filter((r) => r.type === T.IN).reduce((a, r) => a + r.qty, 0);
  const trQ = act.filter((r) => r.type === T.TR).reduce((a, r) => a + r.qty, 0);
  const canc = new Set(d.rows.filter((r) => r.status === CANCEL).map((r) => r.doc)).size;
  const docMap = new Map(groupDocs(d.rows).map((g) => [g.doc, g]));
  const seen = new Set();
  const typeTag = (t) => `<span class="tag ${t === T.OUT ? 'teal' : t === T.IN ? 'blue' : 'violet'}">${t}</span>`;
  return `<div class="kpis sm">
      <div><small>Сотув</small><b>${money(sum)}</b><span>${sDocs} чек · ${fmt(sales.reduce((a, r) => a + r.qty, 0))} дона</span></div>
      <div><small>Приход</small><b>${fmt(inQ)} дона</b></div>
      <div><small>Ўтказма</small><b>${fmt(trQ)} дона</b></div>
      <div><small>Бекор қилинган</small><b>${canc}</b></div>
    </div>
    ${d.total > d.rows.length ? `<p class="muted sm">Охирги ${d.rows.length} та қатор кўрсатилди (жами ${d.total}). Даврни қисқартиринг.</p>` : ''}
    <div class="tbl-wrap"><table class="tbl hist">
      <thead><tr><th>Сана</th><th>№</th><th>Тури</th><th>Филиал</th><th>Маҳсулот</th><th class="num">Сони</th><th class="num">Нарх</th><th class="num">Сумма</th><th>Мижоз</th><th>Врач</th><th>Оператор</th><th>Изоҳ</th><th></th></tr></thead>
      <tbody>${d.rows.map((r) => {
        const first = !seen.has(r.doc); seen.add(r.doc);
        const g = docMap.get(r.doc);
        return `<tr class="${r.status === CANCEL ? 'off' : ''} ${first ? 'first' : ''}">
          <td class="nw">${dLabel(r.date)} <span class="muted">${esc(r.time)}</span></td>
          <td class="nw b">${esc(r.doc)}</td><td>${typeTag(r.type)}</td>
          <td class="nw">${esc(r.branch)}${r.type === T.TR ? ' → ' + esc(r.to) : ''}</td>
          <td>${esc(r.product)}</td><td class="num">${fmt(r.qty)}</td>
          <td class="num">${r.price != null ? fmt(r.price) : ''}</td><td class="num">${r.sum != null ? fmt(r.sum) : ''}</td>
          <td>${esc(r.client)}</td><td>${esc(r.doctor)}</td><td class="nw">${esc(r.op)}</td>
          <td class="note">${esc(r.note)}</td>
          <td>${first && g && canCancel(g) ? `<button class="link danger" data-act="cancel" data-doc="${esc(r.doc)}">бекор</button>` : ''}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
}

/* ───────────── hisobot (admin) ───────────── */

function viewReport() {
  const r = S.rep;
  const [from, to] = presetRange(r.preset, r.from, r.to);
  let body = '<p class="empty">Юкланмоқда…</p>';
  if (r.error) body = `<p class="empty err">${esc(r.error)}</p>`;
  else if (r.data && !r.loading) body = repBody(r.data);
  return `<section class="card">
    <div class="card-h"><h2>📊 Ҳисобот <small>· ${dLabel(from)}${from !== to ? ' — ' + dLabel(to) : ''}</small></h2>
      <button class="btn ghost sm noprint" data-act="print">🖨 Чоп этиш</button></div>
    <div class="filters noprint">${periodBar('r', r)}${r.preset === 'custom' ? '<button class="btn primary sm" data-act="r-load">Кўрсатиш</button>' : ''}</div>
    <div id="r-body">${body}</div>
  </section>`;
}

async function loadReport() {
  const r = S.rep;
  if ($('#r-from')) r.from = $('#r-from').value;
  if ($('#r-to')) r.to = $('#r-to').value;
  const [from, to] = presetRange(r.preset, r.from, r.to);
  r.loading = true; r.error = '';
  try { r.data = await api('report', { from, to }); } catch (e) { r.error = e.message; r.data = null; }
  r.loading = false;
  if (S.page === 'report') {
    const b = $('#r-body');
    if (b) b.innerHTML = r.error ? `<p class="empty err">${esc(r.error)}</p>` : repBody(r.data);
  }
}

function bar(v, max) { return `<span class="bar"><i style="width:${max ? Math.max(2, Math.round((v / max) * 100)) : 0}%"></i></span>`; }

function repBody(d) {
  const t = d.tot;
  const brs = branchNames().concat(Object.keys(d.byBranch).filter((b) => !branchNames().includes(b)));
  const bMax = Math.max(0, ...brs.map((b) => (d.byBranch[b] || {}).sum || 0));
  const prods = Object.entries(d.byProduct).sort((a, b) => b[1].sum - a[1].sum);
  const pMax = Math.max(0, ...prods.map((p) => p[1].sum));
  const docs = Object.entries(d.byDoctor).sort((a, b) => b[1].sum - a[1].sum);
  const dMax = Math.max(0, ...docs.map((p) => p[1].sum));
  const days = Object.entries(d.byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const dyMax = Math.max(0, ...days.map((x) => x[1].sum));
  const mprods = Object.keys(d.matrix);
  return `
  <div class="kpis">
    <div><small>Сотув суммаси</small><b>${money(t.sum)}</b></div>
    <div><small>Чеклар</small><b>${fmt(t.docs)}</b><span>ўртача ${t.docs ? fmt(t.sum / t.docs) : 0}</span></div>
    <div><small>Сотилган дона</small><b>${fmt(t.qty)}</b></div>
    <div><small>Мижозлар</small><b>${fmt(t.clients)}</b></div>
    <div><small>Приход</small><b>${fmt(t.inQty)} дона</b></div>
    <div><small>Ўтказма</small><b>${fmt(t.trQty)} дона</b><span>бекор: ${t.cancelled}</span></div>
  </div>

  <h3>Филиаллар бўйича</h3>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Филиал</th><th class="num">Сотув</th><th></th><th class="num">Чек</th><th class="num">Дона</th><th class="num">Приход</th><th class="num">Ўтказма кирди</th><th class="num">Ўтказма чиқди</th><th class="num">Ҳозирги қолдиқ</th></tr></thead>
    <tbody>${brs.map((b) => {
      const x = d.byBranch[b] || { sum: 0, docs: 0, qty: 0, inQty: 0, trIn: 0, trOut: 0 };
      const st = (S.cfg.products || []).reduce((a, p) => a + stockOf(b, p.name), 0);
      return `<tr><td class="b">${esc(b)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, bMax)}</td><td class="num">${fmt(x.docs)}</td><td class="num">${fmt(x.qty)}</td><td class="num">${fmt(x.inQty)}</td><td class="num">${fmt(x.trIn)}</td><td class="num">${fmt(x.trOut)}</td><td class="num">${fmt(st)}</td></tr>`;
    }).join('')}</tbody>
  </table></div>

  <div class="grid2 eq">
    <div>
      <h3>Маҳсулотлар бўйича</h3>
      ${prods.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Маҳсулот</th><th class="num">Дона</th><th class="num">Сумма</th><th></th></tr></thead>
        <tbody>${prods.map(([n, x]) => `<tr><td>${esc(n)}</td><td class="num">${fmt(x.qty)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, pMax)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Сотув йўқ</p>'}
    </div>
    <div>
      <h3>Юборган врачлар бўйича</h3>
      ${docs.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Врач</th><th class="num">Чек</th><th class="num">Дона</th><th class="num">Сумма</th><th></th></tr></thead>
        <tbody>${docs.map(([n, x]) => `<tr><td>${esc(n)}</td><td class="num">${fmt(x.docs)}</td><td class="num">${fmt(x.qty)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, dMax)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Сотув йўқ</p>'}
    </div>
  </div>

  ${mprods.length ? `<h3>Сотилган дона: маҳсулот × филиал</h3>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Маҳсулот</th>${brs.map((b) => `<th class="num">${esc(b)}</th>`).join('')}<th class="num">Жами</th></tr></thead>
    <tbody>${mprods.map((p) => { const row = brs.map((b) => d.matrix[p][b] || 0); return `<tr><td>${esc(p)}</td>${row.map((q) => `<td class="num ${q ? '' : 'muted'}">${fmt(q)}</td>`).join('')}<td class="num b">${fmt(row.reduce((a, c) => a + c, 0))}</td></tr>`; }).join('')}</tbody></table></div>` : ''}

  ${days.length > 1 ? `<h3>Кунлар бўйича</h3>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Сана</th><th class="num">Чек</th><th class="num">Дона</th><th class="num">Сумма</th><th></th></tr></thead>
    <tbody>${days.map(([dt, x]) => `<tr><td class="nw">${dLabel(dt)}</td><td class="num">${fmt(x.docs)}</td><td class="num">${fmt(x.qty)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, dyMax)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}

/* ───────────── modal / toast ───────────── */

function modal({ title, body, input, ok = 'OK', cancel = 'Ортга', danger }) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    root.innerHTML = `<div class="ov"><div class="mdl" role="dialog" aria-modal="true">
      <h3>${esc(title)}</h3><div class="mdl-b">${body || ''}</div>
      ${input ? `<label>${esc(input)}<input id="mdl-in" autocomplete="off"></label>` : ''}
      <div class="mdl-f"><button class="btn ghost" id="mdl-no">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" id="mdl-ok">${esc(ok)}</button></div>
    </div></div>`;
    const done = (v) => { root.innerHTML = ''; document.removeEventListener('keydown', key); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') done(null); if (e.key === 'Enter') { e.preventDefault(); $('#mdl-ok').click(); } };
    document.addEventListener('keydown', key);
    $('#mdl-no').onclick = () => done(null);
    $('.ov').onclick = (e) => { if (e.target.classList.contains('ov')) done(null); };
    $('#mdl-ok').onclick = () => done(input ? $('#mdl-in').value : true);
    const f = $('#mdl-in') || $('#mdl-ok'); f.focus();
  });
}
const confirmBox = (text, ok) => modal({ title: text, ok: ok || 'Ҳа' }).then((v) => v === true);

function toast(text, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), kind === 'err' ? 5000 : 3000);
  setTimeout(() => el.remove(), kind === 'err' ? 5500 : 3500);
}

/* ───────────── ishga tushirish ───────────── */

function start() {
  const view = document.getElementById('app');
  view.addEventListener('input', (e) => { if (e.target.tagName !== 'SELECT') onViewInput(e); });
  view.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') onViewInput(e); });
  view.addEventListener('focusout', onViewBlur);
  view.addEventListener('click', onViewClick);

  if (S.token) {
    try {
      const c = JSON.parse(lsGet(LS.cache) || 'null');
      if (c && c.user && c.cfg) {
        S.user = c.user; S.cfg = c.cfg; S.cfgHash = c.cfgHash; S.stock = c.stock || {}; S.today = c.today || []; S.ver = c.ver;
        S.branch = isAdmin() ? (lsGet(LS.branch) || '') : S.user.branch;
        if (S.branch && !branchNames().includes(S.branch)) S.branch = '';
        renderApp();
      }
    } catch (e) { /* */ }
    api('boot').then((j) => {
      const first = !S.user;
      const cfgChanged = j.cfgHash !== S.cfgHash;
      applyState(j);
      if (isAdmin() && first) S.branch = lsGet(LS.branch) || '';
      if (first || cfgChanged) renderApp(); else softRefresh();
    }).catch((e) => { if (!S.user) renderLogin(e.message); });
    if (!S.user) $('#app').innerHTML = '<div class="login"><div class="login-card"><div class="logo">✚</div><p class="muted">Юкланмоқда…</p></div></div>';
  } else {
    renderLogin();
  }

  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 45000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - S.lastSync > 10000) sync();
  });
  window.addEventListener('online', () => sync());
}

start();
