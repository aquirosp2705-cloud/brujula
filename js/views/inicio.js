// Inicio: el tablero con lo importante de un vistazo.

import { html, raw, ic, amt, bar, countUp } from '../ui.js';
import { money, pct, num, monthLabel, fmtDate, relDays, ymOf, addMonths, plural, MES3 } from '../format.js';
import { monthSummary, monthPulse, netWorth, cardInfo, invInfo, upcoming, health, budgetRows, series, goalInfo, monthsToClose, recurringFor, catMap } from '../calc.js';
import { donut, bars, gauge, ring } from '../charts.js';
import { pageHead, card, kpi, LEVEL, linkBtn } from './common.js';
import { APP_NAME, ACC_TYPES, emojiOf } from '../config.js';

export const title = 'Inicio';

export function pulseText(p) {
  const s = p.s;
  if (p.level === 'neutral') return { title: 'Empieza a anotar', text: 'Aún no hay ingresos ni gastos este mes. Toca «+» para anotar el primero.' };
  if (p.base <= 0) return { title: 'Faltan tus ingresos', text: `Llevas ${money(s.expense)} en gastos y todavía no anotas ingresos este mes.` };
  if (p.level === 'bad') return { title: p.when === 'past' ? 'Gastaste más de lo que ganaste' : 'Estás gastando más de lo que ganas', text: `Te pasaste por ${money(-p.left)}${p.usingExpected ? ' de tu ingreso esperado' : ''}.` };
  if (p.level === 'warn') return { title: 'Vas gastando rápido', text: `Llevas el ${pct(p.spentPct)} de tus ingresos${p.usingExpected ? ' esperados' : ''} y va el ${pct(p.elapsed)} del mes.` };
  if (p.when === 'past') return { title: '¡Ahorraste!', text: `Te sobró ${money(p.left)}, el ${pct(s.rate)} de lo que ingresó.` };
  return { title: 'Vas bien', text: `Has usado el ${pct(p.spentPct)} de tus ingresos${p.usingExpected ? ' esperados' : ''}. Te quedan ${money(p.left)}.` };
}

export function pulseCard(p, { compact = false } = {}) {
  const L = LEVEL[p.level], t = pulseText(p);
  const spent = Math.min(1.25, p.spentPct || 0);
  return html`<div class="pulse ${L.cls}">
    <div class="pulse-top"><i class="pulse-ic">${ic(L.icon, 22)}</i><div><b>${t.title}</b><p>${t.text}</p></div></div>
    ${p.base > 0 ? html`<div class="pulse-bar"><div class="bar big ${L.cls}"><i style="width:${(Math.min(1, spent) * 100).toFixed(1)}%"></i></div>
      ${p.when === 'current' ? html`<span class="pulse-mark" style="left:${(p.elapsed * 100).toFixed(1)}%" title="Día ${p.day} de ${p.dim}"></span>` : ''}
      <div class="pulse-legend"><span>Gastado ${money(p.s.expense)}</span><span>${p.usingExpected ? 'Ingreso esperado' : 'Ingresos'} ${money(p.base)}</span></div></div>` : ''}
    ${!compact && p.when === 'current' && p.left > 0 && p.daysLeft > 0 ? html`<div class="pulse-foot">${ic('bulb', 16)}<span>Para terminar el mes sin gastar de más, puedes usar hasta <b>${money(p.perDay)}</b> por día (${p.daysLeft} ${plural(p.daysLeft, 'día', 'días')}).</span></div>` : ''}
  </div>`;
}

const HEALTH_TXT = {
  ahorro: (v) => ['Ahorras el ' + pct(v) + ' de lo que ganas', { good: '¡Excelente! La meta es 20% o más.', warn: 'Vas bien. Intenta llegar al 20%.', bad: 'Estás gastando casi todo lo que ganas (o más).' }],
  fondo: (v) => ['Tu dinero disponible cubre ' + num(v, 1) + ' ' + (Math.round(v * 10) / 10 === 1 ? 'mes' : 'meses') + ' de gastos', { good: 'Tienes un buen colchón para imprevistos.', warn: 'Lo ideal son 6 meses de gastos guardados.', bad: 'Intenta juntar al menos 3 meses de gastos.' }],
  deuda: (v) => ['Tus cuotas son el ' + pct(v) + ' de tus ingresos', { good: 'Nivel sano: menos del 30%.', warn: 'Cuidado: estás cerca del límite (30% a 40%).', bad: 'Muy alto: evita nuevas deudas.' }],
  tarjetas: (v) => ['Usas el ' + pct(v) + ' del cupo de tus tarjetas', { good: 'Bien: menos del 30% del cupo.', warn: 'Trata de bajar del 30% del cupo.', bad: 'Uso alto: puede afectar tu historial de crédito.' }],
};

export function healthBlock(h) {
  if (!h.ind.length) return html`<p class="muted small">Anota tus ingresos y gastos de un mes para ver tu salud financiera.</p>`;
  const color = h.score >= 80 ? 'var(--pos)' : h.score >= 60 ? 'var(--brand)' : h.score >= 40 ? 'var(--warn)' : 'var(--neg)';
  return html`<div class="health">
    <div class="health-g">${gauge(h.score, { color })}<b class="health-l" style="color:${raw(color)}">${h.label}</b></div>
    <ul class="health-list">${h.ind.map((x) => { const [t, tips] = HEALTH_TXT[x.key](x.value); return html`<li class="h-${x.status}"><i class="dot-s"></i><span><b>${t}</b><small>${tips[x.status]}</small></span></li>`; })}</ul>
  </div>`;
}

export function render(ctx) {
  const { S, today, bal } = ctx;
  const ym = ymOf(today);
  const sum = monthSummary(S, ym);
  const pulse = monthPulse(S, ym, today);
  const nw = netWorth(S, bal, today);
  const cats = catMap(S);
  const accs = S.accounts.filter((a) => !a.archived);
  const cards = S.cards.filter((c) => !c.archived);
  const hello = S.settings.name ? `Hola, ${S.settings.name}` : 'Hola';

  // ----- Avisos -----
  const banners = [];
  if (S.settings.demo) banners.push(html`<div class="banner demo">${ic('sparkle', 20)}<span><b>Estás viendo datos de ejemplo.</b> Explora con libertad: nada de esto es real.</span><button class="btn small primary" data-act="demo-exit">Empezar con mis datos</button></div>`);
  const pend = monthsToClose(S, today);
  if (pend.length) banners.push(html`<div class="banner close">${ic('history', 20)}<span><b>${monthLabel(pend[0])} terminó.</b> Ciérralo para guardar tu historial y comparar tus meses.</span><button class="btn small primary" data-act="close-month" data-ym="${pend[0]}">Cerrar ${monthLabel(pend[0], { year: false, capital: false })}</button></div>`);
  if (!ctx.standalone && !S.ui.dismiss.install && !S.settings.demo) banners.push(html`<div class="banner install">${ic('phone', 20)}<span><b>Instala ${APP_NAME}</b> en tu celular o computadora: se abre como una app y funciona sin internet.</span><button class="btn small" data-act="install">Cómo instalar</button><button class="icon-btn" data-act="dismiss" data-k="install" aria-label="Ocultar aviso">${ic('x', 18)}</button></div>`);
  const lb = S.settings.lastBackup;
  if (S.movements.length >= 15 && !S.settings.demo && (!lb || (Date.now() - Date.parse(lb)) / 864e5 > 30)) banners.push(html`<div class="banner backup">${ic('download', 20)}<span><b>Haz una copia de seguridad.</b> Tus datos viven solo en este equipo; guarda una copia por si cambias de celular.</span><button class="btn small" data-act="backup">Descargar copia</button></div>`);

  // ----- Primeros pasos -----
  const steps = [
    { done: accs.length > 0, label: 'Agrega tus cuentas de banco o efectivo', act: 'add-acc', btn: 'Agregar cuenta' },
    { done: S.movements.some((m) => m.type === 'expense' || m.type === 'income'), label: 'Anota tu primer ingreso o gasto', act: 'move', btn: 'Anotar' },
    { done: cards.length > 0 || S.ui.dismiss.cards, label: 'Agrega tus tarjetas de crédito (si tienes)', act: 'add-card', btn: 'Agregar tarjeta', skip: 'cards' },
    { done: S.categories.some((c) => c.budget > 0), label: 'Define cuánto quieres gastar al mes', act: 'budget', btn: 'Presupuesto' },
  ];
  const showSteps = !S.settings.demo && steps.some((s) => !s.done) && !S.ui.dismiss.steps;
  const doneN = steps.filter((s) => s.done).length;

  // ----- Héroe -----
  const cardsUsed = cards.reduce((s, c) => s + Math.max(0, bal.card[c.id] || 0), 0);
  const hero = html`<section class="hero span-7">
    <div class="hero-glow" aria-hidden="true"></div>
    <div class="hero-top"><span>${ic('wallet', 18)} Dinero disponible</span>
      <button class="icon-btn on-hero" data-act="toggle-hide" aria-label="${S.settings.hide ? 'Mostrar montos' : 'Ocultar montos'}" title="${S.settings.hide ? 'Mostrar montos' : 'Ocultar montos'}">${ic(S.settings.hide ? 'eyeoff' : 'eye', 20)}</button></div>
    <b class="hero-v" data-count="${nw.cash}">${money(nw.cash)}</b>
    <div class="hero-sub">${accs.length ? `En ${accs.length} ${plural(accs.length, 'cuenta', 'cuentas')}` : 'Agrega tus cuentas para empezar'}</div>
    <div class="hero-pills">
      ${cards.length ? html`<span class="pill">${ic('card', 15)} Tarjetas: ${money(-cardsUsed)}</span><span class="pill">Si pagas tus tarjetas: <b>${money(nw.cash - cardsUsed)}</b></span>` : ''}
      <span class="pill">${ic('compass', 15)} Patrimonio: <b>${money(nw.total)}</b></span>
    </div>
  </section>`;

  // ----- Indicadores del mes -----
  const lastClosed = Object.keys(S.months).filter((k) => S.months[k].closed && S.months[k].snap && k < ym).sort().pop();
  const prevNW = lastClosed ? Number(S.months[lastClosed].snap.nw && S.months[lastClosed].snap.nw.total) || 0 : null;
  const kpis = html`<div class="kpis span-5">
    ${kpi({ label: 'Ingresos del mes', value: amt(sum.income, { color: false }), sub: `${sum.incomeCount} ${plural(sum.incomeCount, 'ingreso', 'ingresos')}`, icon: 'up', tone: 'pos' })}
    ${kpi({ label: 'Gastos del mes', value: amt(sum.expense, { color: false }), sub: `${sum.expenseCount} ${plural(sum.expenseCount, 'gasto', 'gastos')}`, icon: 'downleft', tone: 'neg' })}
    ${kpi({ label: 'Balance hasta hoy', value: amt(sum.result), sub: pulse.usingExpected ? `Aún esperas ${money(pulse.expected - sum.income)} de ingresos` : sum.rate != null ? `${sum.result >= 0 ? 'Ahorras' : 'Te pasas en'} el ${pct(Math.abs(sum.rate))} de tus ingresos` : 'Sin ingresos aún', icon: 'coins', tone: sum.result >= 0 ? 'brand' : 'neg' })}
    ${kpi({ label: 'Patrimonio neto', value: amt(nw.total, { color: false }), sub: prevNW != null ? html`${amt(nw.total - prevNW, { sign: true })} vs ${monthLabel(lastClosed, { year: false, capital: false })}` : 'Lo que tienes menos lo que debes', icon: 'compass', tone: 'violet' })}
  </div>`;

  // ----- Cuentas -----
  const accCard = card({
    title: 'Saldos por banco', icon: 'bank', cls: 'span-6', action: linkBtn('Ver todo', 'data-act="go" data-to="#/bancos"'),
    body: accs.length ? html`<div class="acc-tiles">${accs.map((a) => html`<a class="acc-tile" href="#/bancos/${a.id}" style="--c:${raw(a.color)}">
        <span class="acc-e">${emojiOf(ACC_TYPES, a.type)}</span><span class="acc-n">${a.name}${a.last4 ? html` <em>•${a.last4}</em>` : ''}</span>
        <b>${amt(bal.acc[a.id] || 0, { color: (bal.acc[a.id] || 0) < 0 })}</b></a>`)}
      <button class="acc-tile add" data-act="add-acc">${ic('plus', 20)}<span>Agregar</span></button></div>`
      : html`<div class="mini-empty"><p>Agrega tu banco, tu efectivo o tu billetera digital.</p><button class="btn primary small" data-act="add-acc">${ic('plus', 16)} Agregar cuenta</button></div>`,
  });

  // ----- Gastos por categoría -----
  const expCats = Object.entries(sum.byCat).filter(([k]) => (cats[k] && cats[k].type === 'expense') || k === '_expense').sort((a, b) => b[1] - a[1]);
  const top = expCats.slice(0, 5), rest = expCats.slice(5).reduce((s, x) => s + x[1], 0);
  const segs = top.map(([k, v]) => ({ value: v, color: cats[k] ? cats[k].color : '#94A3B8', label: cats[k] ? cats[k].name : 'Sin categoría', icon: cats[k] ? cats[k].icon : '❔', id: k }));
  if (rest > 0) segs.push({ value: rest, color: '#CBD5E1', label: 'Otras categorías', icon: '•', id: '' });
  const donutCard = card({
    title: 'Gastos de ' + monthLabel(ym, { year: false, capital: false }), icon: 'pie', cls: 'span-6', action: linkBtn('Detalle', `data-act="go" data-to="#/mes/${ym}"`),
    body: sum.expense > 0 ? html`<div class="donut-wrap">${donut(segs, { center: money(sum.expense, { short: true }), sub: 'gastado' })}
      <ul class="legend">${segs.map((s) => html`<li><a href="#/mes/${ym}${s.id ? '?cat=' + s.id : ''}"><i class="dot" style="background:${raw(s.color)}"></i><span>${s.icon} ${s.label}</span><b>${money(s.value)}</b><em>${pct(s.value / sum.expense)}</em></a></li>`)}</ul></div>`
      : html`<div class="mini-empty"><p>Cuando anotes gastos verás aquí en qué se va tu dinero.</p><button class="btn small" data-act="move" data-type="expense">${ic('plus', 16)} Anotar gasto</button></div>`,
  });

  // ----- Presupuesto -----
  const br = budgetRows(S, ym, sum);
  const budgeted = br.rows.filter((r) => r.budget > 0).sort((a, b) => (b.pct || 0) - (a.pct || 0));
  const budgetCard = card({
    title: 'Presupuesto del mes', icon: 'target', cls: 'span-6', action: linkBtn(budgeted.length ? 'Editar' : 'Definir', 'data-act="budget"'),
    body: budgeted.length ? html`<div class="budget-sum"><span>${money(br.spentBudgeted)} de ${money(br.totalBudget)}</span>${br.over ? html`<em class="tag bad">${br.over} ${plural(br.over, 'categoría pasada', 'categorías pasadas')}</em>` : html`<em class="tag good">Dentro del presupuesto</em>`}</div>
      ${bar(br.totalBudget ? br.spentBudgeted / br.totalBudget : 0, br.spentBudgeted > br.totalBudget ? 'var(--neg)' : 'var(--brand)', 'big')}
      <ul class="brows">${budgeted.slice(0, 5).map((r) => html`<li><span>${r.cat.icon} ${r.cat.name}</span><small class="${r.status}">${r.status === 'over' ? 'Te pasaste ' + money(-r.left) : 'Quedan ' + money(r.left)}</small>${bar(r.pct, r.status === 'over' ? 'var(--neg)' : r.status === 'near' ? 'var(--warn)' : r.cat.color)}</li>`)}</ul>`
      : html`<div class="mini-empty"><p>Pon un límite a tus gastos por categoría y te avisamos cuando te acerques.</p><button class="btn small" data-act="budget">${ic('target', 16)} Definir presupuesto</button></div>`,
  });

  // ----- Próximos pagos -----
  const up = upcoming(S, today, 30, bal).slice(0, 7);
  const upCard = card({
    title: 'Próximos pagos y vencimientos', icon: 'calendar', cls: 'span-6',
    body: up.length ? html`<ul class="up-list">${up.map((u) => html`<li><button type="button" class="up ${u.days < 0 ? 'late' : u.days <= 3 ? 'soon' : ''}" data-act="up" data-kind="${u.kind}" data-id="${u.id}" data-ym="${u.ym || ''}">
        <span class="up-d"><b>${Number(u.date.slice(8))}</b><small>${MES3[Number(u.date.slice(5, 7)) - 1]}</small></span>
        <span class="up-t"><b>${u.icon} ${u.title}</b><small>${u.days < 0 ? 'Venció ' + relDays(u.days) : cap1(relDays(u.days))}</small></span>
        <span class="up-a">${amt(u.income || u.kind === 'cobro' || u.kind === 'inv' ? u.amount : -u.amount, { sign: true })}</span></button></li>`)}</ul>`
      : html`<p class="muted small">No tienes pagos en los próximos 30 días. Registra el día de pago de tus tarjetas y deudas, o tus pagos fijos, para verlos aquí.</p>`,
  });

  // ----- Tarjetas -----
  const cardsCard = card({
    title: 'Tarjetas de crédito', icon: 'card', cls: 'span-6', action: linkBtn('Ver todo', 'data-act="go" data-to="#/tarjetas"'),
    body: cards.length ? html`<ul class="cc-rows">${cards.map((c) => { const ci = cardInfo(S, c, today, bal); return html`<li><a href="#/tarjetas/${c.id}">
        <span class="cc-mini" style="--c:${raw(c.color)}"></span>
        <span class="cc-t"><b>${c.name}</b><small>${ci.limit ? `Usado ${money(ci.used)} de ${money(ci.limit)}` : `Usado ${money(ci.used)}`}</small>${ci.util != null ? bar(ci.util, ci.util > 0.6 ? 'var(--neg)' : ci.util > 0.3 ? 'var(--warn)' : 'var(--pos)') : ''}</span>
        <span class="cc-due">${ci.dueAmount > 0 && ci.due ? html`<b>${money(ci.dueAmount)}</b><small class="${ci.daysToDue < 0 ? 'neg' : ci.daysToDue <= 5 ? 'warn' : ''}">${ci.daysToDue < 0 ? 'vencido' : 'pagar ' + relDays(ci.daysToDue)}</small>` : ci.due ? html`<small class="pos">${ic('check', 14)} Al día</small>` : ''}</span></a></li>`; })}</ul>`
      : html`<div class="mini-empty"><p>Registra tus tarjetas para saber cuánto pagar y cuándo.</p><button class="btn small" data-act="add-card">${ic('plus', 16)} Agregar tarjeta</button></div>`,
  });

  // ----- Ingresos vs gastos -----
  const ser = series(S, today, 6);
  const hasSer = ser.some((x) => x.income || x.expense);
  const barsCard = hasSer ? card({
    title: 'Ingresos y gastos', icon: 'bars', cls: 'span-8', action: linkBtn('Historial', 'data-act="go" data-to="#/historial"'),
    body: html`<div class="legend-inline"><span><i class="dot" style="background:var(--pos)"></i>Ingresos</span><span><i class="dot" style="background:var(--neg)"></i>Gastos</span></div>
      ${bars(ser.map((x) => ({ label: monthLabel(x.ym, { short: true, year: false }), title: monthLabel(x.ym), values: [x.income, x.expense], hl: x.ym === ym })), [{ color: 'var(--pos)', label: 'Ingresos' }, { color: 'var(--neg)', label: 'Gastos' }])}`,
  }) : '';

  // ----- Salud financiera -----
  const h = health(S, today, bal);
  const healthCard = card({ title: 'Salud financiera', icon: 'heart', cls: hasSer ? 'span-4' : 'span-6', body: healthBlock(h) });

  // ----- Metas -----
  const goals = S.goals.map((g) => ({ g, i: goalInfo(g, today) })).filter((x) => !x.i.done).slice(0, 3);
  const goalsCard = card({
    title: 'Metas de ahorro', icon: 'target', cls: 'span-6', action: linkBtn(S.goals.length ? 'Ver todas' : 'Crear', S.goals.length ? 'data-act="go" data-to="#/metas"' : 'data-act="add-goal"'),
    body: goals.length ? html`<ul class="goal-mini">${goals.map(({ g, i }) => html`<li><a href="#/metas">${ring(i.pct, { size: 58, color: g.color })}<span><b>${g.icon} ${g.name}</b><small>${money(i.saved)} de ${money(i.target)}${i.perMonth ? ` · ${money(i.perMonth)}/mes` : ''}</small></span></a></li>`)}</ul>`
      : html`<div class="mini-empty"><p>Ponle nombre a tus sueños: un viaje, un fondo de emergencia, tu casa.</p><button class="btn small" data-act="add-goal">${ic('plus', 16)} Crear meta</button></div>`,
  });

  // ----- Inversiones -----
  const invs = S.investments.filter((x) => x.status !== 'cobrada').map((x) => ({ x, i: invInfo(x, bal, today) }));
  const invTotal = invs.reduce((s, y) => s + y.i.current, 0), invMonthly = invs.reduce((s, y) => s + (y.i.monthly || 0), 0);
  const nextInv = invs.filter((y) => y.x.type === 'plazo' && y.x.end).sort((a, b) => (a.x.end < b.x.end ? -1 : 1))[0];
  const invCard = card({
    title: 'Inversiones', icon: 'trend', cls: 'span-6', action: linkBtn(invs.length ? 'Ver todas' : 'Agregar', invs.length ? 'data-act="go" data-to="#/inversiones"' : 'data-act="add-inv"'),
    body: invs.length ? html`<div class="inv-mini"><div><span>Valor hoy</span><b>${money(invTotal)}</b></div><div><span>Te generan aprox.</span><b class="pos">${money(invMonthly)}<small>/mes</small></b></div>
      ${nextInv ? html`<div class="wide"><span>Próximo vencimiento</span><b>${nextInv.x.name}</b><small>${fmtDate(nextInv.x.end, 'medium')} · ${cap1(relDays(nextInv.i.daysToEnd))}</small></div>` : ''}</div>`
      : html`<div class="mini-empty"><p>Lleva tus pólizas, fondos y acciones con sus intereses y vencimientos.</p><button class="btn small" data-act="add-inv">${ic('plus', 16)} Agregar inversión</button></div>`,
  });

  // ----- Pagos fijos del mes -----
  const recs = recurringFor(S, ym);
  const recCard = recs.length ? card({
    title: 'Pagos fijos de ' + monthLabel(ym, { year: false, capital: false }), icon: 'repeat', cls: 'span-6', action: linkBtn('Editar', 'data-act="go" data-to="#/ajustes/fijos"'),
    body: html`<ul class="rec-list">${recs.map((x) => html`<li class="${x.done ? 'done' : ''}">
      <i class="cat-ic sm" style="--c:${raw((cats[x.r.cat] && cats[x.r.cat].color) || '#94A3B8')}">${(cats[x.r.cat] && cats[x.r.cat].icon) || '🔁'}</i>
      <span><b>${x.r.name}</b><small>${x.done ? 'Anotado el ' + fmtDate(x.done.date) : 'Día ' + x.r.day}</small></span>
      ${x.done ? html`<span class="ok-badge">${ic('check', 16)} ${money(x.done.amount)}</span>` : html`<button class="btn small" data-act="rec-do" data-id="${x.r.id}" data-ym="${ym}">Anotar ${money(x.r.amount)}</button>`}</li>`)}</ul>`,
  }) : '';

  return html`
    ${pageHead({ title: hello + ' 👋', sub: fmtDate(today, 'day'), actions: html`<button class="btn primary hide-m" data-act="move">${ic('plus', 18)} Anotar</button>` })}
    <div class="dash">
      ${banners.length ? html`<div class="span-12 banners">${banners}</div>` : ''}
      ${showSteps ? html`<section class="card steps span-12"><header class="card-head"><h2><i class="card-ic">${ic('flag', 18)}</i>Primeros pasos <em class="tag">${doneN} de ${steps.length}</em></h2><button class="icon-btn" data-act="dismiss" data-k="steps" aria-label="Ocultar primeros pasos">${ic('x', 18)}</button></header>
        ${bar(doneN / steps.length, 'var(--brand)')}
        <ol class="step-list">${steps.map((s) => html`<li class="${s.done ? 'done' : ''}"><i>${s.done ? ic('check', 16) : ''}</i><span>${s.label}</span>${s.done ? '' : html`<button class="btn small" data-act="${s.act}">${s.btn}</button>${s.skip ? html`<button class="link-btn small" data-act="dismiss" data-k="${s.skip}">No tengo</button>` : ''}`}</li>`)}</ol></section>` : ''}
      ${hero}${kpis}
      ${card({ title: '¿Cómo vas este mes?', icon: 'lightning', cls: 'span-6', body: pulseCard(pulse) })}
      ${accCard}
      ${donutCard}${budgetCard}
      ${upCard}${cardsCard}
      ${barsCard}${healthCard}
      ${recCard}${goalsCard}${invCard}
    </div>`;
}

const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function mount(el, ctx) {
  if (!ctx.first) return;
  const v = el.querySelector('.hero-v');
  if (v && !ctx.S.settings.hide) countUp(v, Number(v.dataset.count) || 0, (x) => money(x));
}
