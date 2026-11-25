// Bancos (cuentas y efectivo) y Tarjetas de crédito, con su detalle tipo estado de cuenta.

import { html, raw, ic, amt, bar } from '../ui.js';
import { money, pct, fmtDate, relDays, ymOf, addMonths, monthEnd, monthLabel, plural, addDays } from '../format.js';
import { balances, cardInfo, statement, entity, catMap } from '../calc.js';
import { spark, area } from '../charts.js';
import { pageHead, card, moveInfo, kpi } from './common.js';
import { ACC_TYPES, label, emojiOf } from '../config.js';

export const title = 'Cuentas';

const seg = (on) => html`<div class="seg small" role="tablist" aria-label="Cuentas"><a class="seg-b ${on === 'bancos' ? 'on' : ''}" href="#/bancos" role="tab" aria-selected="${on === 'bancos'}">${ic('bank', 16)} Bancos</a><a class="seg-b ${on === 'tarjetas' ? 'on' : ''}" href="#/tarjetas" role="tab" aria-selected="${on === 'tarjetas'}">${ic('card', 16)} Tarjetas</a></div>`;

/** Saldos de fin de mes de los últimos n meses (para las líneas pequeñas). */
function monthEnds(S, today, n = 6) {
  const cur = ymOf(today), out = [];
  for (let k = n - 1; k >= 1; k--) out.push(balances(S, monthEnd(addMonths(cur, -k))));
  out.push(balances(S, today));
  return out;
}

export function render(ctx) {
  const { route } = ctx;
  if (route.name === 'tarjetas') return route.parts[1] ? cardDetail(ctx, route.parts[1]) : cardsPage(ctx);
  return route.parts[1] ? accDetail(ctx, route.parts[1]) : banksPage(ctx);
}

// ---------- Bancos ----------

function banksPage(ctx) {
  const { S, today, bal } = ctx;
  const accs = S.accounts.filter((a) => !a.archived), arch = S.accounts.filter((a) => a.archived);
  const total = S.accounts.reduce((s, a) => s + (bal.acc[a.id] || 0), 0);
  const ends = accs.length ? monthEnds(S, today) : [];
  const lastMove = (id) => S.movements.filter((m) => (m.src && m.src.k === 'acc' && m.src.id === id) || (m.dst && m.dst.k === 'acc' && m.dst.id === id)).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return html`${pageHead({ title: 'Bancos y efectivo', sub: 'Tus cuentas en un solo lugar', actions: html`${seg('bancos')}<button class="btn primary" data-act="add-acc">${ic('plus', 18)} <span class="hide-s">Cuenta</span></button>` })}
    <div class="dash">
      <section class="hero slim span-12"><div class="hero-glow" aria-hidden="true"></div>
        <div class="hero-top"><span>${ic('wallet', 18)} Total en tus cuentas</span></div>
        <b class="hero-v">${money(total)}</b>
        <div class="hero-sub">${accs.length} ${plural(accs.length, 'cuenta activa', 'cuentas activas')}</div></section>
      ${accs.length ? html`<div class="acc-grid span-12">${accs.map((a) => {
        const b = bal.acc[a.id] || 0, lm = lastMove(a.id);
        return html`<article class="acc-card" style="--c:${raw(a.color)}">
          <a class="acc-main" href="#/bancos/${a.id}">
            <span class="acc-type">${emojiOf(ACC_TYPES, a.type)} ${label(ACC_TYPES, a.type)}${a.last4 ? html` · •${a.last4}` : ''}</span>
            <b class="acc-name">${a.name}</b>
            <span class="acc-bal ${b < 0 ? 'neg' : ''}">${money(b)}</span>
            <span class="acc-spark">${spark(ends.map((e) => e.acc[a.id] || 0), { color: a.color, w: 140, h: 34 })}</span>
            <small class="acc-last">${lm ? 'Último movimiento: ' + fmtDate(lm.date) : 'Sin movimientos aún'}</small>
          </a>
          <div class="acc-acts">
            <button data-act="ent-move" data-type="expense" data-k="acc" data-id="${a.id}" data-role="src" title="Anotar gasto">${ic('downleft', 18)}<span>Gasto</span></button>
            <button data-act="ent-move" data-type="income" data-k="acc" data-id="${a.id}" data-role="dst" title="Anotar ingreso">${ic('up', 18)}<span>Ingreso</span></button>
            <button data-act="ent-move" data-type="transfer" data-k="acc" data-id="${a.id}" data-role="src" title="Transferir">${ic('swap', 18)}<span>Transferir</span></button>
            <button data-act="ent-adjust" data-k="acc" data-id="${a.id}" title="Ajustar saldo">${ic('scale', 18)}<span>Ajustar</span></button>
          </div></article>`;
      })}<button class="acc-card add" data-act="add-acc">${ic('plus', 26)}<b>Agregar cuenta</b><small>Banco, efectivo o billetera digital</small></button></div>`
      : html`<div class="span-12">${card({ body: html`<div class="empty"><div class="empty-ic">${ic('bank', 28)}</div><h3>Agrega tu primera cuenta</h3><p>Tu banco, tu efectivo o tu billetera digital. Solo necesitas el nombre y el saldo de hoy.</p><button class="btn primary" data-act="add-acc">${ic('plus', 18)} Agregar cuenta</button></div>` })}</div>`}
      ${arch.length ? html`<details class="card span-12 archived"><summary>${ic('down', 18)} Cuentas archivadas (${arch.length})</summary>
        <ul class="plain-list">${arch.map((a) => html`<li><span>${a.name}</span><b>${money(bal.acc[a.id] || 0)}</b><button class="btn small ghost" data-act="ent-archive" data-k="acc" data-id="${a.id}">Reactivar</button></li>`)}</ul></details>` : ''}
      ${card({ cls: 'span-12 tip', body: html`<p>${ic('bulb', 18)} <span><b>Consejo:</b> una vez al mes compara el saldo de cada cuenta con tu banco. Si no coincide, usa <b>Ajustar</b>: la diferencia queda registrada sin contar como gasto.</span></p>` })}
    </div>`;
}

function statementRows(S, k, id, liab, limit = 120) {
  const st = statement(S, k, id);
  const cats = catMap(S);
  const rows = st.rows.slice(0, limit);
  if (!rows.length) return html`<div class="mini-empty"><p>Aún no hay movimientos aquí.</p></div>`;
  let lastYm = '';
  const out = [];
  for (const r of rows) {
    const ym = r.m.date.slice(0, 7);
    if (ym !== lastYm) { out.push(html`<li class="st-month">${monthLabel(ym)}</li>`); lastYm = ym; }
    const i = moveInfo(S, r.m, cats);
    const shown = liab ? -r.delta : r.delta;
    const act = r.m.virtual ? raw(`data-act="virtual" data-k="${r.m.virtual.k}" data-id="${r.m.virtual.id}"`) : raw(`data-act="edit-move" data-id="${r.m.id}"`);
    out.push(html`<li><button type="button" class="st-row" ${act}>
      <span class="st-d">${fmtDate(r.m.date)}</span>
      <i class="mv-ic sm" style="--c:${raw(i.color)}">${i.icon}</i>
      <span class="st-t"><b>${i.title}</b><small>${i.sub}</small></span>
      <span class="st-a">${amt(shown, { sign: true })}<small>${liab ? 'Usado ' : 'Saldo '}${money(r.bal)}</small></span></button></li>`);
  }
  if (st.rows.length > limit) out.push(html`<li class="muted small center">Se muestran los últimos ${limit} movimientos.</li>`);
  out.push(html`<li class="st-start"><span>${liab ? 'Saldo usado al registrarla' : 'Saldo inicial'}</span><b>${money(st.base)}</b></li>`);
  return html`<ul class="st-list">${out}</ul>`;
}

function accDetail(ctx, id) {
  const { S, today, bal } = ctx;
  const a = entity(S, { k: 'acc', id });
  if (!a) return html`${pageHead({ title: 'Cuenta no encontrada', back: '#/bancos' })}<div class="mini-empty"><p>Esta cuenta ya no existe.</p></div>`;
  const b = bal.acc[a.id] || 0;
  const cur = ymOf(today);
  const pts = [];
  for (let k = 5; k >= 1; k--) { const ym = addMonths(cur, -k); pts.push({ label: monthLabel(ym, { short: true, year: false }), title: 'Fin de ' + monthLabel(ym), value: balances(S, monthEnd(ym)).acc[a.id] || 0 }); }
  pts.push({ label: 'Hoy', title: 'Hoy', value: b });
  let inM = 0, outM = 0;
  for (const m of S.movements) {
    if (m.date.slice(0, 7) !== cur) continue;
    if (m.dst && m.dst.k === 'acc' && m.dst.id === a.id && m.type !== 'adjust') inM += m.amount;
    if (m.src && m.src.k === 'acc' && m.src.id === a.id) outM += m.amount;
  }
  return html`${pageHead({ title: a.name, sub: label(ACC_TYPES, a.type) + (a.last4 ? ' · •' + a.last4 : ''), back: '#/bancos', actions: html`<button class="icon-btn" data-act="ent-edit" data-k="acc" data-id="${a.id}" aria-label="Editar cuenta" title="Editar">${ic('edit', 20)}</button>` })}
    <div class="dash">
      <section class="hero colored span-7" style="--c:${raw(a.color)}"><div class="hero-glow" aria-hidden="true"></div>
        <div class="hero-top"><span>${emojiOf(ACC_TYPES, a.type)} Saldo de hoy</span></div>
        <b class="hero-v">${money(b)}</b>
        <div class="hero-pills"><span class="pill">${ic('up', 14)} Entró este mes: <b>${money(inM)}</b></span><span class="pill">${ic('downleft', 14)} Salió: <b>${money(outM)}</b></span></div>
        <div class="hero-acts">
          <button class="btn on-hero" data-act="ent-move" data-type="expense" data-k="acc" data-id="${a.id}" data-role="src">${ic('downleft', 18)} Gasto</button>
          <button class="btn on-hero" data-act="ent-move" data-type="income" data-k="acc" data-id="${a.id}" data-role="dst">${ic('up', 18)} Ingreso</button>
          <button class="btn on-hero" data-act="ent-move" data-type="transfer" data-k="acc" data-id="${a.id}" data-role="src">${ic('swap', 18)} Transferir</button>
          <button class="btn on-hero" data-act="ent-adjust" data-k="acc" data-id="${a.id}">${ic('scale', 18)} Ajustar saldo</button>
        </div></section>
      ${card({ title: 'Saldo a fin de cada mes', icon: 'trend', cls: 'span-5', body: area(pts, { color: a.color, height: 190 }) })}
      ${card({ title: 'Movimientos', icon: 'list', cls: 'span-12', body: statementRows(S, 'acc', a.id, false), action: html`<button class="btn small ghost" data-act="ent-archive" data-k="acc" data-id="${a.id}">${a.archived ? 'Reactivar' : 'Archivar'}</button>` })}
    </div>`;
}

// ---------- Tarjetas ----------

function ccVisual(c, ci) {
  return html`<div class="cc" style="--c:${raw(c.color)}">
    <div class="cc-shine" aria-hidden="true"></div>
    <div class="cc-top"><span class="cc-chip" aria-hidden="true"></span><span class="cc-net">${c.network || ''}</span></div>
    <div class="cc-num">•••• •••• •••• ${c.last4 || '••••'}</div>
    <div class="cc-bottom"><span><small>Tarjeta</small><b>${c.name}</b></span><span class="right"><small>Usado</small><b>${money(ci.used)}</b></span></div>
  </div>`;
}

function cycleBlock(c, ci) {
  if (!c.cutDay) return html`<p class="muted small">${ic('info', 14)} Registra el día de corte y de pago (en Editar) para saber cuánto pagar y cuándo.</p>`;
  return html`<div class="cycle">
    <div><span>Último corte</span><b>${fmtDate(ci.lastCut, 'medium')}</b></div>
    ${ci.due ? html`<div><span>Pagar hasta</span><b class="${ci.dueAmount > 0 && ci.daysToDue < 0 ? 'neg' : ci.dueAmount > 0 && ci.daysToDue <= 5 ? 'warn' : ''}">${fmtDate(ci.due, 'medium')}</b><small>${ci.dueAmount > 0 ? (ci.daysToDue < 0 ? 'vencido' : relDays(ci.daysToDue)) : ''}</small></div>` : ''}
    <div><span>A pagar (saldo al corte)</span><b>${ci.dueAmount > 0 ? money(ci.dueAmount) : html`<span class="pos">${ic('check', 14)} Pagado</span>`}</b></div>
    <div><span>Compras desde el corte</span><b>${money(ci.newCharges)}</b><small>se pagan el próximo mes</small></div>
  </div>`;
}

function cardsPage(ctx) {
  const { S, today, bal } = ctx;
  const cards = S.cards.filter((c) => !c.archived), arch = S.cards.filter((c) => c.archived);
  const infos = cards.map((c) => ({ c, ci: cardInfo(S, c, today, bal) }));
  const used = infos.reduce((s, x) => s + Math.max(0, x.ci.used), 0), lim = infos.reduce((s, x) => s + (x.c.limit || 0), 0);
  const due = infos.reduce((s, x) => s + (x.ci.dueAmount || 0), 0);
  return html`${pageHead({ title: 'Tarjetas de crédito', sub: 'Cuánto usas, cuánto pagar y cuándo', actions: html`${seg('tarjetas')}<button class="btn primary" data-act="add-card">${ic('plus', 18)} <span class="hide-s">Tarjeta</span></button>` })}
    <div class="dash">
      ${cards.length ? html`<div class="kpis three span-12">
        ${kpi({ label: 'Total usado', value: money(used), icon: 'card', tone: 'neg', sub: lim ? 'de ' + money(lim) + ' de cupo' : '' })}
        ${kpi({ label: 'A pagar este ciclo', value: money(due), icon: 'calendar', tone: 'warn', sub: 'saldo al corte' })}
        ${kpi({ label: 'Uso del cupo', value: lim ? pct(used / lim) : '—', icon: 'pie', tone: lim && used / lim > 0.3 ? 'warn' : 'pos', sub: 'ideal: menos del 30%' })}
      </div>
      <div class="cc-grid span-12">${infos.map(({ c, ci }) => html`<article class="cc-card">
        <a href="#/tarjetas/${c.id}" class="cc-link" aria-label="Ver ${c.name}">${ccVisual(c, ci)}</a>
        <div class="cc-info">
          <div class="cc-nums"><div><span>Disponible</span><b>${ci.available != null ? money(ci.available) : '—'}</b></div><div><span>Cupo</span><b>${ci.limit ? money(ci.limit) : '—'}</b></div></div>
          ${ci.util != null ? html`${bar(ci.util, ci.util > 0.6 ? 'var(--neg)' : ci.util > 0.3 ? 'var(--warn)' : 'var(--pos)')}<small class="muted">Usas el ${pct(ci.util)} del cupo</small>` : ''}
          ${cycleBlock(c, ci)}
          <div class="row-btns left">
            <button class="btn small" data-act="ent-move" data-type="expense" data-k="card" data-id="${c.id}" data-role="src">${ic('downleft', 16)} Compra</button>
            <button class="btn small primary" data-act="ent-move" data-type="pay" data-k="card" data-id="${c.id}" data-role="dst">${ic('check', 16)} Pagar</button>
            <button class="btn small ghost" data-act="ent-adjust" data-k="card" data-id="${c.id}">${ic('scale', 16)} Ajustar</button>
          </div></div></article>`)}
        <button class="cc-add" data-act="add-card">${ic('plus', 26)}<b>Agregar tarjeta</b></button></div>`
      : html`<div class="span-12">${card({ body: html`<div class="empty"><div class="empty-ic">${ic('card', 28)}</div><h3>¿Tienes tarjetas de crédito?</h3><p>Regístralas y te diremos cuánto pagar y hasta qué día para no pagar intereses.</p><button class="btn primary" data-act="add-card">${ic('plus', 18)} Agregar tarjeta</button></div>` })}</div>`}
      ${arch.length ? html`<details class="card span-12 archived"><summary>${ic('down', 18)} Tarjetas archivadas (${arch.length})</summary>
        <ul class="plain-list">${arch.map((c) => html`<li><span>${c.name}</span><b>${money(bal.card[c.id] || 0)}</b><button class="btn small ghost" data-act="ent-archive" data-k="card" data-id="${c.id}">Reactivar</button></li>`)}</ul></details>` : ''}
      ${card({ cls: 'span-12 tip', body: html`<p>${ic('bulb', 18)} <span><b>Cómo se cuentan:</b> cada compra con tarjeta es un gasto del día en que compras. Cuando pagas la tarjeta, el dinero solo pasa de tu banco a la tarjeta (no se cuenta dos veces). Paga el <b>saldo al corte</b> completo antes de la fecha límite y no pagarás intereses.</span></p>` })}
    </div>`;
}

function cardDetail(ctx, id) {
  const { S, today, bal } = ctx;
  const c = entity(S, { k: 'card', id });
  if (!c) return html`${pageHead({ title: 'Tarjeta no encontrada', back: '#/tarjetas' })}<div class="mini-empty"><p>Esta tarjeta ya no existe.</p></div>`;
  const ci = cardInfo(S, c, today, bal);
  return html`${pageHead({ title: c.name, sub: c.network || 'Tarjeta de crédito', back: '#/tarjetas', actions: html`<button class="icon-btn" data-act="ent-edit" data-k="card" data-id="${c.id}" aria-label="Editar tarjeta" title="Editar">${ic('edit', 20)}</button>` })}
    <div class="dash">
      <div class="span-5 cc-detail">${ccVisual(c, ci)}
        <div class="row-btns">
          <button class="btn" data-act="ent-move" data-type="expense" data-k="card" data-id="${c.id}" data-role="src">${ic('downleft', 18)} Compra</button>
          <button class="btn primary" data-act="ent-move" data-type="pay" data-k="card" data-id="${c.id}" data-role="dst">${ic('check', 18)} Pagar</button>
          <button class="btn ghost" data-act="ent-adjust" data-k="card" data-id="${c.id}">${ic('scale', 18)} Ajustar</button>
        </div></div>
      ${card({ title: 'Resumen', icon: 'card', cls: 'span-7', body: html`<div class="cc-nums big"><div><span>Usado</span><b>${money(ci.used)}</b></div><div><span>Disponible</span><b>${ci.available != null ? money(ci.available) : '—'}</b></div><div><span>Cupo</span><b>${ci.limit ? money(ci.limit) : '—'}</b></div></div>
        ${ci.util != null ? bar(ci.util, ci.util > 0.6 ? 'var(--neg)' : ci.util > 0.3 ? 'var(--warn)' : 'var(--pos)', 'big') : ''}${cycleBlock(c, ci)}` })}
      ${card({ title: 'Compras y pagos', icon: 'list', cls: 'span-12', body: statementRows(S, 'card', c.id, true), action: html`<button class="btn small ghost" data-act="ent-archive" data-k="card" data-id="${c.id}">${c.archived ? 'Reactivar' : 'Archivar'}</button>` })}
    </div>`;
}

export { addDays };
