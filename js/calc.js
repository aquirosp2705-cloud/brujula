// Cálculos financieros. Funciones puras: reciben el estado y devuelven números (no tocan la pantalla).
//
// Cómo se calculan los saldos (una sola fuente de verdad: los movimientos):
//   · Cuenta (activo):        saldo inicial + entradas − salidas + ajustes
//   · Tarjeta (pasivo):       usado inicial + compras − pagos − devoluciones + ajustes
//   · Inversión (activo):     capital + aportes − retiros + intereses capitalizados + ajustes de valor
//   · Deuda «debo» (pasivo):  saldo inicial − capital pagado + desembolsos + ajustes
//   · Deuda «me deben» (activo): saldo inicial + lo que presto − lo que me devuelven + ajustes
// Un gasto pagado con tarjeta cuenta como gasto el día de la compra; el pago de la tarjeta es solo un movimiento de
// dinero (no se cuenta dos veces). Una cuota de préstamo es gasto y además baja el saldo de la deuda (solo el capital).

import { ymOf, monthEnd, daysInMonth, diffDays, addDays, addMonths, dayInMonth, monthsBetween, round2 } from './format.js';

export const byId = (list, id) => list.find((x) => x.id === id) || null;
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const avg = (xs) => (xs.length ? sum(xs) / xs.length : 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function catMap(S) { const o = {}; for (const c of S.categories) o[c.id] = c; return o; }

export function entity(S, r) {
  if (!r) return null;
  const list = r.k === 'acc' ? S.accounts : r.k === 'card' ? S.cards : r.k === 'inv' ? S.investments : r.k === 'debt' ? S.debts : [];
  return byId(list, r.id);
}
export function entityName(S, r) { const e = entity(S, r); return e ? e.name : r ? '(eliminada)' : ''; }

function kindOfFactory(S) {
  const asset = new Set(), liab = new Set();
  for (const a of S.accounts) asset.add('acc:' + a.id);
  for (const i of S.investments) asset.add('inv:' + i.id);
  for (const c of S.cards) liab.add('card:' + c.id);
  for (const d of S.debts) (d.direction === 'me_deben' ? asset : liab).add('debt:' + d.id);
  return (r) => { if (!r) return null; const k = r.k + ':' + r.id; return asset.has(k) ? 'asset' : liab.has(k) ? 'liab' : null; };
}

/** Efecto de un movimiento sobre cada cuenta, tarjeta, inversión o deuda: lista de [tipo, id, cambio de saldo]. */
export function effects(m, kindOf) {
  const out = [], a = Number(m.amount) || 0;
  const push = (r, dir, amt) => {
    if (!r) return;
    const t = kindOf(r);
    if (!t) return;
    out.push([r.k, r.id, (t === 'liab' ? -dir : dir) * amt]);
  };
  if (m.type === 'expense') {
    push(m.src, -1, a);
    if (m.dst) push(m.dst, +1, Math.max(0, a - (Number(m.interest) || 0)));
  } else if (m.type === 'income') push(m.dst, +1, a);
  else if (m.type === 'transfer') { push(m.src, -1, a); push(m.dst, +1, a); }
  else if (m.type === 'adjust') { if (m.dst && kindOf(m.dst)) out.push([m.dst.k, m.dst.id, a]); }
  return out;
}

/**
 * Movimientos que no escribe la persona pero que mueven dinero de una cuenta al registrar algo:
 * una inversión pagada desde una cuenta, un préstamo recibido en una cuenta o un préstamo entregado desde una cuenta.
 * Se generan desde el propio registro, así que si se edita el monto, la cuenta se corrige sola.
 */
export function virtualMoves(S) {
  const out = [];
  for (const i of S.investments) {
    if (i.acc && i.capital > 0) out.push({ id: 'v_inv_' + i.id, virtual: { k: 'inv', id: i.id }, type: 'transfer', date: i.opened || i.start, amount: i.capital, src: { k: 'acc', id: i.acc }, note: 'Inversión: ' + i.name, createdAt: i.createdAt || '' });
  }
  for (const d of S.debts) {
    if (!d.acc || !(d.initial > 0)) continue;
    if (d.direction === 'me_deben') out.push({ id: 'v_debt_' + d.id, virtual: { k: 'debt', id: d.id }, type: 'transfer', date: d.start, amount: d.initial, src: { k: 'acc', id: d.acc }, note: 'Préstamo entregado: ' + d.name, createdAt: d.createdAt || '' });
    else out.push({ id: 'v_debt_' + d.id, virtual: { k: 'debt', id: d.id }, type: 'transfer', date: d.start, amount: d.initial, dst: { k: 'acc', id: d.acc }, note: 'Préstamo recibido: ' + d.name, createdAt: d.createdAt || '' });
  }
  return out;
}

export function allMoves(S) { return S.movements.concat(virtualMoves(S)); }

const startOf = (e) => e.since || e.opened || e.start || '';

/** Saldos de todo a una fecha (o a hoy si upTo es null). */
export function balances(S, upTo = null) {
  const b = { acc: {}, card: {}, inv: {}, debt: {}, invIn: {} };
  // Cuentas y tarjetas: el saldo inicial cuenta siempre. Inversiones y deudas: desde su fecha de inicio.
  const born = (e) => !upTo || !startOf(e) || startOf(e) <= upTo;
  for (const a of S.accounts) b.acc[a.id] = a.initial || 0;
  for (const c of S.cards) b.card[c.id] = c.initial || 0;
  for (const i of S.investments) { const v = born(i) ? i.capital || 0 : 0; b.inv[i.id] = v; b.invIn[i.id] = v; }
  for (const d of S.debts) b.debt[d.id] = born(d) ? d.initial || 0 : 0;
  const kindOf = kindOfFactory(S);
  for (const m of allMoves(S)) {
    if (upTo && m.date > upTo) continue;
    for (const [k, id, delta] of effects(m, kindOf)) if (b[k] && id in b[k]) b[k][id] += delta;
    if (m.type === 'transfer' && !m.virtual) {
      if (m.dst && m.dst.k === 'inv' && m.dst.id in b.invIn) b.invIn[m.dst.id] += m.amount;
      if (m.src && m.src.k === 'inv' && m.src.id in b.invIn) b.invIn[m.src.id] -= m.amount;
    }
  }
  for (const k of Object.keys(b)) for (const id of Object.keys(b[k])) b[k][id] = round2(b[k][id]);
  return b;
}

/** Estado de cuenta de una cuenta/tarjeta/inversión/deuda: filas con saldo acumulado (más reciente primero). */
export function statement(S, k, id) {
  const e = entity(S, { k, id });
  if (!e) return { base: 0, rows: [] };
  const base = k === 'inv' ? e.capital || 0 : e.initial || 0;
  const kindOf = kindOfFactory(S);
  const all = allMoves(S).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || '') < (b.createdAt || '') ? -1 : 1));
  const rows = [];
  let bal = base;
  for (const m of all) {
    let d = 0, hit = false;
    for (const [kk, ii, delta] of effects(m, kindOf)) if (kk === k && ii === id) { d += delta; hit = true; }
    if (!hit) continue;
    bal += d;
    rows.push({ m, delta: round2(d), bal: round2(bal) });
  }
  return { base, rows: rows.reverse() };
}

// ---------- Ingresos y gastos ----------

export function monthSummary(S, ym) {
  const cats = catMap(S);
  const r = { ym, income: 0, expense: 0, byCat: {}, byGroup: { nec: 0, gus: 0, deu: 0 }, count: 0, incomeCount: 0, expenseCount: 0 };
  for (const m of S.movements) {
    if (m.type !== 'income' && m.type !== 'expense') continue;
    if (m.date.slice(0, 7) !== ym) continue;
    r.count++;
    const key = m.cat && cats[m.cat] ? m.cat : '_' + m.type;
    r.byCat[key] = (r.byCat[key] || 0) + m.amount;
    if (m.type === 'income') { r.income += m.amount; r.incomeCount++; }
    else {
      r.expense += m.amount; r.expenseCount++;
      const g = (cats[m.cat] && cats[m.cat].group) || 'gus';
      r.byGroup[g] = (r.byGroup[g] || 0) + m.amount;
    }
  }
  r.income = round2(r.income);
  r.expense = round2(r.expense);
  r.result = round2(r.income - r.expense);
  r.rate = r.income > 0 ? r.result / r.income : null;
  for (const k of Object.keys(r.byCat)) r.byCat[k] = round2(r.byCat[k]);
  for (const k of Object.keys(r.byGroup)) r.byGroup[k] = round2(r.byGroup[k]);
  return r;
}

export function yearSummary(S, year, today) {
  const months = [];
  for (let i = 1; i <= 12; i++) months.push(monthSummary(S, year + '-' + String(i).padStart(2, '0')));
  const income = round2(sum(months.map((m) => m.income)));
  const expense = round2(sum(months.map((m) => m.expense)));
  const lastYm = ymOf(today);
  const counted = months.filter((m) => m.count > 0 || (m.ym <= lastYm && m.ym >= firstMonth(S)));
  const n = Math.max(1, counted.length);
  const byCat = {};
  for (const m of months) for (const [k, v] of Object.entries(m.byCat)) byCat[k] = round2((byCat[k] || 0) + v);
  return { year, months, income, expense, result: round2(income - expense), rate: income > 0 ? (income - expense) / income : null, avgIncome: income / n, avgExpense: expense / n, byCat, monthsCounted: counted.length };
}

export function budgetOf(S, ym) {
  const mm = S.months[ym];
  if (mm && mm.closed && mm.snap && mm.snap.budget) return mm.snap.budget;
  const out = {};
  for (const c of S.categories) if (c.type === 'expense' && c.budget > 0 && !c.archived) out[c.id] = c.budget;
  return out;
}

export function budgetRows(S, ym, s = monthSummary(S, ym)) {
  const budget = budgetOf(S, ym);
  const rows = [];
  for (const c of S.categories) {
    if (c.type !== 'expense') continue;
    const b = Number(budget[c.id]) || 0, spent = s.byCat[c.id] || 0;
    if (b <= 0 && spent <= 0) continue;
    rows.push({ cat: c, budget: b, spent, left: round2(b - spent), pct: b > 0 ? spent / b : null, status: b <= 0 ? 'none' : spent > b + 0.005 ? 'over' : spent >= b * 0.85 ? 'near' : 'ok' });
  }
  if (s.byCat._expense) rows.push({ cat: { id: '_expense', name: 'Sin categoría', icon: '❔', color: '#94A3B8' }, budget: 0, spent: s.byCat._expense, left: 0, pct: null, status: 'none' });
  rows.sort((a, b) => (b.budget > 0) - (a.budget > 0) || b.spent - a.spent);
  const totalBudget = round2(sum(Object.values(budget).map(Number).filter((x) => x > 0)));
  const spentBudgeted = round2(sum(rows.filter((r) => r.budget > 0).map((r) => r.spent)));
  return { rows, totalBudget, spentBudgeted, over: rows.filter((r) => r.status === 'over').length };
}

/** ¿Cómo voy este mes? Compara lo gastado con lo que ingresó (o con el ingreso esperado si aún no llega). */
export function monthPulse(S, ym, today) {
  const s = monthSummary(S, ym);
  const dim = daysInMonth(ym), cur = ymOf(today);
  const when = ym === cur ? 'current' : ym < cur ? 'past' : 'future';
  const day = when === 'current' ? Number(today.slice(8, 10)) : when === 'past' ? dim : 0;
  const expected = when === 'past' ? 0 : S.settings.expectedIncome || 0;
  const base = Math.max(s.income, expected);
  const usingExpected = expected > s.income;
  const spentPct = base > 0 ? s.expense / base : null;
  const elapsed = day / dim;
  const left = round2(base - s.expense);
  const daysLeft = when === 'current' ? dim - day + 1 : 0;
  const perDay = daysLeft > 0 && left > 0 ? left / daysLeft : 0;
  let level;
  if (base <= 0 && s.expense <= 0) level = 'neutral';
  else if (base <= 0) level = 'warn';
  else if (s.expense > base + 0.005) level = 'bad';
  else if (when === 'current' && spentPct > elapsed + 0.15) level = 'warn';
  else level = 'good';
  return { s, when, base, usingExpected, expected, spentPct, elapsed, left, daysLeft, perDay, level, day, dim };
}

// ---------- Tarjetas ----------

function lastDateWithDay(today, day) {
  const ym = ymOf(today);
  let d = dayInMonth(ym, day);
  if (d > today) d = dayInMonth(addMonths(ym, -1), day);
  return d;
}
function nextDateWithDay(after, day) {
  const ym = ymOf(after);
  let d = dayInMonth(ym, day);
  if (d <= after) d = dayInMonth(addMonths(ym, 1), day);
  return d;
}

export function cardInfo(S, card, today, bal = balances(S)) {
  const used = bal.card[card.id] || 0, limit = card.limit || 0;
  const o = { used, limit, available: limit > 0 ? round2(limit - used) : null, util: limit > 0 ? Math.max(0, used) / limit : null };
  if (card.cutDay > 0) {
    const lastCut = lastDateWithDay(today, card.cutDay);
    o.lastCut = lastCut;
    o.nextCut = nextDateWithDay(lastCut, card.cutDay);
    const atCut = balances(S, lastCut).card[card.id] || 0;
    let paid = 0, newCharges = 0;
    for (const m of S.movements) {
      if (m.date <= lastCut || m.date > today) continue;
      if ((m.type === 'transfer' || m.type === 'income') && m.dst && m.dst.k === 'card' && m.dst.id === card.id) paid += m.amount;
      if (m.type === 'expense' && m.src && m.src.k === 'card' && m.src.id === card.id) newCharges += m.amount;
    }
    o.atCut = round2(atCut);
    o.paidSinceCut = round2(paid);
    o.dueAmount = Math.max(0, round2(atCut - paid));
    o.newCharges = round2(newCharges);
    if (card.payDay > 0) { o.due = nextDateWithDay(lastCut, card.payDay); o.daysToDue = diffDays(today, o.due); }
  }
  return o;
}

// ---------- Inversiones ----------

export function invInfo(inv, bal, today) {
  const value = bal.inv[inv.id] || 0, invested = bal.invIn[inv.id] || 0;
  const o = { value, invested, gain: round2(value - invested), current: value, accrued: 0, gainPct: invested > 0 ? (value - invested) / invested : null };
  const rate = (inv.rate || 0) / 100, net = 1 - (inv.tax || 0) / 100;
  if (inv.status === 'cobrada') { o.done = true; o.monthly = 0; return o; }
  if (inv.type === 'plazo' && inv.start && inv.end && inv.end > inv.start) {
    const total = diffDays(inv.start, inv.end);
    const el = clamp(diffDays(inv.start, today), 0, total);
    o.term = total; o.elapsed = el; o.left = total - el; o.progress = el / total; o.daysToEnd = diffDays(today, inv.end);
    o.interestAtEnd = round2(value * rate * (total / 365) * net);
    o.accrued = round2(o.interestAtEnd * (el / total));
    o.current = round2(value + o.accrued);
    o.atEnd = round2(value + o.interestAtEnd);
    o.matured = today >= inv.end;
    o.monthly = round2((o.interestAtEnd / total) * 30.42);
  } else {
    o.yearly = round2(value * rate * net);
    o.monthly = round2(o.yearly / 12);
  }
  return o;
}

// ---------- Deudas ----------

function paidInMonth(S, d, ym) {
  return S.movements.some((m) => ymOf(m.date) === ym && (
    (d.direction !== 'me_deben' && m.type === 'expense' && m.dst && m.dst.k === 'debt' && m.dst.id === d.id) ||
    (d.direction === 'me_deben' && m.type === 'transfer' && m.src && m.src.k === 'debt' && m.src.id === d.id)));
}

export function debtInfo(S, debt, bal, today) {
  const balance = round2(bal.debt[debt.id] || 0);
  const pos = Math.max(0, balance);
  const original = Math.max(debt.original || 0, debt.initial || 0, pos);
  const paidPct = original > 0 ? clamp(1 - pos / original, 0, 1) : 0;
  const P = debt.payment || 0, i = (debt.rate || 0) / 100 / 12;
  let months = null;
  if (pos <= 0.005) months = 0;
  else if (P > 0) {
    if (i === 0) months = Math.ceil(pos / P - 1e-9);
    else if (P > pos * i) months = Math.ceil(-Math.log(1 - (i * pos) / P) / Math.log(1 + i) - 1e-9);
    else months = Infinity;
  }
  const finite = months != null && isFinite(months);
  const payoff = finite && months > 0 ? addMonths(ymOf(today), months - (paidInMonth(S, debt, ymOf(today)) ? 0 : 1)) : null;
  const interestLeft = finite && P > 0 && i > 0 ? Math.max(0, round2(months * P - pos)) : finite ? 0 : null;
  let next = null, paidThisMonth = false;
  if (debt.payDay > 0 && pos > 0.005 && !debt.closed) {
    const cur = ymOf(today);
    paidThisMonth = paidInMonth(S, debt, cur);
    next = paidThisMonth ? dayInMonth(addMonths(cur, 1), debt.payDay) : dayInMonth(cur, debt.payDay);
  }
  return { balance, pos, original, paidPct, months, payoff, interestLeft, next, paidThisMonth, monthlyInterest: round2(pos * i), cantCover: months === Infinity };
}

// ---------- Patrimonio ----------

export function netWorth(S, bal, today) {
  let cash = 0, inv = 0, rec = 0, cards = 0, debts = 0, assets = 0;
  for (const a of S.accounts) cash += bal.acc[a.id] || 0;
  for (const i of S.investments) inv += i.status === 'cobrada' ? bal.inv[i.id] || 0 : invInfo(i, bal, today).current;
  for (const c of S.cards) cards += bal.card[c.id] || 0;
  for (const d of S.debts) { const v = bal.debt[d.id] || 0; if (d.direction === 'me_deben') rec += v; else debts += v; }
  for (const a of S.assets) assets += a.value || 0;
  const totalAssets = cash + inv + rec + assets, totalLiab = cards + debts;
  const r = (x) => round2(x);
  return { cash: r(cash), inv: r(inv), rec: r(rec), assets: r(assets), cards: r(cards), debts: r(debts), totalAssets: r(totalAssets), totalLiab: r(totalLiab), total: r(totalAssets - totalLiab) };
}

// ---------- Meses: cierre e historial ----------

export function firstMonth(S) {
  let f = S.settings.startMonth;
  for (const m of S.movements) { const y = m.date.slice(0, 7); if (y < f) f = y; }
  return f;
}
export const isClosed = (S, ym) => !!(S.months[ym] && S.months[ym].closed);

/** Meses ya terminados que todavía no se cierran (el más antiguo primero). */
export function monthsToClose(S, today) {
  return monthsBetween(firstMonth(S), addMonths(ymOf(today), -1)).filter((ym) => !isClosed(S, ym));
}

/** Foto del mes al cerrarlo: ingresos, gastos, presupuesto, saldos y patrimonio al último día del mes. */
export function snapshot(S, ym) {
  const end = monthEnd(ym);
  const bal = balances(S, end);
  const nw = netWorth(S, bal, end);
  const s = monthSummary(S, ym);
  const names = { acc: {}, card: {}, inv: {}, debt: {} };
  for (const a of S.accounts) names.acc[a.id] = a.name;
  for (const c of S.cards) names.card[c.id] = c.name;
  for (const i of S.investments) names.inv[i.id] = i.name;
  for (const d of S.debts) names.debt[d.id] = d.name;
  return {
    income: s.income, expense: s.expense, result: s.result, rate: s.rate, byCat: s.byCat, byGroup: s.byGroup, count: s.count,
    budget: budgetOf(S, ym), nw, bal: { acc: bal.acc, card: bal.card, inv: bal.inv, debt: bal.debt }, names, at: new Date().toISOString(),
  };
}

/** Serie de meses para el historial: datos del cierre si el mes está cerrado; si no, calculados al día. */
export function series(S, today, n = 12) {
  const cur = ymOf(today);
  let from = addMonths(cur, -(n - 1));
  const f = firstMonth(S);
  if (from < f) from = f;
  return monthsBetween(from, cur).map((ym) => {
    const mm = S.months[ym];
    if (mm && mm.closed && mm.snap) {
      const sn = mm.snap;
      return { ym, closed: true, income: Number(sn.income) || 0, expense: Number(sn.expense) || 0, result: Number(sn.result) || 0, nw: Number(sn.nw && sn.nw.total) || 0 };
    }
    const s = monthSummary(S, ym);
    const at = ym === cur ? today : monthEnd(ym);
    return { ym, closed: false, income: s.income, expense: s.expense, result: s.result, nw: netWorth(S, balances(S, at), at).total };
  });
}

// ---------- Pagos fijos ----------

export function recurringFor(S, ym) {
  return S.recurring.filter((r) => r.active).map((r) => ({
    r, due: dayInMonth(ym, r.day), done: S.movements.find((m) => m.rec === r.id && ymOf(m.date) === ym) || null,
  })).sort((a, b) => (a.due < b.due ? -1 : 1));
}

// ---------- Próximos pagos y vencimientos ----------

export function upcoming(S, today, horizon = 30, bal = balances(S)) {
  const items = [], end = addDays(today, horizon);
  for (const c of S.cards) {
    if (c.archived) continue;
    const ci = cardInfo(S, c, today, bal);
    if (ci.due && ci.dueAmount > 0.005 && ci.due <= end && ci.daysToDue >= -45) items.push({ date: ci.due, kind: 'card', id: c.id, title: 'Pagar ' + c.name, amount: ci.dueAmount, icon: '💳' });
  }
  for (const d of S.debts) {
    if (d.closed || !(d.payment > 0)) continue;
    const di = debtInfo(S, d, bal, today);
    const me = d.direction === 'me_deben';
    if (di.next && di.next <= end) items.push({ date: di.next, kind: me ? 'cobro' : 'debt', id: d.id, title: me ? (d.who ? 'Cobrar a ' + d.who : 'Cobro: ' + d.name) : 'Cuota: ' + d.name, amount: Math.min(d.payment, di.pos), icon: me ? '🤝' : '🏦' });
  }
  for (const i of S.investments) {
    if (i.status === 'cobrada' || i.type !== 'plazo' || !i.end || i.end > end) continue;
    items.push({ date: i.end, kind: 'inv', id: i.id, title: (i.end <= today ? 'Venció ' : 'Vence ') + i.name, amount: invInfo(i, bal, i.end).atEnd, icon: '📜' });
  }
  const cur = ymOf(today), cats = catMap(S);
  for (const ym of [cur, addMonths(cur, 1)]) {
    for (const x of recurringFor(S, ym)) {
      if (x.done || x.due > end) continue;
      if (ym !== cur && x.due < today) continue;
      items.push({ date: x.due, kind: 'rec', id: x.r.id, ym, title: x.r.name, amount: x.r.amount, icon: (cats[x.r.cat] && cats[x.r.cat].icon) || '🔁', income: x.r.type === 'income' });
    }
  }
  for (const it of items) it.days = diffDays(today, it.date);
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return items;
}

// ---------- Salud financiera ----------

export function health(S, today, bal = balances(S)) {
  const cur = ymOf(today), f = firstMonth(S);
  const hist = [];
  for (let k = 1; k <= 6 && hist.length < 3; k++) {
    const ym = addMonths(cur, -k);
    if (ym < f) break;
    const s = monthSummary(S, ym);
    if (s.count) hist.push(s);
  }
  if (!hist.length) { const s = monthSummary(S, cur); if (s.count) hist.push(s); }
  const avgInc = avg(hist.map((h) => h.income)), avgExp = avg(hist.map((h) => h.expense));
  const nw = netWorth(S, bal, today);
  const ind = [];
  if (avgInc > 0) {
    const v = (avgInc - avgExp) / avgInc;
    ind.push({ key: 'ahorro', label: 'Ahorro', value: v, status: v >= 0.2 ? 'good' : v >= 0.05 ? 'warn' : 'bad' });
  }
  if (avgExp > 0) {
    const v = nw.cash / avgExp;
    ind.push({ key: 'fondo', label: 'Fondo de emergencia', value: v, status: v >= 6 ? 'good' : v >= 3 ? 'warn' : 'bad' });
  }
  if (avgInc > 0) {
    let cuotas = 0;
    for (const d of S.debts) if (d.direction !== 'me_deben' && !d.closed && (bal.debt[d.id] || 0) > 0.005) cuotas += d.payment || 0;
    const v = cuotas / avgInc;
    ind.push({ key: 'deuda', label: 'Cuotas de deudas', value: v, status: v <= 0.3 ? 'good' : v <= 0.4 ? 'warn' : 'bad', cuotas });
  }
  let lim = 0, used = 0;
  for (const c of S.cards) if (!c.archived) { lim += c.limit || 0; used += Math.max(0, bal.card[c.id] || 0); }
  if (lim > 0) {
    const v = used / lim;
    ind.push({ key: 'tarjetas', label: 'Uso de tarjetas', value: v, status: v <= 0.3 ? 'good' : v <= 0.6 ? 'warn' : 'bad' });
  }
  const pts = { good: 100, warn: 60, bad: 20 };
  const score = ind.length ? Math.round(avg(ind.map((x) => pts[x.status]))) : null;
  const label = score == null ? 'Sin datos' : score >= 80 ? 'Muy buena' : score >= 60 ? 'Buena' : score >= 40 ? 'Regular' : 'Necesita atención';
  return { ind, score, label, avgInc, avgExp, months: hist.length };
}

// ---------- Metas ----------

export function goalInfo(g, today) {
  const saved = round2(sum(g.log.map((x) => x.amount)));
  const target = g.target || 0;
  const pct = target > 0 ? clamp(saved / target, 0, 1) : 0;
  const left = Math.max(0, round2(target - saved));
  let monthsLeft = null, perMonth = null;
  if (g.deadline && left > 0) {
    const d = diffDays(today, g.deadline);
    monthsLeft = Math.max(1, Math.ceil(d / 30.42));
    perMonth = d > 0 ? round2(left / monthsLeft) : left;
  }
  return { saved, target, pct, left, monthsLeft, perMonth, done: target > 0 && saved >= target - 0.005, late: g.deadline && today > g.deadline && left > 0 };
}

// ---------- Búsqueda en movimientos ----------

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function filterMoves(S, { ym = null, year = null, type = 'all', q = '', cat = '', ref = null } = {}) {
  const cats = catMap(S), nq = norm(q).trim();
  return S.movements.filter((m) => {
    if (ym && m.date.slice(0, 7) !== ym) return false;
    if (year && m.date.slice(0, 4) !== String(year)) return false;
    if (type !== 'all' && m.type !== type) return false;
    if (cat && m.cat !== cat) return false;
    if (ref && !((m.src && m.src.k === ref.k && m.src.id === ref.id) || (m.dst && m.dst.k === ref.k && m.dst.id === ref.id))) return false;
    if (nq) {
      const hay = norm(m.note) + ' ' + norm(cats[m.cat] && cats[m.cat].name) + ' ' + norm(entityName(S, m.src)) + ' ' + norm(entityName(S, m.dst)) + ' ' + String(m.amount);
      if (!hay.includes(nq)) return false;
    }
    return true;
  }).sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : (a.createdAt || '') > (b.createdAt || '') ? -1 : 1));
}
