// Inversiones: portafolio con valor de hoy, intereses, distribución y vencimientos.

import { html, raw, ic, amt, bar } from '../ui.js';
import { money, pct, num, fmtDate, relDays, plural } from '../format.js';
import { invInfo } from '../calc.js';
import { donut } from '../charts.js';
import { pageHead, card, kpi } from './common.js';
import { INV_TYPES, label, emojiOf } from '../config.js';

export const title = 'Inversiones';
const TYPE_COLORS = { plazo: '#10B981', ahorro: '#F59E0B', fondo: '#6366F1', acciones: '#EC4899', cripto: '#F97316', inmueble: '#0EA5E9', otro: '#64748B' };

let tab = 'activas';

function statusChip(x, i) {
  if (x.status === 'cobrada') return html`<em class="tag">Cobrada</em>`;
  if (x.type === 'plazo' && i.term) {
    if (i.matured) return html`<em class="tag bad">Venció ${relDays(i.daysToEnd)}</em>`;
    if (i.daysToEnd <= 7) return html`<em class="tag warn">Vence ${relDays(i.daysToEnd)}</em>`;
    return html`<em class="tag good">Vence ${relDays(i.daysToEnd)}</em>`;
  }
  return html`<em class="tag good">Activa</em>`;
}

export function render(ctx) {
  const { S, today, bal } = ctx;
  const all = S.investments.map((x) => ({ x, i: invInfo(x, bal, today) }));
  const act = all.filter((y) => y.x.status !== 'cobrada'), done = all.filter((y) => y.x.status === 'cobrada');
  const total = act.reduce((s, y) => s + y.i.current, 0);
  const invested = act.reduce((s, y) => s + y.i.invested, 0);
  const earned = total - invested;
  const monthly = act.reduce((s, y) => s + (y.i.monthly || 0), 0);
  const wRate = invested > 0 ? act.reduce((s, y) => s + y.i.invested * (y.x.rate || 0), 0) / invested : 0;
  const byType = {};
  for (const y of act) byType[y.x.type] = (byType[y.x.type] || 0) + y.i.current;
  const segs = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ value: v, color: TYPE_COLORS[k] || '#64748B', label: label(INV_TYPES, k), icon: emojiOf(INV_TYPES, k) }));
  const timeline = act.filter((y) => y.x.type === 'plazo' && y.i.term).sort((a, b) => (a.x.end < b.x.end ? -1 : 1));
  const list = tab === 'activas' ? act : done;

  return html`${pageHead({ title: 'Inversiones', sub: 'Tu dinero trabajando para ti', actions: html`<button class="btn primary" data-act="add-inv">${ic('plus', 18)} <span class="hide-s">Inversión</span></button>` })}
    <div class="dash">
      ${act.length ? html`
        <section class="hero green span-7"><div class="hero-glow" aria-hidden="true"></div>
          <div class="hero-top"><span>${ic('trend', 18)} Valor de tus inversiones hoy</span></div>
          <b class="hero-v">${money(total)}</b>
          <div class="hero-sub">${act.length} ${plural(act.length, 'inversión activa', 'inversiones activas')}</div>
          <div class="hero-pills"><span class="pill">Invertido: <b>${money(invested)}</b></span><span class="pill">Ganado: <b>${money(earned, { sign: true })}</b></span><span class="pill">Tasa promedio: <b>${num(wRate, 2)}%</b></span></div>
        </section>
        <div class="kpis span-5">
          ${kpi({ label: 'Te generan al mes', value: money(monthly), icon: 'coins', tone: 'pos', sub: 'aprox., según sus tasas' })}
          ${kpi({ label: 'Al año', value: money(monthly * 12), icon: 'calendar', tone: 'brand', sub: 'si se mantienen las tasas' })}
          ${kpi({ label: 'Próximo vencimiento', value: timeline.length ? fmtDate(timeline[0].x.end, 'medium') : '—', icon: 'flag', tone: 'warn', sub: timeline.length ? timeline[0].x.name : 'Sin plazos fijos' })}
          ${kpi({ label: 'Rendimiento', value: invested > 0 ? pct(earned / invested, 1) : '—', icon: 'trend', tone: 'violet', sub: 'sobre lo invertido' })}
        </div>
        ${card({ title: 'Cómo está repartido', icon: 'pie', cls: 'span-5', body: html`<div class="donut-wrap">${donut(segs, { center: money(total, { short: true }), sub: 'invertido hoy' })}
          <ul class="legend">${segs.map((s) => html`<li><span class="lg"><i class="dot" style="background:${raw(s.color)}"></i><span>${s.icon} ${s.label}</span><b>${money(s.value)}</b><em>${pct(s.value / total)}</em></span></li>`)}</ul></div>
          ${segs.length === 1 ? html`<p class="mini-help">${ic('bulb', 16)} Todo está en un solo tipo de inversión. Repartir en varios reduce el riesgo.</p>` : ''}` })}
        ${card({ title: 'Vencimientos', icon: 'calendar', cls: 'span-7', body: timeline.length ? html`<ul class="tl">${timeline.map(({ x, i }) => html`<li class="${i.matured ? 'late' : i.daysToEnd <= 7 ? 'soon' : ''}"><button type="button" data-act="inv" data-id="${x.id}">
            <span class="tl-d"><b>${fmtDate(x.end)}</b><small>${x.end.slice(0, 4)}</small></span>
            <span class="tl-t"><b>${x.name}</b><small>${i.matured ? 'Venció ' + relDays(i.daysToEnd) + ' · cóbrala o renuévala' : 'Faltan ' + i.left + ' días'}</small>${bar(i.progress, i.matured ? 'var(--neg)' : 'var(--pos)')}</span>
            <span class="tl-a"><b>${money(i.atEnd)}</b><small>+${money(i.interestAtEnd)}</small></span></button></li>`)}</ul>`
          : html`<p class="muted small">Los plazos fijos (pólizas) muestran aquí su fecha de vencimiento y lo que recibirás.</p>` })}` : ''}
      <section class="card span-12">
        <header class="card-head"><h2><i class="card-ic">${ic('list', 18)}</i>Mis inversiones</h2>
          <div class="seg small" role="tablist"><button type="button" class="seg-b ${tab === 'activas' ? 'on' : ''}" data-act="inv-tab" data-t="activas">Activas (${act.length})</button><button type="button" class="seg-b ${tab === 'cobradas' ? 'on' : ''}" data-act="inv-tab" data-t="cobradas">Cobradas (${done.length})</button></div></header>
        ${list.length ? html`<div class="inv-grid">${list.map(({ x, i }) => html`<button type="button" class="inv-card" data-act="inv" data-id="${x.id}" style="--c:${raw(TYPE_COLORS[x.type] || '#64748B')}">
            <div class="inv-top"><i class="inv-e">${emojiOf(INV_TYPES, x.type)}</i><span><b>${x.name}</b><small>${label(INV_TYPES, x.type)}${x.institution ? ' · ' + x.institution : ''}</small></span>${statusChip(x, i)}</div>
            <div class="inv-nums">
              <div><span>Invertido</span><b>${money(i.invested)}</b></div>
              <div><span>Valor hoy</span><b>${money(i.current)}</b></div>
              ${x.type === 'plazo' && i.term ? html`<div><span>Al vencer</span><b class="pos">${money(i.atEnd)}</b></div>` : html`<div><span>Ganancia</span><b class="${i.gain >= 0 ? 'pos' : 'neg'}">${money(i.gain, { sign: true })}${i.gainPct != null ? html` <small>(${pct(i.gainPct, 1)})</small>` : ''}</b></div>`}
            </div>
            ${x.type === 'plazo' && i.term && x.status !== 'cobrada' ? html`${bar(i.progress, 'var(--c)')}<div class="inv-foot"><span>${fmtDate(x.start, 'medium')} → ${fmtDate(x.end, 'medium')}</span><span>${x.rate ? num(x.rate, 2) + '% anual' : ''}</span></div>`
              : html`<div class="inv-foot"><span>Desde ${fmtDate(x.start, 'medium')}</span><span>${x.rate ? num(x.rate, 2) + '% anual' : ''}</span></div>`}
          </button>`)}</div>`
        : tab === 'activas' ? html`<div class="empty"><div class="empty-ic">${ic('trend', 28)}</div><h3>Registra tus inversiones</h3><p>Pólizas o plazos fijos, fondos, acciones o cripto. Te mostramos cuánto ganas, cuándo vencen y cuánto recibirás.</p><button class="btn primary" data-act="add-inv">${ic('plus', 18)} Agregar inversión</button></div>`
          : html`<p class="muted small">Aún no has cobrado ninguna inversión.</p>`}
      </section>
      ${card({ cls: 'span-12 tip', body: html`<p>${ic('bulb', 18)} <span><b>Toca una inversión</b> para cobrarla, renovarla, actualizar su valor o aportar más. Si al crearla eliges la cuenta de donde salió el dinero, ese saldo se descuenta solo.</span></p>` })}
    </div>`;
}

export const actions = {
  'inv-tab': (b, ctx, el, rerender) => { tab = b.dataset.t; rerender(); },
};
