// Piezas comunes de las pantallas: encabezado, selector de mes, tarjetas, filas de movimientos.

import { html, raw, ic, amt } from '../ui.js';
import { money, monthLabel, fmtDate, addDays, cap } from '../format.js';
import { catMap, entityName, entity } from '../calc.js';

export function pageHead({ title, sub = '', actions = '', back = '' }) {
  return html`<header class="page-head">
    ${back ? html`<a class="icon-btn back" href="${back}" aria-label="Volver">${ic('left', 22)}</a>` : ''}
    <div class="ph-text"><h1>${title}</h1>${sub ? html`<p>${sub}</p>` : ''}</div>
    <div class="ph-actions">${actions}</div>
  </header>`;
}

export function monthNav(ym, hrefOf, { min = null, max = null } = {}) {
  const prev = addMonthsSafe(ym, -1), next = addMonthsSafe(ym, 1);
  return html`<div class="month-nav" role="group" aria-label="Elegir mes">
    <a class="icon-btn ${min && prev < min ? 'disabled' : ''}" href="${hrefOf(prev)}" aria-label="Mes anterior">${ic('left', 20)}</a>
    <b>${monthLabel(ym)}</b>
    <a class="icon-btn ${max && next > max ? 'disabled' : ''}" href="${hrefOf(next)}" aria-label="Mes siguiente">${ic('right', 20)}</a>
  </div>`;
}

function addMonthsSafe(ym, n) {
  let [y, m] = ym.split('-').map(Number);
  m += n; y += Math.floor((m - 1) / 12); m = (((m - 1) % 12) + 12) % 12 + 1;
  return y + '-' + String(m).padStart(2, '0');
}

export function card({ title = '', icon = '', body, action = '', cls = '', id = '' }) {
  return html`<section class="card ${cls}" ${id ? raw(`id="${id}"`) : ''}>
    ${title ? html`<header class="card-head"><h2>${icon ? html`<i class="card-ic">${ic(icon, 18)}</i>` : ''}${title}</h2>${action}</header>` : ''}
    ${body}
  </section>`;
}

export const linkBtn = (label, attrs) => html`<button type="button" class="link-btn" ${raw(attrs)}>${label} ${ic('right', 16)}</button>`;

export const LEVEL = {
  good: { color: 'var(--pos)', icon: 'check', cls: 'lv-good' },
  warn: { color: 'var(--warn)', icon: 'alert', cls: 'lv-warn' },
  bad: { color: 'var(--neg)', icon: 'alert', cls: 'lv-bad' },
  neutral: { color: 'var(--muted)', icon: 'info', cls: 'lv-neutral' },
};

/** Ícono, título y detalle de un movimiento para las listas. */
export function moveInfo(S, m, cats = catMap(S)) {
  const c = m.cat ? cats[m.cat] : null;
  if (m.type === 'expense' || m.type === 'income') {
    const where = m.type === 'expense' ? entityName(S, m.src) : entityName(S, m.dst);
    const debt = m.type === 'expense' && m.dst && m.dst.k === 'debt' ? entityName(S, m.dst) : '';
    return {
      icon: c ? c.icon : '❔', color: c ? c.color : '#94A3B8',
      title: m.note || (debt ? 'Cuota: ' + debt : c ? c.name : 'Sin categoría'),
      sub: [m.note ? (c ? c.name : '') : debt ? (c ? c.name : '') : '', where].filter(Boolean).join(' · '),
      value: m.type === 'expense' ? -m.amount : m.amount,
    };
  }
  if (m.type === 'transfer') {
    const s = m.src ? entityName(S, m.src) : '', d = m.dst ? entityName(S, m.dst) : '';
    let title = 'Transferencia', icon = '🔁';
    if (m.dst && m.dst.k === 'card') { title = 'Pago de tarjeta'; icon = '💳'; }
    else if (m.dst && m.dst.k === 'inv') { title = 'Inversión'; icon = '📈'; }
    else if (m.src && m.src.k === 'inv') { title = 'Retiro de inversión'; icon = '📈'; }
    else if (m.src && m.src.k === 'debt') { const e = entity(S, m.src); title = e && e.direction === 'me_deben' ? 'Cobro de préstamo' : 'Préstamo recibido'; icon = '🤝'; }
    else if (m.dst && m.dst.k === 'debt') { title = 'Préstamo entregado'; icon = '🤝'; }
    return { icon, color: '#64748B', title: m.note || title, sub: s && d ? s + ' → ' + d : s || d, value: 0, transfer: true };
  }
  return { icon: '⚖️', color: '#64748B', title: m.note || 'Ajuste de saldo', sub: entityName(S, m.dst), value: m.amount, adjust: true };
}

export function moveRow(S, m, { cats, showDate = false, value = null } = {}) {
  const i = moveInfo(S, m, cats);
  const v = value != null ? value : i.value;
  const act = m.virtual ? raw(`data-act="virtual" data-k="${m.virtual.k}" data-id="${m.virtual.id}"`) : raw(`data-act="edit-move" data-id="${m.id}"`);
  return html`<button type="button" class="mv" ${act}>
    <i class="mv-ic" style="--c:${raw(i.color)}">${i.icon}</i>
    <span class="mv-t"><b>${i.title}${m.rec ? html` <em class="tag">fijo</em>` : ''}${m.virtual ? html` <em class="tag">auto</em>` : ''}</b><small>${showDate ? fmtDate(m.date, 'medium') + (i.sub ? ' · ' : '') : ''}${i.sub}</small></span>
    <span class="mv-a">${i.transfer && value == null ? html`<span class="amt zero">${money(m.amount)}</span>` : amt(v, { sign: true })}</span>
  </button>`;
}

/** Lista de movimientos agrupada por día, con el neto de cada día. */
export function dayGroups(S, list, today, { limit = 0, valueFn = null } = {}) {
  const cats = catMap(S);
  const out = [];
  let cur = null, items = [], net = 0, count = 0;
  const flush = () => {
    if (!cur) return;
    const label = cur === today ? 'Hoy' : cur === addDays(today, -1) ? 'Ayer' : fmtDate(cur, cur.slice(0, 4) === today.slice(0, 4) ? 'day' : 'dayyear');
    out.push(html`<div class="day"><div class="day-h"><span>${label}</span>${net ? amt(net, { sign: true }) : ''}</div>${items}</div>`);
  };
  for (const m of list) {
    if (limit && count >= limit) break;
    if (m.date !== cur) { flush(); cur = m.date; items = []; net = 0; }
    const val = valueFn ? valueFn(m) : null;
    items.push(moveRow(S, m, { cats, value: val }));
    const info = valueFn ? { value: val } : moveInfo(S, m, cats);
    net += info.value || 0;
    count++;
  }
  flush();
  return out;
}

export function kpi({ label, value, sub = '', icon = '', tone = '', id = '' }) {
  return html`<div class="kpi ${tone ? 't-' + tone : ''}" ${id ? raw(`data-kpi="${id}"`) : ''}>
    <span class="kpi-l">${icon ? ic(icon, 16) : ''}${label}</span>
    <b class="kpi-v">${value}</b>
    ${sub ? html`<small class="kpi-s">${sub}</small>` : ''}
  </div>`;
}

export function chipLink(label, href, on = false) { return html`<a class="seg-b ${on ? 'on' : ''}" href="${href}">${label}</a>`; }

export const capWords = (s) => cap(s);
