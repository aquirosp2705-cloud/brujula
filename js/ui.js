// Piezas de interfaz: plantillas HTML seguras, ventanas (hojas), avisos y confirmaciones.

import { icon } from './icons.js';
import { money } from './format.js';

// ---------- Plantillas: todo lo que se interpola se escapa, salvo lo marcado con raw() ----------

export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

function part(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(String(v));
}

export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Raw(out);
}

export const ic = (name, size, cls) => raw(icon(name, size, cls));

/** Monto con color: verde si es positivo (o ingreso), rojo si es negativo (o gasto). */
export function amt(n, { sign = false, cls = '', color = true, short = false, cents } = {}) {
  const c = !color ? '' : n > 0.004 ? 'pos' : n < -0.004 ? 'neg' : 'zero';
  const o = { sign, short };
  if (cents != null) o.cents = cents;
  return html`<span class="amt ${c} ${cls}">${money(n, o)}</span>`;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function debounce(fn, ms = 300) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
}

export function bar(pct, color = 'var(--brand)', cls = '') {
  const w = Math.max(0, Math.min(100, (pct || 0) * 100));
  return html`<div class="bar ${cls}"><i style="width:${w.toFixed(1)}%;background:${raw(color)}"></i></div>`;
}

export function empty({ icon: ico = 'sparkle', title, text = '', action = null }) {
  return html`<div class="empty">
    <div class="empty-ic">${ic(ico, 28)}</div>
    <h3>${title}</h3>
    ${text ? html`<p>${text}</p>` : ''}
    ${action ? html`<button class="btn primary" data-act="${action.act}" ${action.data ? raw(action.data) : ''}>${ic('plus', 18)} ${action.label}</button>` : ''}
  </div>`;
}

// ---------- Hojas (ventanas): abajo en el celular, al centro en la computadora ----------
// Se integran con el botón «atrás» de Android: atrás cierra la hoja en vez de salir de la app.

const stack = [];
let sentinel = false;       // hay una entrada nuestra en el historial
let expectPop = false;      // estamos esperando el popstate de nuestro propio history.back()
let pendingHash = null;

function lockScroll(on) { document.documentElement.classList.toggle('no-scroll', on); }

export function sheet({ title, body = '', size = 'md', cls = '', onClose = null, onMount = null, label = null }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop" data-close></div>
    <section class="sheet ${size} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label || title || 'Ventana')}">
      <header class="sheet-head"><span class="sheet-grab" aria-hidden="true"></span><h2>${esc(title || '')}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('x', 20)}</button></header>
      <div class="sheet-body">${part(body)}</div>
    </section>`;
  document.body.appendChild(wrap);
  const prevFocus = document.activeElement;
  const ctl = {
    root: wrap, el: wrap.querySelector('.sheet-body'), panel: wrap.querySelector('.sheet'),
    close: () => closeSheet(ctl), setTitle: (t) => { wrap.querySelector('.sheet-head h2').textContent = t; },
    onClose, prevFocus, closed: false,
  };
  stack.push(ctl);
  lockScroll(true);
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) { e.preventDefault(); closeSheet(ctl); } });
  wrap.addEventListener('keydown', (e) => trapKeys(e, ctl));
  requestAnimationFrame(() => {
    wrap.classList.add('open');
    if (ctl.panel.contains(document.activeElement)) return;
    const f = ctl.el.querySelector('[autofocus]') || ctl.el.querySelector('input,select,textarea,button') || ctl.panel;
    if (f && !matchMedia('(pointer: coarse)').matches) try { f.focus({ preventScroll: true }); } catch (e) { /* nada */ }
    else try { ctl.panel.focus({ preventScroll: true }); } catch (e) { /* nada */ }
  });
  ctl.panel.tabIndex = -1;
  if (!sentinel && !expectPop) { try { history.pushState({ brSheet: 1 }, ''); sentinel = true; } catch (e) { /* nada */ } }
  if (onMount) onMount(ctl.el, ctl);
  return ctl;
}

// Escape cierra la hoja de arriba aunque el foco se haya perdido (por ejemplo, tras redibujar su contenido).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !stack.length || e.defaultPrevented) return;
  e.preventDefault();
  closeSheet(stack[stack.length - 1]);
});

/** Devuelve el foco a la hoja si se perdió al redibujar su contenido. */
export function keepFocus(ctl) {
  if (ctl && !ctl.closed && !ctl.panel.contains(document.activeElement)) try { ctl.panel.focus({ preventScroll: true }); } catch (e) { /* nada */ }
}

function trapKeys(e, ctl) {
  if (stack[stack.length - 1] !== ctl) return;
  if (e.key !== 'Tab') return;
  const f = Array.from(ctl.panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')).filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function removeSheet(ctl) {
  if (ctl.closed) return;
  ctl.closed = true;
  const i = stack.indexOf(ctl);
  if (i >= 0) stack.splice(i, 1);
  ctl.root.classList.remove('open');
  ctl.root.classList.add('closing');
  setTimeout(() => ctl.root.remove(), 230);
  if (!stack.length) lockScroll(false);
  try { if (ctl.onClose) ctl.onClose(); } catch (e) { console.error(e); }
  const pf = ctl.prevFocus;
  if (pf && pf.isConnected && typeof pf.focus === 'function') try { pf.focus({ preventScroll: true }); } catch (e) { /* nada */ }
}

export function closeSheet(ctl) {
  if (!ctl || ctl.closed) return;
  removeSheet(ctl);
  if (!stack.length && sentinel && !expectPop) { expectPop = true; history.back(); }
}

export function closeAllSheets() { while (stack.length) removeSheet(stack[stack.length - 1]); if (sentinel && !expectPop) { expectPop = true; history.back(); } }
/** Quita las hojas sin tocar el historial (cuando la ruta ya cambió por otro lado). */
export function dropAllSheets() { while (stack.length) removeSheet(stack[stack.length - 1]); sentinel = false; }
export const sheetsOpen = () => stack.length;

/** Navega a una ruta cerrando antes las hojas abiertas (sin dejar entradas sueltas en el historial). */
export function go(hash) {
  if (stack.length || expectPop || sentinel) {
    pendingHash = hash;
    while (stack.length) removeSheet(stack[stack.length - 1]);
    if (sentinel && !expectPop) { expectPop = true; history.back(); }
    else if (!expectPop) { const h = pendingHash; pendingHash = null; location.hash = h; }
    return;
  }
  location.hash = hash;
}

window.addEventListener('popstate', () => {
  if (expectPop) {
    expectPop = false;
    sentinel = false;
    if (stack.length) { try { history.pushState({ brSheet: 1 }, ''); sentinel = true; } catch (e) { /* nada */ } }
    if (pendingHash) { const h = pendingHash; pendingHash = null; location.hash = h; }
    return;
  }
  if (sentinel) {
    sentinel = false;
    if (stack.length) removeSheet(stack[stack.length - 1]);
    if (stack.length) { try { history.pushState({ brSheet: 1 }, ''); sentinel = true; } catch (e) { /* nada */ } }
  }
});

// ---------- Avisos (toasts) ----------

let toastBox = null;
export function toast(msg, { action = null, timeout = 3800, kind = '' } = {}) {
  if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; toastBox.setAttribute('role', 'status'); toastBox.setAttribute('aria-live', 'polite'); document.body.appendChild(toastBox); }
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button" class="toast-btn">${esc(action.label)}</button>` : '');
  toastBox.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  let done = false;
  const close = () => { if (done) return; done = true; t.classList.remove('show'); setTimeout(() => t.remove(), 250); };
  if (action) t.querySelector('.toast-btn').addEventListener('click', () => { close(); action.fn(); });
  setTimeout(close, action ? Math.max(timeout, 6000) : timeout);
  return close;
}

// ---------- Confirmación ----------

export function confirmBox({ title = '¿Seguro?', text = '', ok = 'Aceptar', cancel = 'Cancelar', danger = false, typeToConfirm = null } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const body = html`<div class="confirm">
      ${text ? html`<p class="confirm-text">${text}</p>` : ''}
      ${typeToConfirm ? html`<label class="field"><span>Escribe <b>${typeToConfirm}</b> para confirmar</span><input class="input" data-k="type" autocomplete="off" autocapitalize="characters"></label>` : ''}
      <div class="row-btns">
        <button type="button" class="btn ghost" data-a="no">${cancel}</button>
        <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-a="yes" ${typeToConfirm ? 'disabled' : ''}>${ok}</button>
      </div></div>`;
    const sh = sheet({ title, body, size: 'sm', onClose: () => { if (!answered) { answered = true; resolve(false); } } });
    const yes = sh.el.querySelector('[data-a="yes"]');
    if (typeToConfirm) {
      const inp = sh.el.querySelector('[data-k="type"]');
      inp.addEventListener('input', () => { yes.disabled = inp.value.trim().toUpperCase() !== typeToConfirm.toUpperCase(); });
    }
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b || b.disabled) return;
      answered = true;
      resolve(b.dataset.a === 'yes');
      sh.close();
    });
  });
}

// ---------- Animación de números (solo la primera vez que aparecen) ----------

export function countUp(el, to, fmt, ms = 700) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) { if (el) el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function vibrate(ms = 12) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* nada */ } }
