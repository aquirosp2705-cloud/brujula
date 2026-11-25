// Campos de formulario reutilizables (montos, fechas, chips, colores) y lectura de sus valores.

import { html, raw, ic } from './ui.js';
import { amountInput, parseAmount, todayISO, addDays, getFormat, isISO } from './format.js';
import { PALETTE } from './config.js';

const errSlot = (k) => html`<small class="err" data-err="${k}" role="alert"></small>`;

export function fAmount(k, v, { label = 'Monto', big = false, hint = '', placeholder = '0.00', allowNeg = false, autofocus = false } = {}) {
  const f = getFormat();
  const ph = f.style === 'es' ? placeholder.replace('.', ',') : placeholder;
  const neg = allowNeg && v < 0;
  return html`<label class="field ${big ? 'big' : ''}"><span>${label}</span>
    <div class="money-in ${neg ? 'is-neg' : ''}">${allowNeg ? html`<button type="button" class="neg-btn" data-neg-toggle="${k}" aria-label="Cambiar a negativo o positivo" title="Negativo / positivo">±</button>` : ''}<b>${f.sym}</b><input class="input" data-k="${k}" data-type="amount" ${allowNeg ? raw('data-allow-neg="1"') : ''} inputmode="decimal" autocomplete="off" enterkeyhint="done" placeholder="${ph}" value="${v === '' || v == null ? '' : amountInput(Math.abs(v))}" ${autofocus ? raw('autofocus') : ''}></div>
    ${hint ? html`<small class="hint">${hint}</small>` : ''}${errSlot(k)}</label>`;
}

export function fText(k, v, { label = '', placeholder = '', max = 60, hint = '', autofocus = false, type = 'text', inputmode = '' } = {}) {
  return html`<label class="field"><span>${label}</span>
    <input class="input" type="${type}" data-k="${k}" maxlength="${max}" placeholder="${placeholder}" value="${v || ''}" autocomplete="off" ${inputmode ? raw(`inputmode="${inputmode}"`) : ''} ${autofocus ? raw('autofocus') : ''}>
    ${hint ? html`<small class="hint">${hint}</small>` : ''}${errSlot(k)}</label>`;
}

export function fArea(k, v, { label = '', placeholder = '', rows = 3, max = 2000 } = {}) {
  return html`<label class="field"><span>${label}</span><textarea class="input" data-k="${k}" rows="${rows}" maxlength="${max}" placeholder="${placeholder}">${v || ''}</textarea>${errSlot(k)}</label>`;
}

export function fNumber(k, v, { label = '', placeholder = '', suffix = '', hint = '', min = 0, max = 1000, step = 'any' } = {}) {
  return html`<label class="field"><span>${label}</span>
    <div class="suffix-in"><input class="input" data-k="${k}" data-type="number" inputmode="decimal" placeholder="${placeholder}" value="${v || v === 0 ? String(v).replace('.', getFormat().style === 'es' ? ',' : '.') : ''}" data-min="${min}" data-max="${max}" data-step="${step}" autocomplete="off">${suffix ? html`<em>${suffix}</em>` : ''}</div>
    ${hint ? html`<small class="hint">${hint}</small>` : ''}${errSlot(k)}</label>`;
}

export function fDay(k, v, { label = 'Día del mes', hint = '' } = {}) {
  const opts = [['0', '—']].concat(Array.from({ length: 31 }, (_, i) => [String(i + 1), String(i + 1)]));
  return fSelect(k, opts, String(v || 0), { label, hint });
}

export function fSelect(k, options, v, { label = '', hint = '' } = {}) {
  return html`<label class="field"><span>${label}</span>
    <div class="select-in"><select class="input" data-k="${k}">${options.map(([val, lab]) => html`<option value="${val}" ${String(val) === String(v) ? raw('selected') : ''}>${lab}</option>`)}</select>${ic('down', 18)}</div>
    ${hint ? html`<small class="hint">${hint}</small>` : ''}${errSlot(k)}</label>`;
}

/** Fecha con atajos «Hoy» y «Ayer». */
export function fDate(k, v, { label = 'Fecha', quick = true, hint = '' } = {}) {
  const t = todayISO(), y = addDays(t, -1);
  return html`<div class="field"><span>${label}</span>
    <div class="date-row">
      ${quick ? html`<button type="button" class="chip ${v === t ? 'on' : ''}" data-date-quick="${k}" data-v="${t}">Hoy</button>
      <button type="button" class="chip ${v === y ? 'on' : ''}" data-date-quick="${k}" data-v="${y}">Ayer</button>` : ''}
      <input type="date" class="input date-in" data-k="${k}" value="${v || ''}">
    </div>${hint ? html`<small class="hint">${hint}</small>` : ''}${errSlot(k)}</div>`;
}

/** Opciones en forma de chips (una sola elegida). options: [[valor, texto, emoji?]] */
export function fChips(k, options, v, { label = '', cls = '', hint = '' } = {}) {
  return html`<div class="field"><span>${label}</span>
    <div class="chips ${cls}" data-k="${k}" data-type="chips" data-value="${v == null ? '' : v}" role="radiogroup" aria-label="${label}">
      ${options.map(([val, lab, emo]) => html`<button type="button" class="chip ${String(val) === String(v) ? 'on' : ''}" data-v="${val}" role="radio" aria-checked="${String(val) === String(v)}">${emo ? html`<i class="emo">${emo}</i>` : ''}${lab}</button>`)}
    </div>${hint ? html`<small class="hint">${hint}</small>` : ''}${errSlot(k)}</div>`;
}

export function fColor(k, v, { label = 'Color' } = {}) {
  return html`<div class="field"><span>${label}</span>
    <div class="colors" data-k="${k}" data-type="chips" data-value="${v}" role="radiogroup" aria-label="${label}">
      ${PALETTE.map((c) => html`<button type="button" class="color ${c === v ? 'on' : ''}" data-v="${c}" style="--c:${raw(c)}" role="radio" aria-checked="${c === v}" aria-label="Color ${c}"></button>`)}
    </div></div>`;
}

export function fToggle(k, v, { label = '', hint = '' } = {}) {
  return html`<label class="toggle-row"><span><b>${label}</b>${hint ? html`<small>${hint}</small>` : ''}</span>
    <input type="checkbox" class="switch" data-k="${k}" data-type="bool" ${v ? raw('checked') : ''}></label>`;
}

/** Activa los chips, atajos de fecha, colores y el botón ± dentro de un formulario. */
export function bindFields(root, onChange = () => {}) {
  root.addEventListener('click', (e) => {
    const q = e.target.closest('[data-date-quick]');
    if (q) {
      const inp = root.querySelector(`[data-k="${q.dataset.dateQuick}"]`);
      inp.value = q.dataset.v;
      root.querySelectorAll(`[data-date-quick="${q.dataset.dateQuick}"]`).forEach((b) => b.classList.toggle('on', b === q));
      clearErr(root, q.dataset.dateQuick);
      onChange(q.dataset.dateQuick);
      return;
    }
    const nb = e.target.closest('[data-neg-toggle]');
    if (nb) { nb.closest('.money-in').classList.toggle('is-neg'); onChange(nb.dataset.negToggle); return; }
    const chip = e.target.closest('[data-type="chips"] [data-v]');
    if (chip) {
      const box = chip.closest('[data-type="chips"]');
      box.dataset.value = chip.dataset.v;
      box.querySelectorAll('[data-v]').forEach((b) => { const on = b === chip; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      clearErr(root, box.dataset.k);
      onChange(box.dataset.k);
    }
  });
  root.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.k;
    if (!k) return;
    clearErr(root, k);
    if (e.target.type === 'date') root.querySelectorAll(`[data-date-quick="${k}"]`).forEach((b) => b.classList.toggle('on', b.dataset.v === e.target.value));
    onChange(k);
  });
  root.addEventListener('change', (e) => { const k = e.target.dataset && e.target.dataset.k; if (k && e.target.tagName === 'SELECT') onChange(k); });
}

export function readFields(root) {
  const out = {};
  root.querySelectorAll('[data-k]').forEach((el) => {
    const k = el.dataset.k, t = el.dataset.type;
    if (t === 'chips') out[k] = el.dataset.value;
    else if (t === 'amount') {
      let v = parseAmount(el.value);
      if (el.value.trim() === '') v = NaN;
      if (!isNaN(v) && el.dataset.allowNeg && el.closest('.money-in').classList.contains('is-neg')) v = -Math.abs(v);
      out[k] = v;
    } else if (t === 'number') { const v = parseAmount(el.value); out[k] = el.value.trim() === '' ? NaN : v; }
    else if (t === 'bool') out[k] = el.checked;
    else out[k] = el.value.trim();
  });
  return out;
}

export function setErr(root, k, msg) {
  const s = root.querySelector(`[data-err="${k}"]`);
  if (s) s.textContent = msg;
  const f = root.querySelector(`[data-k="${k}"]`);
  if (f) {
    const box = f.closest('.field') || f;
    box.classList.add('has-err');
    box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
    if (f.focus && f.tagName !== 'DIV') try { f.focus({ preventScroll: false }); } catch (e) { /* nada */ }
    else box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  return false;
}
export function clearErr(root, k) {
  const s = root.querySelector(`[data-err="${k}"]`);
  if (s) s.textContent = '';
  const f = root.querySelector(`[data-k="${k}"]`);
  if (f) { const box = f.closest('.field'); if (box) box.classList.remove('has-err'); }
}

export const validDate = (d) => isISO(d);
