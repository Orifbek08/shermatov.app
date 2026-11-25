/* Др. Шерматов — дорихоналар тармоғи · сайт (оддий JS, framework йўқ) */
'use strict';

// База: Supabase («shermatov apteka»). Калит очиқ (publishable) — жадвалларга тўғридан-тўғри кириб бўлмайди,
// ҳамма амал фақат public.app() функцияси орқали, PIN токени билан текширилади.
const SB_URL = 'https://hfrfskwglwnbcaymzbad.supabase.co';
const SB_KEY = 'sb_publishable_I0CJDGavnnEzWGiTD2ri9Q_XAtDfW52';

const LS = { token: 'sh_token', cache: 'sh_cache', branch: 'sh_branch', page: 'sh_page' };
const TZ = 'Asia/Tashkent';
const T = { IN: 'Приход', OUT: 'Расход', TR: 'Ўтказма', RET: 'Қайтариш' };
const CANCEL = 'Бекор';

const PAGES = [
  { id: 'sale', t: 'Сотув', ic: 'cart', sub: 'Мижозга маҳсулот сотиш' },
  { id: 'income', t: 'Приход', ic: 'income', sub: 'Филиалга келган товарни қолдиққа қўшиш', more: true },
  { id: 'transfer', t: 'Ўтказма', ic: 'transfer', sub: 'Бир филиалдан бошқасига товар ўтказиш', more: true },
  { id: 'stock', t: 'Қолдиқ', ic: 'box', sub: 'Ҳамма филиаллардаги қолдиқ' },
  { id: 'return', t: 'Қайтариш', ic: 'undo', sub: 'Мижоз қайтариб келган маҳсулотни қабул қилиш (фақат сотилган филиалда)', more: true },
  { id: 'debts', t: 'Қарздорлар', ic: 'debt', sub: 'Қарзга олганлар: тўлаш санаси яқинлари тепада' },
  { id: 'finance', t: 'Молия', ic: 'wallet', sub: 'Кирим, чиқим ва касса — ҳар филиал алоҳида', more: true },
  { id: 'history', t: 'Тарих', ic: 'clock', sub: 'Ҳамма ёзувлар, қидирув ва бекор қилиш' },
  { id: 'report', t: 'Ҳисобот', ic: 'chart', sub: 'Сотув, қайтариш, приход ва врачлар бўйича · Excel', admin: true, more: true },
  { id: 'settings', t: 'Созламалар', ic: 'gear', sub: 'Маҳсулотлар, нархлар, филиаллар, врачлар ва фойдаланувчилар', admin: true, more: true },
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
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><path d="M4 7.5v10A2.5 2.5 0 0 0 6.5 20H20V8H6.5A2.5 2.5 0 0 1 4 5.5"/><circle cx="16" cy="14" r="1.3"/>',
  cash: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
  bank: '<path d="M3.5 9.5 12 4.5l8.5 5"/><path d="M5.5 10v7M10 10v7M14 10v7M18.5 10v7M4 19.5h16"/>',
  debt: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6M9 12h6M9 15.5h3"/>',
  tag: '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.4"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  undo: '<path d="M9 14.5 4 9.5l5-5"/><path d="M4 9.5h10.5a5.5 5.5 0 0 1 0 11H10"/>',
  more: '<circle cx="5.5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/>',
  download: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

const S = {
  token: lsGet(LS.token) || '',
  user: null, cfg: null, stock: {}, today: [], ver: -1, cfgHash: '',
  branch: '', page: lsGet(LS.page) || 'sale',
  net: 'idle', lastSync: 0, syncing: false,
  forms: {},
  hist: { preset: 'today', from: '', to: '', type: '', q: '', data: null, loading: false },
  rep: { preset: 'month', from: '', to: '', branch: '', doctor: '', data: null, loading: false },
  ret: null,
  fin: { preset: 'today', from: '', to: '', data: null, loading: false, error: '' },
  debts: { status: 'open', q: '', data: null, loading: false, error: '' },
  stockQ: '',
  set: { tab: 'products', data: null, loading: false, q: '' },
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

function payTypes() { return (S.cfg && S.cfg.payTypes) || []; }
function payKind(name) { const p = payTypes().find((x) => x.name === name); return p ? p.kind : ''; }
function payIcon(kind) { return { cash: 'cash', card: 'card', transfer: 'bank', debt: 'debt' }[kind] || 'wallet'; }
function moneyPays() { return payTypes().filter((p) => p.kind !== 'debt'); }
function payTag(name) { return name ? `<span class="ptag k-${payKind(name) || 'none'}">${ic(payIcon(payKind(name)))}${esc(name)}</span>` : ''; }
function product(name) { return (S.cfg.products || []).find((p) => p.name === name); }
function stockOf(branch, prod) { return (S.stock[branch] && S.stock[branch][prod]) || 0; }
function branchNames() { return (S.cfg.branches || []).map((b) => b.name); }

/* ───────────── server ───────────── */

async function api(action, data = {}) {
  let res;
  try {
    res = await fetch(SB_URL + '/rest/v1/rpc/app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
      body: JSON.stringify({ req: Object.assign({ action, t: S.token }, data) }),
    });
  } catch (e) {
    setNet('off');
    throw new Error('Интернет ёки сервер билан алоқа йўқ');
  }
  let j;
  try { j = await res.json(); } catch (e) { j = null; }
  if (!res.ok || !j || typeof j !== 'object') {
    setNet('off');
    throw new Error('Сервер жавоби нотўғри' + (j && j.message ? ': ' + j.message : ' (' + res.status + ')'));
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
      if (cfgChanged && S.page !== 'settings') renderApp(); else softRefresh();
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
    </form>
  </div>`;
  drawDots();
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
  const err = $('#login-err');
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
  if (!$('#login-form')) return;
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
    <nav class="tabbar" id="tabbar" aria-label="Бўлимлар">${navButtons(pages.filter((p) => !p.more))}
      <button id="more-btn" class="${pg.more ? 'on' : ''}" aria-haspopup="dialog">${ic('more')}<span>Яна</span></button></nav>
  </div>`;
  const out = async () => { if (await confirmBox('Тизимдан чиқасизми?', 'Чиқиш')) logout(); };
  $('#logout').onclick = out;
  $('#logout-m').onclick = out;
  const go = (e) => {
    if (e.target.closest('#more-btn')) return openMore(pages.filter((p) => p.more));
    const b = e.target.closest('[data-page]');
    if (b) goPage(b.dataset.page);
  };
  $('#tabs').onclick = go;
  $('#tabbar').onclick = go;
  const bs = $('#branch-sel');
  if (bs) bs.onchange = () => {
    S.branch = bs.value; lsSet(LS.branch, S.branch);
    S.hist.data = null; S.fin.data = null; S.debts.data = null; S.fin.error = ''; S.debts.error = '';
    renderView(true);
  };
  renderView(true);
}

function goPage(id) {
  if (id === S.page) return;
  if (id === 'debts') { S.debts.data = null; S.debts.error = ''; }
  if (id === 'finance') { S.fin.data = null; S.fin.error = ''; }
  S.page = id; lsSet(LS.page, S.page);
  document.querySelectorAll('[data-page]').forEach((x) => {
    const on = x.dataset.page === S.page;
    x.classList.toggle('on', on);
    on ? x.setAttribute('aria-current', 'page') : x.removeAttribute('aria-current');
  });
  const p = PAGES.find((x) => x.id === S.page);
  const mb = $('#more-btn'); if (mb) mb.classList.toggle('on', !!p.more);
  $('#page-title').textContent = p.t; $('#page-sub').textContent = p.sub;
  renderView(true);
  window.scrollTo({ top: 0 });
}

/** Телефонда: пастки менюга сиғмаган бўлимлар */
function openMore(list) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="ov sheet-ov"><div class="bsheet" role="dialog" aria-modal="true" aria-label="Бўлимлар">
    <span class="grab"></span>
    ${list.map((p) => `<button data-go="${p.id}" class="${p.id === S.page ? 'on' : ''}">${ic(p.ic)}<span><b>${p.t}</b><small>${p.sub}</small></span></button>`).join('')}
  </div></div>`;
  const close = () => { const ov = $('.ov'); if (ov) ov.classList.add('out'); setTimeout(() => { root.innerHTML = ''; }, 160); };
  $('.ov').onclick = (e) => {
    const b = e.target.closest('[data-go]');
    if (b) { close(); goPage(b.dataset.go); } else if (e.target.classList.contains('ov')) close();
  };
}

function renderView(animate) {
  const v = $('#view');
  if (!v) return;
  const fn = { sale: viewSale, return: viewReturn, income: viewIncome, transfer: viewTransfer, stock: viewStock, debts: viewDebts, finance: viewFinance, history: viewHistory, report: viewReport, settings: viewSettings }[S.page];
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
  } else if (S.page === 'return') {
    const side = $('#side');
    if (side) side.innerHTML = sideHTML('return');
  } else if (S.page === 'stock') {
    renderView();
  }
}

function after() {
  if (S.page === 'history' && !S.hist.data && !S.hist.loading) loadHistory();
  if (S.page === 'report' && !S.rep.data && !S.rep.loading && !S.rep.error) loadReport();
  if (S.page === 'settings' && !S.set.data && !S.set.loading) loadSettings();
  if (S.page === 'debts' && !S.debts.data && !S.debts.loading && !S.debts.error) loadDebts();
  if (S.page === 'finance' && !S.fin.data && !S.fin.loading && !S.fin.error) loadFinance();
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
  if (!S.forms[id]) {
    const p0 = (moneyPays()[0] || payTypes()[0] || {}).name || '';
    S.forms[id] = { lines: [newLine()], client: '', doctor: '', note: '', to: '', rid: uid(), busy: false,
      pay: p0, debtNote: '', due: '', disc: false, discSum: '', discNote: '' };
  }
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
      ${sale ? `<input class="money locked" data-f="price" data-i="${i}" value="${l.price === '' ? '' : fmt(l.price)}" aria-label="Нарх" placeholder="—" readonly tabindex="-1" title="Нарх Созламалар → Маҳсулотларда ўзгартирилади. Арзонроқ сотиш учун «Чегирма»ни ёқинг">
      <input class="money calc" data-f="sum" data-i="${i}" value="${l.sum === '' ? '' : fmt(l.sum)}" aria-label="Сумма" placeholder="Сумма" readonly tabindex="-1">` : ''}
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
    const disc = f.disc ? num(f.discSum) : 0;
    const debt = payKind(f.pay) === 'debt';
    const cap = $('#co-cap'); if (cap) cap.textContent = debt ? 'Қарзга ёзилади' : 'Мижоз тўлайди';
    const co = $('.checkout'); if (co) co.classList.toggle('debt', debt);
    el.innerHTML = `<b class="amt">${fmt(Math.max(0, sum - disc))}<small>${cur()}</small></b><span class="sub">${disc ? `${fmt(sum)} − чегирма ${fmt(disc)} · ` : ''}${fmt(qty)} дона, ${kinds} хил${f.pay ? ' · ' + esc(f.pay) : ''}</span>`;
  } else {
    el.innerHTML = `<b class="amt">${fmt(qty)}<small>дона</small></b><span class="sub">${kinds} хил маҳсулот</span>`;
  }
}

function checkoutHTML(kind, label) {
  const f = form(kind);
  return `<div class="checkout">
    <div class="co-l"><span class="co-cap" id="co-cap">Жами</span><div id="f-total"></div></div>
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
          <div class="in-ic">${ic('user')}<input id="f-client" data-ff="client" value="${esc(f.client)}" placeholder="Масалан: Каримов Алишер" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ac-client"><div class="ac hidden" id="ac-client" role="listbox"></div></div>
        </label>
        <label class="field"><span>Юборган врач</span>
          <div class="in-ic">${ic('doctor')}<input id="f-doctor" data-ff="doctor" list="dl-doctors" value="${esc(f.doctor)}" placeholder="Рўйхатдан танланг ёки ёзинг" autocomplete="off"></div>
          <datalist id="dl-doctors">${(S.cfg.doctors || []).map((d) => `<option value="${esc(d)}">`).join('')}</datalist>
        </label>
      </div>
      ${linesHTML('sale')}
      ${payBlockHTML(f)}
      <label class="field note"><span>Изоҳ</span><input data-ff="note" value="${esc(f.note)}" placeholder="Ихтиёрий"></label>
      ${checkoutHTML('sale', 'Сотиш')}
    </section>
    <aside class="feed" id="side">${sideHTML('sale')}</aside>
  </div>`;
}

function payBlockHTML(f) {
  const debt = payKind(f.pay) === 'debt';
  return `<div class="payblock">
    <div class="pb-row">
      <span class="pb-cap">Тўлов тури</span>
      <div class="chips" role="radiogroup" aria-label="Тўлов тури">${payTypes().map((p) => `<button type="button" class="chip k-${p.kind} ${f.pay === p.name ? 'on' : ''}" data-act="pay" data-v="${esc(p.name)}" role="radio" aria-checked="${f.pay === p.name}">${ic(payIcon(p.kind))}${esc(p.name)}</button>`).join('')}</div>
    </div>
    <div class="subbox debt-box ${debt ? '' : 'hidden'}" id="debt-box">
      <label class="field grow"><span>Қарз изоҳи <b class="req" title="Мажбурий">*</b></span><input data-ff="debtNote" value="${esc(f.debtNote)}" placeholder="Телефони, қачон тўлашини айтди ва ҳ.к." autocomplete="off"></label>
      <label class="field"><span>Тўлаш санаси</span><input type="date" data-ff="due" value="${esc(f.due)}" min="${todayISO()}" aria-label="Тўлаш санаси (ихтиёрий)"></label>
    </div>
    <button type="button" class="switch ${f.disc ? 'on' : ''}" data-act="disc" role="switch" aria-checked="${f.disc}"><i></i>${ic('tag')}Чегирма</button>
    <div class="subbox disc-box ${f.disc ? '' : 'hidden'}" id="disc-box">
      <label class="field"><span>Чегирма суммаси <b class="req">*</b></span><input class="money" data-ff="discSum" inputmode="numeric" value="${f.discSum ? fmt(f.discSum) : ''}" placeholder="0" autocomplete="off"></label>
      <label class="field grow"><span>Чегирма сабаби <b class="req">*</b></span><input data-ff="discNote" value="${esc(f.discNote)}" placeholder="Масалан: доимий мижоз, врач тавсияси" autocomplete="off"></label>
    </div>
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

/* mijoz qidiruvi (Ф.И.Ш yozilganda taklif, hamma filiallar bo'yicha) */

const AC = { items: [], idx: -1, timer: 0, seq: 0, cache: new Map() };

function acQuery(text) {
  clearTimeout(AC.timer);
  const q = text.trim();
  if (q.length < 2) return acClose();
  const key = q.toLowerCase();
  if (AC.cache.has(key)) return acShow(AC.cache.get(key));
  AC.timer = setTimeout(async () => {
    const my = ++AC.seq;
    try {
      const j = await api('clients', { q });
      AC.cache.set(key, j.rows || []);
      if (my === AC.seq && $('#f-client') && $('#f-client').value.trim().toLowerCase() === key) acShow(j.rows || []);
    } catch (e) { /* таклиф бўлмаса ҳам ёзиш давом этади */ }
  }, 220);
}

function acShow(items) {
  const box = $('#ac-client');
  const inp = $('#f-client');
  if (!box || !inp || document.activeElement !== inp) return;
  AC.items = items; AC.idx = -1;
  if (!items.length) return acClose();
  box.innerHTML = items.map((c, i) => `<button type="button" role="option" data-ac="${i}" id="ac-o${i}">
      <b>${esc(c.name)}</b>
      <small>${c.visits} марта, охирги ${dLabel(c.last)} · ${esc(c.branch)}${c.doctor ? ' · ' + esc(c.doctor) : ''}</small>
    </button>`).join('');
  box.classList.remove('hidden');
  inp.setAttribute('aria-expanded', 'true');
}

function acClose() {
  const box = $('#ac-client');
  if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
  const inp = $('#f-client');
  if (inp) { inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); }
  AC.items = []; AC.idx = -1;
}

function acMove(d) {
  if (!AC.items.length) return;
  AC.idx = (AC.idx + d + AC.items.length) % AC.items.length;
  document.querySelectorAll('#ac-client [data-ac]').forEach((b, i) => b.classList.toggle('on', i === AC.idx));
  const inp = $('#f-client');
  if (inp) inp.setAttribute('aria-activedescendant', 'ac-o' + AC.idx);
}

function acPick(i) {
  const c = AC.items[i];
  if (!c) return;
  const f = form('sale');
  f.client = c.name;
  $('#f-client').value = c.name;
  const doc = $('#f-doctor');
  if (c.doctor && doc && !doc.value.trim()) { doc.value = c.doctor; f.doctor = c.doctor; }
  acClose();
  const next = document.querySelector('#lines .prod-in');
  if (next) next.focus();
}

function onViewKey(e) {
  if (e.target.id === 'ret-q' && e.key === 'Enter') { e.preventDefault(); retFind(); return; }
  if (e.target.id === 'd-q' && e.key === 'Enter') { e.preventDefault(); loadDebts(); return; }
  if (e.target.id !== 'f-client' || !AC.items.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); acMove(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); acMove(-1); }
  else if (e.key === 'Enter' && AC.idx >= 0) { e.preventDefault(); acPick(AC.idx); }
  else if (e.key === 'Escape') { acClose(); }
}

/* yon panel: bugungi hujjatlar */

function groupDocs(rows) {
  const m = new Map();
  rows.forEach((r) => {
    let g = m.get(r.doc);
    if (!g) {
      g = { doc: r.doc, date: r.date, time: r.time, type: r.type, branch: r.branch, to: r.to, client: r.client,
        doctor: r.doctor, op: r.op, note: r.note, status: r.status, ref: r.ref || '', pay: r.pay || '',
        disc: Number(r.disc) || 0, discNote: r.discNote || '', opPhone: r.opPhone || '', lines: [], sum: 0, qty: 0 };
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
  const money_ = g.type === T.OUT || g.type === T.RET;
  const lines = g.lines.map((l) => `<li><span class="nm">${esc(l.product)}</span><span class="q">${fmt(l.qty)} × ${money_ && l.sum != null ? fmt(l.sum) : 'дона'}</span></li>`).join('');
  let who = '';
  if (g.type === T.OUT) who = `<div class="doc-who"><span>${ic('user')}${esc(g.client)}</span>${g.doctor ? `<span>${ic('doctor')}${esc(g.doctor)}</span>` : ''}</div>`
    + (g.disc ? `<div class="doc-who disc"><span>${ic('tag')}Чегирма −${fmt(g.disc)}${g.discNote ? ': ' + esc(g.discNote) : ''}</span></div>` : '');
  if (g.type === T.RET) who = `<div class="doc-who"><span>${ic('user')}${esc(g.client)}</span><span>${ic('undo')}${esc(g.ref)} дан</span></div>${g.note ? `<div class="doc-who muted"><span>${ic('note')}${esc(g.note)}</span></div>` : ''}`;
  if (g.type === T.TR) who = `<div class="doc-who"><span class="route-s">${esc(g.branch)} ${ic('arrow')} ${esc(g.to)}</span></div>`;
  if (g.type === T.IN && g.note) who = `<div class="doc-who"><span>${ic('note')}${esc(g.note)}</span></div>`;
  const showBr = !S.branch && g.type !== T.TR;
  return `<article class="doc ${off ? 'off' : ''}">
    <header><b class="no">${esc(g.doc)}</b><span class="tm">${esc(g.time)}</span>${showBr ? `<span class="br">${esc(g.branch)}</span>` : ''}
      ${off ? '<span class="tag red">Бекор қилинган</span>' : ''}
      ${g.type === T.OUT ? `<button class="mini-act rc-btn" data-act="rc-print" data-doc="${esc(g.doc)}" title="Чекни чоп этиш" aria-label="${esc(g.doc)} чекини чоп этиш">${ic('print')}</button>` : ''}
      ${canCancel(g) ? `<button class="mini-danger" data-act="cancel" data-doc="${esc(g.doc)}" title="Ҳужжатни бекор қилиш">Бекор қилиш</button>` : ''}</header>
    ${who}
    <ul>${lines}</ul>
    <footer><b class="${g.type === T.RET ? 'neg' : ''}">${g.type === T.OUT ? money(g.sum - g.disc) : g.type === T.RET ? '−' + money(g.sum) : fmt(g.qty) + ' дона'}</b>${g.type === T.OUT || g.type === T.RET ? payTag(g.pay) : ''}<span>${esc(g.op)}</span></footer>
  </article>`;
}

function sideHTML(kind) {
  const type = { sale: T.OUT, income: T.IN, transfer: T.TR, return: T.RET }[kind];
  const rows = S.today.filter((r) => r.type === type && (!S.branch || r.branch === S.branch || (type === T.TR && r.to === S.branch)));
  const docs = groupDocs(rows).reverse();
  const act = docs.filter((d) => d.status !== CANCEL);
  const title = { sale: 'Бугунги сотувлар', income: 'Бугунги приход', transfer: 'Бугунги ўтказмалар', return: 'Бугунги қайтаришлар' }[kind];
  let stats = '';
  if (kind === 'sale') {
    const rets = groupDocs(S.today.filter((r) => r.type === T.RET && r.status !== CANCEL && (!S.branch || r.branch === S.branch)));
    const retSum = rets.reduce((a, d) => a + d.sum, 0);
    const gross = act.reduce((a, d) => a + d.sum - d.disc, 0);
    const debtSum = act.filter((d) => payKind(d.pay) === 'debt').reduce((a, d) => a + d.sum - d.disc, 0);
    stats = `<div class="feed-stats">
      <div class="fs-main"><small>Тушум${retSum ? ' (соф)' : ''}</small><b>${fmt(gross - retSum)}</b><small>${cur()}</small>${retSum ? `<em>қайтариш −${fmt(retSum)}</em>` : ''}${debtSum ? `<em class="dbt">шундан қарзга ${fmt(debtSum)}</em>` : ''}</div>
      <div><small>Чеклар</small><b>${act.length}</b></div>
      <div><small>Дона</small><b>${fmt(act.reduce((a, d) => a + d.qty, 0))}</b></div>
    </div>`;
  }
  if (kind === 'return' && act.length) {
    stats = `<div class="feed-stats two-c">
      <div class="fs-ret"><small>Қайтарилди</small><b>${fmt(act.reduce((a, d) => a + d.sum, 0))}</b><small>${cur()}</small></div>
      <div><small>Ҳужжатлар</small><b>${act.length}</b></div>
    </div>`;
  }
  const empty = { sale: 'Бугун ҳали сотув йўқ. Биринчи сотув шу ерда пайдо бўлади.', income: 'Бугун ҳали приход қилинмаган.', transfer: 'Бугун ҳали ўтказма йўқ.', return: 'Бугун ҳали қайтариш йўқ.' }[kind];
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
    if (t.id === 'd-q') S.debts.q = t.value;
    if (t.id === 'set-q') { S.set.q = t.value; filterSettings(); }
    if (S.page === 'return') retInput(t);
    if (t.id === 'r-branch' || t.id === 'r-doctor') {
      S.rep[t.id === 'r-branch' ? 'branch' : 'doctor'] = t.value;
      S.rep.data = null; loadReport();
    }
    return;
  }
  const f = form(kind);
  if (t.dataset.ff) {
    f[t.dataset.ff] = t.dataset.ff === 'discSum' ? num(t.value) : t.value;
    if (t.dataset.ff === 'discSum') { updateTotals(kind); return; }
    if (t.id === 'f-client') acQuery(t.value);
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
    if (name && kind === 'sale' && !l.price) toast(`«${name}»: нархи қўйилмаган — Созламалар → Маҳсулотларда нарх қўйинг`, 'err');
  } else if (fld === 'qty') {
    l.qty = t.value.replace(/[^\d]/g, '');
    if (kind === 'sale' && !l.manual && l.product) {
      l.sum = num(l.qty) * num(l.price);
      const s = t.closest('.line').querySelector('[data-f="sum"]');
      if (s) s.value = fmt(l.sum);
    }
    f.lines.forEach((_, j) => updateLineMeta(kind, j));
  }
  updateTotals(kind);
}

function onViewBlur(e) {
  const t = e.target;
  if (t.id === 'f-client') setTimeout(acClose, 120);
  if (t.dataset && t.dataset.f === 'product' && isForm(S.page)) {
    const l = form(S.page).lines[Number(t.dataset.i)];
    if (l && l.product) t.value = l.product;
    else if (t.value.trim()) t.classList.add('bad');
  }
  if (t.dataset && (t.dataset.f === 'price' || t.dataset.f === 'sum' || t.dataset.ff === 'discSum') && t.value !== '') t.value = fmt(num(t.value));
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
  } else if (act === 'pay') {
    const f = form('sale');
    f.pay = b.dataset.v;
    document.querySelectorAll('[data-act="pay"]').forEach((x) => { const on = x.dataset.v === f.pay; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
    const debt = payKind(f.pay) === 'debt';
    const box = $('#debt-box'); if (box) box.classList.toggle('hidden', !debt);
    if (debt) { const i = box.querySelector('input'); if (i) i.focus(); }
    updateTotals('sale');
  } else if (act === 'disc') {
    const f = form('sale');
    f.disc = !f.disc;
    b.classList.toggle('on', f.disc); b.setAttribute('aria-checked', f.disc);
    const box = $('#disc-box'); if (box) box.classList.toggle('hidden', !f.disc);
    if (f.disc) box.querySelector('input').focus();
    updateTotals('sale');
  } else if (act === 'submit') {
    submit(b.dataset.kind);
  } else if (act === 'cancel') {
    cancelDoc(b.dataset.doc);
  } else if (act === 'h-preset') {
    S.hist.preset = b.dataset.p; S.hist.data = null; renderView();
  } else if (act === 'h-load') {
    readHistFilters(); S.hist.data = null; loadHistory();
  } else if (act === 'r-preset') {
    S.rep.preset = b.dataset.p; S.rep.data = null; S.rep.error = ''; renderView();
  } else if (act === 'r-load') {
    S.rep.from = $('#r-from') ? $('#r-from').value : ''; S.rep.to = $('#r-to') ? $('#r-to').value : '';
    S.rep.data = null; loadReport();
  } else if (act === 'print') {
    window.print();
  } else if (act === 'refresh') {
    b.classList.add('spinning');
    await sync(true); renderView();
  } else if (act === 'ret-find') {
    retFind();
  } else if (act === 'ret-pick') {
    retPick(b.dataset.doc);
  } else if (act === 'ret-back') {
    S.ret.sel = null; renderRet();
  } else if (act === 'ret-all') {
    retAll();
  } else if (act === 'rq-inc' || act === 'rq-dec') {
    const inp = b.parentElement.querySelector('[data-rq]');
    inp.value = Math.max(0, num(inp.value) + (act === 'rq-inc' ? 1 : -1));
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (act === 'ret-submit') {
    retSubmit();
  } else if (act === 'ret-from') {
    retFrom(b.dataset.doc);
  } else if (act === 'xls') {
    exportExcel(b);
  } else if (act === 'rc-print') {
    printReceipt(docGroup(b.dataset.doc));
  } else if (act === 'd-status') {
    S.debts.status = b.dataset.v; S.debts.data = null; S.debts.error = ''; renderView();
  } else if (act === 'd-load') {
    loadDebts();
  } else if (act === 'd-pay') {
    debtPay(b.dataset.id);
  } else if (act === 'd-edit') {
    debtEdit(b.dataset.id);
  } else if (act === 'f-preset') {
    S.fin.preset = b.dataset.p; S.fin.data = null; S.fin.error = ''; renderView();
  } else if (act === 'f-load') {
    loadFinance();
  } else if (act === 'fin-new') {
    finNew(b.dataset.grp);
  } else if (act === 'fin-cancel') {
    finCancel(b.dataset.no);
  } else if (act === 'set-tab') {
    S.set.tab = b.dataset.tab; S.set.q = ''; renderView();
  } else if (act === 'set-new') {
    editItem(SET_KIND[S.set.tab], null);
  } else if (act === 'set-edit') {
    const list = S.set.data[S.set.tab] || [];
    editItem(SET_KIND[S.set.tab], list.find((x) => String(x.id) === b.dataset.id));
  } else if (act === 'set-general') {
    saveGeneral(b);
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
    const free = lines.find((l) => !(num(l.price) > 0));
    if (free) return toast(`«${free.product}»: нархи қўйилмаган — Созламалар → Маҳсулотларда нарх қўйинг`, 'err');
    payload.client = f.client; payload.doctor = f.doctor;
    payload.items = lines.map((l) => ({ product: l.product, qty: num(l.qty), price: num(l.price) }));
    const total = lines.reduce((a, l) => a + num(l.sum), 0);
    if (!f.pay) return toast('Тўлов турини танланг', 'err');
    payload.pay = f.pay;
    if (f.disc && num(f.discSum) > 0) {
      if (num(f.discSum) > total) return toast(`Чегирма сотув суммасидан (${fmt(total)}) катта бўлмасин`, 'err');
      if (!f.discNote.trim()) { toast('Чегирма сабабини ёзинг', 'err'); const i = $('[data-ff="discNote"]'); if (i) i.focus(); return; }
      payload.discount = String(num(f.discSum)); payload.discountNote = f.discNote;
    }
    if (payKind(f.pay) === 'debt') {
      if (!f.debtNote.trim()) { toast('Қарз учун изоҳ ёзинг: телефони, қачон тўлайди', 'err'); const i = $('[data-ff="debtNote"]'); if (i) i.focus(); return; }
      payload.debtNote = f.debtNote; payload.due = f.due;
    }
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
    const label = kind === 'sale' && j.debt ? 'Қарзга сотилди' : { sale: 'Сотилди', income: 'Приход қилинди', transfer: 'Ўтказилди' }[kind];
    if (j.debt) S.debts.data = null;
    S.fin.data = null;
    toast(`${label}: ${j.doc}${kind === 'sale' && j.total != null ? ', ' + money(j.total) : ''}${j.dup ? ' (аввал сақланган)' : ''}`, 'ok');
    S.hist.data = null; S.rep.data = null;
    if (kind === 'sale') AC.cache.clear();
    renderView();
    const first = document.querySelector(kind === 'sale' ? '#f-client' : '#lines .prod-in');
    if (first) first.focus();
    if (kind === 'sale' && !j.dup) askReceipt(j.doc);
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
    S.rep.data = null; S.fin.data = null; S.debts.data = null;
    if (S.page === 'history') { S.hist.data = null; loadHistory(); } else renderView();
  } catch (err) { toast(err.message, 'err'); }
}

/* ───────────── chek (80 мм термопринтер, brauzer orqali) ───────────── */

// QR: https://drshermatov.vercel.app/ — Др. Шерматов ҳақида сайт (qrcode-generator, MIT, бир марта тайёрланган)
const BIO_URL = 'drshermatov.vercel.app';
const BIO_QR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 33 33" shape-rendering="crispEdges"><rect x="-2" y="-2" width="33" height="33" fill="#fff"/><path d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM9 0h1v1h-1zM10 0h1v1h-1zM14 0h1v1h-1zM19 0h1v1h-1zM22 0h1v1h-1zM23 0h1v1h-1zM24 0h1v1h-1zM25 0h1v1h-1zM26 0h1v1h-1zM27 0h1v1h-1zM28 0h1v1h-1zM0 1h1v1h-1zM6 1h1v1h-1zM9 1h1v1h-1zM10 1h1v1h-1zM16 1h1v1h-1zM20 1h1v1h-1zM22 1h1v1h-1zM28 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM10 2h1v1h-1zM14 2h1v1h-1zM15 2h1v1h-1zM17 2h1v1h-1zM18 2h1v1h-1zM20 2h1v1h-1zM22 2h1v1h-1zM24 2h1v1h-1zM25 2h1v1h-1zM26 2h1v1h-1zM28 2h1v1h-1zM0 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM12 3h1v1h-1zM13 3h1v1h-1zM16 3h1v1h-1zM18 3h1v1h-1zM19 3h1v1h-1zM22 3h1v1h-1zM24 3h1v1h-1zM25 3h1v1h-1zM26 3h1v1h-1zM28 3h1v1h-1zM0 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM12 4h1v1h-1zM18 4h1v1h-1zM22 4h1v1h-1zM24 4h1v1h-1zM25 4h1v1h-1zM26 4h1v1h-1zM28 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM9 5h1v1h-1zM15 5h1v1h-1zM16 5h1v1h-1zM17 5h1v1h-1zM19 5h1v1h-1zM20 5h1v1h-1zM22 5h1v1h-1zM28 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h1v1h-1zM23 6h1v1h-1zM24 6h1v1h-1zM25 6h1v1h-1zM26 6h1v1h-1zM27 6h1v1h-1zM28 6h1v1h-1zM10 7h1v1h-1zM12 7h1v1h-1zM13 7h1v1h-1zM15 7h1v1h-1zM16 7h1v1h-1zM17 7h1v1h-1zM18 7h1v1h-1zM19 7h1v1h-1zM20 7h1v1h-1zM0 8h1v1h-1zM3 8h1v1h-1zM5 8h1v1h-1zM6 8h1v1h-1zM8 8h1v1h-1zM11 8h1v1h-1zM12 8h1v1h-1zM14 8h1v1h-1zM16 8h1v1h-1zM20 8h1v1h-1zM21 8h1v1h-1zM23 8h1v1h-1zM1 9h1v1h-1zM3 9h1v1h-1zM7 9h1v1h-1zM8 9h1v1h-1zM10 9h1v1h-1zM12 9h1v1h-1zM13 9h1v1h-1zM15 9h1v1h-1zM16 9h1v1h-1zM17 9h1v1h-1zM20 9h1v1h-1zM21 9h1v1h-1zM22 9h1v1h-1zM25 9h1v1h-1zM28 9h1v1h-1zM0 10h1v1h-1zM4 10h1v1h-1zM6 10h1v1h-1zM9 10h1v1h-1zM10 10h1v1h-1zM11 10h1v1h-1zM12 10h1v1h-1zM13 10h1v1h-1zM14 10h1v1h-1zM15 10h1v1h-1zM19 10h1v1h-1zM20 10h1v1h-1zM21 10h1v1h-1zM24 10h1v1h-1zM25 10h1v1h-1zM26 10h1v1h-1zM27 10h1v1h-1zM2 11h1v1h-1zM8 11h1v1h-1zM12 11h1v1h-1zM13 11h1v1h-1zM16 11h1v1h-1zM18 11h1v1h-1zM24 11h1v1h-1zM26 11h1v1h-1zM27 11h1v1h-1zM2 12h1v1h-1zM4 12h1v1h-1zM5 12h1v1h-1zM6 12h1v1h-1zM7 12h1v1h-1zM10 12h1v1h-1zM11 12h1v1h-1zM14 12h1v1h-1zM15 12h1v1h-1zM17 12h1v1h-1zM19 12h1v1h-1zM20 12h1v1h-1zM21 12h1v1h-1zM22 12h1v1h-1zM25 12h1v1h-1zM27 12h1v1h-1zM28 12h1v1h-1zM1 13h1v1h-1zM4 13h1v1h-1zM5 13h1v1h-1zM9 13h1v1h-1zM13 13h1v1h-1zM14 13h1v1h-1zM15 13h1v1h-1zM16 13h1v1h-1zM19 13h1v1h-1zM0 14h1v1h-1zM2 14h1v1h-1zM3 14h1v1h-1zM6 14h1v1h-1zM7 14h1v1h-1zM9 14h1v1h-1zM10 14h1v1h-1zM12 14h1v1h-1zM13 14h1v1h-1zM14 14h1v1h-1zM17 14h1v1h-1zM22 14h1v1h-1zM25 14h1v1h-1zM26 14h1v1h-1zM27 14h1v1h-1zM28 14h1v1h-1zM1 15h1v1h-1zM5 15h1v1h-1zM9 15h1v1h-1zM10 15h1v1h-1zM15 15h1v1h-1zM17 15h1v1h-1zM20 15h1v1h-1zM21 15h1v1h-1zM22 15h1v1h-1zM23 15h1v1h-1zM25 15h1v1h-1zM27 15h1v1h-1zM4 16h1v1h-1zM5 16h1v1h-1zM6 16h1v1h-1zM7 16h1v1h-1zM8 16h1v1h-1zM10 16h1v1h-1zM11 16h1v1h-1zM13 16h1v1h-1zM17 16h1v1h-1zM18 16h1v1h-1zM19 16h1v1h-1zM21 16h1v1h-1zM23 16h1v1h-1zM27 16h1v1h-1zM1 17h1v1h-1zM8 17h1v1h-1zM9 17h1v1h-1zM13 17h1v1h-1zM14 17h1v1h-1zM15 17h1v1h-1zM16 17h1v1h-1zM17 17h1v1h-1zM21 17h1v1h-1zM22 17h1v1h-1zM23 17h1v1h-1zM25 17h1v1h-1zM28 17h1v1h-1zM0 18h1v1h-1zM2 18h1v1h-1zM3 18h1v1h-1zM6 18h1v1h-1zM9 18h1v1h-1zM10 18h1v1h-1zM12 18h1v1h-1zM14 18h1v1h-1zM15 18h1v1h-1zM16 18h1v1h-1zM17 18h1v1h-1zM21 18h1v1h-1zM27 18h1v1h-1zM28 18h1v1h-1zM4 19h1v1h-1zM5 19h1v1h-1zM11 19h1v1h-1zM12 19h1v1h-1zM14 19h1v1h-1zM17 19h1v1h-1zM19 19h1v1h-1zM20 19h1v1h-1zM22 19h1v1h-1zM23 19h1v1h-1zM27 19h1v1h-1zM28 19h1v1h-1zM0 20h1v1h-1zM2 20h1v1h-1zM6 20h1v1h-1zM8 20h1v1h-1zM10 20h1v1h-1zM11 20h1v1h-1zM12 20h1v1h-1zM15 20h1v1h-1zM16 20h1v1h-1zM19 20h1v1h-1zM20 20h1v1h-1zM21 20h1v1h-1zM22 20h1v1h-1zM23 20h1v1h-1zM24 20h1v1h-1zM26 20h1v1h-1zM8 21h1v1h-1zM10 21h1v1h-1zM14 21h1v1h-1zM15 21h1v1h-1zM17 21h1v1h-1zM19 21h1v1h-1zM20 21h1v1h-1zM24 21h1v1h-1zM26 21h1v1h-1zM27 21h1v1h-1zM28 21h1v1h-1zM0 22h1v1h-1zM1 22h1v1h-1zM2 22h1v1h-1zM3 22h1v1h-1zM4 22h1v1h-1zM5 22h1v1h-1zM6 22h1v1h-1zM9 22h1v1h-1zM10 22h1v1h-1zM11 22h1v1h-1zM12 22h1v1h-1zM16 22h1v1h-1zM18 22h1v1h-1zM20 22h1v1h-1zM22 22h1v1h-1zM24 22h1v1h-1zM27 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM8 23h1v1h-1zM10 23h1v1h-1zM14 23h1v1h-1zM16 23h1v1h-1zM18 23h1v1h-1zM20 23h1v1h-1zM24 23h1v1h-1zM25 23h1v1h-1zM26 23h1v1h-1zM28 23h1v1h-1zM0 24h1v1h-1zM2 24h1v1h-1zM3 24h1v1h-1zM4 24h1v1h-1zM6 24h1v1h-1zM9 24h1v1h-1zM12 24h1v1h-1zM15 24h1v1h-1zM16 24h1v1h-1zM17 24h1v1h-1zM20 24h1v1h-1zM21 24h1v1h-1zM22 24h1v1h-1zM23 24h1v1h-1zM24 24h1v1h-1zM27 24h1v1h-1zM0 25h1v1h-1zM2 25h1v1h-1zM3 25h1v1h-1zM4 25h1v1h-1zM6 25h1v1h-1zM8 25h1v1h-1zM9 25h1v1h-1zM10 25h1v1h-1zM13 25h1v1h-1zM16 25h1v1h-1zM17 25h1v1h-1zM18 25h1v1h-1zM22 25h1v1h-1zM24 25h1v1h-1zM25 25h1v1h-1zM26 25h1v1h-1zM28 25h1v1h-1zM0 26h1v1h-1zM2 26h1v1h-1zM3 26h1v1h-1zM4 26h1v1h-1zM6 26h1v1h-1zM10 26h1v1h-1zM11 26h1v1h-1zM14 26h1v1h-1zM16 26h1v1h-1zM17 26h1v1h-1zM18 26h1v1h-1zM19 26h1v1h-1zM24 26h1v1h-1zM25 26h1v1h-1zM26 26h1v1h-1zM28 26h1v1h-1zM0 27h1v1h-1zM6 27h1v1h-1zM9 27h1v1h-1zM10 27h1v1h-1zM11 27h1v1h-1zM12 27h1v1h-1zM13 27h1v1h-1zM14 27h1v1h-1zM15 27h1v1h-1zM17 27h1v1h-1zM20 27h1v1h-1zM21 27h1v1h-1zM23 27h1v1h-1zM27 27h1v1h-1zM0 28h1v1h-1zM1 28h1v1h-1zM2 28h1v1h-1zM3 28h1v1h-1zM4 28h1v1h-1zM5 28h1v1h-1zM6 28h1v1h-1zM8 28h1v1h-1zM10 28h1v1h-1zM11 28h1v1h-1zM14 28h1v1h-1zM16 28h1v1h-1zM17 28h1v1h-1zM20 28h1v1h-1zM21 28h1v1h-1zM23 28h1v1h-1zM24 28h1v1h-1zM25 28h1v1h-1zM27 28h1v1h-1z" fill="#000"/></svg>';

function receiptHTML(g) {
  const br = (S.cfg.branches || []).find((b) => b.name === g.branch) || {};
  const net = g.sum - g.disc;
  const debt = payKind(g.pay) === 'debt';
  const phone = g.opPhone || (g.op === S.user.name ? S.user.phone : '') || '';
  const items = g.lines.map((l) => `<div class="rc-it"><div class="rc-nm">${esc(l.product)}</div>
    <div class="rc-r"><span>${fmt(l.qty)} × ${fmt(l.price)}</span><b>${fmt(l.sum)}</b></div></div>`).join('');
  return `<div class="rc">
    <div class="rc-c rc-name">${esc(S.cfg.name || 'Др. Шерматов дорихоналари')}</div>
    <div class="rc-c">${esc(g.branch)}</div>
    ${br.addr ? `<div class="rc-c rc-sm">${esc(br.addr)}</div>` : ''}
    ${br.phone ? `<div class="rc-c rc-sm">Тел: ${esc(br.phone)}</div>` : ''}
    <div class="rc-line"></div>
    <div class="rc-c rc-title">СОТУВ ЧЕКИ № ${esc(g.doc)}</div>
    ${g.status === CANCEL ? '<div class="rc-c rc-warn">*** БЕКОР ҚИЛИНГАН ***</div>' : ''}
    <div class="rc-kv"><span>Сана</span><b>${dLabel(g.date)} ${esc(g.time)}</b></div>
    <div class="rc-kv"><span>Мижоз</span><b>${esc(g.client)}</b></div>
    ${g.doctor ? `<div class="rc-kv"><span>Юборган врач</span><b>${esc(g.doctor)}</b></div>` : ''}
    <div class="rc-line"></div>
    ${items}
    <div class="rc-line"></div>
    ${g.disc ? `<div class="rc-kv"><span>Жами</span><b>${fmt(g.sum)}</b></div><div class="rc-kv"><span>Чегирма</span><b>−${fmt(g.disc)}</b></div>` : ''}
    <div class="rc-kv rc-tot"><span>${debt ? 'ҚАРЗГА' : 'ТЎЛОВ'}</span><b>${fmt(net)} ${esc(cur())}</b></div>
    ${g.pay ? `<div class="rc-kv"><span>Тўлов тури</span><b>${esc(g.pay)}</b></div>` : ''}
    <div class="rc-line"></div>
    <div class="rc-kv"><span>Кассир</span><b>${esc(g.op)}</b></div>
    ${phone ? `<div class="rc-kv"><span>Кассир тел.</span><b>${esc(phone)}</b></div>` : ''}
    <div class="rc-qr">${BIO_QR}<div class="rc-c rc-sm"><b>Др. Шерматов ҳақида</b><br>${BIO_URL}</div></div>
    <div class="rc-c rc-bye">Саломат бўлинг!</div>
  </div>`;
}

function printReceipt(g) {
  if (!g) return;
  let el = document.getElementById('receipt');
  if (!el) { el = document.createElement('div'); el.id = 'receipt'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
  el.innerHTML = receiptHTML(g);
  let st = document.getElementById('print-page');
  if (!st) { st = document.createElement('style'); st.id = 'print-page'; document.head.appendChild(st); }
  // қоғоз ўлчамини принтер драйвери белгилайди — акс ҳолда Chrome чекни варақ ўртасига қўяди
  st.textContent = '@page { size: auto; margin: 0; }';
  document.body.dataset.print = 'receipt';
  const done = () => { delete document.body.dataset.print; st.textContent = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(() => { if (document.body.dataset.print) done(); }, 1500); }, 80);
}

function docGroup(doc) {
  const src = S.today.concat((S.hist.data && S.hist.data.rows) || []);
  return groupDocs(src.filter((r) => r.doc === doc))[0];
}

async function askReceipt(doc) {
  const g = docGroup(doc);
  if (!g) return;
  const yes = await modal({
    title: 'Чек керакми?',
    body: `<b>${esc(g.doc)}</b> · ${esc(g.client)} · ${money(g.sum - g.disc)}`,
    ok: 'Ҳа, чек чиқариш', cancel: 'Йўқ',
  });
  if (yes) printReceipt(g);
}

/* ───────────── qaytarish ───────────── */

function retState() {
  if (!S.ret) S.ret = { q: '', results: null, loading: false, error: '', sel: null, qty: {}, sums: {}, manual: {}, reason: '', rid: uid(), busy: false };
  return S.ret;
}

function viewReturn() {
  const r = retState();
  return `<div class="work">
    <section class="panel sheet">
      <div class="ret-find">
        <div class="search grow">${ic('search')}<input id="ret-q" value="${esc(r.q)}" placeholder="Чек рақами (С-12 ёки 12) ёки мижоз исми" autocomplete="off" aria-label="Сотувни қидириш"></div>
        <button class="btn primary" data-act="ret-find">${ic('search')}Топиш</button>
      </div>
      <div id="ret-body">${retBody()}</div>
    </section>
    <aside class="feed" id="side">${sideHTML('return')}</aside>
  </div>`;
}

function renderRet() {
  const b = $('#ret-body');
  if (!b) return renderView();
  b.innerHTML = retBody();
  retTotals();
}

function retRemain(l) { return Math.max(0, l.qty - (l.returned || 0)); }
function retDefSum(l, q) { return l.qty ? Math.round(((l.sum || 0) * (l.fac == null ? 1 : l.fac) * q) / l.qty) : 0; }

function retBody() {
  const r = retState();
  if (r.sel) return retForm();
  if (r.loading) return loadingHTML;
  if (r.error) return `<p class="empty err">${esc(r.error)}</p>`;
  if (!r.results) {
    return `<div class="ret-empty">${ic('undo')}<p><b>Мижоз маҳсулот қайтариб келдими?</b><br>Чекдаги рақамни (С-12) ёки мижоз исмини ёзинг. ${isAdmin() ? (S.branch ? `«${esc(S.branch)}» филиалининг` : 'Ҳамма филиалларнинг') : 'Шу филиалнинг'} охирги бир йиллик сотувлари ичидан топилади. Маҳсулот сотилган филиал қолдиғига қайтади.</p></div>`;
  }
  if (!r.results.length) return '<p class="empty">Бундай сотув топилмади. Чек рақамини ёки исмни текширинг.</p>';
  return `<div class="sale-list">${r.results.map((d) => {
    const left = d.lines.reduce((a, l) => a + retRemain(l), 0);
    const sum = d.lines.reduce((a, l) => a + (l.sum || 0), 0);
    return `<article class="sale-pick ${left ? '' : 'done'}">
      <header><b>${esc(d.doc)}</b><span class="muted">${dLabel(d.date)} ${esc(d.time)}</span><span class="br">${esc(d.branch)}</span>
        ${left ? `<button class="btn primary sm" data-act="ret-pick" data-doc="${esc(d.doc)}">${ic('undo')}Қайтариш</button>` : '<span class="tag gray">Тўлиқ қайтарилган</span>'}</header>
      <div class="doc-who"><span>${ic('user')}${esc(d.client)}</span>${d.doctor ? `<span>${ic('doctor')}${esc(d.doctor)}</span>` : ''}</div>
      <ul>${d.lines.map((l) => `<li><span class="nm">${esc(l.product)}</span><span class="q">${fmt(l.qty)} × ${fmt(l.sum)}${l.returned ? ` · <em>қайтарилган ${l.returned}</em>` : ''}</span></li>`).join('')}</ul>
      <footer><b>${money(sum - (Number(d.discount) || 0))}</b>${payTag(d.pay)}<span>${esc(d.op)}</span></footer>
    </article>`;
  }).join('')}</div>`;
}

function retForm() {
  const r = retState();
  const d = r.sel;
  return `<div class="ret-head">
      <div><b>${esc(d.doc)}</b> <span class="muted">· ${dLabel(d.date)} ${esc(d.time)} · ${esc(d.branch)}</span>
        <div class="doc-who"><span>${ic('user')}${esc(d.client)}</span>${d.doctor ? `<span>${ic('doctor')}${esc(d.doctor)}</span>` : ''}</div></div>
      <button class="btn soft sm" data-act="ret-back">Бошқа чек</button>
    </div>
    <div class="rlines">
      <div class="rline head" aria-hidden="true"><span>Маҳсулот</span><span class="c">Сотилган</span><span class="c">Қайтариш сони</span><span class="r">Қайтариладиган сумма</span></div>
      ${d.lines.map((l) => {
        const rem = retRemain(l);
        const q = r.qty[l.id] || 0;
        const sm = r.manual[l.id] ? r.sums[l.id] : retDefSum(l, q);
        return `<div class="rline ${rem ? '' : 'done'}" data-rline="${l.id}">
          <div class="rp"><b>${esc(l.product)}</b><small>${fmt(l.qty)} × ${fmt(l.price)} = ${fmt(l.sum)}${l.returned ? ` · аввал қайтарилган: ${l.returned}` : ''}</small></div>
          <span class="c sold">${fmt(l.qty)}</span>
          ${rem ? `<div class="qty">
            <button type="button" data-act="rq-dec" aria-label="Камайтириш">${ic('minus')}</button>
            <input data-rq="${l.id}" inputmode="numeric" value="${q}" aria-label="${esc(l.product)}: қайтариш сони">
            <button type="button" data-act="rq-inc" aria-label="Кўпайтириш">${ic('plus')}</button>
          </div>
          <input class="money ${r.manual[l.id] ? 'manual' : ''}" data-rs="${l.id}" inputmode="numeric" value="${q ? fmt(sm) : ''}" placeholder="0" aria-label="${esc(l.product)}: қайтариладиган сумма">`
          : '<span class="c muted">тўлиқ қайтарилган</span><span></span>'}
        </div>`;
      }).join('')}
    </div>
    <button class="add-line" data-act="ret-all">${ic('undo')}<span>Ҳаммасини қайтариш</span></button>
    <label class="field note"><span>Қайтариш сабаби <b class="req" title="Мажбурий">*</b></span><input id="ret-reason" value="${esc(r.reason)}" placeholder="Масалан: ёқмади, ножўя таъсир, муддати" autocomplete="off"></label>
    <div class="checkout ret">
      <div class="co-l"><span class="co-cap">Мижозга қайтариладиган пул</span><div id="f-total"></div></div>
      <button class="go" data-act="ret-submit" ${r.busy ? 'disabled' : ''}>${r.busy ? '<span class="spin"></span>Сақланмоқда' : ic('check') + '<span class="d-txt">Қайтаришни расмийлаштириш</span><span class="m-txt">Қайтариш</span>'}</button>
    </div>`;
}

function retTotals() {
  const r = retState();
  const el = $('#f-total');
  if (!el || !r.sel) return;
  let qty = 0; let sum = 0;
  r.sel.lines.forEach((l) => {
    const q = r.qty[l.id] || 0;
    if (!q) return;
    qty += q;
    sum += r.manual[l.id] ? (r.sums[l.id] || 0) : retDefSum(l, q);
  });
  const debt = payKind(r.sel.pay) === 'debt';
  el.innerHTML = `<b class="amt">${fmt(sum)}<small>${cur()}</small></b><span class="sub">${fmt(qty)} дона «${esc(r.sel.branch)}» қолдиғига қайтади${debt ? ' · аввал қарздан айрилади' : ''}${Number(r.sel.discount) ? ' · чегирма ҳисобга олинган' : ''}</span>`;
}

function retInput(t) {
  const r = retState();
  if (t.id === 'ret-q') { r.q = t.value; return; }
  if (t.id === 'ret-reason') { r.reason = t.value; return; }
  if (!r.sel) return;
  if (t.dataset.rq) {
    const l = r.sel.lines.find((x) => String(x.id) === t.dataset.rq);
    let q = num(t.value);
    const rem = retRemain(l);
    if (q > rem) { q = rem; t.value = q; toast(`«${l.product}»: кўпи билан ${rem} дона қайтариш мумкин`, 'err'); }
    r.qty[l.id] = q;
    r.manual[l.id] = false;
    const sIn = document.querySelector(`[data-rs="${l.id}"]`);
    if (sIn) { sIn.value = q ? fmt(retDefSum(l, q)) : ''; sIn.classList.remove('manual'); }
    retTotals();
  } else if (t.dataset.rs) {
    const l = r.sel.lines.find((x) => String(x.id) === t.dataset.rs);
    r.sums[l.id] = num(t.value);
    r.manual[l.id] = true;
    t.classList.add('manual');
    retTotals();
  }
}

function retAll() {
  const r = retState();
  r.sel.lines.forEach((l) => { r.qty[l.id] = retRemain(l); r.manual[l.id] = false; });
  renderRet();
}

async function retFind(autoPick) {
  const r = retState();
  const inp = $('#ret-q');
  if (inp) r.q = inp.value;
  const q = r.q.trim();
  if (!q) { toast('Чек рақамини ёки мижоз исмини ёзинг', 'err'); return; }
  r.loading = true; r.error = ''; r.sel = null; renderRet();
  try {
    // чек рақами билан қидирилса, админга филиал филтри қўйилмайди
    const j = await api('saleLookup', { q, branch: /^\s*[CcСс]?\s*-?\s*\d+\s*$/.test(q) ? '' : S.branch });
    r.results = j.rows || [];
  } catch (e) { r.error = e.message; r.results = null; }
  r.loading = false;
  if (autoPick && r.results && r.results.length === 1) return retPick(r.results[0].doc);
  if (S.page === 'return') renderRet();
}

function retPick(doc) {
  const r = retState();
  const d = (r.results || []).find((x) => x.doc === doc);
  if (!d) return;
  r.sel = d; r.qty = {}; r.sums = {}; r.manual = {}; r.rid = uid();
  const tot = d.lines.reduce((a, l) => a + (l.sum || 0), 0);
  const fac = tot > 0 ? (tot - (Number(d.discount) || 0)) / tot : 1;
  d.lines.forEach((l) => { l.fac = fac; });
  const open = d.lines.filter((l) => retRemain(l) > 0);
  if (open.length === 1) r.qty[open[0].id] = Math.min(1, retRemain(open[0]));
  renderRet();
  const first = document.querySelector('[data-rq]');
  if (first) first.focus();
}

function retFrom(doc) {
  S.ret = null;
  retState().q = doc;
  goPage('return');
  retFind(true);
}

async function retSubmit() {
  const r = retState();
  if (r.busy || !r.sel) return;
  const items = r.sel.lines.filter((l) => (r.qty[l.id] || 0) > 0).map((l) => ({
    line: l.id, qty: r.qty[l.id], sum: r.manual[l.id] ? (r.sums[l.id] || 0) : retDefSum(l, r.qty[l.id]),
  }));
  if (!items.length) return toast('Қайтариладиган маҳсулот сонини ёзинг', 'err');
  if (!r.reason.trim()) { toast('Қайтариш сабабини ёзинг', 'err'); const i = $('#ret-reason'); if (i) i.focus(); return; }
  const total = items.reduce((a, x) => a + x.sum, 0);
  if (!(await modal({
    title: 'Қайтаришни тасдиқланг',
    body: `<b>${esc(r.sel.doc)}</b> чекидан ${fmt(items.reduce((a, x) => a + x.qty, 0))} дона қайтарилади${payKind(r.sel.pay) === 'debt' ? `. Сумма <b>${money(total)}</b> — аввал мижознинг қарзидан айрилади, қарздан ортгани пул қилиб қайтарилади` : `. Мижозга <b>${money(total)}</b> қайтарасиз`}. Маҳсулот <b>${esc(r.sel.branch)}</b> қолдиғига қўшилади.`,
    ok: 'Қайтариш',
  }))) return;
  r.busy = true; renderRet();
  try {
    const j = await api('return', { branch: r.sel.branch, ref: r.sel.doc, reason: r.reason, items, rid: r.rid });
    applyState(j);
    const parts = [];
    if (j.debtCut) parts.push(`қарздан −${fmt(j.debtCut)}`);
    if (j.refund) parts.push(`мижозга ${fmt(j.refund)} (${j.refundPay})`);
    toast(`Қайтарилди: ${j.doc}, ${money(j.total)}${parts.length ? ' · ' + parts.join(', ') : ''}${j.dup ? ' (аввал сақланган)' : ''}`, 'ok');
    S.ret = null; S.hist.data = null; S.rep.data = null; S.fin.data = null; S.debts.data = null;
    renderView();
    const q = $('#ret-q'); if (q) q.focus();
  } catch (e) {
    r.busy = false; renderRet();
    toast(e.message, 'err');
  }
}

/* ───────────── qarzdorlar ───────────── */

function daysTo(iso) {
  const a = new Date(todayISO() + 'T00:00:00Z'); const b = new Date(iso + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}
function dueInfo(x) {
  if (x.left <= 0) return { cls: 'done', label: 'Ёпилган' };
  if (!x.due) return { cls: 'none', label: 'Сана белгиланмаган' };
  const n = daysTo(x.due);
  if (n < 0) return { cls: 'late', label: `${-n} кун ўтди · ${dLabel(x.due)}` };
  if (n === 0) return { cls: 'soon', label: 'Бугун тўлаши керак' };
  if (n <= 3) return { cls: 'soon', label: `${n} кун қолди · ${dLabel(x.due)}` };
  return { cls: 'ok', label: `${dLabel(x.due)} гача` };
}

function viewDebts() {
  const d = S.debts;
  let body = loadingHTML;
  if (d.error) body = `<p class="empty err">${esc(d.error)}</p>`;
  else if (d.data && !d.loading) body = debtsBody(d.data);
  const segs = [['open', 'Очиқ'], ['closed', 'Ёпилган'], ['all', 'Ҳаммаси']];
  return `<section class="panel">
    <div class="filters">
      <div class="f-row">
        <div class="seg" role="group" aria-label="Ҳолати">${segs.map(([k, t]) => `<button class="${d.status === k ? 'on' : ''}" data-act="d-status" data-v="${k}">${t}</button>`).join('')}</div>
        <div class="search grow">${ic('search')}<input id="d-q" placeholder="Мижоз исми, чек рақами ёки изоҳ" value="${esc(d.q)}" aria-label="Қарздорни қидириш"></div>
        <button class="btn primary" data-act="d-load">Қидириш</button>
      </div>
    </div>
    <p class="range-cap">${S.branch ? esc(S.branch) : (isAdmin() ? 'Ҳамма филиаллар' : esc(S.user.branch))}</p>
    <div id="d-body">${body}</div>
  </section>`;
}

async function loadDebts() {
  const d = S.debts;
  const q = $('#d-q'); if (q) d.q = q.value;
  d.loading = true; d.error = '';
  const b = $('#d-body'); if (b) b.innerHTML = loadingHTML;
  try { d.data = await api('debts', { status: d.status, q: d.q, branch: S.branch }); } catch (e) { d.error = e.message; d.data = null; }
  d.loading = false;
  if (S.page === 'debts') { const bb = $('#d-body'); if (bb) bb.innerHTML = d.error ? `<p class="empty err">${esc(d.error)}</p>` : debtsBody(d.data); }
}

function debtsBody(d) {
  const t = d.tot;
  const stats = `<div class="stats">
    <div class="st-main"><small>Очиқ қарз</small><b>${money(t.left)}</b><span>${fmt(t.count)} та қарздор</span></div>
    <div class="${t.overdue ? 'st-late' : ''}"><small>Муддати ўтган</small><b>${fmt(t.overdueSum)}</b><span>${fmt(t.overdue)} та</span></div>
    <div class="${t.soon ? 'st-soon' : ''}"><small>3 кун ичида</small><b>${fmt(t.soonSum)}</b><span>${fmt(t.soon)} та</span></div>
    <div><small>Ёпилган</small><b>${fmt(t.closed)}</b><span>та қарз</span></div>
  </div>`;
  if (!d.rows.length) {
    const msg = S.debts.status === 'open' ? 'Очиқ қарз йўқ. Қарзга сотиш учун сотувда «Қарз» тўлов турини танланг.' : 'Бундай ёзув топилмади.';
    return stats + `<p class="empty">${msg}</p>`;
  }
  return stats + `<div class="debt-grid">${d.rows.map(debtCard).join('')}</div>`;
}

function debtCard(x) {
  const di = dueInfo(x);
  const done = x.paid + x.cut;
  const pct = x.amount ? Math.min(100, Math.round((done / x.amount) * 100)) : 0;
  const mine = isAdmin() || x.branch === S.user.branch;
  const hist = x.pays.map((p) => `<li><span>${dLabel(p.date)} ${esc(p.time)}</span><span>${payTag(p.pay)}</span><b>+${fmt(p.amount)}</b><span class="muted">${esc(p.op)}</span></li>`)
    .concat(x.rets.map((r) => `<li><span>${dLabel(r.date)}</span><span class="muted">${esc(r.doc)} қайтариш</span><b>−${fmt(r.cut)}</b><span></span></li>`)).join('');
  return `<article class="debt-c ${di.cls}">
    <header><b class="cl">${esc(x.client)}</b><span class="due ${di.cls}">${ic('cal')}${di.label}</span></header>
    <div class="meta">${esc(x.doc)} · ${dLabel(x.date)}${!S.branch && isAdmin() ? ' · ' + esc(x.branch) : ''}${x.doctor ? ' · ' + esc(x.doctor) : ''}</div>
    ${x.note ? `<p class="dnote">${ic('note')}<span>${esc(x.note)}</span></p>` : ''}
    <div class="prog" aria-hidden="true"><i style="width:${pct}%"></i></div>
    <div class="nums"><span><small>Қарз</small>${fmt(x.amount)}</span><span><small>Тўланди</small>${fmt(done)}</span><span class="lft"><small>Қолди</small>${fmt(x.left)}</span></div>
    ${hist ? `<details class="dh"><summary>Тўловлар тарихи (${x.pays.length + x.rets.length})</summary><ul>${hist}</ul></details>` : ''}
    ${mine ? `<footer>${x.left > 0 ? `<button class="btn primary sm" data-act="d-pay" data-id="${x.id}">${ic('cash')}Тўлов қабул қилиш</button>` : ''}
      <button class="btn soft sm" data-act="d-edit" data-id="${x.id}">${ic('pencil')}Сана ва изоҳ</button></footer>` : ''}
  </article>`;
}

function debtById(id) { return ((S.debts.data && S.debts.data.rows) || []).find((x) => String(x.id) === String(id)); }

function debtPay(id) {
  const x = debtById(id);
  if (!x) return;
  const rid = uid();
  formModal({
    title: `${x.client}: тўлов қабул қилиш`,
    fields: [
      { key: 'amount', label: `Сумма (қолган қарз ${fmt(x.left)})`, type: 'money', value: fmt(x.left) },
      { key: 'pay', label: 'Қандай тўлади', type: 'select', value: (moneyPays()[0] || {}).name, options: moneyPays().map((p) => [p.name, p.name]) },
      { key: 'note', label: 'Изоҳ', value: '', full: true, placeholder: 'Ихтиёрий' },
    ],
    ok: 'Қабул қилиш',
    onSubmit: async (v) => {
      if (!(Number(v.amount) > 0)) throw new Error('Тўлов суммасини ёзинг');
      if (Number(v.amount) > x.left) throw new Error(`Қолган қарз ${fmt(x.left)} — ундан кўп ёзиб бўлмайди`);
      const j = await api('debtPay', { id: x.id, amount: v.amount, pay: v.pay, note: v.note, rid });
      toast(j.left > 0 ? `Қабул қилинди: ${j.no}. Қолди ${money(j.left)}` : `Қабул қилинди: ${j.no}. Қарз тўлиқ ёпилди`, 'ok');
      S.fin.data = null; S.rep.data = null;
      loadDebts();
    },
  });
}

function debtEdit(id) {
  const x = debtById(id);
  if (!x) return;
  formModal({
    title: `${x.client}: сана ва изоҳ`,
    fields: [
      { key: 'due', label: 'Тўлаш санаси (бўш қолдириш мумкин)', type: 'date', value: x.due, full: true },
      { key: 'note', label: 'Изоҳ', value: x.note, full: true },
    ],
    onSubmit: async (v) => {
      await api('debtEdit', { id: x.id, due: v.due, note: v.note });
      toast('Сақланди', 'ok');
      loadDebts();
    },
  });
}

/* ───────────── moliya ───────────── */

const FIN_CAT = { 'Сотув': 'Сотувдан', 'Қарз тўлови': 'Қарз тўлови', 'Қайтариш': 'Мижозга қайтарилди', 'Харажат': 'Аптека харажати', 'Кассадан ечиш': 'Кассадан ечилди' };

function viewFinance() {
  const f = S.fin;
  const [from, to] = presetRange(f.preset, f.from, f.to);
  let body = loadingHTML;
  if (f.error) body = `<p class="empty err">${esc(f.error)}</p>`;
  else if (f.data && !f.loading) body = finBody(f.data);
  return `<section class="panel">
    <div class="filters">
      <div class="f-row">${periodBar('f', f)}${f.preset === 'custom' ? '<button class="btn primary sm" data-act="f-load">Кўрсатиш</button>' : ''}</div>
      <div class="f-row">
        <button class="btn primary" data-act="fin-new" data-grp="exp">${ic('minus')}Харажат ёзиш</button>
        <button class="btn soft" data-act="fin-new" data-grp="cash">${ic('wallet')}Кассадан пул ечиш</button>
      </div>
    </div>
    <p class="range-cap">${S.branch ? esc(S.branch) : (isAdmin() ? 'Ҳамма филиаллар' : esc(S.user.branch))}, ${rangeLabel(from, to)}</p>
    <div id="f-body">${body}</div>
  </section>`;
}

async function loadFinance() {
  const f = S.fin;
  if ($('#f-from')) f.from = $('#f-from').value;
  if ($('#f-to')) f.to = $('#f-to').value;
  const [from, to] = presetRange(f.preset, f.from, f.to);
  f.loading = true; f.error = '';
  const b = $('#f-body'); if (b) b.innerHTML = loadingHTML;
  try { f.data = await api('finance', { from, to, branch: S.branch }); } catch (e) { f.error = e.message; f.data = null; }
  f.loading = false;
  if (S.page === 'finance') { const bb = $('#f-body'); if (bb) bb.innerHTML = f.error ? `<p class="empty err">${esc(f.error)}</p>` : finBody(f.data); }
}

function finCanCancel(r) {
  if (r.status === CANCEL || r.cat === 'Сотув' || r.cat === 'Қайтариш') return false;
  if (isAdmin()) return true;
  return r.branch === S.user.branch && r.date === todayISO();
}

function finBody(d) {
  const t = d.tot;
  const diff = t.in - t.out;
  const ins = d.cats.filter((c) => c.dir === 'in');
  const outs = d.cats.filter((c) => c.dir === 'out');
  const catRow = (c) => `<tr><td>${esc(FIN_CAT[c.cat] || c.cat)}${c.sub ? ` <span class="muted">· ${esc(c.sub)}</span>` : ''}</td><td class="num">${fmt(c.n)}</td><td class="num b ${c.dir === 'out' ? 'neg' : 'pos'}">${c.dir === 'out' ? '−' : '+'}${fmt(c.sum)}</td></tr>`;
  return `<div class="stats rep6 fin">
    <div class="st-main"><small>Кассадаги нақд пул</small><b>${money(t.cash)}</b><span>ҳозир, ҳамма вақт бўйича</span></div>
    <div><small>Кирим</small><b class="pos">+${fmt(t.in)}</b><span>шу даврда</span></div>
    <div><small>Чиқим</small><b class="neg">−${fmt(t.out)}</b><span>шу даврда</span></div>
    <div><small>Фарқ</small><b class="${diff < 0 ? 'neg' : ''}">${diff < 0 ? '−' : ''}${fmt(Math.abs(diff))}</b><span>кирим − чиқим</span></div>
    <div><small>Ҳамма кассалар</small><b>${fmt(t.bal)}</b><span>нақд + карта + ўтказма</span></div>
    <div><small>Очиқ қарз</small><b>${fmt(t.debt)}</b><span>мижозларда</span></div>
  </div>

  ${d.branches.length ? `<h3 class="sec">Филиаллар</h3>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Филиал</th><th class="num">Кирим</th><th class="num">Чиқим</th><th class="num">Кассадаги нақд</th><th class="num">Ҳамма кассалар</th><th class="num">Очиқ қарз</th></tr></thead>
    <tbody>${d.branches.map((b) => `<tr><td class="b">${esc(b.branch)}</td><td class="num pos">+${fmt(b.in)}</td><td class="num neg">−${fmt(b.out)}</td><td class="num b">${fmt(b.cash)}</td><td class="num">${fmt(b.bal)}</td><td class="num">${fmt(b.debt)}</td></tr>`).join('')}</tbody></table></div>` : ''}

  <div class="two">
    <div>
      <h3 class="sec">Тўлов турлари бўйича</h3>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Тур</th><th class="num">Кирим</th><th class="num">Чиқим</th><th class="num">Ҳозирги қолдиқ</th></tr></thead>
        <tbody>${d.pays.map((p) => `<tr><td>${payTag(p.pay)}</td><td class="num">${fmt(p.in)}</td><td class="num">${fmt(p.out)}</td><td class="num b">${fmt(p.bal)}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div>
      <h3 class="sec">Нимадан кирди, нимага кетди</h3>
      ${d.cats.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Тоифа</th><th class="num">Сони</th><th class="num">Сумма</th></tr></thead>
        <tbody>${ins.map(catRow).join('')}${outs.map(catRow).join('')}</tbody></table></div>` : '<p class="empty">Бу даврда ёзув йўқ</p>'}
    </div>
  </div>

  <h3 class="sec">Ҳамма ёзувлар</h3>
  ${d.total > d.rows.length ? `<p class="hint soft">${ic('alert')}<span>Охирги ${d.rows.length} та ёзув кўрсатилди, жами ${d.total} та.</span></p>` : ''}
  ${d.rows.length ? `<div class="tbl-wrap"><table class="tbl hist fin-t"><thead><tr><th>Сана</th><th>№</th>${!S.branch && isAdmin() ? '<th>Филиал</th>' : ''}<th>Тоифа</th><th>Тўлов</th><th class="num">Сумма</th><th>Изоҳ</th><th>Оператор</th><th></th></tr></thead>
    <tbody>${d.rows.map((r) => `<tr class="${r.status === CANCEL ? 'off' : ''}">
      <td class="nw">${dLabel(r.date)} <span class="muted">${esc(r.time)}</span></td><td class="nw b">${esc(r.no)}</td>
      ${!S.branch && isAdmin() ? `<td class="nw">${esc(r.branch)}</td>` : ''}
      <td><span class="tag ${r.dir === 'in' ? 'leaf' : 'red'}">${r.dir === 'in' ? 'Кирим' : 'Чиқим'}</span> ${esc(FIN_CAT[r.cat] || r.cat)}${r.sub ? ` <span class="muted">· ${esc(r.sub)}</span>` : ''}</td>
      <td class="nw">${payTag(r.pay)}</td>
      <td class="num b ${r.dir === 'out' ? 'neg' : 'pos'}">${r.dir === 'out' ? '−' : '+'}${fmt(r.amount)}</td>
      <td class="note">${esc(r.note)}${r.cancel ? `${r.note ? ' · ' : ''}<span class="neg">${esc(r.cancel)}</span>` : ''}</td>
      <td class="nw muted">${esc(r.op)}</td>
      <td class="acts">${finCanCancel(r) ? `<button class="mini-danger" data-act="fin-cancel" data-no="${esc(r.no)}">Бекор қилиш</button>` : ''}</td>
    </tr>`).join('')}</tbody></table></div>` : '<p class="empty">Бу даврда молия ёзуви йўқ. Сотув, қарз тўлови ва харажатлар шу ерга тушади.</p>'}`;
}

function finNew(grp) {
  const cats = ((S.cfg.finCats || {})[grp]) || [];
  if (!cats.length) return toast('Созламаларда тоифа қўшинг', 'err');
  const needBr = isAdmin() && !S.branch;
  const rid = uid();
  const fields = [];
  if (needBr) fields.push({ key: 'branch', label: 'Филиал', type: 'select', value: '', options: [['', 'Филиални танланг']].concat(branchNames().map((b) => [b, b])), full: true });
  fields.push(
    { key: 'sub', label: grp === 'exp' ? 'Харажат тури' : 'Нимага ечилди', type: 'select', value: cats[0], options: cats.map((c) => [c, c]) },
    { key: 'amount', label: `Сумма, ${cur()}`, type: 'money', value: '' },
    { key: 'pay', label: 'Қайси кассадан', type: 'select', value: (moneyPays()[0] || {}).name, options: moneyPays().map((p) => [p.name, p.name]) },
    { key: 'note', label: 'Изоҳ', value: '', placeholder: 'Масалан: ноябрь ойи учун', full: true },
  );
  formModal({
    title: grp === 'exp' ? `Аптека харажати${S.branch ? ' · ' + S.branch : ''}` : `Кассадан пул ечиш${S.branch ? ' · ' + S.branch : ''}`,
    fields, ok: 'Ёзиш',
    onSubmit: async (v) => {
      const br = needBr ? v.branch : S.branch;
      if (needBr && !br) throw new Error('Филиални танланг');
      if (!(Number(v.amount) > 0)) throw new Error('Суммани ёзинг');
      const j = await api('finAdd', { grp, sub: v.sub, amount: v.amount, pay: v.pay, note: v.note, branch: br, rid });
      toast(`Ёзилди: ${j.no}, −${money(v.amount)}`, 'ok');
      S.rep.data = null;
      loadFinance();
    },
  });
}

async function finCancel(no) {
  const reason = await modal({
    title: `${no} ни бекор қилиш`,
    body: 'Ёзув ўчмайди, «Бекор» деб белгиланади ва касса қолдиғи тузалади. Сабабини ёзинг.',
    input: 'Сабаби', ok: 'Бекор қилиш', danger: true,
  });
  if (reason == null) return;
  if (!reason.trim()) return toast('Бекор қилиш сабабини ёзинг', 'err');
  try {
    await api('finCancel', { no, reason });
    toast(`${no} бекор қилинди`, 'ok');
    S.debts.data = null;
    loadFinance();
  } catch (e) { toast(e.message, 'err'); }
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
        <select id="h-type" aria-label="Тури"><option value="">Ҳамма турлар</option>${[T.OUT, T.RET, T.IN, T.TR].map((t) => `<option ${h.type === t ? 'selected' : ''} value="${t}">${t === T.OUT ? 'Расход (сотув)' : t}</option>`).join('')}</select>
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

function typeTag(t) { return `<span class="tag ${t === T.OUT ? 'leaf' : t === T.IN ? 'sky' : t === T.RET ? 'honey' : 'plum'}">${t === T.OUT ? 'Сотув' : t}</span>`; }

function histTable(d) {
  if (!d || !d.rows.length) return '<p class="empty">Бу даврда ёзув йўқ. Даврни ёки филтрни ўзгартириб кўринг.</p>';
  const act = d.rows.filter((r) => r.status !== CANCEL);
  const sales = act.filter((r) => r.type === T.OUT);
  const sDocs = new Set(sales.map((r) => r.doc)).size;
  const discSum = groupDocs(sales).reduce((a, g) => a + g.disc, 0);
  const sum = sales.reduce((a, r) => a + (r.sum || 0), 0) - discSum;
  const inQ = act.filter((r) => r.type === T.IN).reduce((a, r) => a + r.qty, 0);
  const trQ = act.filter((r) => r.type === T.TR).reduce((a, r) => a + r.qty, 0);
  const canc = new Set(d.rows.filter((r) => r.status === CANCEL).map((r) => r.doc)).size;
  const rets = act.filter((r) => r.type === T.RET);
  const retSum = rets.reduce((a, r) => a + (r.sum || 0), 0);
  const docMap = new Map(groupDocs(d.rows).map((g) => [g.doc, g]));
  const seen = new Set();
  return `<div class="stats rep">
      <div class="st-main"><small>Соф тушум</small><b>${money(sum - retSum)}</b><span>${sDocs} та чек, ${fmt(sales.reduce((a, r) => a + r.qty, 0))} дона</span></div>
      <div><small>Қайтариш</small><b class="${retSum ? 'neg' : ''}">${retSum ? '−' : ''}${fmt(retSum)}</b><span>${new Set(rets.map((r) => r.doc)).size} та, ${fmt(rets.reduce((a, r) => a + r.qty, 0))} дона</span></div>
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
          <td class="nw b">${first ? esc(r.doc) : ''}</td><td class="nw">${first ? typeTag(r.type) + (r.pay ? '<br>' + payTag(r.pay) : '') : ''}</td>
          <td class="nw">${first ? esc(r.branch) + (r.type === T.TR ? ` <span class="muted">→</span> ${esc(r.to)}` : '') : ''}</td>
          <td>${esc(r.product)}</td><td class="num">${fmt(r.qty)}</td>
          <td class="num">${r.price != null ? fmt(r.price) : ''}</td><td class="num b ${r.type === T.RET ? 'neg' : ''}">${r.sum != null ? (r.type === T.RET ? '−' : '') + fmt(r.sum) : ''}</td>
          <td>${first ? esc(r.client) : ''}</td><td>${first ? esc(r.doctor) : ''}</td><td class="nw muted">${first ? esc(r.op) : ''}</td>
          <td class="note">${first ? (r.ref ? `<b>Асос: ${esc(r.ref)}</b>${r.note ? ' · ' : ''}` : '') + (Number(r.disc) ? `<b class="discn">Чегирма −${fmt(r.disc)}${r.discNote ? ': ' + esc(r.discNote) : ''}</b>${r.note ? ' · ' : ''}` : '') + esc(r.note) : ''}</td>
          <td class="acts">${first && g && g.type === T.OUT ? `<button class="mini-act" data-act="rc-print" data-doc="${esc(r.doc)}" title="Чекни чоп этиш">${ic('print')}Чек</button>` : ''}${first && g && g.type === T.OUT && g.status !== CANCEL && (isAdmin() || g.branch === S.user.branch) ? `<button class="mini-act" data-act="ret-from" data-doc="${esc(r.doc)}">Қайтариш</button>` : ''}${first && g && canCancel(g) ? `<button class="mini-danger" data-act="cancel" data-doc="${esc(r.doc)}">Бекор қилиш</button>` : ''}</td>
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
      <div class="f-row">${periodBar('r', r)}${r.preset === 'custom' ? '<button class="btn primary sm" data-act="r-load">Кўрсатиш</button>' : ''}</div>
      <div class="f-row">
        <label class="sel-f">${ic('pin')}<select id="r-branch" aria-label="Филиал"><option value="">Ҳамма филиаллар</option>${branchNames().map((b) => `<option ${b === r.branch ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></label>
        <label class="sel-f">${ic('doctor')}<select id="r-doctor" aria-label="Врач"><option value="">Ҳамма врачлар</option>${(S.cfg.doctors || []).map((x) => `<option ${x === r.doctor ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <button class="btn primary push" data-act="xls" ${r.data ? '' : 'disabled'}>${ic('download')}Excel юклаб олиш</button>
        <button class="btn soft" data-act="print">${ic('print')}Чоп этиш</button>
      </div>
    </div>
    <p class="range-cap">Ҳисобот, ${rangeLabel(from, to)}${r.branch ? ' · ' + esc(r.branch) : ''}${r.doctor ? ' · ' + esc(r.doctor) : ''}</p>
    <div id="r-body">${body}</div>
  </section>`;
}

async function loadReport() {
  const r = S.rep;
  if ($('#r-from')) r.from = $('#r-from').value;
  if ($('#r-to')) r.to = $('#r-to').value;
  const [from, to] = presetRange(r.preset, r.from, r.to);
  r.loading = true; r.error = '';
  const cap = $('#r-body'); if (cap) cap.innerHTML = loadingHTML;
  try { r.data = await api('report', { from, to, branch: r.branch, doctor: r.doctor }); } catch (e) { r.error = e.message; r.data = null; }
  r.loading = false;
  if (S.page === 'report') renderView();
}

function repBranches(d) {
  if (d.filter && d.filter.branch) return [d.filter.branch];
  return branchNames().concat(Object.keys(d.byBranch).filter((b) => !branchNames().includes(b)));
}

function bar(v, max) { return `<span class="bar"><i style="width:${max ? Math.max(2, Math.round((v / max) * 100)) : 0}%"></i></span>`; }

function repBody(d) {
  const t = d.tot;
  const brs = repBranches(d);
  const bMax = Math.max(0, ...brs.map((b) => (d.byBranch[b] || {}).sum || 0));
  const prods = Object.entries(d.byProduct).sort((a, b) => b[1].sum - a[1].sum);
  const pMax = Math.max(0, ...prods.map((p) => p[1].sum));
  const docs = Object.entries(d.byDoctor).sort((a, b) => b[1].sum - a[1].sum);
  const dMax = Math.max(0, ...docs.map((p) => p[1].sum));
  const days = Object.entries(d.byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const dyMax = Math.max(0, ...days.map((x) => x[1].sum));
  const mprods = Object.keys(d.matrix);
  return `
  <div class="stats rep6">
    <div class="st-main"><small>Соф тушум</small><b>${money(t.sum)}</b><span>сотув ${fmt(t.gross)} − чегирма ${fmt(t.discount)} − қайтариш ${fmt(t.retSum)}</span></div>
    <div><small>Чегирма</small><b class="${t.discount ? 'disc' : ''}">${t.discount ? '−' : ''}${fmt(t.discount)}</b><span>${fmt(t.discDocs)} та чекда</span></div>
    <div><small>Қайтариш</small><b class="${t.retSum ? 'neg' : ''}">${t.retSum ? '−' : ''}${fmt(t.retSum)}</b><span>${fmt(t.retDocs)} та, ${fmt(t.retQty)} дона</span></div>
    <div><small>Чеклар</small><b>${fmt(t.docs)}</b><span>${fmt(t.clients)} мижоз, ${fmt(t.qty)} дона (соф)</span></div>
    <div><small>Очиқ қарз</small><b>${fmt(d.debt.open)}</b><span>${fmt(d.debt.openCount)} та қарздор</span></div>
    <div><small>Приход · Ўтказма</small><b>${fmt(t.inQty)} · ${fmt(t.trQty)}</b><span>дона, бекор: ${t.cancelled}</span></div>
  </div>

  <h3 class="sec">Филиаллар</h3>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Филиал</th><th class="num">Соф тушум</th><th class="w"></th><th class="num">Сотув</th><th class="num">Чегирма</th><th class="num">Қайтариш</th><th class="num">Чек</th><th class="num">Дона</th><th class="num">Приход</th><th class="num">Ўтказма кирди</th><th class="num">Ўтказма чиқди</th><th class="num">Ҳозирги қолдиқ</th></tr></thead>
    <tbody>${brs.map((b) => {
      const x = d.byBranch[b] || { sum: 0, gross: 0, disc: 0, retSum: 0, docs: 0, qty: 0, inQty: 0, trIn: 0, trOut: 0 };
      const st = (S.cfg.products || []).reduce((a, p) => a + stockOf(b, p.name), 0);
      return `<tr><td class="b">${esc(b)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, bMax)}</td><td class="num">${fmt(x.gross)}</td><td class="num ${x.disc ? 'disc' : 'muted'}">${x.disc ? '−' + fmt(x.disc) : 0}</td><td class="num ${x.retSum ? 'neg' : 'muted'}">${x.retSum ? '−' + fmt(x.retSum) : 0}</td><td class="num">${fmt(x.docs)}</td><td class="num">${fmt(x.qty)}</td><td class="num">${fmt(x.inQty)}</td><td class="num">${fmt(x.trIn)}</td><td class="num">${fmt(x.trOut)}</td><td class="num">${fmt(st)}</td></tr>`;
    }).join('')}</tbody>
  </table></div>

  <div class="two">
    <div>
      <h3 class="sec">Маҳсулотлар</h3>
      ${prods.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Маҳсулот</th><th class="num">Дона (соф)</th><th class="num">Қайтарилган</th><th class="num">Сумма (нархда)</th><th class="w"></th></tr></thead>
        <tbody>${prods.map(([n, x]) => `<tr><td>${esc(n)}</td><td class="num">${fmt(x.qty)}</td><td class="num ${x.ret ? 'neg' : 'muted'}">${fmt(x.ret || 0)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, pMax)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Бу даврда сотув йўқ</p>'}
    </div>
    <div>
      <h3 class="sec">Юборган врачлар</h3>
      ${docs.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Врач</th><th class="num">Чек</th><th class="num">Дона</th><th class="num">Сумма</th><th class="w"></th></tr></thead>
        <tbody>${docs.map(([n, x]) => `<tr><td>${esc(n)}</td><td class="num">${fmt(x.docs)}</td><td class="num">${fmt(x.qty)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, dMax)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Бу даврда сотув йўқ</p>'}
    </div>
  </div>

  <div class="two">
    <div>
      <h3 class="sec">Тўлов турлари (сотув, чегирмадан кейин)</h3>
      ${d.byPay.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Тур</th><th class="num">Чек</th><th class="num">Сумма</th><th class="w"></th></tr></thead>
        <tbody>${d.byPay.map((x) => `<tr><td>${payTag(x.pay)}</td><td class="num">${fmt(x.docs)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, Math.max(...d.byPay.map((y) => y.sum)))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Бу даврда сотув йўқ</p>'}
    </div>
    <div>
      <h3 class="sec">Қарзлар</h3>
      <div class="tbl-wrap"><table class="tbl"><tbody>
        <tr><td>Шу даврда қарзга сотилди</td><td class="num b">${fmt(d.debt.given)}</td></tr>
        <tr><td>Шу даврда қарз тўланди</td><td class="num b pos">${fmt(d.debt.paid)}</td></tr>
        <tr><td>Ҳозир очиқ қарз (${fmt(d.debt.openCount)} та)</td><td class="num b">${fmt(d.debt.open)}</td></tr>
      </tbody></table></div>
    </div>
  </div>

  <h3 class="sec">Чегирмалар ${d.discounts.length ? `<span class="muted">· ${d.discounts.length} та, жами −${fmt(t.discount)}</span>` : ''}</h3>
  ${d.discounts.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Сана</th><th>Чек</th><th>Филиал</th><th>Мижоз</th><th>Сотувчи</th><th class="num">Нархда</th><th class="num">Чегирма</th><th>Сабаби</th></tr></thead>
    <tbody>${d.discounts.map((x) => `<tr><td class="nw">${dLabel(x.date)} <span class="muted">${esc(x.time)}</span></td><td class="nw b">${esc(x.doc)}</td><td class="nw">${esc(x.branch)}</td><td>${esc(x.client)}</td><td class="nw muted">${esc(x.op)}</td><td class="num">${fmt(x.gross)}</td><td class="num b disc">−${fmt(x.disc)}</td><td class="note">${esc(x.note)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Бу даврда чегирма қилинмаган</p>'}

  ${mprods.length ? `<h3 class="sec">Сотилган дона (соф): маҳсулот ва филиал</h3>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Маҳсулот</th>${brs.map((b) => `<th class="num">${esc(b)}</th>`).join('')}<th class="num">Жами</th></tr></thead>
    <tbody>${mprods.map((p) => { const row = brs.map((b) => d.matrix[p][b] || 0); return `<tr><td>${esc(p)}</td>${row.map((q) => `<td class="num ${q ? '' : 'muted'}">${fmt(q)}</td>`).join('')}<td class="num b">${fmt(row.reduce((a, c) => a + c, 0))}</td></tr>`; }).join('')}</tbody></table></div>` : ''}

  ${days.length > 1 ? `<h3 class="sec">Кунлар</h3>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Сана</th><th class="num">Чек</th><th class="num">Дона</th><th class="num">Сумма</th><th class="w"></th></tr></thead>
    <tbody>${days.map(([dt, x]) => `<tr><td class="nw">${dLabel(dt)}</td><td class="num">${fmt(x.docs)}</td><td class="num">${fmt(x.qty)}</td><td class="num b">${fmt(x.sum)}</td><td class="w">${bar(x.sum, dyMax)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}

/* ───────────── Excel (ExcelJS, faqat bosilganda yuklanadi) ───────────── */

let xlsLib = null;
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (xlsLib) return xlsLib;
  xlsLib = new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = 'vendor/exceljs.min.js';
    sc.onload = () => resolve(window.ExcelJS);
    sc.onerror = () => { xlsLib = null; reject(new Error('Excel кутубхонаси юкланмади — интернетни текширинг')); };
    document.head.appendChild(sc);
  });
  return xlsLib;
}

const XL = {
  forest: 'FF12382D', leaf: 'FF1E9E63', mint: 'FFEDF4EF', line: 'FFDDE8E1', honey: 'FFFDF1DC',
  red: 'FFD9493F', redSoft: 'FFFCE9E7', grey: 'FF8A9A93', white: 'FFFFFFFF', ink: 'FF17302A',
};
const XL_TYPE_FILL = { 'Расход': 'FFE3F4EA', 'Қайтариш': 'FFFDF1DC', 'Приход': 'FFE5F0FA', 'Ўтказма': 'FFEFE8F8' };

function xlDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }

/** Чиройли жадвал: сарлавҳа, қаторлар, жами, филтр, қотирилган сарлавҳа */
function xlTable(ws, { title, sub, cols, rows, total, startRow = 1 }) {
  let r = startRow;
  const n = cols.length;
  if (title) {
    ws.mergeCells(r, 1, r, n);
    const c = ws.getCell(r, 1);
    c.value = title; c.font = { bold: true, size: 15, color: { argb: XL.forest } };
    ws.getRow(r).height = 24; r++;
  }
  if (sub) {
    ws.mergeCells(r, 1, r, n);
    const c = ws.getCell(r, 1);
    c.value = sub; c.font = { size: 10, color: { argb: XL.grey } };
    r++;
  }
  if (title || sub) r++;
  const hr = r;
  const head = ws.getRow(hr);
  cols.forEach((col, i) => {
    const c = head.getCell(i + 1);
    c.value = col.h;
    c.font = { bold: true, color: { argb: XL.white } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.forest } };
    c.alignment = { vertical: 'middle', horizontal: col.num ? 'right' : 'left', wrapText: true };
    c.border = { bottom: { style: 'thin', color: { argb: XL.forest } } };
    ws.getColumn(i + 1).width = col.w || 14;
  });
  head.height = 22;
  rows.forEach((vals, k) => {
    const row = ws.getRow(hr + 1 + k);
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v == null ? '' : v;
      const col = cols[i];
      if (col.num) { c.numFmt = col.fmt || '#,##0'; c.alignment = { horizontal: 'right' }; }
      if (col.date) c.numFmt = 'dd.mm.yyyy';
      c.border = { bottom: { style: 'hair', color: { argb: XL.line } } };
    });
    if (k % 2 === 1) row.eachCell({ includeEmpty: true }, (c) => { if (!c.fill || c.fill.type !== 'pattern') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FBF9' } }; });
  });
  const last = hr + rows.length;
  if (total && rows.length) {
    const tr = ws.getRow(last + 1);
    cols.forEach((col, i) => {
      const c = tr.getCell(i + 1);
      const letter = ws.getColumn(i + 1).letter;
      if (i === 0) c.value = 'Жами';
      else if (col.sum) c.value = { formula: `SUBTOTAL(9,${letter}${hr + 1}:${letter}${last})` };
      if (col.num) { c.numFmt = col.fmt || '#,##0'; c.alignment = { horizontal: 'right' }; }
      c.font = { bold: true, color: { argb: XL.forest } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.mint } };
      c.border = { top: { style: 'thin', color: { argb: XL.forest } } };
    });
  }
  ws.autoFilter = { from: { row: hr, column: 1 }, to: { row: Math.max(hr, last), column: n } };
  ws.views = [{ state: 'frozen', ySplit: hr, xSplit: 0, showGridLines: false }];
  return { headRow: hr, lastRow: last };
}

async function exportExcel(btn) {
  const r = S.rep;
  const d = r.data;
  if (!d) return;
  const [from, to] = [d.from, d.to];
  const old = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Тайёрланмоқда';
  try {
    const [ExcelJS, ex] = await Promise.all([
      loadExcelJS(),
      api('exportRows', { from, to, branch: r.branch, doctor: r.doctor }),
    ]);
    const wb = new ExcelJS.Workbook();
    wb.creator = S.user.name; wb.created = new Date();
    const net = S.cfg.name;
    const period = rangeLabel(from, to);
    const filt = `Давр: ${period} · Филиал: ${r.branch || 'ҳаммаси'} · Врач: ${r.doctor || 'ҳаммаси'} · Тузилди: ${dLabel(todayISO())} ${hm(Date.now())}, ${S.user.name}`;
    const t = d.tot;
    const brs = repBranches(d);

    // 1. Умумий
    const w1 = wb.addWorksheet('Ҳисобот', { properties: { tabColor: { argb: XL.forest } } });
    xlTable(w1, {
      title: `${net} — ҳисобот`, sub: filt,
      cols: [{ h: 'Кўрсаткич', w: 34 }, { h: 'Қиймат', w: 20, num: true }, { h: 'Изоҳ', w: 40 }],
      rows: [
        ['Сотув (нархда)', t.gross, cur()],
        ['Чегирма', -t.discount, `${t.discDocs} та чекда`],
        ['Қайтариш', -t.retSum, `${t.retDocs} та ҳужжат, ${t.retQty} дона`],
        ['Соф тушум', t.sum, 'сотув − чегирма − қайтариш'],
        ['Чеклар сони', t.docs, ''],
        ['Ўртача чек', t.docs ? Math.round(t.gross / t.docs) : 0, cur()],
        ['Сотилган дона (соф)', t.qty, `сотилган ${t.soldQty}, қайтарилган ${t.retQty}`],
        ['Мижозлар', t.clients, 'киши'],
        ['Приход', t.inQty, 'дона'],
        ['Ўтказма', t.trQty, 'дона'],
        ['Бекор қилинган ҳужжатлар', t.cancelled, ''],
        ['Шу даврда қарзга сотилди', d.debt.given, cur()],
        ['Шу даврда қарз тўланди', d.debt.paid, cur()],
        ['Ҳозир очиқ қарз', d.debt.open, `${d.debt.openCount} та қарздор`],
      ],
    });
    const netRow = w1.getRow(8);
    netRow.eachCell((c) => { c.font = { bold: true, size: 12, color: { argb: XL.forest } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.honey } }; });
    w1.getCell('B6').font = { color: { argb: XL.red } };
    w1.getCell('B7').font = { color: { argb: XL.red } };

    // 2. Филиаллар
    const w2 = wb.addWorksheet('Филиаллар');
    xlTable(w2, {
      title: 'Филиаллар бўйича', sub: filt,
      cols: [{ h: 'Филиал', w: 28 }, { h: 'Сотув (нархда)', w: 15, num: true, sum: true }, { h: 'Чегирма', w: 13, num: true, sum: true }, { h: 'Қайтариш', w: 14, num: true, sum: true },
        { h: 'Соф тушум', w: 16, num: true, sum: true }, { h: 'Чеклар', w: 10, num: true, sum: true }, { h: 'Дона (соф)', w: 12, num: true, sum: true },
        { h: 'Приход', w: 11, num: true, sum: true }, { h: 'Ўтказма кирди', w: 13, num: true, sum: true }, { h: 'Ўтказма чиқди', w: 13, num: true, sum: true },
        { h: 'Ҳозирги қолдиқ', w: 14, num: true, sum: true }],
      rows: brs.map((b) => {
        const x = d.byBranch[b] || {};
        const st = (S.cfg.products || []).reduce((a, p) => a + stockOf(b, p.name), 0);
        return [b, x.gross || 0, -(x.disc || 0), -(x.retSum || 0), x.sum || 0, x.docs || 0, x.qty || 0, x.inQty || 0, x.trIn || 0, x.trOut || 0, st];
      }),
      total: true,
    });

    // 3. Маҳсулотлар
    const prods = Object.entries(d.byProduct).sort((a, b) => b[1].sum - a[1].sum);
    xlTable(wb.addWorksheet('Маҳсулотлар'), {
      title: 'Маҳсулотлар бўйича', sub: filt,
      cols: [{ h: '№', w: 5, num: true, fmt: '0' }, { h: 'Маҳсулот', w: 42 }, { h: 'Сотилган дона (соф)', w: 16, num: true, sum: true },
        { h: 'Қайтарилган дона', w: 15, num: true, sum: true }, { h: 'Соф сумма', w: 16, num: true, sum: true }],
      rows: prods.map(([n, x], i) => [i + 1, n, x.qty, x.ret || 0, x.sum]),
      total: true,
    });

    // 4. Врачлар
    const docs = Object.entries(d.byDoctor).sort((a, b) => b[1].sum - a[1].sum);
    xlTable(wb.addWorksheet('Врачлар'), {
      title: 'Юборган врачлар бўйича', sub: filt,
      cols: [{ h: '№', w: 5, num: true, fmt: '0' }, { h: 'Врач', w: 30 }, { h: 'Чеклар', w: 10, num: true, sum: true },
        { h: 'Дона (соф)', w: 12, num: true, sum: true }, { h: 'Соф сумма', w: 16, num: true, sum: true }],
      rows: docs.map(([n, x], i) => [i + 1, n, x.docs, x.qty, x.sum]),
      total: true,
    });

    // 5. Кунлар
    const days = Object.entries(d.byDay).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    xlTable(wb.addWorksheet('Кунлар'), {
      title: 'Кунлар бўйича', sub: filt,
      cols: [{ h: 'Сана', w: 13, date: true }, { h: 'Чеклар', w: 10, num: true, sum: true }, { h: 'Дона (соф)', w: 12, num: true, sum: true }, { h: 'Соф сумма', w: 16, num: true, sum: true }],
      rows: days.map(([dt, x]) => [xlDate(dt), x.docs, x.qty, x.sum]),
      total: true,
    });

    // 6. Матрица
    const mp = Object.keys(d.matrix).sort();
    xlTable(wb.addWorksheet('Маҳсулот×Филиал'), {
      title: 'Сотилган дона (соф): маҳсулот ва филиал', sub: filt,
      cols: [{ h: 'Маҳсулот', w: 40 }].concat(brs.map((b) => ({ h: b, w: 16, num: true, sum: true })), [{ h: 'Жами', w: 10, num: true, sum: true }]),
      rows: mp.map((p) => { const q = brs.map((b) => d.matrix[p][b] || 0); return [p].concat(q, [q.reduce((a, c) => a + c, 0)]); }),
      total: true,
    });

    // 6б. Тўлов турлари, чегирмалар, қарздорлар, молия
    xlTable(wb.addWorksheet('Тўлов турлари'), {
      title: 'Тўлов турлари бўйича сотув (чегирмадан кейин)', sub: filt,
      cols: [{ h: 'Тўлов тури', w: 26 }, { h: 'Чеклар', w: 10, num: true, sum: true }, { h: 'Сумма', w: 16, num: true, sum: true }],
      rows: d.byPay.map((x) => [x.pay, x.docs, x.sum]),
      total: true,
    });
    const wD = wb.addWorksheet('Чегирмалар', { properties: { tabColor: { argb: 'FFF2A93B' } } });
    xlTable(wD, {
      title: 'Чегирмалар', sub: filt,
      cols: [{ h: 'Сана', w: 11, date: true }, { h: 'Вақт', w: 7 }, { h: 'Чек', w: 9 }, { h: 'Филиал', w: 24 }, { h: 'Мижоз', w: 26 },
        { h: 'Сотувчи', w: 14 }, { h: 'Нархда', w: 14, num: true, sum: true }, { h: 'Чегирма', w: 13, num: true, sum: true },
        { h: 'Тўланди', w: 14, num: true, sum: true }, { h: 'Сабаби', w: 40 }],
      rows: d.discounts.map((x) => [xlDate(x.date), x.time, x.doc, x.branch, x.client, x.op, x.gross, x.disc, x.gross - x.disc, x.note]),
      total: true,
    });
    const [dbt, fin] = await Promise.all([
      api('debts', { status: 'open', branch: r.branch }),
      api('finance', { from, to, branch: r.branch }),
    ]);
    xlTable(wb.addWorksheet('Қарздорлар'), {
      title: `Очиқ қарзлар (${dLabel(todayISO())} ҳолатига)`, sub: `Филиал: ${r.branch || 'ҳаммаси'} · тўлаш санаси яқинлари тепада`,
      cols: [{ h: 'Мижоз', w: 26 }, { h: 'Чек', w: 9 }, { h: 'Сана', w: 11, date: true }, { h: 'Филиал', w: 24 },
        { h: 'Қарз', w: 13, num: true, sum: true }, { h: 'Тўланди', w: 13, num: true, sum: true }, { h: 'Қолди', w: 13, num: true, sum: true },
        { h: 'Тўлаш санаси', w: 13, date: true }, { h: 'Изоҳ', w: 40 }],
      rows: dbt.rows.map((x) => [x.client, x.doc, xlDate(x.date), x.branch, x.amount, x.paid + x.cut, x.left, x.due ? xlDate(x.due) : null, x.note]),
      total: true,
    });
    const wF = wb.addWorksheet('Молия');
    const posF = xlTable(wF, {
      title: 'Молия: кирим ва чиқим', sub: `Давр: ${period} · Филиал: ${r.branch || 'ҳаммаси'} · Кассадаги нақд (ҳозир): ${fmt(fin.tot.cash)} ${cur()}`,
      cols: [{ h: 'Сана', w: 11, date: true }, { h: 'Вақт', w: 7 }, { h: '№', w: 9 }, { h: 'Филиал', w: 24 }, { h: 'Тоифа', w: 22 },
        { h: 'Тури', w: 22 }, { h: 'Тўлов', w: 12 }, { h: 'Кирим', w: 14, num: true, sum: true }, { h: 'Чиқим', w: 14, num: true, sum: true },
        { h: 'Изоҳ', w: 40 }, { h: 'Оператор', w: 13 }, { h: 'Ҳолат', w: 8 }],
      rows: fin.rows.slice().reverse().map((x) => [xlDate(x.date), x.time, x.no, x.branch, FIN_CAT[x.cat] || x.cat, x.sub, x.pay,
        x.dir === 'in' && x.status !== CANCEL ? x.amount : null, x.dir === 'out' && x.status !== CANCEL ? x.amount : null,
        [x.note, x.cancel].filter(Boolean).join(' · '), x.op, x.status]),
      total: true,
    });
    fin.rows.slice().reverse().forEach((x, k) => {
      const row = wF.getRow(posF.headRow + 1 + k);
      row.getCell(8).font = { color: { argb: XL.leaf } };
      row.getCell(9).font = { color: { argb: XL.red } };
      if (x.status === CANCEL) row.eachCell({ includeEmpty: true }, (c) => { c.font = { italic: true, strike: true, color: { argb: XL.grey } }; });
    });

    // 7. Ҳаракатлар (батафсил)
    const w7 = wb.addWorksheet('Ҳаракатлар', { properties: { tabColor: { argb: XL.leaf } } });
    const cols7 = [{ h: 'Сана', w: 11, date: true }, { h: 'Вақт', w: 7 }, { h: 'Ҳужжат', w: 9 }, { h: 'Тури', w: 11 },
      { h: 'Филиал', w: 24 }, { h: 'Қаерга', w: 20 }, { h: 'Маҳсулот', w: 36 }, { h: 'Сони', w: 7, num: true, sum: true },
      { h: 'Нарх', w: 11, num: true }, { h: 'Сумма', w: 13, num: true, sum: true }, { h: 'Мижоз Ф.И.Ш', w: 24 }, { h: 'Юборган врач', w: 18 },
      { h: 'Ҳолат', w: 8 }, { h: 'Оператор', w: 13 }, { h: 'Изоҳ', w: 34 }, { h: 'Асос ҳужжат', w: 11 },
      { h: 'Тўлов тури', w: 12 }, { h: 'Чегирма (чек)', w: 13, num: true, sum: true }, { h: 'Чегирма сабаби', w: 30 }];
    const rows7 = ex.rows.map((x) => {
      const ret = x[3] === T.RET;
      return [xlDate(x[0]), x[1], x[2], x[3], x[4], x[5], x[6], ret ? -x[7] : x[7], x[8], x[9] == null ? null : (ret ? -x[9] : x[9]), x[10], x[11], x[12], x[13], x[14], x[15],
        x[16] || '', x[17] ? -x[17] : null, x[18] || ''];
    });
    const pos = xlTable(w7, {
      title: 'Ҳамма ҳаракатлар', sub: filt + ' · Қайтариш ва чегирма манфий (−). «Сумма» + «Чегирма» = соф тушум (приход/ўтказмада сумма йўқ)',
      cols: cols7, rows: rows7, total: true,
    });
    ex.rows.forEach((x, k) => {
      const row = w7.getRow(pos.headRow + 1 + k);
      const tc = row.getCell(4);
      tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_TYPE_FILL[x[3]] || XL.white } };
      if (x[3] === T.RET) [8, 10].forEach((i) => { row.getCell(i).font = { color: { argb: XL.red } }; });
      if (x[17]) row.getCell(18).font = { color: { argb: 'FFB7791F' } };
      if (x[12] === CANCEL) row.eachCell({ includeEmpty: true }, (c) => { c.font = { italic: true, strike: true, color: { argb: XL.grey } }; });
      row.getCell(15).alignment = { wrapText: true, vertical: 'top' };
    });
    if (ex.total > ex.rows.length) {
      const c = w7.getCell(pos.lastRow + 3, 1);
      c.value = `Диққат: биринчи ${ex.rows.length} та қатор олинди (жами ${ex.total}). Даврни қисқартиринг.`;
      c.font = { bold: true, color: { argb: XL.red } };
    }

    wb.eachSheet((ws) => { ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }; });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const name = `Ҳисобот_${from}_${to}${r.branch ? '_' + r.branch : ''}${r.doctor ? '_' + r.doctor : ''}.xlsx`.replace(/[\\/:*?"<>|]+/g, ' ');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(`Excel тайёр: ${ex.rows.length} та қатор`, 'ok');
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    btn.disabled = false; btn.innerHTML = old;
  }
}

/* ───────────── sozlamalar (admin) ───────────── */

const SET_TABS = [['products', 'Маҳсулотлар'], ['branches', 'Филиаллар'], ['doctors', 'Врачлар'], ['users', 'Фойдаланувчилар'], ['payTypes', 'Тўлов турлари'], ['finCats', 'Чиқим турлари'], ['general', 'Умумий']];
const SET_KIND = { products: 'product', branches: 'branch', doctors: 'doctor', users: 'user', payTypes: 'paytype', finCats: 'fincat' };
const PAY_KINDS = [['cash', 'Нақд пул — кассага тушади'], ['card', 'Карта / терминал'], ['transfer', 'Ўтказма (ЯТТ, МЧЖ, Click ...)'], ['debt', 'Қарз — қарздорлар рўйхатига тушади']];
const FIN_GRPS = [['exp', 'Аптека харажати'], ['cash', 'Кассадан пул ечиш']];

function viewSettings() {
  const st = S.set;
  let body = loadingHTML;
  if (st.error) body = `<p class="empty err">${esc(st.error)}</p>`;
  else if (st.data && !st.loading) body = setBody();
  return `<section class="panel">
    <div class="toolbar">
      <div class="seg" role="tablist">${SET_TABS.map(([k, t]) => `<button class="${st.tab === k ? 'on' : ''}" data-act="set-tab" data-tab="${k}" role="tab" aria-selected="${st.tab === k}">${t}</button>`).join('')}</div>
      ${st.tab !== 'general' ? `<button class="btn primary sm push" data-act="set-new">${ic('plus')}Янги қўшиш</button>` : ''}
    </div>
    <div id="set-body">${body}</div>
  </section>`;
}

async function loadSettings() {
  const st = S.set;
  st.loading = true; st.error = '';
  try { st.data = await api('settings'); } catch (e) { st.error = e.message; }
  st.loading = false;
  if (S.page === 'settings') renderView();
}

function renderSetBody() {
  const b = $('#set-body');
  if (b && S.page === 'settings') b.innerHTML = setBody();
}

function stateTag(on) { return on ? '<span class="tag leaf">Фаол</span>' : '<span class="tag gray">Ўчирилган</span>'; }
function editBtn(id) { return `<button class="icon-btn" data-act="set-edit" data-id="${id}" title="Таҳрирлаш" aria-label="Таҳрирлаш">${ic('pencil')}</button>`; }

function setBody() {
  const d = S.set.data;
  const tab = S.set.tab;
  if (tab === 'general') {
    return `<div class="gen">
      <label class="field"><span>Тармоқ номи (сайт тепасида кўринади)</span><input id="g-name" value="${esc(d.general.name)}"></label>
      <label class="field"><span>Валюта</span><input id="g-cur" value="${esc(d.general.currency)}"></label>
      <button class="btn primary" data-act="set-general">${ic('check')}Сақлаш</button>
    </div>
    <p class="hint soft">${ic('note')}<span>Google Sheets жадвали ҳар 6 соатда шу базадан нусха олади. Нархни, маҳсулотни ёки PIN'ни энди фақат шу саҳифада ўзгартиринг — Sheets'даги ўзгариш сайтга тушмайди.</span></p>`;
  }
  const search = `<div class="search set-search">${ic('search')}<input id="set-q" placeholder="Қидириш" value="${esc(S.set.q)}" aria-label="Қидириш"></div>`;
  if (tab === 'products') {
    const noPrice = d.products.filter((p) => p.active && !Number(p.price)).length;
    return `${search}
      ${noPrice ? `<p class="hint warn">${ic('alert')}<span><b>${noPrice} та</b> маҳсулотнинг нархи ёзилмаган. Нарх устунига ёзиб Enter босинг — дарҳол сақланади ва сотувда ўзи қўйилади.</span></p>` : ''}
      <div class="tbl-wrap"><table class="tbl set" id="set-tbl"><thead><tr><th>Маҳсулот</th><th class="num">Нарх, ${esc(cur())}</th><th>Бирлик</th><th class="num">Мин. қолдиқ</th><th>Ҳолат</th><th></th></tr></thead>
      <tbody>${d.products.map((p) => `<tr class="${p.active ? '' : 'inactive'}" data-name="${esc(p.name.toLowerCase())}">
        <td class="b">${esc(p.name)}${p.note ? `<small>${esc(p.note)}</small>` : ''}</td>
        <td class="num"><input class="money inline" data-price-id="${p.id}" inputmode="numeric" value="${Number(p.price) ? fmt(p.price) : ''}" placeholder="0" aria-label="${esc(p.name)} нархи"></td>
        <td>${esc(p.unit)}</td><td class="num">${p.min}</td><td>${stateTag(p.active)}</td><td class="act">${editBtn(p.id)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if (tab === 'branches') {
    return `<div class="tbl-wrap"><table class="tbl set"><thead><tr><th>Филиал</th><th>Манзил</th><th>Телефон</th><th>Ҳолат</th><th></th></tr></thead>
      <tbody>${d.branches.map((b) => `<tr class="${b.active ? '' : 'inactive'}"><td class="b">${esc(b.name)}</td><td>${esc(b.addr)}</td><td class="nw">${esc(b.phone)}</td><td>${stateTag(b.active)}</td><td class="act">${editBtn(b.id)}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint soft">${ic('note')}<span>Филиал номини ўзгартириш хавфсиз — эски ёзувлар ҳам янги ном билан кўринади.</span></p>`;
  }
  if (tab === 'doctors') {
    return `${search}<div class="tbl-wrap"><table class="tbl set" id="set-tbl"><thead><tr><th>Врач</th><th>Изоҳ</th><th>Ҳолат</th><th></th></tr></thead>
      <tbody>${d.doctors.map((x) => `<tr class="${x.active ? '' : 'inactive'}" data-name="${esc(x.name.toLowerCase())}"><td class="b">${esc(x.name)}</td><td class="muted">${esc(x.note)}</td><td>${stateTag(x.active)}</td><td class="act">${editBtn(x.id)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if (tab === 'payTypes') {
    return `<div class="tbl-wrap"><table class="tbl set"><thead><tr><th>Тўлов тури</th><th>Қандай ишлайди</th><th>Ҳолат</th><th></th></tr></thead>
      <tbody>${d.payTypes.map((x) => `<tr class="${x.active ? '' : 'inactive'}"><td class="b">${payTag(x.name) || esc(x.name)}</td><td class="muted">${esc((PAY_KINDS.find((k) => k[0] === x.kind) || [, x.kind])[1])}</td><td>${stateTag(x.active)}</td><td class="act">${editBtn(x.id)}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint soft">${ic('note')}<span>Сотувда шу турлар тугма бўлиб чиқади. «Қарз» туридаги сотув молияга тушмайди — қарздорлар рўйхатига тушади, мижоз тўлаганда кирим бўлади. Номни ўзгартирсангиз, эски ёзувлар ҳам янги ном билан кўринади.</span></p>`;
  }
  if (tab === 'finCats') {
    return `<div class="tbl-wrap"><table class="tbl set"><thead><tr><th>Тоифа</th><th>Гуруҳ</th><th>Ҳолат</th><th></th></tr></thead>
      <tbody>${d.finCats.map((x) => `<tr class="${x.active ? '' : 'inactive'}"><td class="b">${esc(x.name)}</td><td>${x.grp === 'exp' ? '<span class="tag red">Аптека харажати</span>' : '<span class="tag plum">Кассадан пул ечиш</span>'}</td><td>${stateTag(x.active)}</td><td class="act">${editBtn(x.id)}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint soft">${ic('note')}<span>Молия бўлимида «Харажат ёзиш» ва «Кассадан пул ечиш» тугмаларида шу тоифалар чиқади. «Бошқа» билан бошланадиган тоифага изоҳ мажбурий.</span></p>`;
  }
  if (tab === 'users') {
    return `<div class="tbl-wrap"><table class="tbl set"><thead><tr><th>Исм</th><th>Роль</th><th>Филиал</th><th>Телефон</th><th>Ҳолат</th><th></th></tr></thead>
      <tbody>${d.users.map((u) => `<tr class="${u.active ? '' : 'inactive'}"><td class="b">${esc(u.name)}</td><td>${u.role === 'admin' ? '<span class="tag plum">Админ</span>' : '<span class="tag sky">Сотувчи</span>'}</td><td>${esc(u.branch || '—')}</td><td class="nw muted">${esc(u.phone || '')}</td><td>${stateTag(u.active)}</td><td class="act">${editBtn(u.id)}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint soft">${ic('note')}<span>PIN ўзгартирилса, у фойдаланувчи ҳамма қурилмадан чиқиб кетади ва янги PIN билан киради. Ҳар сотувчига алоҳида PIN беринг.</span></p>`;
  }
  return '';
}

function filterSettings() {
  const q = S.set.q.trim().toLowerCase();
  document.querySelectorAll('#set-tbl tbody tr').forEach((tr) => { tr.style.display = !q || tr.dataset.name.includes(q) ? '' : 'none'; });
}

let syncTimer = 0;
function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(true), 700); }

async function savePrice(inp) {
  const p = S.set.data.products.find((x) => String(x.id) === inp.dataset.priceId);
  if (!p) return;
  const price = num(inp.value);
  if (price === Number(p.price)) { inp.value = price ? fmt(price) : ''; return; }
  inp.classList.add('saving');
  try {
    S.set.data = await api('save', { kind: 'product', item: { id: p.id, name: p.name, price, unit: p.unit, min: p.min, note: p.note, active: p.active } });
    inp.value = price ? fmt(price) : '';
    inp.classList.remove('saving'); inp.classList.add('saved');
    setTimeout(() => inp.classList.remove('saved'), 1200);
    scheduleSync();
  } catch (e) {
    inp.classList.remove('saving');
    toast(e.message, 'err');
  }
}

async function saveGeneral(btn) {
  btn.disabled = true;
  try {
    S.set.data = await api('save', { kind: 'general', item: { name: $('#g-name').value, currency: $('#g-cur').value } });
    toast('Сақланди', 'ok');
    await sync(true);
    renderApp();
  } catch (e) { toast(e.message, 'err'); }
  btn.disabled = false;
}

function editItem(kind, item) {
  const d = S.set.data;
  const brOpts = [['', 'Филиални танланг']].concat(d.branches.filter((b) => b.active || (item && b.name === item.branch)).map((b) => [b.name, b.name]));
  const T = {
    product: [item ? 'Маҳсулотни таҳрирлаш' : 'Янги маҳсулот', [
      { key: 'name', label: 'Номи', value: item && item.name, full: true, placeholder: 'Масалан: Asal (500gr)' },
      { key: 'price', label: `Нарх, ${cur()}`, type: 'money', value: item && Number(item.price) ? fmt(item.price) : '' },
      { key: 'min', label: 'Минимал қолдиқ', type: 'int', value: item ? String(item.min) : '3' },
      { key: 'unit', label: 'Бирлик', value: item ? item.unit : 'дона' },
      { key: 'note', label: 'Изоҳ', value: item && item.note },
      { key: 'active', label: 'Фаол — сотувда кўринади', type: 'check', value: item ? item.active : true, full: true },
    ]],
    branch: [item ? 'Филиални таҳрирлаш' : 'Янги филиал', [
      { key: 'name', label: 'Номи', value: item && item.name, full: true, placeholder: 'Масалан: Чилонзор филиали' },
      { key: 'addr', label: 'Манзил', value: item && item.addr },
      { key: 'phone', label: 'Телефон', value: item && item.phone },
      { key: 'active', label: 'Фаол', type: 'check', value: item ? item.active : true, full: true },
    ]],
    doctor: [item ? 'Врачни таҳрирлаш' : 'Янги врач', [
      { key: 'name', label: 'Исми', value: item && item.name, full: true, placeholder: 'Масалан: Др. Каримов' },
      { key: 'note', label: 'Изоҳ', value: item && item.note, full: true },
      { key: 'active', label: 'Фаол — рўйхатда кўринади', type: 'check', value: item ? item.active : true, full: true },
    ]],
    paytype: [item ? 'Тўлов турини таҳрирлаш' : 'Янги тўлов тури', [
      { key: 'name', label: 'Номи', value: item && item.name, full: true, placeholder: 'Масалан: Click, Payme, Терминал' },
      { key: 'kind', label: 'Қандай ишлайди', type: 'select', value: item ? item.kind : 'transfer', options: PAY_KINDS, full: true },
      { key: 'active', label: 'Фаол — сотувда кўринади', type: 'check', value: item ? item.active : true, full: true },
    ]],
    fincat: [item ? 'Тоифани таҳрирлаш' : 'Янги чиқим тоифаси', [
      { key: 'grp', label: 'Гуруҳ', type: 'select', value: item ? item.grp : 'exp', options: FIN_GRPS, full: true },
      { key: 'name', label: 'Номи', value: item && item.name, full: true, placeholder: 'Масалан: Реклама, Интернет' },
      { key: 'active', label: 'Фаол — рўйхатда кўринади', type: 'check', value: item ? item.active : true, full: true },
    ]],
    user: [item ? 'Фойдаланувчини таҳрирлаш' : 'Янги фойдаланувчи', [
      { key: 'name', label: 'Исми', value: item && item.name, full: true, placeholder: 'Масалан: Дилноза (1-филиал)' },
      { key: 'role', label: 'Роль', type: 'select', value: item ? item.role : 'seller', options: [['seller', 'Сотувчи'], ['admin', 'Админ']] },
      { key: 'branch', label: 'Филиал', type: 'select', value: item ? item.branch : '', options: brOpts },
      { key: 'phone', label: 'Телефон (чекда «Кассир тел.» бўлиб чиқади)', value: item && item.phone, placeholder: '+998 90 123 45 67', full: true },
      { key: 'pin', label: item ? 'Янги PIN' : 'PIN', type: 'pin', value: '', placeholder: item ? 'Ўзгартирмаслик учун бўш қолдиринг' : '4–12 та рақам', full: true },
      { key: 'active', label: 'Фаол — тизимга кира олади', type: 'check', value: item ? item.active : true, full: true },
    ]],
  }[kind];
  formModal({
    title: T[0], fields: T[1],
    onSubmit: async (v) => {
      if (kind === 'user' && v.role === 'admin') v.branch = '';
      S.set.data = await api('save', { kind, item: Object.assign({ id: item ? item.id : null }, v) });
      renderSetBody(); filterSettings();
      toast('Сақланди', 'ok');
      scheduleSync();
    },
  });
}

function fieldHTML(f) {
  const cls = `field ${f.full ? 'full' : ''}`;
  if (f.type === 'check') return `<label class="check ${f.full ? 'full' : ''}"><input type="checkbox" name="${f.key}" ${f.value ? 'checked' : ''}><span>${esc(f.label)}</span></label>`;
  if (f.type === 'select') return `<label class="${cls}" data-field="${f.key}"><span>${esc(f.label)}</span><select name="${f.key}">${f.options.map(([v, t]) => `<option value="${esc(v)}" ${v === f.value ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  if (f.type === 'date') return `<label class="${cls}" data-field="${f.key}"><span>${esc(f.label)}</span><input type="date" name="${f.key}" value="${esc(f.value || '')}"></label>`;
  const numeric = ['money', 'int', 'pin'].includes(f.type);
  return `<label class="${cls}" data-field="${f.key}"><span>${esc(f.label)}</span><input name="${f.key}" value="${esc(f.value == null ? '' : f.value)}" ${numeric ? 'inputmode="numeric"' : ''} ${f.type === 'pin' ? 'type="password" autocomplete="new-password"' : 'autocomplete="off"'} placeholder="${esc(f.placeholder || '')}" class="${f.type === 'money' ? 'money' : ''}"></label>`;
}

function formModal({ title, fields, onSubmit, ok = 'Сақлаш' }) {
  const root = $('#modal-root');
  const prev = document.activeElement;
  root.innerHTML = `<div class="ov"><form class="mdl wide" id="fm" role="dialog" aria-modal="true" aria-labelledby="fm-t" novalidate>
    <h3 id="fm-t">${esc(title)}</h3>
    <div class="fm-grid">${fields.map(fieldHTML).join('')}</div>
    <div class="err" id="fm-err" role="alert"></div>
    <div class="mdl-f"><button type="button" class="btn soft" id="fm-no">Ортга</button><button class="btn primary" type="submit" id="fm-ok">${ic('check')}${esc(ok)}</button></div>
  </form></div>`;
  const form = $('#fm');
  const close = () => {
    document.removeEventListener('keydown', key);
    const ov = $('.ov'); if (ov) ov.classList.add('out');
    setTimeout(() => { root.innerHTML = ''; if (prev && prev.focus) prev.focus(); }, 140);
  };
  const key = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  $('#fm-no').onclick = close;
  $('.ov').onclick = (e) => { if (e.target.classList.contains('ov')) close(); };
  const roleSel = form.querySelector('select[name="role"]');
  const syncRole = () => { const br = form.querySelector('[data-field="branch"]'); if (br) br.classList.toggle('hidden', roleSel.value === 'admin'); };
  if (roleSel) { roleSel.onchange = syncRole; syncRole(); }
  form.querySelectorAll('input.money').forEach((i) => i.addEventListener('blur', () => { if (i.value) i.value = fmt(num(i.value)); }));
  form.onsubmit = async (e) => {
    e.preventDefault();
    const v = {};
    fields.forEach((f) => {
      const el = form.elements[f.key];
      if (f.type === 'check') v[f.key] = el.checked;
      else if (f.type === 'money' || f.type === 'int') v[f.key] = String(num(el.value));
      else v[f.key] = el.value.trim();
    });
    const btn = $('#fm-ok');
    btn.disabled = true; $('#fm-err').textContent = '';
    try { await onSubmit(v); close(); } catch (err) { $('#fm-err').textContent = err.message; btn.disabled = false; }
  };
  const first = form.querySelector('input, select');
  if (first) first.focus();
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
  view.addEventListener('change', (e) => {
    if (e.target.dataset && e.target.dataset.priceId) return savePrice(e.target);
    if (e.target.tagName === 'SELECT' && e.target.id !== 'branch-sel') onViewInput(e);
  });
  view.addEventListener('focusout', onViewBlur);
  view.addEventListener('keydown', onViewKey);
  view.addEventListener('mousedown', (e) => {
    const o = e.target.closest('[data-ac]');
    if (o) { e.preventDefault(); acPick(Number(o.dataset.ac)); }
  });
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

  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - S.lastSync > 5000) sync();
  });
  window.addEventListener('online', () => sync());
}

start();
