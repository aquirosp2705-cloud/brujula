// Deudas en una sola hoja: tarjetas, préstamos de todo tipo y lo que me deben.

import { html, raw, ic, amt, bar } from '../ui.js';
import { money, pct, num, fmtDate, relDays, monthLabel, plural } from '../format.js';
import { debtInfo, cardInfo, health } from '../calc.js';
import { pageHead, card, kpi } from './common.js';
import { DEBT_TYPES, label, emojiOf } from '../config.js';

export const title = 'Deudas';

function debtRow(S, d, info, today) {
  const me = d.direction === 'me_deben';
  const term = info.months === 0 ? '¡Pagada!' : info.cantCover ? 'La cuota no alcanza a cubrir los intereses' : info.months != null ? `Terminas en ~${info.months} ${plural(info.months, 'mes', 'meses')}${info.payoff ? ' (' + monthLabel(info.payoff, { short: true }) + ')' : ''}` : 'Registra la cuota para estimar cuándo terminas';
  return html`<li><button type="button" class="debt" data-act="debt" data-id="${d.id}" style="--c:${raw(d.color)}">
    <i class="debt-e">${me ? '🤝' : emojiOf(DEBT_TYPES, d.type)}</i>
    <span class="debt-t"><b>${d.name}</b><small>${d.who ? (me ? 'Te debe: ' : 'A: ') + d.who + ' · ' : ''}${d.payment ? `Cuota ${money(d.payment)}${d.payDay ? ' el día ' + d.payDay : ''}` : 'Sin cuota fija'}${d.rate ? ` · ${num(d.rate, 2)}% anual` : ''}</small>
      ${bar(info.paidPct, me ? 'var(--pos)' : 'var(--c)')}
      <small class="${info.cantCover ? 'neg' : ''}">${Math.round(info.paidPct * 100)}% ${me ? 'cobrado' : 'pagado'} · ${me ? (info.months != null && info.months > 0 ? `Te termina de pagar en ~${info.months} ${plural(info.months, 'mes', 'meses')}` : '') : term}</small></span>
    <span class="debt-a"><b>${money(info.pos)}</b>${info.next ? html`<small class="${info.next < today ? 'neg' : ''}">${me ? 'Cobro' : 'Pago'}: ${fmtDate(info.next)}</small>` : ''}${!me && info.interestLeft ? html`<small>Intereses por pagar ~${money(info.interestLeft)}</small>` : ''}</span>
  </button></li>`;
}

export function render(ctx) {
  const { S, today, bal } = ctx;
  const mine = S.debts.filter((d) => d.direction !== 'me_deben' && !d.closed).map((d) => ({ d, i: debtInfo(S, d, bal, today) }));
  const owed = S.debts.filter((d) => d.direction === 'me_deben' && !d.closed).map((d) => ({ d, i: debtInfo(S, d, bal, today) }));
  const closed = S.debts.filter((d) => d.closed);
  const cards = S.cards.filter((c) => !c.archived).map((c) => ({ c, ci: cardInfo(S, c, today, bal) })).filter((x) => x.ci.used > 0.005);
  const totDebts = mine.reduce((s, x) => s + x.i.pos, 0), totCards = cards.reduce((s, x) => s + x.ci.used, 0);
  const totOwed = owed.reduce((s, x) => s + x.i.pos, 0);
  const cuotas = mine.filter((x) => x.i.pos > 0.005).reduce((s, x) => s + (x.d.payment || 0), 0);
  const h = health(S, today, bal);
  const ratio = h.avgInc > 0 ? cuotas / h.avgInc : null;
  const groups = {};
  for (const x of mine) (groups[x.d.type] = groups[x.d.type] || []).push(x);
  const withRate = mine.filter((x) => x.i.pos > 0.005 && x.d.rate > 0);
  const aval = withRate.slice().sort((a, b) => b.d.rate - a.d.rate)[0];
  const snow = mine.filter((x) => x.i.pos > 0.005).sort((a, b) => a.i.pos - b.i.pos)[0];
  const nothing = !mine.length && !owed.length && !cards.length;

  return html`${pageHead({ title: 'Deudas', sub: 'Todo lo que debes y lo que te deben, en una sola hoja', actions: html`<button class="btn ghost small" data-act="add-debt" data-dir="me_deben">${ic('plus', 16)} Me deben</button><button class="btn primary small" data-act="add-debt" data-dir="debo">${ic('plus', 16)} Deuda</button>` })}
    <div class="dash">
      ${nothing ? html`<div class="span-12">${card({ body: html`<div class="empty"><div class="empty-ic">${ic('debt', 28)}</div><h3>¿Tienes préstamos o deudas?</h3><p>Créditos del banco, hipoteca, carro, casas comerciales, préstamos de familia… Regístralos y verás cuánto debes, cuánto pagas al mes y cuándo terminas.</p><div class="row-btns"><button class="btn primary" data-act="add-debt" data-dir="debo">${ic('plus', 18)} Registrar una deuda</button><button class="btn ghost" data-act="add-debt" data-dir="me_deben">Alguien me debe</button></div></div>` })}</div>` : html`
      <div class="kpis four span-12">
        ${kpi({ label: 'Debes en total', value: money(totDebts + totCards), icon: 'debt', tone: 'neg', sub: totCards ? `${money(totCards)} en tarjetas` : 'préstamos' })}
        ${kpi({ label: 'Cuotas al mes', value: money(cuotas), icon: 'calendar', tone: 'warn', sub: 'de tus préstamos' })}
        ${kpi({ label: 'De tus ingresos', value: ratio != null ? pct(ratio) : '—', icon: 'pie', tone: ratio == null ? '' : ratio <= 0.3 ? 'pos' : ratio <= 0.4 ? 'warn' : 'neg', sub: ratio == null ? 'anota tus ingresos' : ratio <= 0.3 ? 'nivel sano' : ratio <= 0.4 ? 'cerca del límite' : 'muy alto' })}
        ${kpi({ label: 'Te deben', value: money(totOwed), icon: 'coins', tone: 'pos', sub: owed.length ? `${owed.length} ${plural(owed.length, 'persona', 'personas')}` : 'nadie' })}
      </div>
      ${(aval || snow) && mine.length > 1 ? card({ title: '¿A cuál abonar primero?', icon: 'bulb', cls: 'span-12 strategy', body: html`<div class="strat">
          ${aval ? html`<div><span class="tag">Método avalancha</span><b>${aval.d.name}</b><p>Tiene la tasa más alta (${num(aval.d.rate, 2)}%). Abonarle primero te ahorra más intereses.</p></div>` : ''}
          ${snow ? html`<div><span class="tag">Método bola de nieve</span><b>${snow.d.name}</b><p>Es la más pequeña (${money(snow.i.pos)}). Terminarla rápido te motiva a seguir.</p></div>` : ''}</div>` }) : ''}
      <section class="card span-12">
        <header class="card-head"><h2><i class="card-ic">${ic('debt', 18)}</i>Lo que debo</h2><span class="muted small">${money(totDebts + totCards)}</span></header>
        ${cards.length ? html`<h3 class="group-h">💳 Tarjetas de crédito <small>${money(totCards)}</small></h3><ul class="debt-list">${cards.map(({ c, ci }) => html`<li><a class="debt" href="#/tarjetas/${c.id}" style="--c:${raw(c.color)}"><i class="debt-e">💳</i><span class="debt-t"><b>${c.name}</b><small>${ci.limit ? `Usas el ${pct(ci.util)} de ${money(ci.limit)}` : 'Tarjeta de crédito'}</small>${ci.util != null ? bar(ci.util, ci.util > 0.6 ? 'var(--neg)' : ci.util > 0.3 ? 'var(--warn)' : 'var(--pos)') : ''}</span><span class="debt-a"><b>${money(ci.used)}</b>${ci.dueAmount > 0 && ci.due ? html`<small>Pagar ${money(ci.dueAmount)} · ${fmtDate(ci.due)}</small>` : ''}</span></a></li>`)}</ul>` : ''}
        ${Object.entries(groups).map(([t, xs]) => html`<h3 class="group-h">${emojiOf(DEBT_TYPES, t)} ${label(DEBT_TYPES, t)} <small>${money(xs.reduce((s, x) => s + x.i.pos, 0))}</small></h3><ul class="debt-list">${xs.map((x) => debtRow(S, x.d, x.i, today))}</ul>`)}
        ${!mine.length && !cards.length ? html`<p class="muted small">No tienes deudas registradas. ¡Bien!</p>` : ''}
        <button class="btn small ghost" data-act="add-debt" data-dir="debo">${ic('plus', 16)} Agregar deuda</button>
      </section>
      <section class="card span-12">
        <header class="card-head"><h2><i class="card-ic">${ic('coins', 18)}</i>Lo que me deben</h2><span class="muted small">${money(totOwed)}</span></header>
        ${owed.length ? html`<ul class="debt-list">${owed.map((x) => debtRow(S, x.d, x.i, today))}</ul>` : html`<p class="muted small">Si le prestaste dinero a alguien, regístralo para no olvidarlo.</p>`}
        <button class="btn small ghost" data-act="add-debt" data-dir="me_deben">${ic('plus', 16)} Alguien me debe</button>
      </section>`}
      ${closed.length ? html`<details class="card span-12 archived"><summary>${ic('down', 18)} Terminadas (${closed.length})</summary><ul class="plain-list">${closed.map((d) => html`<li><span>${d.direction === 'me_deben' ? '🤝' : emojiOf(DEBT_TYPES, d.type)} ${d.name}</span><b>${money(bal.debt[d.id] || 0)}</b><button class="btn small ghost" data-act="debt" data-id="${d.id}">Ver</button></li>`)}</ul></details>` : ''}
      ${card({ cls: 'span-12 tip', body: html`<p>${ic('bulb', 18)} <span><b>Toca una deuda</b> para pagar la cuota: baja el saldo y cuenta como gasto del mes. Si sabes cuánto del pago es interés, anótalo y el saldo bajará solo por el capital.</span></p>` })}
    </div>`;
}
