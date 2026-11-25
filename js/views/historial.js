// Cierres e historial: cerrar el mes (asistente de 3 pasos), reabrirlo y ver la evolución mes a mes.

import { getState, commit, subscribe } from '../store.js';
import { html, raw, ic, amt, sheet, toast, confirmBox, go, bar, keepFocus } from '../ui.js';
import { money, pct, monthLabel, ymOf, addMonths, monthEnd, monthsBetween, todayISO, fmtDate, daysInMonth, plural } from '../format.js';
import { monthSummary, monthPulse, balances, netWorth, snapshot, isClosed, firstMonth, monthsToClose, budgetRows, catMap, series } from '../calc.js';
import { bars, area } from '../charts.js';
import { pageHead, card, kpi } from './common.js';
import { pulseCard } from './inicio.js';
import { openAdjust } from '../moveform.js';

export const title = 'Cierres e historial';

function monthData(S, ym, today) {
  const mm = S.months[ym];
  if (mm && mm.closed && mm.snap) {
    const s = mm.snap;
    return { ym, closed: true, income: Number(s.income) || 0, expense: Number(s.expense) || 0, result: Number(s.result) || 0, rate: s.rate == null ? null : Number(s.rate), nw: Number(s.nw && s.nw.total) || 0, note: mm.note || '', closedAt: mm.closedAt };
  }
  const s = monthSummary(S, ym), cur = ymOf(today);
  const at = ym === cur ? today : monthEnd(ym);
  return { ym, closed: false, income: s.income, expense: s.expense, result: s.result, rate: s.rate, nw: netWorth(S, balances(S, at), at).total, note: mm ? mm.note || '' : '' };
}

export function render(ctx) {
  const { S, today } = ctx;
  const cur = ymOf(today), f = firstMonth(S);
  const months = monthsBetween(f, cur).map((ym) => monthData(S, ym, today));
  const pend = monthsToClose(S, today);
  const closedList = months.filter((m) => m.closed);
  const lastClosed = closedList.length ? closedList[closedList.length - 1].ym : null;
  const oldestOpen = months.find((m) => !m.closed);
  const totInc = months.reduce((s, m) => s + m.income, 0), totExp = months.reduce((s, m) => s + m.expense, 0);
  const ser = series(S, today, 12);
  const rev = months.slice().reverse();
  return html`${pageHead({ title: 'Cierres e historial', sub: 'Cada mes cerrado queda guardado para comparar' })}
    <div class="dash">
      ${pend.length ? html`<div class="span-12 banner close">${ic('history', 20)}<span><b>Tienes ${pend.length} ${plural(pend.length, 'mes', 'meses')} sin cerrar.</b> Empieza por ${monthLabel(pend[0])}.</span><button class="btn small primary" data-act="close-month" data-ym="${pend[0]}">Cerrar ${monthLabel(pend[0], { year: false, capital: false })}</button></div>` : ''}
      <div class="kpis three span-12">
        ${kpi({ label: 'Ingresaste', value: money(totInc), icon: 'up', tone: 'pos', sub: `desde ${monthLabel(f, { capital: false })}` })}
        ${kpi({ label: 'Gastaste', value: money(totExp), icon: 'downleft', tone: 'neg', sub: `${months.length} ${plural(months.length, 'mes', 'meses')}` })}
        ${kpi({ label: totInc - totExp >= 0 ? 'Ahorraste' : 'Te faltó', value: amt(totInc - totExp), icon: 'coins', tone: 'brand', sub: totInc > 0 ? pct((totInc - totExp) / totInc) + ' de tus ingresos' : '' })}
      </div>
      ${ser.some((x) => x.income || x.expense) ? card({ title: 'Ingresos y gastos', icon: 'bars', cls: 'span-7', body: html`<div class="legend-inline"><span><i class="dot" style="background:var(--pos)"></i>Ingresos</span><span><i class="dot" style="background:var(--neg)"></i>Gastos</span></div>${bars(ser.map((x) => ({ label: monthLabel(x.ym, { short: true, year: false }), title: monthLabel(x.ym), values: [x.income, x.expense], hl: x.ym === cur })), [{ color: 'var(--pos)', label: 'Ingresos' }, { color: 'var(--neg)', label: 'Gastos' }])}` }) : ''}
      ${ser.length > 1 ? card({ title: 'Patrimonio', icon: 'compass', cls: 'span-5', body: area(ser.map((x) => ({ label: monthLabel(x.ym, { short: true, year: false }), title: monthLabel(x.ym), value: x.nw })), { color: 'var(--violet)', height: 220 }) }) : ''}
      <section class="card span-12">
        <header class="card-head"><h2><i class="card-ic">${ic('history', 18)}</i>Mes a mes</h2></header>
        <ul class="hist">${rev.map((m, idx) => {
          const prev = rev[idx + 1];
          const dExp = prev && prev.expense > 0 ? (m.expense - prev.expense) / prev.expense : null;
          const canClose = !m.closed && oldestOpen && oldestOpen.ym === m.ym;
          return html`<li class="${m.closed ? 'closed' : 'open'}">
            <div class="hist-h"><b>${monthLabel(m.ym)}</b>${m.closed ? html`<em class="tag good">${ic('check', 12)} Cerrado</em>` : m.ym === cur ? html`<em class="tag">En curso</em>` : html`<em class="tag warn">Sin cerrar</em>`}</div>
            <div class="hist-n">
              <div><span>Ingresos</span><b>${money(m.income)}</b></div>
              <div><span>Gastos</span><b>${money(m.expense)}</b>${dExp != null && Math.abs(dExp) >= 0.005 ? html`<small class="${dExp > 0 ? 'neg' : 'pos'}">${dExp > 0 ? '▲' : '▼'} ${pct(Math.abs(dExp))}</small>` : ''}</div>
              <div><span>${m.result >= 0 ? 'Te sobró' : 'Te faltó'}</span>${amt(m.result)}${m.rate != null ? html`<small>${pct(m.rate)}</small>` : ''}</div>
              <div><span>Patrimonio</span><b>${money(m.nw)}</b></div>
            </div>
            ${m.note ? html`<p class="hist-note">${ic('note', 14)} ${m.note}</p>` : ''}
            <div class="row-btns left">
              <a class="btn small ghost" href="#/mes/${m.ym}">Ver detalle</a>
              ${canClose ? html`<button class="btn small primary" data-act="close-month" data-ym="${m.ym}">${ic('check', 16)} Cerrar mes</button>` : ''}
              ${m.closed && m.ym === lastClosed ? html`<button class="btn small ghost" data-act="reopen-month" data-ym="${m.ym}">Reabrir</button>` : ''}
            </div></li>`;
        })}</ul>
      </section>
      ${card({ cls: 'span-12 tip', body: html`<p>${ic('bulb', 18)} <span><b>¿Qué hace cerrar el mes?</b> Guarda una foto de tus ingresos, gastos, saldos y patrimonio al último día del mes. Tus saldos siguen automáticamente al mes siguiente; no tienes que volver a escribirlos.</span></p>` })}
    </div>`;
}

// ---------- Reabrir ----------

export async function reopenMonth(ym) {
  const ok = await confirmBox({ title: 'Reabrir ' + monthLabel(ym), text: 'Podrás corregir sus movimientos. Cuando termines, ciérralo otra vez para actualizar tu historial.', ok: 'Reabrir' });
  if (!ok) return;
  const S = getState();
  const later = Object.keys(S.months).filter((k) => k > ym && S.months[k].closed);
  commit((s) => { s.months[ym].closed = false; for (const k of later) s.months[k].closed = false; });
  toast(later.length ? `${monthLabel(ym)} y los meses siguientes quedaron abiertos` : monthLabel(ym) + ' quedó abierto', { kind: 'ok' });
}

// ---------- Asistente de cierre ----------

export function openCloseWizard(ym) {
  const S0 = getState(), today = todayISO();
  if (isClosed(S0, ym)) { toast('Ese mes ya está cerrado.'); return; }
  const earlier = monthsBetween(firstMonth(S0), addMonths(ym, -1)).filter((m) => !isClosed(S0, m));
  if (earlier.length) { toast(`Primero cierra ${monthLabel(earlier[0])}.`); ym = earlier[0]; }
  let step = 1, note = (S0.months[ym] && S0.months[ym].note) || '', done = false;
  const sh = sheet({ title: 'Cerrar ' + monthLabel(ym), size: 'lg', cls: 'wizard', onClose: () => unsub() });
  const unsub = subscribe(() => { if (!done && step === 2) draw(); });

  function steps() {
    return html`<ol class="wz-steps">${['Resumen', 'Saldos', 'Cerrar'].map((t, i) => html`<li class="${step === i + 1 ? 'on' : step > i + 1 ? 'ok' : ''}"><i>${step > i + 1 ? ic('check', 14) : i + 1}</i><span>${t}</span></li>`)}</ol>`;
  }

  function step1(S) {
    const sum = monthSummary(S, ym), p = monthPulse(S, ym, today), prev = monthSummary(S, addMonths(ym, -1));
    const cats = catMap(S);
    const top = Object.entries(sum.byCat).filter(([k]) => cats[k] && cats[k].type === 'expense').sort((a, b) => b[1] - a[1]).slice(0, 3);
    const br = budgetRows(S, ym, sum);
    const dExp = prev.expense > 0 ? (sum.expense - prev.expense) / prev.expense : null;
    return html`<div class="kpis three">
        <div class="kpi t-pos"><span class="kpi-l">Ingresos</span><b class="kpi-v">${money(sum.income)}</b></div>
        <div class="kpi t-neg"><span class="kpi-l">Gastos</span><b class="kpi-v">${money(sum.expense)}</b>${dExp != null ? html`<small class="kpi-s">${dExp > 0 ? '▲' : '▼'} ${pct(Math.abs(dExp))} vs ${monthLabel(addMonths(ym, -1), { year: false, capital: false })}</small>` : ''}</div>
        <div class="kpi t-brand"><span class="kpi-l">${sum.result >= 0 ? 'Te sobró' : 'Te faltó'}</span><b class="kpi-v">${amt(sum.result)}</b>${sum.rate != null ? html`<small class="kpi-s">${pct(sum.rate)} de tus ingresos</small>` : ''}</div></div>
      ${pulseCard(p, { compact: true })}
      ${top.length ? html`<h3 class="sub-h">En lo que más gastaste</h3><ul class="top3">${top.map(([k, v]) => html`<li><i class="cat-ic sm" style="--c:${raw(cats[k].color)}">${cats[k].icon}</i><span>${cats[k].name}</span><b>${money(v)}</b></li>`)}</ul>` : ''}
      ${br.totalBudget > 0 ? html`<p class="mini-help">${ic('target', 16)} Presupuesto: gastaste ${money(br.spentBudgeted)} de ${money(br.totalBudget)}${br.over ? ` y te pasaste en ${br.over} ${plural(br.over, 'categoría', 'categorías')}` : ', ¡dentro de lo planeado!'}.</p>` : ''}
      ${sum.count === 0 ? html`<p class="mini-help">${ic('info', 16)} Este mes no tiene movimientos. Puedes cerrarlo igual para mantener tu historial en orden.</p>` : ''}`;
  }

  function step2(S) {
    const end = monthEnd(ym), bal = balances(S, end);
    const accs = S.accounts.filter((a) => !a.archived || Math.abs(bal.acc[a.id] || 0) > 0.005);
    const cards = S.cards.filter((c) => !c.archived || Math.abs(bal.card[c.id] || 0) > 0.005);
    if (!accs.length && !cards.length) return html`<p class="muted">No tienes cuentas ni tarjetas registradas.</p>`;
    return html`<p class="wz-p">Compara cada saldo al <b>${fmtDate(end, 'long')}</b> con tu banco. Si alguno no coincide, toca <b>Ajustar</b>.</p>
      <ul class="wz-bal">${accs.map((a) => html`<li><i class="dot" style="background:${raw(a.color)}"></i><span>${a.name}</span><b class="${(bal.acc[a.id] || 0) < 0 ? 'neg' : ''}">${money(bal.acc[a.id] || 0)}</b><button type="button" class="btn small ghost" data-w="adj" data-k="acc" data-id="${a.id}">Ajustar</button></li>`)}
        ${cards.map((c) => html`<li><i class="dot" style="background:${raw(c.color)}"></i><span>💳 ${c.name} <small>(usado)</small></span><b>${money(bal.card[c.id] || 0)}</b><button type="button" class="btn small ghost" data-w="adj" data-k="card" data-id="${c.id}">Ajustar</button></li>`)}</ul>`;
  }

  function step3(S) {
    const cur = ymOf(today);
    const left = ym === cur ? daysInMonth(ym) - Number(today.slice(8)) : 0;
    const nw = netWorth(S, balances(S, monthEnd(ym)), monthEnd(ym));
    return html`<div class="wz-final">
      <p class="wz-p">Al cerrar <b>${monthLabel(ym)}</b> se guardan tus ingresos, gastos, saldos y tu patrimonio (${money(nw.total)}) en el historial. Tus saldos pasan solos a ${monthLabel(addMonths(ym, 1))}.</p>
      ${left > 0 ? html`<p class="mini-help warn">${ic('alert', 16)} Al mes aún le ${left === 1 ? 'queda 1 día' : `quedan ${left} días`}. Si después anotas algo con fecha de este mes, se reabrirá.</p>` : ''}
      <label class="field"><span>Nota del mes (opcional)</span><textarea class="input" data-w-note rows="3" maxlength="1000" placeholder="Ej.: mes con gastos médicos, recibí un bono…">${note}</textarea></label></div>`;
  }

  function doneView(S) {
    const sn = S.months[ym] && S.months[ym].snap;
    const res = sn ? Number(sn.result) || 0 : 0;
    const pend = monthsToClose(S, today);
    return html`<div class="wz-done">
      <div class="wz-check">${ic('check', 44)}</div>
      <h3>¡${monthLabel(ym)} quedó cerrado!</h3>
      <p>${res >= 0 ? html`Te sobraron <b class="pos">${money(res)}</b>. ¡Muy bien!` : html`Gastaste <b class="neg">${money(-res)}</b> más de lo que ingresó. El próximo mes puede ser mejor.`}</p>
      <div class="row-btns">${pend.length ? html`<button type="button" class="btn primary" data-w="next" data-ym="${pend[0]}">Cerrar ${monthLabel(pend[0], { capital: false })}</button>` : html`<button type="button" class="btn primary" data-w="go" data-to="#/historial">Ver mi historial</button>`}<button type="button" class="btn ghost" data-w="close">Listo</button></div></div>`;
  }

  function draw() {
    const S = getState();
    if (done) { sh.el.innerHTML = doneView(S).s; keepFocus(sh); return; }
    const body = step === 1 ? step1(S) : step === 2 ? step2(S) : step3(S);
    sh.el.innerHTML = html`${steps()}<div class="wz-body">${body}</div>
      <div class="form-actions">${step > 1 ? html`<button type="button" class="btn ghost" data-w="back">${ic('left', 18)} Atrás</button>` : html`<span></span>`}
        ${step < 3 ? html`<button type="button" class="btn primary big" data-w="fwd">Siguiente ${ic('right', 18)}</button>` : html`<button type="button" class="btn primary big" data-w="close-it">${ic('check', 20)} Cerrar ${monthLabel(ym, { year: false, capital: false })}</button>`}</div>`.s;
    keepFocus(sh);
  }

  sh.el.addEventListener('input', (e) => { if (e.target.matches('[data-w-note]')) note = e.target.value; });
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-w]');
    if (!b) return;
    const w = b.dataset.w;
    if (w === 'fwd') { step++; draw(); sh.el.scrollTop = 0; }
    else if (w === 'back') { step--; draw(); }
    else if (w === 'adj') openAdjust({ k: b.dataset.k, id: b.dataset.id }, { date: monthEnd(ym) });
    else if (w === 'close-it') {
      const S = getState();
      if (isClosed(S, ym)) { done = true; draw(); return; }
      const snap = snapshot(S, ym);
      commit((s) => { s.months[ym] = { closed: true, closedAt: new Date().toISOString(), note: note.trim(), snap }; });
      done = true;
      draw();
    } else if (w === 'next') { const nx = b.dataset.ym; sh.close(); setTimeout(() => openCloseWizard(nx), 260); }
    else if (w === 'go') go(b.dataset.to);
    else if (w === 'close') sh.close();
  });
  draw();
  return sh;
}
