/* Др. Шерматов — дорихоналар тармоғи · сайт (оддий JS, framework йўқ) */
'use strict';

// Apps Script Web App манзили (…/exec). Бўш бўлса — кириш саҳифасида бир марта киритилади.
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbzZTKSeZXjod6A5HO7_sZbSCVFVXdcHBHzaiQ0Myroc61AHtfIXZcMALa4zbLLuPdnmOg/exec';

const LS = { api: 'sh_api', token: 'sh_token', cache: 'sh_cache', branch: 'sh_branch', page: 'sh_page' };
const TZ = 'Asia/Tashkent';
const T = { IN: 'Приход', OUT: 'Расход', TR: 'Ўтказма' };
const CANCEL = 'Бекор';

const PAGES = [
  { id: 'sale', t: 'Сотув', ic: 'cart', sub: 'Мижозга маҳсулот сотиш' },
  { id: 'income', t: 'Приход', ic: 'income', sub: 'Филиалга келган товарни қолдиққа қўшиш' },
  { id: 'transfer', t: 'Ўтказма', ic: 'transfer', sub: 'Бир филиалдан бошқасига товар ўтказиш' },
  { id: 'stock', t: 'Қолдиқ', ic: 'box', sub: 'Ҳамма филиаллардаги қолдиқ' },
  { id: 'history', t: 'Тарих', ic: 'clock', sub: 'Ҳамма ёзувлар, қидирув ва бекор қилиш' },
  { id: 'report', t: 'Ҳисобот', ic: 'chart', sub: 'Сотув, приход ва врачлар бўйича', admin: true },
];

/* ───────────── ikonkalar ───────────── */

const ICONS = {
  leaf: '<path d="M5 19c0-8.5 5.5-14 15-14 0 9.5-5.5 15-14 15"/><path d="M5 19l8-8"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.6l2.4 11.1a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 7.5H6"/>',
  income: '<path d="M12 3.5v10m0 0-4-4m4 4 4-4"/><path d="M4 14.5v3.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3.5"/>',
  transfer: '<path d="M7 7.5h13m0 0-3.5-3.5M20 7.5 16.5 11"/><path d="M17 16.5H4m0 0L7.5 13M4 16.5 7.5 20"/>',
  box: '<path d="M20.5 7.8 12 3.3 3.5 7.8v8.4l8.5 4.5 8.5-4.5z"/><path d="M3.5 7.8 12 12.3l8.5-4.5M12 12.3v8.4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chart: '<path d="M3.5 20h17"/><path d="M7 16.5v-5M12 16.5V6.5M17 16.5v-8"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
  logout: '<path d="M14.5 4h3.5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H16"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  doctor: '<path d="M6.5 3.5v5a4 4 0 0 0 8 0v-5"/><path d="M10.5 12.5v1.5a5 5 0 0 0 10 0V12"/><circle cx="20.5" cy="10" r="1.8"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4.5H15"/>',
  print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17h.01"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="M9 5.5h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-6-6.5z"/><path d="m12 9.5 5 5m0-5-5 5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
  note: '<path d="M5 4.5h14v15H5z"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

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
const isForm = (p) => ['sale', 'income', 'transfer'].includes(p);

function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dLabel(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso || ''); }
function hm(ts) { return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ts)); }

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
function rangeLabel(from, to) { return from === to ? dLabel(from) : `${dLabel(from)} – ${dLabel(to)}`; }

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
  if (S.net === 'off') return `<span id="net" class="net off" title="Интернет ёки сервер билан алоқа йўқ"><i></i>Алоқа йўқ</span>`;
  if (S.syncing) return `<span id="net" class="net busy"><i></i>Янгиланмоқда</span>`;
  return `<span id="net" class="net ok" title="Маълумот янгиланган вақт"><i></i>${S.lastSync ? hm(S.lastSync) : 'Онлайн'}</span>`;
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

/* ───────────── kirish (PIN klaviatura) ───────────── */

let pinBuf = '';

function renderLogin(msg) {
  pinBuf = '';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'];
  $('#app').innerHTML = `
  <div class="login">
    <section class="login-art" aria-hidden="true">
      <div class="mark big">${ic('leaf')}</div>
      <h1>Др. Шерматов</h1>
      <p>Дорихоналар тармоғи</p>
    </section>
    <form class="login-card" id="login-form" autocomplete="off">
      <div class="mark sm-only">${ic('leaf')}</div>
      <h2>PIN кодни киритинг</h2>
      <div class="dots" id="dots"></div>
      <div class="err" id="login-err" role="alert">${esc(msg || '')}</div>
      <div class="pad">
        ${keys.map((k) => k === 'back'
          ? `<button type="button" class="key fn" data-k="back" aria-label="Ўчириш">${ic('back')}</button>`
          : k === 'ok'
            ? `<button type="submit" class="key go" id="login-btn" aria-label="Кириш">${ic('arrow')}</button>`
            : `<button type="button" class="key" data-k="${k}">${k}</button>`).join('')}
      </div>
      <button class="link-btn" type="button" id="toggle-url">${ic('gear')} Сервер манзили</button>
      <div id="url-box" class="${S.api ? 'hidden' : ''}">
        <label class="field"><span>Apps Script Web App манзили</span>
          <input id="api-url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(S.api)}">
        </label>
      </div>
    </form>
  </div>`;
  drawDots();
  $('#toggle-url').onclick = () => $('#url-box').classList.toggle('hidden');
  $('.pad').onclick = (e) => {
    const k = e.target.closest('[data-k]');
    if (!k) return;
    pinKey(k.dataset.k);
  };
  $('#login-form').onsubmit = (e) => { e.preventDefault(); doLogin(); };
}

function pinKey(k) {
  if (k === 'back') pinBuf = pinBuf.slice(0, -1);
  else if (/^\d$/.test(k) && pinBuf.length < 12) pinBuf += k;
  const err = $('#login-err'); if (err) err.textContent = '';
  drawDots();
}

function drawDots() {
  const d = $('#dots');
  if (!d) return;
  const n = Math.max(4, pinBuf.length);
  d.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < pinBuf.length ? 'on' : ''}"></i>`).join('');
}

async function doLogin() {
  const urlIn = $('#api-url');
  const url = urlIn ? urlIn.value.trim() : '';
  if (url) { S.api = url; lsSet(LS.api, url); }
  const err = $('#login-err');
  if (!S.api) { err.textContent = 'Сервер манзилини киритинг'; $('#url-box').classList.remove('hidden'); return; }
  if (!pinBuf) { err.textContent = 'PIN кодни киритинг'; return; }
  const card = $('#login-form');
  card.classList.add('busy');
  try {
    const j = await api('login', { pin: pinBuf });
    S.token = j.token; lsSet(LS.token, j.token);
    applyState(j);
    if (isAdmin()) S.branch = lsGet(LS.branch) || '';
    if (S.branch && !branchNames().includes(S.branch)) S.branch = '';
    renderApp();
  } catch (e) {
    card.classList.remove('busy');
    pinBuf = ''; drawDots();
    err.textContent = e.message;
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  }
}

document.addEventListener('keydown', (e) => {
  if (!$('#login-form') || e.target.id === 'api-url') return;
  if (/^\d$/.test(e.key)) { pinKey(e.key); e.preventDefault(); }
  else if (e.key === 'Backspace') { pinKey('back'); e.preventDefault(); }
  else if (e.key === 'Enter') { e.preventDefault(); doLogin(); }
});

function logout(expired) {
  S.token = ''; S.user = null; S.forms = {};
  S.hist.data = null; S.rep.data = null;
  lsSet(LS.token, null); lsSet(LS.cache, null);
  renderLogin(expired ? 'Сеанс тугади — қайта киринг' : '');
}

/* ───────────── asosiy qobiq ───────────── */

function navButtons(pages) {
  return pages.map((p) => `<button data-page="${p.id}" class="${p.id === S.page ? 'on' : ''}" ${p.id === S.page ? 'aria-current="page"' : ''}>${ic(p.ic)}<span>${p.t}</span></button>`).join('');
}

function renderApp() {
  if (!S.user || !S.cfg) return renderLogin();
  const pages = PAGES.filter((p) => !p.admin || isAdmin());
  if (!pages.some((p) => p.id === S.page)) S.page = 'sale';
  const pg = PAGES.find((p) => p.id === S.page);
  const initials = S.user.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const brSel = isAdmin()
    ? `<label class="branch-sel">${ic('pin')}<select id="branch-sel" aria-label="Филиал">
        <option value="">Ҳамма филиаллар</option>
        ${branchNames().map((b) => `<option ${b === S.branch ? 'selected' : ''}>${esc(b)}</option>`).join('')}
      </select></label>`
    : `<span class="branch-sel fixed">${ic('pin')}<span>${esc(S.user.branch)}</span></span>`;
  $('#app').innerHTML = `
  <div class="shell">
    <aside class="rail">
      <div class="brand"><span class="mark">${ic('leaf')}</span><span class="brand-t">${esc(S.cfg.name)}</span></div>
      <nav class="rail-nav" id="tabs" aria-label="Бўлимлар">${navButtons(pages)}</nav>
      <div class="me-box">
        <span class="avatar">${esc(initials)}</span>
        <span class="me-t"><b>${esc(S.user.name)}</b><small>${isAdmin() ? 'Админ' : esc(S.user.branch)}</small></span>
        <button class="icon-btn" id="logout" title="Чиқиш" aria-label="Чиқиш">${ic('logout')}</button>
      </div>
    </aside>
    <div class="stage">
      <header class="page-h">
        <span class="mark m-only">${ic('leaf')}</span>
        <div class="ph-t"><h1 id="page-title">${pg.t}</h1><p id="page-sub">${pg.sub}</p></div>
        <div class="ph-r">${netHTML()}${brSel}
          <button class="icon-btn m-only" id="logout-m" title="Чиқиш" aria-label="Чиқиш">${ic('logout')}</button></div>
      </header>
      <main id="view"></main>
    </div>
    <nav class="tabbar" id="tabbar" aria-label="Бўлимлар">${navButtons(pages)}</nav>
  </div>`;
  const out = async () => { if (await confirmBox('Тизимдан чиқасизми?', 'Чиқиш')) logout(); };
  $('#logout').onclick = out;
  $('#logout-m').onclick = out;
  const go = (e) => {
    const b = e.target.closest('[data-page]');
    if (!b || b.dataset.page === S.page) return;
    S.page = b.dataset.page; lsSet(LS.page, S.page);
    document.querySelectorAll('[data-page]').forEach((x) => {
      const on = x.dataset.page === S.page;
      x.classList.toggle('on', on);
      on ? x.setAttribute('aria-current', 'page') : x.removeAttribute('aria-current');
    });
    const p = PAGES.find((x) => x.id === S.page);
    $('#page-title').textContent = p.t; $('#page-sub').textContent = p.sub;
    renderView(true);
    window.scrollTo({ top: 0 });
  };
  $('#tabs').onclick = go;
  $('#tabbar').onclick = go;
  const bs = $('#branch-sel');
  if (bs) bs.onchange = () => {
    S.branch = bs.value; lsSet(LS.branch, S.branch);
    S.hist.data = null;
    renderView(true);
  };
  renderView(true);
}

function renderView(animate) {
  const v = $('#view');
  if (!v) return;
  const fn = { sale: viewSale, income: viewIncome, transfer: viewTransfer, stock: viewStock, history: viewHistory, report: viewReport }[S.page];
  v.innerHTML = fn ? fn() : '';
  if (animate) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
  if (isForm(S.page) && $('#f-total')) {
    form(S.page).lines.forEach((_, j) => updateLineMeta(S.page, j));
    updateTotals(S.page);
  }
  after();
}

/** Sinxrondan keyin: yozilayotgan formani buzmasdan faqat yon panel va qoldiqlarni yangilash. */
function softRefresh() {
  if (isForm(S.page)) {
    const side = $('#side');
    if (side) side.innerHTML = sideHTML(S.page);
    const dl = $('#dl-products');
    if (dl) dl.innerHTML = prodOptions();
    form(S.page).lines.forEach((_, j) => updateLineMeta(S.page, j));
  } else if (S.page === 'stock') {
    renderView();
  }
}

function after() {
  if (S.page === 'history' && !S.hist.data && !S.hist.loading) loadHistory();
  if (S.page === 'report' && !S.rep.data && !S.rep.loading) loadReport();
}

/* ───────────── filial tanlash (admin) ───────────── */

function needBranch() {
  if (S.branch) return '';
  return `<section class="panel pick">
    <span class="pick-ic">${ic('pin')}</span>
    <h2>Қайси филиал учун ёзасиз?</h2>
    <p>Админ ҳамма филиал номидан ёза олади. Филиални танланг — кейин тепадаги рўйхатдан алмаштирса бўлади.</p>
    <div class="pick-grid">${branchNames().map((b) => `<button class="pick-b" data-act="pick-branch" data-b="${esc(b)}">${ic('pin')}<span>${esc(b)}</span></button>`).join('')}</div>
  </section>`;
}

/* ───────────── formalar: sotuv / prixod / o'tkazma ───────────── */

function newLine() { return { product: '', text: '', qty: '1', price: '', sum: '', manual: false }; }
function form(id) {
  if (!S.forms[id]) S.forms[id] = { lines: [newLine()], client: '', doctor: '', note: '', to: '', rid: uid(), busy: false };
  return S.forms[id];
}

function linesHTML(kind) {
  const f = form(kind);
  const sale = kind === 'sale';
  const head = `<div class="line head ${sale ? 'sale' : ''}" aria-hidden="true">
      <span>Маҳсулот</span><span class="c">Сони</span>${sale ? '<span class="r">Нарх</span><span class="r">Сумма</span>' : ''}<span></span></div>`;
  const rows = f.lines.map((l, i) => `
    <div class="line ${sale ? 'sale' : ''}" data-line="${i}">
      <div class="prod">${ic('search')}<input data-f="product" data-i="${i}" list="dl-products" value="${esc(l.product || l.text)}" placeholder="Маҳсулот номини ёзинг" autocomplete="off" aria-label="Маҳсулот" class="prod-in" title="${esc(l.product)}"><span class="stock-b" data-stockbadge="${i}"></span></div>
      <div class="qty">
        <button type="button" data-act="qty-dec" data-i="${i}" aria-label="Камайтириш">${ic('minus')}</button>
        <input data-f="qty" data-i="${i}" inputmode="numeric" value="${esc(l.qty)}" aria-label="Сони">
        <button type="button" data-act="qty-inc" data-i="${i}" aria-label="Кўпайтириш">${ic('plus')}</button>
      </div>
      ${sale ? `<input class="money" data-f="price" data-i="${i}" inputmode="numeric" value="${l.price === '' ? '' : fmt(l.price)}" aria-label="Нарх" placeholder="Нарх">
      <input class="money ${l.manual ? 'manual' : ''}" data-f="sum" data-i="${i}" inputmode="numeric" value="${l.sum === '' ? '' : fmt(l.sum)}" aria-label="Сумма" placeholder="Сумма" title="Қўлда ўзгартирилса — чегирма">` : ''}
      <button class="icon-btn x" data-act="del-line" data-i="${i}" title="Қаторни ўчириш" aria-label="Қаторни ўчириш">${ic('x')}</button>
    </div>`).join('');
  return `<div class="lines" id="lines">${head}${rows}<datalist id="dl-products">${prodOptions()}</datalist></div>
    <button class="add-line" data-act="add-line">${ic('plus')}<span>Яна маҳсулот қўшиш</span></button>`;
}

function prodOptions() {
  return (S.cfg.products || []).map((p) => `<option value="${esc(p.name)}">${S.branch ? 'қолдиқ: ' + stockOf(S.branch, p.name) : ''}</option>`).join('');
}

function findProduct(text) {
  const v = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!v) return null;
  return (S.cfg.products || []).find((p) => p.name.toLowerCase() === v) || null;
}

function updateLineMeta(kind, i) {
  const f = form(kind);
  const l = f.lines[i];
  const el = document.querySelector(`[data-stockbadge="${i}"]`);
  if (!l || !el) return;
  if (!l.product) { el.textContent = ''; el.className = 'stock-b'; return; }
  const p = product(l.product) || {};
  const have = stockOf(S.branch, l.product);
  const need = f.lines.filter((x) => x.product === l.product).reduce((a, x) => a + num(x.qty), 0);
  el.textContent = fmt(have) + ' ' + (p.unit || 'дона');
  let cls = 'stock-b';
  if (kind !== 'income' && need > have) cls += ' bad';
  else if (kind !== 'income' && have <= (p.min || 0)) cls += ' low';
  el.className = cls;
  el.title = kind !== 'income' && need > have ? `Етарли эмас: ${have} бор, ${need} керак` : 'Шу филиалдаги қолдиқ';
}

function updateTotals(kind) {
  const f = form(kind);
  const el = $('#f-total');
  if (!el) return;
  const act = f.lines.filter((l) => l.product);
  const qty = act.reduce((a, l) => a + num(l.qty), 0);
  const kinds = new Set(act.map((l) => l.product)).size;
  if (kind === 'sale') {
    const sum = act.reduce((a, l) => a + num(l.sum), 0);
    el.innerHTML = `<b class="amt">${fmt(sum)}<small>${cur()}</small></b><span class="sub">${fmt(qty)} дона, ${kinds} хил маҳсулот</span>`;
  } else {
    el.innerHTML = `<b class="amt">${fmt(qty)}<small>дона</small></b><span class="sub">${kinds} хил маҳсулот</span>`;
  }
}

function checkoutHTML(kind, label) {
  const f = form(kind);
  return `<div class="checkout">
    <div class="co-l"><span class="co-cap">Жами</span><div id="f-total"></div></div>
    <button class="go" data-act="submit" data-kind="${kind}" ${f.busy ? 'disabled' : ''}>${f.busy ? '<span class="spin"></span>Сақланмоқда' : ic('check') + label}</button>
  </div>`;
}
const SUBMIT_LABEL = { sale: 'Сотиш', income: 'Приход қилиш', transfer: 'Ўтказиш' };

function viewSale() {
  const nb = needBranch();
  if (nb) return nb;
  const f = form('sale');
  return `<div class="work">
    <section class="panel sheet">
      <div class="who">
        <label class="field"><span>Мижоз Ф.И.Ш <b class="req" title="Мажбурий">*</b></span>
          <div class="in-ic">${ic('user')}<input id="f-client" data-ff="client" value="${esc(f.client)}" placeholder="Масалан: Каримов Алишер" autocomplete="off"></div>
        </label>
        <label class="field"><span>Юборган врач</span>
          <div class="in-ic">${ic('doctor')}<input id="f-doctor" data-ff="doctor" list="dl-doctors" value="${esc(f.doctor)}" placeholder="Рўйхатдан танланг ёки ёзинг" autocomplete="off"></div>
          <datalist id="dl-doctors">${(S.cfg.doctors || []).map((d) => `<option value="${esc(d)}">`).join('')}</datalist>
        </label>
      </div>
      ${linesHTML('sale')}
      <label class="field note"><span>Изоҳ</span><input data-ff="note" value="${esc(f.note)}" placeholder="Ихтиёрий"></label>
      ${checkoutHTML('sale', 'Сотиш')}
    </section>
    <aside class="feed" id="side">${sideHTML('sale')}</aside>
  </div>`;
}

function viewIncome() {
  const nb = needBranch();
  if (nb) return nb;
  const f = form('income');
  return `<div class="work">
    <section class="panel sheet">
      <p class="hint">${ic('income')}<span>Фақат маҳсулот ва сони ёзилади, сумма керак эмас. <b>${esc(S.branch)}</b> қолдиғига қўшилади.</span></p>
      ${linesHTML('income')}
      <label class="field note"><span>Изоҳ</span><input data-ff="note" value="${esc(f.note)}" placeholder="Масалан: қаердан келди, накладной рақами"></label>
      ${checkoutHTML('income', 'Приход қилиш')}
    </section>
    <aside class="feed" id="side">${sideHTML('income')}</aside>
  </div>`;
}

function viewTransfer() {
  const nb = needBranch();
  if (nb) return nb;
  const f = form('transfer');
  const others = branchNames().filter((b) => b !== S.branch);
  if (f.to && !others.includes(f.to)) f.to = '';
  return `<div class="work">
    <section class="panel sheet">
      <div class="route">
        <div class="field"><span>Қаердан</span><div class="from">${ic('pin')}<b>${esc(S.branch)}</b></div></div>
        <span class="route-arrow">${ic('arrow')}</span>
        <label class="field"><span>Қаерга <b class="req" title="Мажбурий">*</b></span>
          <select data-ff="to" id="f-to">
            <option value="">Филиални танланг</option>
            ${others.map((b) => `<option ${b === f.to ? 'selected' : ''}>${esc(b)}</option>`).join('')}
          </select>
        </label>
      </div>
      ${linesHTML('transfer')}
      <div id="to-hint" class="hint soft">${toHint()}</div>
      <label class="field note"><span>Изоҳ</span><input data-ff="note" value="${esc(f.note)}" placeholder="Ихтиёрий"></label>
      ${checkoutHTML('transfer', 'Ўтказиш')}
    </section>
    <aside class="feed" id="side">${sideHTML('transfer')}</aside>
  </div>`;
}

function toHint() {
  const f = form('transfer');
  if (!f.to) return '';
  const ps = [...new Set(f.lines.filter((l) => l.product).map((l) => l.product))];
  if (!ps.length) return '';
  return `${ic('box')}<span>${esc(f.to)} қолдиғи: ${ps.map((p) => `${esc(p)} — <b>${stockOf(f.to, p)}</b>`).join(', ')}</span>`;
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
  const lines = g.lines.map((l) => `<li><span class="nm">${esc(l.product)}</span><span class="q">${fmt(l.qty)} × ${g.type === T.OUT && l.sum != null ? fmt(l.sum) : 'дона'}</span></li>`).join('');
  let who = '';
  if (g.type === T.OUT) who = `<div class="doc-who"><span>${ic('user')}${esc(g.client)}</span>${g.doctor ? `<span>${ic('doctor')}${esc(g.doctor)}</span>` : ''}</div>`;
  if (g.type === T.TR) who = `<div class="doc-who"><span class="route-s">${esc(g.branch)} ${ic('arrow')} ${esc(g.to)}</span></div>`;
  if (g.type === T.IN && g.note) who = `<div class="doc-who"><span>${ic('note')}${esc(g.note)}</span></div>`;
  const showBr = !S.branch && g.type !== T.TR;
  return `<article class="doc ${off ? 'off' : ''}">
    <header><b class="no">${esc(g.doc)}</b><span class="tm">${esc(g.time)}</span>${showBr ? `<span class="br">${esc(g.branch)}</span>` : ''}
      ${off ? '<span class="tag red">Бекор қилинган</span>' : ''}
      ${canCancel(g) ? `<button class="mini-danger" data-act="cancel" data-doc="${esc(g.doc)}" title="Ҳужжатни бекор қилиш">Бекор қилиш</button>` : ''}</header>
    ${who}
    <ul>${lines}</ul>
    <footer><b>${g.type === T.OUT ? money(g.sum) : fmt(g.qty) + ' дона'}</b><span>${esc(g.op)}</span></footer>
  </article>`;
}

function sideHTML(kind) {
  const type = { sale: T.OUT, income: T.IN, transfer: T.TR }[kind];
  const rows = S.today.filter((r) => r.type === type && (!S.branch || r.branch === S.branch || (type === T.TR && r.to === S.branch)));
  const docs = groupDocs(rows).reverse();
  const act = docs.filter((d) => d.status !== CANCEL);
  const title = { sale: 'Бугунги сотувлар', income: 'Бугунги приход', transfer: 'Бугунги ўтказмалар' }[kind];
  let stats = '';
  if (kind === 'sale') {
    stats = `<div class="feed-stats">
      <div class="fs-main"><small>Тушум</small><b>${fmt(act.reduce((a, d) => a + d.sum, 0))}</b><small>${cur()}</small></div>
      <div><small>Чеклар</small><b>${act.length}</b></div>
      <div><small>Дона</small><b>${fmt(act.reduce((a, d) => a + d.qty, 0))}</b></div>
    </div>`;
  }
  const empty = { sale: 'Бугун ҳали сотув йўқ. Биринчи сотув шу ерда пайдо бўлади.', income: 'Бугун ҳали приход қилинмаган.', transfer: 'Бугун ҳали ўтказма йўқ.' }[kind];
  return `<div class="feed-h"><h3>${title}</h3><span>${S.branch ? esc(S.branch) : 'Ҳамма филиаллар'}</span></div>${stats}
    <div class="feed-list">${docs.length ? docs.map(docCard).join('') : `<p class="empty">${empty}</p>`}</div>`;
}

/* form hodisalari */

function onViewInput(e) {
  const t = e.target;
  const kind = S.page;
  if (!isForm(kind)) {
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
    l.text = t.value;
    const p = findProduct(t.value);
    const name = p ? p.name : '';
    t.classList.remove('bad');
    if (name === l.product) return;
    l.product = name;
    l.price = p && p.price ? p.price : '';
    l.manual = false;
    l.sum = l.price === '' ? '' : num(l.qty) * num(l.price);
    const row = t.closest('.line');
    if (row && kind === 'sale') {
      row.querySelector('[data-f="price"]').value = l.price === '' ? '' : fmt(l.price);
      const s = row.querySelector('[data-f="sum"]'); s.value = l.sum === '' ? '' : fmt(l.sum); s.classList.remove('manual');
    }
    if (row) row.classList.toggle('filled', !!name);
    t.title = name;
    updateTotals(kind);
    f.lines.forEach((_, j) => updateLineMeta(kind, j));
    if (kind === 'transfer') { const h = $('#to-hint'); if (h) h.innerHTML = toHint(); }
    if (name && kind === 'sale' && !l.price) { const pr = row && row.querySelector('[data-f="price"]'); if (pr) pr.focus(); }
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
  if (t.dataset && t.dataset.f === 'product' && isForm(S.page)) {
    const l = form(S.page).lines[Number(t.dataset.i)];
    if (l && l.product) t.value = l.product;
    else if (t.value.trim()) t.classList.add('bad');
  }
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
    renderView(true);
  } else if (act === 'add-line') {
    form(kind).lines.push(newLine());
    rerenderLines(kind);
    const ins = document.querySelectorAll('#lines .prod-in');
    if (ins.length) ins[ins.length - 1].focus();
  } else if (act === 'del-line') {
    const f = form(kind);
    f.lines.splice(Number(b.dataset.i), 1);
    if (!f.lines.length) f.lines.push(newLine());
    rerenderLines(kind);
  } else if (act === 'qty-inc' || act === 'qty-dec') {
    const inp = b.parentElement.querySelector('[data-f="qty"]');
    inp.value = Math.max(1, num(inp.value) + (act === 'qty-inc' ? 1 : -1));
    inp.dispatchEvent(new Event('input', { bubbles: true }));
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
    b.classList.add('spinning');
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
  wrap.nextElementSibling.remove(); // eski «қўшиш» тугмаси
  wrap.replaceWith(...tmp.children);
  form(kind).lines.forEach((l, j) => {
    updateLineMeta(kind, j);
    const row = document.querySelector(`.line[data-line="${j}"]`);
    if (row) row.classList.toggle('filled', !!l.product);
  });
  updateTotals(kind);
  if (kind === 'transfer') { const h = $('#to-hint'); if (h) h.innerHTML = toHint(); }
}

async function submit(kind) {
  const f = form(kind);
  if (f.busy) return;
  const lost = f.lines.find((l) => !l.product && String(l.text || '').trim());
  if (lost) return toast(`«${lost.text.trim()}» деган маҳсулот йўқ. Рўйхатдан танланг`, 'err');
  const lines = f.lines.filter((l) => l.product);
  if (!lines.length) return toast('Камида битта маҳсулот танланг', 'err');
  for (const l of lines) if (!(num(l.qty) > 0)) return toast(`«${l.product}»: сонини ёзинг`, 'err');
  const payload = { branch: S.branch, note: f.note, rid: f.rid };
  if (kind === 'sale') {
    if (!f.client.trim()) { toast('Мижознинг исм-фамилиясини ёзинг', 'err'); const c = $('#f-client'); if (c) c.focus(); return; }
    const free = lines.find((l) => !(num(l.sum) > 0));
    if (free) return toast(`«${free.product}»: нарх ёки суммани ёзинг`, 'err');
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
      if (need[p] > have) return toast(`«${p}» етарли эмас: ${have} бор, ${need[p]} керак`, 'err');
    }
  }
  if (kind === 'transfer' && !(await modal({
    title: 'Ўтказмани тасдиқланг',
    body: `<b>${esc(S.branch)}</b> дан <b>${esc(f.to)}</b> га ${fmt(payload.items.reduce((a, x) => a + x.qty, 0))} дона ўтказилади.`,
    ok: 'Ўтказиш',
  }))) return;
  f.busy = true; setSubmitBusy(kind, true);
  try {
    const j = await api(kind, payload);
    applyState(j);
    S.forms[kind] = null;
    const label = { sale: 'Сотилди', income: 'Приход қилинди', transfer: 'Ўтказилди' }[kind];
    toast(`${label}: ${j.doc}${kind === 'sale' && j.total != null ? ', ' + money(j.total) : ''}${j.dup ? ' (аввал сақланган)' : ''}`, 'ok');
    S.hist.data = null; S.rep.data = null;
    renderView();
    const first = document.querySelector(kind === 'sale' ? '#f-client' : '#lines .prod-in');
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
  b.innerHTML = busy ? '<span class="spin"></span>Сақланмоқда' : ic('check') + SUBMIT_LABEL[kind];
}

async function cancelDoc(doc) {
  const reason = await modal({
    title: `${doc} ни бекор қилиш`,
    body: 'Ёзув ўчмайди: «Бекор» деб белгиланади ва қолдиқ қайтарилади. Сабабини ёзинг — у тарихда сақланади.',
    input: 'Сабаби', ok: 'Бекор қилиш', cancel: 'Ортга', danger: true,
  });
  if (reason == null) return;
  if (!reason.trim()) return toast('Бекор қилиш сабабини ёзинг', 'err');
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
    // ҳали ҳеч қаерга келмаган маҳсулотлар рўйхатни тўлдириб юбормасин
    if (!brs.some((x) => stockOf(x, p.name) > 0) && q === 0) return;
    if (q <= p.min) {
      const donor = brs.filter((x) => x !== b).map((x) => [x, stockOf(x, p.name)]).sort((a, c) => c[1] - a[1])[0];
      low.push({ b, p, q, donor: donor && donor[1] > p.min ? donor : null });
    }
  }));
  low.sort((a, c) => a.q - c.q);
  const totals = brs.map((b) => prods.reduce((a, p) => a + stockOf(b, p.name), 0));
  return `
  ${low.length ? `<section class="callout"><details ${low.length <= 6 ? 'open' : ''}>
    <summary>${ic('alert')}<span><b>${low.length} та маҳсулот кам қолган</b>${me ? ' — ' + esc(me) : ''}</span></summary>
    <ul class="low">${low.map((x) => `<li><span class="nm">${esc(x.p.name)}${me ? '' : `<small>${esc(x.b)}</small>`}</span>
      <span class="q ${x.q <= 0 ? 'zero' : ''}">${x.q} ${esc(x.p.unit)}</span>
      <span class="donor">${x.donor ? `${esc(x.donor[0])}да ${x.donor[1]} бор` : 'Бошқа филиалда ҳам кам'}</span></li>`).join('')}</ul>
    ${me ? `<button class="btn soft sm" data-act="go-transfer">${ic('transfer')}Ўтказма қилиш</button>` : ''}
  </details></section>` : ''}
  <section class="panel">
    <div class="toolbar">
      <div class="search">${ic('search')}<input id="stock-q" placeholder="Маҳсулот қидириш" value="${esc(S.stockQ)}" aria-label="Маҳсулот қидириш"></div>
      <span class="legend"><i class="sw low"></i>Кам қолган <i class="sw zero"></i>Тугаган</span>
      <button class="btn soft sm" data-act="refresh">${ic('refresh')}Янгилаш</button>
    </div>
    <div class="tbl-wrap"><table class="tbl stock" id="stock-tbl">
      <thead><tr><th class="sticky">Маҳсулот</th>${brs.map((b) => `<th class="num ${b === me ? 'me' : ''}">${esc(b)}</th>`).join('')}<th class="num">Жами</th></tr></thead>
      <tbody>${prods.map((p) => {
        const qs = brs.map((b) => stockOf(b, p.name));
        return `<tr data-name="${esc(p.name.toLowerCase())}"><td class="sticky"><span class="pn">${esc(p.name)}</span>${p.price ? `<small>${fmt(p.price)} ${cur()}</small>` : ''}</td>
          ${qs.map((q, i) => `<td class="num ${brs[i] === me ? 'me' : ''}"><span class="qv ${q <= 0 ? 'zero' : q <= p.min ? 'low' : ''}">${fmt(q)}</span></td>`).join('')}
          <td class="num tot">${fmt(qs.reduce((a, c) => a + c, 0))}</td></tr>`;
      }).join('')}</tbody>
      <tfoot><tr><td class="sticky">Жами</td>${totals.map((t, i) => `<td class="num ${brs[i] === me ? 'me' : ''}">${fmt(t)}</td>`).join('')}<td class="num">${fmt(totals.reduce((a, c) => a + c, 0))}</td></tr></tfoot>
    </table></div>
  </section>`;
}

function filterStock() {
  const q = S.stockQ.trim().toLowerCase();
  document.querySelectorAll('#stock-tbl tbody tr').forEach((tr) => { tr.style.display = !q || tr.dataset.name.includes(q) ? '' : 'none'; });
}

/* ───────────── tarix ───────────── */

function periodBar(prefix, st) {
  const [from, to] = presetRange(st.preset, st.from, st.to);
  return `<div class="seg" role="group" aria-label="Давр">${PRESETS.map(([k, t]) => `<button class="${st.preset === k ? 'on' : ''}" data-act="${prefix}-preset" data-p="${k}">${t}</button>`).join('')}</div>
    ${st.preset === 'custom' ? `<div class="dates"><input type="date" id="${prefix}-from" value="${from}" aria-label="Бошланиши"><span>–</span><input type="date" id="${prefix}-to" value="${to}" aria-label="Тугаши"></div>` : ''}`;
}

function readHistFilters() {
  const h = S.hist;
  if ($('#h-from')) h.from = $('#h-from').value;
  if ($('#h-to')) h.to = $('#h-to').value;
  if ($('#h-type')) h.type = $('#h-type').value;
  if ($('#h-q')) h.q = $('#h-q').value;
}

const loadingHTML = '<div class="loading"><span class="spin dark"></span>Юкланмоқда</div>';

function viewHistory() {
  const h = S.hist;
  const [from, to] = presetRange(h.preset, h.from, h.to);
  let body = loadingHTML;
  if (h.data && !h.loading) body = histTable(h.data);
  if (h.error) body = `<p class="empty err">${esc(h.error)}</p>`;
  return `<section class="panel">
    <div class="filters">
      ${periodBar('h', h)}
      <div class="f-row">
        <select id="h-type" aria-label="Тури"><option value="">Ҳамма турлар</option>${[T.OUT, T.IN, T.TR].map((t) => `<option ${h.type === t ? 'selected' : ''} value="${t}">${t === T.OUT ? 'Расход (сотув)' : t}</option>`).join('')}</select>
        <div class="search grow">${ic('search')}<input id="h-q" placeholder="Мижоз, врач, маҳсулот ёки ҳужжат рақами" value="${esc(h.q)}" aria-label="Қидирув"></div>
        <button class="btn primary" data-act="h-load">Кўрсатиш</button>
      </div>
    </div>
    <p class="range-cap">${S.branch ? esc(S.branch) : 'Ҳамма филиаллар'}, ${rangeLabel(from, to)}</p>
    <div id="h-body">${body}</div>
  </section>`;
}

async function loadHistory() {
  const h = S.hist;
  readHistFilters();
  const [from, to] = presetRange(h.preset, h.from, h.to);
  h.loading = true; h.error = '';
  const hb = $('#h-body'); if (hb) hb.innerHTML = loadingHTML;
  try {
    h.data = await api('history', { from, to, type: h.type, q: h.q, branch: S.branch });
  } catch (e) { h.error = e.message; h.data = null; }
  h.loading = false;
  if (S.page === 'history') {
    const b = $('#h-body');
    if (b) b.innerHTML = h.error ? `<p class="empty err">${esc(h.error)}</p>` : histTable(h.data);
  }
}

function typeTag(t) { return `<span class="tag ${t === T.OUT ? 'leaf' : t === T.IN ? 'sky' : 'plum'}">${t === T.OUT ? 'Сотув' : t}</span>`; }

function histTable(d) {
  if (!d || !d.rows.length) return '<p class="empty">Бу даврда ёзув йўқ. Даврни ёки филтрни ўзгартириб кўринг.</p>';
  const act = d.rows.filter((r) => r.status !== CANCEL);
  const sales = act.filter((r) => r.type === T.OUT);
  const sDocs = new Set(sales.map((r) => r.doc)).size;
  const sum = sales.reduce((a, r) => a + (r.sum || 0), 0);
  const inQ = act.filter((r) => r.type === T.IN).reduce((a, r) => a + r.qty, 0);
  const trQ = act.filter((r) => r.type === T.TR).reduce((a, r) => a + r.qty, 0);
  const canc = new Set(d.rows.filter((r) => r.status === CANCEL).map((r) => r.doc)).size;
  const docMap = new Map(groupDocs(d.rows).map((g) => [g.doc, g]));
  const seen = new Set();
  return `<div class="stats">
      <div class="st-main"><small>Сотув</small><b>${money(sum)}</b><span>${sDocs} та чек, ${fmt(sales.reduce((a, r) => a + r.qty, 0))} дона</span></div>
      <div><small>Приход</small><b>${fmt(inQ)}</b><span>дона</span></div>
      <div><small>Ўтказма</small><b>${fmt(trQ)}</b><span>дона</span></div>
      <div><small>Бекор қилинган</small><b>${canc}</b><span>ҳужжат</span></div>
    </div>
    ${d.total > d.rows.length ? `<p class="hint soft">${ic('alert')}<span>Охирги ${d.rows.length} та қатор кўрсатилди, жами ${d.total} та. Даврни қисқартиринг.</span></p>` : ''}
    <div class="tbl-wrap"><table class="tbl hist">
      <thead><tr><th>Сана</th><th>Ҳужжат</th><th>Тури</th><th>Филиал</th><th>Маҳсулот</th><th class="num">Сони</th><th class="num">Нарх</th><th class="num">Сумма</th><th>Мижоз</th><th>Врач</th><th>Оператор</th><th>Изоҳ</th><th></th></tr></thead>
      <tbody>${d.rows.map((r) => {
        const first = !seen.has(r.doc); seen.add(r.doc);
        const g = docMap.get(r.doc);
        return `<tr class="${r.status === CANCEL ? 'off' : ''} ${first ? 'first' : ''}">
          <td class="nw">${first ? `${dLabel(r.date)} <span class="muted">${esc(r.time)}</span>` : ''}</td>
          <td class="nw b">${first ? esc(r.doc) : ''}</td><td>${first ? typeTag(r.type) : ''}</td>
          <td class="nw">${first ? esc(r.branch) + (r.type === T.TR ? ` <span class="muted">→</span> ${esc(r.to)}` : '') : ''}</td>
          <td>${esc(r.product)}</td><td class="num">${fmt(r.qty)}</td>
          <td class="num">${r.price != null ? fmt(r.price) : ''}</td><td class="num b">${r.sum != null ? fmt(r.sum) : ''}</td>
          <td>${first ? esc(r.client) : ''}</td><td>${first ? esc(r.doctor) : ''}</td><td class="nw muted">${first ? esc(r.op) : ''}</td>
          <td class="note">${first ? esc(r.note) : ''}</td>
          <td>${first && g && canCancel(g) ? `<button class="mini-danger" data-act="cancel" data-doc="${esc(r.doc)}">Бекор қилиш</button>` : ''}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
}

/* ───────────── hisobot (admin) ───────────── */

function viewReport() {
  const r = S.rep;
  const [from, to] = presetRange(r.preset, r.from, r.to);
  let body = loadingHTML;
  if (r.error) body = `<p class="empty err">${esc(r.error)}</p>`;
  else if (r.data && !r.loading) body = repBody(r.data);
  return `<section class="panel">
    <div class="filters noprint">
      <div class="f-row">${periodBar('r', r)}${r.preset === 'custom' ? '<button class="btn primary sm" data-act="r-load">Кўрсатиш</button>' : ''}
        <button class="btn soft sm push" data-act="print">${ic('print')}Чоп этиш</button></div>
    </div>
    <p class="range-cap">Ҳисобот, ${rangeLabel(from, to)}</p>
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
  <div class="stats rep">
    <div class="st-main"><small>Сотув суммаси</small><b>${money(t.sum)}</b><span>${fmt(t.docs)} та чек, ўртача ${t.docs ? fmt(t.sum / t.docs) : 0}</span></div>
    <div><small>Сотилган</small><b>${fmt(t.qty)}</b><span>дона</span></div>
    <div><small>Мижозлар</small><b>${fmt(t.clients)}</b><span>киши</span></div>
    <div><small>Приход</small><b>${fmt(t.inQty)}</b><span>дона</span></div>
    <div><small>Ўтказма</small><b>${fmt(t.trQty)}</b><span>дона, бекор: ${t.cancelled}</span></div>
  </div>

  <h3 class="sec">Филиаллар</h3>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Филиал</th><th class="num">Сотув</th><th class="w"></th><th class="num">Чек</th><th class="num">Дона</th><th class="num">Приход</th><th class="num">Ўтказма кирди</th><th class="num">Ўтказма чиқди</th><th class="num">Ҳозирги қолдиқ</th></tr></thead>
    <tbody>${brs.map((b) => {
      const x = d.byBranch[b] || { sum: 0, docs: 0, qty: 0, inQty: 0, trIn: 0, trOut: 0 };
      const st = (S.cfg.products || []).reduce((a, p) => a + stockOf(b, p.name), 0);
      return `<tr><td class="b">${esc(b)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, bMax)}</td><td class="num">${fmt(x.docs)}</td><td class="num">${fmt(x.qty)}</td><td class="num">${fmt(x.inQty)}</td><td class="num">${fmt(x.trIn)}</td><td class="num">${fmt(x.trOut)}</td><td class="num">${fmt(st)}</td></tr>`;
    }).join('')}</tbody>
  </table></div>

  <div class="two">
    <div>
      <h3 class="sec">Маҳсулотлар</h3>
      ${prods.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Маҳсулот</th><th class="num">Дона</th><th class="num">Сумма</th><th class="w"></th></tr></thead>
        <tbody>${prods.map(([n, x]) => `<tr><td>${esc(n)}</td><td class="num">${fmt(x.qty)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, pMax)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Бу даврда сотув йўқ</p>'}
    </div>
    <div>
      <h3 class="sec">Юборган врачлар</h3>
      ${docs.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Врач</th><th class="num">Чек</th><th class="num">Дона</th><th class="num">Сумма</th><th class="w"></th></tr></thead>
        <tbody>${docs.map(([n, x]) => `<tr><td>${esc(n)}</td><td class="num">${fmt(x.docs)}</td><td class="num">${fmt(x.qty)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, dMax)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Бу даврда сотув йўқ</p>'}
    </div>
  </div>

  ${mprods.length ? `<h3 class="sec">Сотилган дона: маҳсулот ва филиал</h3>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Маҳсулот</th>${brs.map((b) => `<th class="num">${esc(b)}</th>`).join('')}<th class="num">Жами</th></tr></thead>
    <tbody>${mprods.map((p) => { const row = brs.map((b) => d.matrix[p][b] || 0); return `<tr><td>${esc(p)}</td>${row.map((q) => `<td class="num ${q ? '' : 'muted'}">${fmt(q)}</td>`).join('')}<td class="num b">${fmt(row.reduce((a, c) => a + c, 0))}</td></tr>`; }).join('')}</tbody></table></div>` : ''}

  ${days.length > 1 ? `<h3 class="sec">Кунлар</h3>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Сана</th><th class="num">Чек</th><th class="num">Дона</th><th class="num">Сумма</th><th class="w"></th></tr></thead>
    <tbody>${days.map(([dt, x]) => `<tr><td class="nw">${dLabel(dt)}</td><td class="num">${fmt(x.docs)}</td><td class="num">${fmt(x.qty)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, dyMax)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}

/* ───────────── modal / toast ───────────── */

function modal({ title, body, input, ok = 'Ҳа', cancel = 'Ортга', danger }) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    const prev = document.activeElement;
    root.innerHTML = `<div class="ov"><div class="mdl" role="dialog" aria-modal="true" aria-labelledby="mdl-t">
      <h3 id="mdl-t">${esc(title)}</h3>${body ? `<div class="mdl-b">${body}</div>` : ''}
      ${input ? `<label class="field"><span>${esc(input)}</span><input id="mdl-in" autocomplete="off"></label>` : ''}
      <div class="mdl-f"><button class="btn soft" id="mdl-no">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" id="mdl-ok">${esc(ok)}</button></div>
    </div></div>`;
    const done = (v) => {
      document.removeEventListener('keydown', key);
      const ov = $('.ov'); if (ov) ov.classList.add('out');
      setTimeout(() => { root.innerHTML = ''; if (prev && prev.focus) prev.focus(); }, 140);
      resolve(v);
    };
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
  el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  el.innerHTML = `${ic(kind === 'err' ? 'alert' : 'check')}<span>${esc(text)}</span>`;
  const box = $('#toasts');
  while (box.children.length > 2) box.firstElementChild.remove();
  box.appendChild(el);
  const life = kind === 'err' ? 5000 : 2800;
  setTimeout(() => el.classList.add('out'), life);
  setTimeout(() => el.remove(), life + 400);
}

/* ───────────── ishga tushirish ───────────── */

function start() {
  const view = document.getElementById('app');
  view.addEventListener('input', (e) => { if (e.target.tagName !== 'SELECT') onViewInput(e); });
  view.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' && e.target.id !== 'branch-sel') onViewInput(e); });
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
      if (first || cfgChanged) renderApp(); else { softRefresh(); setNet('ok'); }
    }).catch((e) => { if (!S.user) renderLogin(e.message); });
    if (!S.user) $('#app').innerHTML = `<div class="boot"><span class="mark big">${ic('leaf')}</span><span class="spin dark"></span></div>`;
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
