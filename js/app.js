// Arranque de la app: estructura de la pantalla, rutas (#/…), menú, acciones globales, tema y modo sin conexión.

import { load, getState, subscribe, commit, flush, askPersist, wipe } from './store.js';
import { setFormat, todayISO } from './format.js';
import { balances } from './calc.js';
import { html, raw, ic, go, toast, confirmBox, sheet, dropAllSheets, sheetsOpen } from './ui.js';
import { CURRENCIES, APP_NAME, VERSION } from './config.js';
import { icon } from './icons.js';
import { openMoveForm, openAdjust } from './moveform.js';
import {
  openAccountForm, openCardForm, openInvestmentForm, openInvestmentActions, openDebtForm, openDebtActions,
  openAssetForm, openGoalForm, openGoalMove, openRecurringForm, openBudgetEditor, toggleArchive, registerRecurring,
} from './entityforms.js';
import { downloadBackup } from './backup.js';
import { isStandalone, openInstallHelp } from './install.js';
import * as inicio from './views/inicio.js';
import * as mes from './views/mes.js';
import * as cuentas from './views/cuentas.js';
import * as inversiones from './views/inversiones.js';
import * as deudas from './views/deudas.js';
import * as patrimonio from './views/patrimonio.js';
import * as metas from './views/metas.js';
import * as apuntes from './views/apuntes.js';
import * as historial from './views/historial.js';
import * as ajustes from './views/ajustes.js';
import * as bienvenida from './views/bienvenida.js';

const VIEWS = { inicio, mes, anio: mes, bancos: cuentas, tarjetas: cuentas, inversiones, deudas, patrimonio, metas, apuntes, historial, ajustes, bienvenida };

const NAV = [
  ['Resumen', [['inicio', 'Inicio', 'home'], ['mes', 'Ingresos y gastos', 'list']]],
  ['Mi dinero', [['bancos', 'Bancos', 'bank'], ['tarjetas', 'Tarjetas', 'card'], ['inversiones', 'Inversiones', 'trend'], ['deudas', 'Deudas', 'debt'], ['patrimonio', 'Patrimonio', 'compass']]],
  ['Planear', [['metas', 'Metas de ahorro', 'target'], ['historial', 'Cierres e historial', 'history'], ['apuntes', 'Apuntes', 'note']]],
];

let route = { name: 'inicio', parts: [], query: new URLSearchParams() };
let main = null;
let lastKey = '';
let firstRender = true;
let queued = false;
let ctx = null;

function parseRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  const [path, q] = h.split('?');
  const parts = path.split('/').filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
  return { name: parts[0] || 'inicio', parts, query: new URLSearchParams(q || '') };
}

// ---------- Estructura ----------

function buildShell() {
  const app = document.getElementById('app');
  app.innerHTML = html`
    <aside class="side" aria-label="Menú principal">
      <a class="brand" href="#/inicio"><span class="logo">${raw(icon('logo', 26))}</span><b>${APP_NAME}</b></a>
      <button type="button" class="btn primary block side-add" data-act="move">${ic('plus', 20)} Anotar movimiento</button>
      <nav class="side-nav">${NAV.map(([g, items]) => html`<p class="side-g">${g}</p>${items.map(([id, l, ico]) => html`<a href="#/${id}" data-nav="${id}">${ic(ico, 20)}<span>${l}</span></a>`)}`)}</nav>
      <div class="side-foot">
        <a href="#/ajustes" data-nav="ajustes">${ic('settings', 20)}<span>Ajustes</span></a>
        <button type="button" data-act="toggle-hide" class="side-btn">${ic('eye', 20)}<span>Ocultar montos</span></button>
      </div>
    </aside>
    <main id="view" class="view" tabindex="-1"></main>
    <nav class="tabbar" aria-label="Navegación">
      <a href="#/inicio" data-tab="inicio">${ic('home', 22)}<span>Inicio</span></a>
      <a href="#/mes" data-tab="mes">${ic('list', 22)}<span>Mes</span></a>
      <button type="button" class="fab" data-act="move" aria-label="Anotar movimiento">${ic('plus', 28)}</button>
      <a href="#/bancos" data-tab="cuentas">${ic('bank', 22)}<span>Cuentas</span></a>
      <button type="button" data-act="more" data-tab="mas">${ic('grid', 22)}<span>Más</span></button>
    </nav>`.s;
  main = document.getElementById('view');
}

function tabOf(name) {
  if (name === 'inicio') return 'inicio';
  if (name === 'mes' || name === 'anio') return 'mes';
  if (name === 'bancos' || name === 'tarjetas') return 'cuentas';
  return 'mas';
}

function applySettings(S) {
  const st = S.settings;
  const c = CURRENCIES.find((x) => x[0] === st.currency) || CURRENCIES[0];
  setFormat({ cur: c[0], sym: c[2], style: st.style, cents: st.cents, hide: st.hide });
  const root = document.documentElement;
  if (st.theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = st.theme;
  const dark = st.theme === 'dark' || (st.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.setAttribute('content', dark ? '#0B1020' : '#F3F5FB'); m.removeAttribute('media'); });
  const hb = document.querySelector('.side-btn[data-act="toggle-hide"]');
  if (hb) hb.innerHTML = icon(st.hide ? 'eyeoff' : 'eye', 20) + `<span>${st.hide ? 'Mostrar montos' : 'Ocultar montos'}</span>`;
}

// ---------- Pintar la pantalla ----------

function render() {
  queued = false;
  const S = getState();
  applySettings(S);
  if (!S.settings.onboarded && route.name !== 'bienvenida') { location.replace('#/bienvenida'); return; }
  if (S.settings.onboarded && route.name === 'bienvenida') { location.replace('#/inicio'); return; }
  const view = VIEWS[route.name] || inicio;
  const today = todayISO();
  ctx = { S, today, bal: balances(S), route, first: firstRender, standalone: isStandalone(), view };
  const key = location.hash;
  const same = key === lastKey;
  const y = window.scrollY;
  document.body.classList.toggle('is-ob', route.name === 'bienvenida');
  try {
    main.innerHTML = view.render(ctx).s;
    if (view.mount) view.mount(main, ctx);
  } catch (err) {
    console.error(err);
    main.innerHTML = html`<div class="fatal"><h2>Algo salió mal al mostrar esta pantalla</h2><p>${String(err && err.message || err)}</p><a class="btn primary" href="#/inicio">Volver al inicio</a></div>`.s;
  }
  const tab = tabOf(route.name);
  document.querySelectorAll('[data-nav]').forEach((a) => { const on = a.dataset.nav === route.name || (a.dataset.nav === 'mes' && route.name === 'anio'); a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  document.title = (view.title && route.name !== 'inicio' ? view.title + ' · ' : '') + APP_NAME;
  if (same) window.scrollTo(0, y);
  else { window.scrollTo(0, 0); if (!firstRender) try { main.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
  lastKey = key;
  firstRender = false;
}

function rerender() { if (queued) return; queued = true; requestAnimationFrame(render); }

// ---------- Acciones globales (data-act) ----------

const S_ = () => getState();
const find = (list, id) => list.find((x) => x.id === id);

function openMore() {
  const items = [['tarjetas', 'Tarjetas', 'card'], ['inversiones', 'Inversiones', 'trend'], ['deudas', 'Deudas', 'debt'], ['patrimonio', 'Patrimonio', 'compass'], ['metas', 'Metas', 'target'], ['historial', 'Cierres', 'history'], ['apuntes', 'Apuntes', 'note'], ['ajustes', 'Ajustes', 'settings']];
  sheet({
    title: 'Más opciones', size: 'sm', cls: 'more-sheet',
    body: html`<div class="more-grid">${items.map(([id, l, ico]) => html`<button type="button" class="more-tile ${route.name === id ? 'on' : ''}" data-act="go" data-to="#/${id}"><i>${ic(ico, 24)}</i><span>${l}</span></button>`)}</div>
      <div class="more-row"><button type="button" class="btn ghost block" data-act="toggle-hide">${ic(S_().settings.hide ? 'eyeoff' : 'eye', 18)} ${S_().settings.hide ? 'Mostrar montos' : 'Ocultar montos'}</button>
      ${isStandalone() ? '' : html`<button type="button" class="btn ghost block" data-act="install">${ic('phone', 18)} Instalar la app</button>`}</div>`,
  });
}

const GLOBAL = {
  move: (b) => openMoveForm({ type: b.dataset.type || 'expense' }),
  'edit-move': (b) => { const m = find(S_().movements, b.dataset.id); if (m) openMoveForm({ move: m }); },
  virtual: (b) => {
    const S = S_();
    if (b.dataset.k === 'inv') { const i = find(S.investments, b.dataset.id); if (i) openInvestmentForm(i); }
    else { const d = find(S.debts, b.dataset.id); if (d) openDebtForm(d); }
    toast('Este movimiento se creó solo al registrar la inversión o el préstamo. Para cambiarlo, edita ese registro.', { timeout: 6000 });
  },
  go: (b) => go(b.dataset.to),
  more: () => openMore(),
  'add-acc': () => openAccountForm(),
  'add-card': () => openCardForm(),
  'add-inv': () => openInvestmentForm(),
  'add-debt': (b) => openDebtForm(null, { direction: b.dataset.dir || 'debo' }),
  'add-asset': () => openAssetForm(),
  'add-goal': () => openGoalForm(),
  'add-note': () => apuntes.openNoteEditor(),
  'add-rec': () => openRecurringForm(),
  budget: () => openBudgetEditor(),
  note: (b) => apuntes.openNoteEditor(b.dataset.id),
  inv: (b) => { const i = find(S_().investments, b.dataset.id); if (i) openInvestmentActions(i); },
  debt: (b) => { const d = find(S_().debts, b.dataset.id); if (d) openDebtActions(d); },
  asset: (b) => { const a = find(S_().assets, b.dataset.id); if (a) openAssetForm(a); },
  'goal-add': (b) => { const g = find(S_().goals, b.dataset.id); if (g) openGoalMove(g, 1); },
  'goal-sub': (b) => { const g = find(S_().goals, b.dataset.id); if (g) openGoalMove(g, -1); },
  'goal-edit': (b) => { const g = find(S_().goals, b.dataset.id); if (g) openGoalForm(g); },
  'ent-move': (b) => openMoveForm({ type: b.dataset.type, preset: { [b.dataset.role]: { k: b.dataset.k, id: b.dataset.id } } }),
  'ent-adjust': (b) => openAdjust({ k: b.dataset.k, id: b.dataset.id }),
  'ent-edit': (b) => {
    const S = S_(), k = b.dataset.k, id = b.dataset.id;
    if (k === 'acc') { const a = find(S.accounts, id); if (a) openAccountForm(a); }
    else if (k === 'card') { const c = find(S.cards, id); if (c) openCardForm(c); }
  },
  'ent-archive': (b) => {
    const S = S_(), k = b.dataset.k, e = find(k === 'acc' ? S.accounts : S.cards, b.dataset.id);
    if (e) { toggleArchive(k, e); if (!e.archived && route.parts[1]) go(k === 'acc' ? '#/bancos' : '#/tarjetas'); }
  },
  'rec-do': (b) => { const r = find(S_().recurring, b.dataset.id); if (r) registerRecurring(r, b.dataset.ym); },
  up: (b) => {
    const S = S_(), k = b.dataset.kind, id = b.dataset.id;
    if (k === 'card') openMoveForm({ type: 'pay', preset: { dst: { k: 'card', id } } });
    else if (k === 'debt') openMoveForm({ type: 'pay', preset: { dst: { k: 'debt', id } } });
    else if (k === 'cobro') { const d = find(S.debts, id); if (d) openDebtActions(d); }
    else if (k === 'inv') { const i = find(S.investments, id); if (i) openInvestmentActions(i); }
    else if (k === 'rec') { const r = find(S.recurring, id); if (r) registerRecurring(r, b.dataset.ym); }
  },
  'toggle-hide': () => { commit((s) => { s.settings.hide = !s.settings.hide; }); },
  dismiss: (b) => { const k = b.dataset.k; commit((s) => { s.ui.dismiss[k] = true; }); },
  install: () => openInstallHelp(),
  backup: () => downloadBackup(),
  'close-month': (b) => historial.openCloseWizard(b.dataset.ym),
  'reopen-month': (b) => historial.reopenMonth(b.dataset.ym),
  'demo-exit': async () => {
    const ok = await confirmBox({ title: 'Empezar con tus datos', text: 'Se borrarán los datos de ejemplo y empezarás desde cero.', ok: 'Empezar' });
    if (!ok) return;
    await wipe();
    go('#/bienvenida');
  },
};

function onClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const act = t.dataset.act;
  const v = ctx && ctx.view;
  if (v && v.actions && v.actions[act] && main.contains(t)) { e.preventDefault(); v.actions[act](t, ctx, main, rerender); return; }
  if (v && v.actions && v.actions[act] && !GLOBAL[act]) { e.preventDefault(); v.actions[act](t, ctx, main, rerender); return; }
  const g = GLOBAL[act];
  if (g) { e.preventDefault(); g(t); }
}

// ---------- Arranque ----------

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const ask = (w) => toast('Hay una versión nueva de ' + APP_NAME, { action: { label: 'Actualizar', fn: () => w.postMessage({ t: 'skip' }) }, timeout: 30000 });
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded) return; reloaded = true; flush().then(() => location.reload()); });
}

async function boot() {
  await load();
  buildShell();
  route = parseRoute();
  render();
  subscribe((kind) => { if (kind === 'saveerror') { toast('No se pudo guardar en este equipo. Revisa el espacio disponible o descarga una copia.', { kind: 'err', timeout: 8000 }); return; } rerender(); });
  window.addEventListener('hashchange', () => { if (sheetsOpen()) dropAllSheets(); route = parseRoute(); render(); });
  document.addEventListener('click', onClick);
  document.addEventListener('input', (e) => { const v = ctx && ctx.view; if (v && v.onInput && main.contains(e.target)) v.onInput(e, ctx, main); });
  document.addEventListener('change', (e) => { const v = ctx && ctx.view; if (v && v.onChange && main.contains(e.target)) v.onChange(e, ctx, main); });
  document.addEventListener('keydown', (e) => {
    if (sheetsOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    if ((e.key === 'n' || e.key === '+') && getState().settings.onboarded) { e.preventDefault(); openMoveForm(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); else rerender(); });
  window.addEventListener('pagehide', () => { flush(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applySettings(getState()));
  let day = todayISO();
  setInterval(() => { const d = todayISO(); if (d !== day) { day = d; rerender(); } }, 60000);
  document.documentElement.classList.add('ready');
  const splash = document.getElementById('splash');
  if (splash) { splash.classList.add('hide'); setTimeout(() => splash.remove(), 400); }
  registerSW();
  if (getState().settings.onboarded) askPersist();
  // Atajo del ícono instalado («Anotar un gasto»): #/inicio?nuevo=gasto
  if (route.query.get('nuevo') && getState().settings.onboarded) {
    const t = { gasto: 'expense', ingreso: 'income', pago: 'pay', transferencia: 'transfer' }[route.query.get('nuevo')] || 'expense';
    try { history.replaceState(null, '', '#/inicio'); } catch (e) { /* nada */ }
    route = parseRoute();
    openMoveForm({ type: t });
  }
}

boot().catch((err) => {
  console.error(err);
  const app = document.getElementById('app');
  if (app) app.innerHTML = `<div class="fatal"><h2>No se pudo abrir ${APP_NAME}</h2><p>${String(err && err.message || err).replace(/[<>&]/g, '')}</p><button class="btn primary" onclick="location.reload()">Reintentar</button></div>`;
  const splash = document.getElementById('splash');
  if (splash) splash.remove();
});

export { VERSION };
