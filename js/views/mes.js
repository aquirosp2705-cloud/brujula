// Ingresos y gastos: vista del mes (resumen, presupuesto, categorías, movimientos) y vista del año.

import { html, raw, ic, amt, bar } from '../ui.js';
import { money, pct, monthLabel, ymOf, fmtDate, plural } from '../format.js';
import { monthSummary, monthPulse, budgetRows, yearSummary, catMap, filterMoves, isClosed, firstMonth } from '../calc.js';
import { donut, bars, stack } from '../charts.js';
import { pageHead, card, kpi, dayGroups, monthNav, linkBtn } from './common.js';
import { pulseCard } from './inicio.js';
import { GROUPS } from '../config.js';

export const title = 'Ingresos y gastos';

const vs = { type: 'all', q: '', key: '' };

function header(mode, ctx, extra = '') {
  return pageHead({
    title: 'Ingresos y gastos',
    actions: html`<div class="seg small" role="tablist"><a class="seg-b ${mode === 'mes' ? 'on' : ''}" href="#/mes/${ymOf(ctx.today)}" role="tab" aria-selected="${mode === 'mes'}">Mes</a><a class="seg-b ${mode === 'anio' ? 'on' : ''}" href="#/anio/${ctx.today.slice(0, 4)}" role="tab" aria-selected="${mode === 'anio'}">Año</a></div>${extra}<button class="btn primary hide-m" data-act="move">${ic('plus', 18)} Anotar</button>`,
  });
}

export function render(ctx) {
  return ctx.route.name === 'anio' ? renderYear(ctx) : renderMonth(ctx);
}

function renderMonth(ctx) {
  const { S, today } = ctx;
  const p1 = ctx.route.parts[1];
  const ym = /^\d{4}-\d{2}$/.test(p1 || '') ? p1 : ymOf(today);
  const key = ym + '|' + (ctx.route.query.get('cat') || '');
  if (vs.key !== key) { vs.key = key; vs.type = ctx.route.query.get('t') || 'all'; vs.q = ''; }
  const sum = monthSummary(S, ym);
  const pulse = monthPulse(S, ym, today);
  const cats = catMap(S);
  const closed = isClosed(S, ym);
  const cur = ymOf(today);
  const mm = S.months[ym];

  let status = '';
  if (closed) status = html`<div class="banner closed">${ic('check', 20)}<span><b>Mes cerrado</b>${mm.closedAt ? ' el ' + fmtDate(mm.closedAt.slice(0, 10), 'long') : ''}. Sus números quedaron guardados en tu historial.</span><button class="btn small" data-act="reopen-month" data-ym="${ym}">Reabrir</button></div>`;
  else if (ym < cur && ym >= firstMonth(S)) status = html`<div class="banner close">${ic('history', 20)}<span><b>Este mes ya terminó.</b> Ciérralo para guardarlo en tu historial.</span><button class="btn small primary" data-act="close-month" data-ym="${ym}">Cerrar mes</button></div>`;

  // Gastos por categoría
  const exp = Object.entries(sum.byCat).filter(([k]) => (cats[k] && cats[k].type === 'expense') || k === '_expense').sort((a, b) => b[1] - a[1]);
  const inc = Object.entries(sum.byCat).filter(([k]) => (cats[k] && cats[k].type === 'income') || k === '_income').sort((a, b) => b[1] - a[1]);
  const br = budgetRows(S, ym, sum);
  const bmap = {}; for (const r of br.rows) bmap[r.cat.id] = r;
  const segs = exp.map(([k, v]) => ({ value: v, color: cats[k] ? cats[k].color : '#94A3B8', label: cats[k] ? cats[k].name : 'Sin categoría' }));
  const catFilter = ctx.route.query.get('cat') || '';

  const expCard = card({
    title: 'Gastos por categoría', icon: 'pie', cls: 'span-7', action: linkBtn('Presupuesto', 'data-act="budget"'),
    body: sum.expense > 0 || br.totalBudget > 0 ? html`<div class="donut-wrap wide">${sum.expense > 0 ? donut(segs, { center: money(sum.expense, { short: true }), sub: 'gastado' }) : ''}
      <ul class="cat-rows">${br.rows.map((r) => html`<li class="${catFilter === r.cat.id ? 'sel' : ''}"><a href="#/mes/${ym}${catFilter === r.cat.id ? '' : '?cat=' + r.cat.id}">
        <i class="cat-ic sm" style="--c:${raw(r.cat.color)}">${r.cat.icon}</i>
        <span class="cr-t"><b>${r.cat.name}</b>${r.budget > 0 ? html`<small class="${r.status}">${money(r.spent)} de ${money(r.budget)}${r.status === 'over' ? ' · te pasaste ' + money(-r.left) : ''}</small>${bar(r.pct, r.status === 'over' ? 'var(--neg)' : r.status === 'near' ? 'var(--warn)' : r.cat.color)}` : html`<small>${sum.expense > 0 ? pct(r.spent / sum.expense) + ' del gasto' : ''}</small>`}</span>
        <b class="cr-a">${money(r.spent)}</b></a></li>`)}</ul></div>`
      : html`<p class="muted small">Sin gastos en ${monthLabel(ym, { capital: false })}.</p>`,
  });

  // Ingresos por categoría + regla 50/30/20
  const base = sum.income > 0 ? sum.income : 0;
  const g = sum.byGroup;
  const ahorro = Math.max(0, sum.result);
  const rule = base > 0 ? html`<div class="rule">
      ${stack([{ value: g.nec, color: GROUPS.nec.color, label: 'Necesidades' }, { value: g.gus, color: GROUPS.gus.color, label: 'Gustos' }, { value: g.deu, color: GROUPS.deu.color, label: 'Deudas' }, { value: ahorro, color: 'var(--pos)', label: 'Ahorro' }])}
      <ul class="rule-list">
        <li><i class="dot" style="background:${raw(GROUPS.nec.color)}"></i><span>Necesidades</span><b>${pct(g.nec / base)}</b><small class="${g.nec / base <= 0.5 ? 'pos' : 'warn'}">meta: hasta 50%</small></li>
        <li><i class="dot" style="background:${raw(GROUPS.gus.color)}"></i><span>Gustos</span><b>${pct(g.gus / base)}</b><small class="${g.gus / base <= 0.3 ? 'pos' : 'warn'}">meta: hasta 30%</small></li>
        <li><i class="dot" style="background:${raw(GROUPS.deu.color)}"></i><span>Pago de deudas</span><b>${pct(g.deu / base)}</b><small></small></li>
        <li><i class="dot" style="background:var(--pos)"></i><span>Ahorro</span><b>${pct(ahorro / base)}</b><small class="${(ahorro + g.deu) / base >= 0.2 ? 'pos' : 'warn'}">ahorro + deudas: 20% o más</small></li>
      </ul></div>` : html`<p class="muted small">Anota tus ingresos para ver cómo repartes tu dinero (regla 50/30/20).</p>`;
  const incCard = card({
    title: 'Ingresos y reparto', icon: 'up', cls: 'span-5',
    body: html`${inc.length ? html`<ul class="cat-rows compact">${inc.map(([k, v]) => html`<li><a href="#/mes/${ym}${catFilter === k ? '' : '?cat=' + k}"><i class="cat-ic sm" style="--c:${raw(cats[k] ? cats[k].color : '#94A3B8')}">${cats[k] ? cats[k].icon : '❔'}</i><span class="cr-t"><b>${cats[k] ? cats[k].name : 'Sin categoría'}</b></span><b class="cr-a pos">${money(v)}</b></a></li>`)}</ul>` : ''}
      <h3 class="sub-h">¿Cómo repartiste tus ingresos?</h3>${rule}`,
  });

  const list = html`<section class="card span-12">
    <header class="card-head"><h2><i class="card-ic">${ic('list', 18)}</i>Movimientos</h2><span class="muted small" data-count></span></header>
    <div class="mv-tools">
      <div class="seg small" role="tablist" aria-label="Filtrar por tipo">${[['all', 'Todos'], ['expense', 'Gastos'], ['income', 'Ingresos'], ['transfer', 'Transferencias']].map(([k, l]) => html`<button type="button" class="seg-b ${vs.type === k ? 'on' : ''}" data-act="mv-type" data-t="${k}" role="tab" aria-selected="${vs.type === k}">${l}</button>`)}</div>
      <label class="search">${ic('search', 18)}<input type="search" data-mv-q placeholder="Buscar" value="${vs.q}" aria-label="Buscar movimientos"></label>
    </div>
    ${catFilter ? html`<div class="filter-chip">Categoría: <b>${cats[catFilter] ? cats[catFilter].icon + ' ' + cats[catFilter].name : 'Sin categoría'}</b><a class="icon-btn" href="#/mes/${ym}" aria-label="Quitar filtro">${ic('x', 16)}</a></div>` : ''}
    <div id="mv-list" class="mv-list"></div>
  </section>`;

  return html`${header('mes', ctx, !closed && ym >= firstMonth(S) && ym <= cur ? html`<button class="btn ghost hide-m" data-act="close-month" data-ym="${ym}">${ic('history', 18)} Cerrar mes</button>` : '')}
    ${monthNav(ym, (x) => '#/mes/' + x)}
    <div class="dash">
      ${status ? html`<div class="span-12">${status}</div>` : ''}
      <div class="kpis four span-12">
        ${kpi({ label: 'Ingresos', value: amt(sum.income, { color: false }), icon: 'up', tone: 'pos', sub: `${sum.incomeCount} ${plural(sum.incomeCount, 'ingreso', 'ingresos')}` })}
        ${kpi({ label: 'Gastos', value: amt(sum.expense, { color: false }), icon: 'downleft', tone: 'neg', sub: `${sum.expenseCount} ${plural(sum.expenseCount, 'gasto', 'gastos')}` })}
        ${kpi({ label: ym === ymOf(today) ? 'Balance hasta hoy' : sum.result >= 0 ? 'Te sobró' : 'Te faltó', value: amt(sum.result), icon: 'coins', tone: sum.result >= 0 ? 'brand' : 'neg', sub: pulse.usingExpected ? `Aún esperas ${money(pulse.expected - sum.income)}` : ym === ymOf(today) ? 'ingresos menos gastos' : 'en el mes' })}
        ${pulse.usingExpected
          ? kpi({ label: 'Ahorro esperado', value: pct((pulse.expected - sum.expense) / pulse.expected), icon: 'target', tone: 'violet', sub: 'si recibes lo esperado' })
          : kpi({ label: 'Ahorro', value: sum.rate != null ? pct(sum.rate) : '—', icon: 'target', tone: 'violet', sub: 'de tus ingresos' })}
      </div>
      ${card({ title: ym === ymOf(today) ? '¿Cómo vas?' : '¿Cómo te fue?', icon: 'lightning', cls: 'span-12', body: pulseCard(pulse, { compact: ym !== ymOf(today) }) })}
      ${expCard}${incCard}
      ${list}
    </div>`;
}

function renderList(el, ctx) {
  const { S, today } = ctx;
  const p1 = ctx.route.parts[1];
  const ym = /^\d{4}-\d{2}$/.test(p1 || '') ? p1 : ymOf(today);
  const cat = ctx.route.query.get('cat') || '';
  const list = filterMoves(S, { ym, type: vs.type, q: vs.q, cat: cat.startsWith('_') ? '' : cat });
  const box = el.querySelector('#mv-list');
  if (!box) return;
  const c = el.querySelector('[data-count]');
  if (c) c.textContent = list.length ? `${list.length} ${plural(list.length, 'movimiento', 'movimientos')}` : '';
  box.innerHTML = list.length ? dayGroups(S, list, today).map((x) => x.s).join('')
    : html`<div class="mini-empty"><p>${vs.q || cat || vs.type !== 'all' ? 'No hay movimientos con ese filtro.' : 'Aún no hay movimientos en este mes.'}</p>${vs.q || cat || vs.type !== 'all' ? '' : html`<button class="btn small primary" data-act="move">${ic('plus', 16)} Anotar</button>`}</div>`.s;
}

function renderYear(ctx) {
  const { S, today } = ctx;
  const p1 = ctx.route.parts[1];
  const year = /^\d{4}$/.test(p1 || '') ? Number(p1) : Number(today.slice(0, 4));
  const y = yearSummary(S, year, today);
  const cats = catMap(S);
  const cur = ymOf(today);
  const expCats = Object.entries(y.byCat).filter(([k]) => cats[k] && cats[k].type === 'expense').sort((a, b) => b[1] - a[1]);
  const maxCat = expCats.length ? expCats[0][1] : 1;
  return html`${header('anio', ctx)}
    <div class="month-nav"><a class="icon-btn" href="#/anio/${year - 1}" aria-label="Año anterior">${ic('left', 20)}</a><b>${year}</b><a class="icon-btn" href="#/anio/${year + 1}" aria-label="Año siguiente">${ic('right', 20)}</a></div>
    <div class="dash">
      <div class="kpis four span-12">
        ${kpi({ label: 'Ingresos del año', value: amt(y.income, { color: false }), icon: 'up', tone: 'pos' })}
        ${kpi({ label: 'Gastos del año', value: amt(y.expense, { color: false }), icon: 'downleft', tone: 'neg' })}
        ${kpi({ label: y.result >= 0 ? 'Ahorro del año' : 'Déficit del año', value: amt(y.result), icon: 'coins', tone: y.result >= 0 ? 'brand' : 'neg', sub: y.rate != null ? pct(y.rate) + ' de tus ingresos' : '' })}
        ${kpi({ label: 'Gasto promedio al mes', value: amt(y.avgExpense, { color: false }), icon: 'calendar', tone: 'violet', sub: `Ingreso promedio ${money(y.avgIncome)}` })}
      </div>
      ${card({
        title: 'Mes a mes', icon: 'bars', cls: 'span-12',
        body: html`<div class="legend-inline"><span><i class="dot" style="background:var(--pos)"></i>Ingresos</span><span><i class="dot" style="background:var(--neg)"></i>Gastos</span></div>
          ${bars(y.months.map((m) => ({ label: monthLabel(m.ym, { short: true, year: false }), title: monthLabel(m.ym), values: [m.income, m.expense], hl: m.ym === cur })), [{ color: 'var(--pos)', label: 'Ingresos' }, { color: 'var(--neg)', label: 'Gastos' }])}`,
      })}
      ${card({
        title: 'Resumen por mes', icon: 'calendar', cls: 'span-7',
        body: html`<div class="table-wrap"><table class="tbl"><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Resultado</th><th>Ahorro</th></tr></thead><tbody>
          ${y.months.map((m) => html`<tr class="${m.count ? '' : 'dim'}"><td><a href="#/mes/${m.ym}">${monthLabel(m.ym, { year: false })}</a>${isClosed(S, m.ym) ? html` <i class="closed-ic" title="Cerrado">${ic('check', 14)}</i>` : ''}</td><td>${money(m.income)}</td><td>${money(m.expense)}</td><td>${amt(m.result)}</td><td>${m.rate != null ? pct(m.rate) : '—'}</td></tr>`)}
          </tbody><tfoot><tr><th>Total</th><th>${money(y.income)}</th><th>${money(y.expense)}</th><th>${amt(y.result)}</th><th>${y.rate != null ? pct(y.rate) : '—'}</th></tr></tfoot></table></div>`,
      })}
      ${card({
        title: 'En qué gastaste este año', icon: 'pie', cls: 'span-5',
        body: expCats.length ? html`<ul class="year-cats">${expCats.slice(0, 10).map(([k, v]) => html`<li><span>${cats[k].icon} ${cats[k].name}</span><b>${money(v)}</b>${bar(v / maxCat, cats[k].color)}<small>${pct(v / y.expense)} · ${money(v / Math.max(1, y.monthsCounted))}/mes</small></li>`)}</ul>` : html`<p class="muted small">Sin gastos en ${year}.</p>`,
      })}
    </div>`;
}

export function mount(el, ctx) { if (ctx.route.name !== 'anio') renderList(el, ctx); }

export const actions = {
  'mv-type': (b, ctx, el) => {
    vs.type = b.dataset.t;
    el.querySelectorAll('[data-act="mv-type"]').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    renderList(el, ctx);
  },
};

export function onInput(e, ctx, el) {
  if (!e.target.matches('[data-mv-q]')) return;
  vs.q = e.target.value;
  renderList(el, ctx);
}
