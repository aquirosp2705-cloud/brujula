// Estado de la app y su guardado en el propio equipo (IndexedDB; si no se puede, localStorage).
// Los datos nunca salen del dispositivo salvo que la persona descargue o comparta una copia.

import { defaultCategories } from './config.js';
import { todayISO, ymOf, isISO } from './format.js';

const DB_NAME = 'brujula', OS = 'kv', KEY = 'state', KEY_PREV = 'state_prev';
export const SCHEMA = 1;

let S = null;
let idb = null;
let useLS = false;
let timer = null;
let saving = Promise.resolve();
let lastError = null;
const subs = new Set();
const TAB = Math.random().toString(36).slice(2);
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('brujula') : null;

export function uid(p = 'x') { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function emptyState() {
  const now = new Date().toISOString();
  return {
    schema: SCHEMA, createdAt: now, updatedAt: now,
    settings: {
      name: '', currency: 'USD', style: 'en', cents: true, theme: 'auto', expectedIncome: 0,
      onboarded: false, demo: false, lastBackup: null, startMonth: ymOf(todayISO()), hide: false,
    },
    accounts: [], cards: [], investments: [], debts: [], assets: [], goals: [], notes: [], recurring: [],
    categories: defaultCategories(),
    movements: [],
    months: {},
    ui: { last: {}, dismiss: {} },
  };
}

// ---------- Limpieza de datos (al cargar y al restaurar copias): tipos correctos y sin basura ----------

const str = (v, max = 400) => (v == null ? '' : String(v)).slice(0, max);
const numv = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const bool = (v) => v === true;
const date = (v, def = '') => (isISO(v) ? v : def);
const color = (v, def = '#6366F1') => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : def);
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const ref = (r) => (r && typeof r === 'object' && ['acc', 'card', 'inv', 'debt'].includes(r.k) && r.id ? { k: r.k, id: str(r.id, 60) } : null);
const arr = (v) => (Array.isArray(v) ? v : []);
const idOk = (v) => typeof v === 'string' && v.length > 0 && v.length < 80;

export function sanitize(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw.settings || {};
  const out = {
    schema: SCHEMA,
    createdAt: str(raw.createdAt || base.createdAt, 40),
    updatedAt: str(raw.updatedAt || base.updatedAt, 40),
    settings: {
      name: str(s.name, 60),
      currency: str(s.currency || 'USD', 6),
      style: oneOf(s.style, ['en', 'es'], 'en'),
      cents: s.cents !== false,
      theme: oneOf(s.theme, ['auto', 'light', 'dark'], 'auto'),
      expectedIncome: Math.max(0, numv(s.expectedIncome)),
      onboarded: bool(s.onboarded),
      demo: bool(s.demo),
      lastBackup: s.lastBackup ? str(s.lastBackup, 40) : null,
      startMonth: /^\d{4}-\d{2}$/.test(s.startMonth || '') ? s.startMonth : base.settings.startMonth,
      hide: bool(s.hide),
    },
    accounts: arr(raw.accounts).filter((a) => a && idOk(a.id)).map((a) => ({
      id: a.id, name: str(a.name, 60) || 'Cuenta', type: oneOf(a.type, ['ahorros', 'corriente', 'efectivo', 'digital', 'otra'], 'ahorros'),
      last4: str(a.last4, 4).replace(/\D/g, ''), color: color(a.color), initial: numv(a.initial), since: date(a.since, todayISO()),
      archived: bool(a.archived), createdAt: str(a.createdAt, 40),
    })),
    cards: arr(raw.cards).filter((c) => c && idOk(c.id)).map((c) => ({
      id: c.id, name: str(c.name, 60) || 'Tarjeta', network: str(c.network, 30), last4: str(c.last4, 4).replace(/\D/g, ''),
      limit: Math.max(0, numv(c.limit)), initial: numv(c.initial), cutDay: Math.min(31, Math.max(0, numv(c.cutDay) | 0)),
      payDay: Math.min(31, Math.max(0, numv(c.payDay) | 0)), color: color(c.color, '#4F46E5'), since: date(c.since, todayISO()),
      archived: bool(c.archived), createdAt: str(c.createdAt, 40),
    })),
    investments: arr(raw.investments).filter((i) => i && idOk(i.id)).map((i) => ({
      id: i.id, name: str(i.name, 60) || 'Inversión', type: oneOf(i.type, ['plazo', 'ahorro', 'fondo', 'acciones', 'cripto', 'inmueble', 'otro'], 'otro'),
      institution: str(i.institution, 60), capital: Math.max(0, numv(i.capital)), rate: numv(i.rate), tax: Math.max(0, numv(i.tax)),
      start: date(i.start, todayISO()), end: date(i.end), opened: date(i.opened), acc: str(i.acc, 60), status: oneOf(i.status, ['activa', 'cobrada'], 'activa'),
      color: color(i.color, '#10B981'), notes: str(i.notes, 2000), createdAt: str(i.createdAt, 40),
    })),
    debts: arr(raw.debts).filter((d) => d && idOk(d.id)).map((d) => ({
      id: d.id, name: str(d.name, 60) || 'Deuda', type: oneOf(d.type, ['consumo', 'hipoteca', 'vehiculo', 'estudios', 'comercial', 'personal', 'otro'], 'otro'),
      direction: oneOf(d.direction, ['debo', 'me_deben'], 'debo'), who: str(d.who, 60), original: Math.max(0, numv(d.original)),
      initial: numv(d.initial), rate: Math.max(0, numv(d.rate)), payment: Math.max(0, numv(d.payment)),
      payDay: Math.min(31, Math.max(0, numv(d.payDay) | 0)), start: date(d.start, todayISO()), acc: str(d.acc, 60),
      notes: str(d.notes, 2000), color: color(d.color, '#F59E0B'), closed: bool(d.closed), createdAt: str(d.createdAt, 40),
    })),
    assets: arr(raw.assets).filter((a) => a && idOk(a.id)).map((a) => ({
      id: a.id, name: str(a.name, 60) || 'Bien', type: oneOf(a.type, ['inmueble', 'terreno', 'vehiculo', 'negocio', 'otro'], 'otro'),
      value: Math.max(0, numv(a.value)), notes: str(a.notes, 2000), updatedAt: str(a.updatedAt, 40),
    })),
    goals: arr(raw.goals).filter((g) => g && idOk(g.id)).map((g) => ({
      id: g.id, name: str(g.name, 60) || 'Meta', icon: str(g.icon, 8) || '⭐', color: color(g.color, '#8B5CF6'),
      target: Math.max(0, numv(g.target)), deadline: date(g.deadline),
      log: arr(g.log).filter((x) => x && isISO(x.date)).map((x) => ({ date: x.date, amount: numv(x.amount) })).slice(0, 2000),
      createdAt: str(g.createdAt, 40),
    })),
    notes: arr(raw.notes).filter((n) => n && idOk(n.id)).map((n) => ({
      id: n.id, title: str(n.title, 120), body: str(n.body, 20000), color: color(n.color, '#FEF3C7'), pinned: bool(n.pinned),
      createdAt: str(n.createdAt, 40), updatedAt: str(n.updatedAt, 40),
    })),
    recurring: arr(raw.recurring).filter((r) => r && idOk(r.id)).map((r) => ({
      id: r.id, type: oneOf(r.type, ['expense', 'income'], 'expense'), name: str(r.name, 60) || 'Pago fijo',
      amount: Math.max(0, numv(r.amount)), cat: str(r.cat, 60), ref: ref(r.ref), day: Math.min(31, Math.max(1, numv(r.day) | 0 || 1)),
      active: r.active !== false,
    })),
    categories: [],
    movements: arr(raw.movements).filter((m) => m && idOk(m.id) && isISO(m.date) && ['expense', 'income', 'transfer', 'adjust'].includes(m.type)).map((m) => {
      const o = { id: m.id, type: m.type, date: m.date, amount: numv(m.amount), note: str(m.note, 200), createdAt: str(m.createdAt, 40) };
      if (m.type !== 'adjust') o.amount = Math.abs(o.amount);
      if (m.cat) o.cat = str(m.cat, 60);
      const sr = ref(m.src), dr = ref(m.dst);
      if (sr) o.src = sr;
      if (dr) o.dst = dr;
      if (m.interest) o.interest = Math.max(0, numv(m.interest));
      if (m.rec) o.rec = str(m.rec, 60);
      return o;
    }),
    months: {},
    ui: { last: {}, dismiss: {} },
  };
  // Categorías: las guardadas, o las de fábrica si no hay ninguna.
  const cats = arr(raw.categories).filter((c) => c && idOk(c.id)).map((c) => ({
    id: c.id, type: oneOf(c.type, ['expense', 'income'], 'expense'), name: str(c.name, 50) || 'Categoría', icon: str(c.icon, 8) || '•',
    color: color(c.color, '#64748B'), group: c.type === 'income' ? null : oneOf(c.group, ['nec', 'gus', 'deu'], 'gus'),
    budget: Math.max(0, numv(c.budget)), archived: bool(c.archived),
  }));
  out.categories = cats.length ? cats : base.categories;
  // Meses cerrados
  if (raw.months && typeof raw.months === 'object') {
    for (const [ym, m] of Object.entries(raw.months)) {
      if (!/^\d{4}-\d{2}$/.test(ym) || !m || typeof m !== 'object') continue;
      out.months[ym] = { closed: bool(m.closed), closedAt: str(m.closedAt, 40), note: str(m.note, 1000), snap: m.snap && typeof m.snap === 'object' ? m.snap : null };
    }
  }
  if (raw.ui && typeof raw.ui === 'object') {
    out.ui.last = raw.ui.last && typeof raw.ui.last === 'object' ? raw.ui.last : {};
    out.ui.dismiss = raw.ui.dismiss && typeof raw.ui.dismiss === 'object' ? raw.ui.dismiss : {};
  }
  return out;
}

// ---------- IndexedDB ----------

function openDB() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('sin IndexedDB'));
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(OS);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('IndexedDB bloqueada'));
  });
}
function idbGet(k) {
  return new Promise((res, rej) => {
    const q = idb.transaction(OS, 'readonly').objectStore(OS).get(k);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
function idbSet(k, v) {
  return new Promise((res, rej) => {
    const tx = idb.transaction(OS, 'readwrite');
    tx.objectStore(OS).put(v, k);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error || new Error('abortado'));
  });
}
function idbDel(k) {
  return new Promise((res) => {
    const tx = idb.transaction(OS, 'readwrite');
    tx.objectStore(OS).delete(k);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

async function readRaw(key) {
  if (!useLS && idb) { try { return await idbGet(key); } catch (e) { /* cae a localStorage */ } }
  try { return localStorage.getItem('brujula:' + key); } catch (e) { return null; }
}

function parse(raw) {
  if (!raw) return null;
  try { const v = typeof raw === 'string' ? JSON.parse(raw) : raw; return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
}

export async function load() {
  try { idb = await openDB(); } catch (e) { useLS = true; }
  let st = parse(await readRaw(KEY));
  if (!st) st = parse(await readRaw(KEY_PREV));
  S = sanitize(st || emptyState());
  return S;
}

async function persistNow() {
  const json = JSON.stringify(S);
  try {
    if (!useLS && idb) {
      try {
        const prev = await idbGet(KEY);
        if (prev) await idbSet(KEY_PREV, prev);
        await idbSet(KEY, json);
      } catch (e) {
        useLS = true;
      }
    }
    if (useLS) {
      const prev = localStorage.getItem('brujula:' + KEY);
      if (prev) localStorage.setItem('brujula:' + KEY_PREV, prev);
      localStorage.setItem('brujula:' + KEY, json);
    }
    lastError = null;
    if (bc) bc.postMessage({ t: 'saved', tab: TAB });
  } catch (e) {
    lastError = e;
    emit('saveerror');
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => { timer = null; saving = saving.then(persistNow); }, 250);
}

/** Guarda ya (al cerrar o esconder la app). */
export function flush() {
  if (timer) { clearTimeout(timer); timer = null; saving = saving.then(persistNow); }
  return saving;
}

export const saveError = () => lastError;
export const getState = () => S;

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit(kind = 'change') { for (const fn of subs) { try { fn(kind); } catch (e) { console.error(e); } } }

/**
 * Aplica un cambio al estado, lo guarda y avisa a la pantalla.
 * Con { undo: true } devuelve una función que deshace el cambio (para el aviso «Deshacer»).
 */
export function commit(fn, { undo = false } = {}) {
  const before = undo ? JSON.stringify(S) : null;
  fn(S);
  S.updatedAt = new Date().toISOString();
  schedule();
  emit();
  if (!before) return null;
  return () => { S = sanitize(JSON.parse(before)); schedule(); emit(); };
}

/** Reemplaza todo el estado (restaurar copia, datos de ejemplo). */
export async function replaceState(next) {
  S = sanitize(next);
  S.updatedAt = new Date().toISOString();
  clearTimeout(timer); timer = null;
  saving = saving.then(persistNow);
  await saving;
  emit('replace');
  return S;
}

/** Borra todo lo guardado en este equipo y deja la app como recién instalada. */
export async function wipe() {
  clearTimeout(timer); timer = null;
  await saving;
  try { if (idb) { await idbDel(KEY); await idbDel(KEY_PREV); } } catch (e) { /* nada */ }
  try { localStorage.removeItem('brujula:' + KEY); localStorage.removeItem('brujula:' + KEY_PREV); } catch (e) { /* nada */ }
  S = emptyState();
  if (bc) bc.postMessage({ t: 'saved', tab: TAB });
  emit('replace');
  return S;
}

/** Pide al navegador que no borre los datos por falta de espacio. */
export async function askPersist() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { /* nada */ }
  return false;
}

// Si la app está abierta en otra pestaña o ventana y guarda, aquí se recarga lo guardado.
if (bc) {
  bc.onmessage = async (e) => {
    if (!e.data || e.data.t !== 'saved' || e.data.tab === TAB) return;
    const st = parse(await readRaw(KEY));
    S = sanitize(st || emptyState());
    emit('external');
  };
}
