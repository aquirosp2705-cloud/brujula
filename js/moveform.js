// Formulario «Anotar»: gasto, ingreso, pago (tarjeta o deuda) y transferencia. Es la pantalla que más se usa,
// así que todo se elige tocando: categorías con ícono, cuentas como fichas y fecha con «Hoy / Ayer».

import { getState, commit, uid } from './store.js';
import { sheet, html, raw, ic, toast, confirmBox, vibrate, keepFocus } from './ui.js';
import { fAmount, fDate, fText, bindFields, readFields, setErr } from './fields.js';
import { money, todayISO, ymOf, monthLabel, round2, amountInput, isISO, parseAmount } from './format.js';
import { balances, cardInfo, debtInfo, invInfo, entity, isClosed } from './calc.js';

const TYPES = [['expense', 'Gasto', 'downleft'], ['income', 'Ingreso', 'up'], ['pay', 'Pago', 'card'], ['transfer', 'Transferir', 'swap']];
const SAVE_TXT = { expense: 'Guardar gasto', income: 'Guardar ingreso', pay: 'Guardar pago', transfer: 'Guardar transferencia' };

const refKey = (r) => (r ? r.k + ':' + r.id : '');
const parseRef = (s) => { if (!s) return null; const i = s.indexOf(':'); return { k: s.slice(0, i), id: s.slice(i + 1) }; };
const sameRef = (a, b) => !!a && !!b && a.k === b.k && a.id === b.id;

function validRef(S, r) {
  const e = entity(S, r);
  return !!e && !e.archived && !e.closed && e.status !== 'cobrada';
}

function firstAccount(S) {
  const acc = S.accounts.filter((a) => !a.archived);
  return acc.length ? { k: 'acc', id: acc[0].id } : null;
}

/** Decide en qué pestaña se muestra un movimiento guardado. */
function formTypeOf(m) {
  if (m.type === 'expense' && m.dst && m.dst.k === 'debt') return 'pay';
  if (m.type === 'transfer' && m.dst && m.dst.k === 'card' && m.src && m.src.k === 'acc') return 'pay';
  return m.type;
}

/** Pregunta si se reabre un mes cerrado antes de guardar en él. Devuelve true si se puede seguir. */
export async function ensureOpenMonth(dates) {
  const S = getState();
  const closed = [...new Set(dates.filter(Boolean).map(ymOf))].filter((ym) => isClosed(S, ym));
  if (!closed.length) return true;
  const names = closed.map((ym) => monthLabel(ym)).join(' y ');
  const ok = await confirmBox({
    title: 'Mes cerrado',
    text: `${names} ya está cerrado. Si anotas o cambias algo ahí, el mes se reabre y tendrás que cerrarlo otra vez para actualizar tu historial.`,
    ok: 'Reabrir y guardar',
  });
  if (!ok) return false;
  commit((s) => { for (const ym of closed) if (s.months[ym]) s.months[ym].closed = false; });
  return true;
}

export function openMoveForm({ type = 'expense', move = null, preset = {}, onSaved = null } = {}) {
  const S0 = getState();
  if (move && move.type === 'adjust') return openAdjustEdit(move);
  const st = move
    ? { id: move.id, type: formTypeOf(move), amount: move.amount, cat: move.cat || '', src: move.src || null, dst: move.dst || null, date: move.date, note: move.note || '', interest: move.interest || 0, rec: move.rec || '', createdAt: move.createdAt, origDate: move.date }
    : { id: null, type, amount: preset.amount != null ? preset.amount : '', cat: preset.cat || '', src: preset.src || null, dst: preset.dst || null, date: preset.date || todayISO(), note: preset.note || '', interest: preset.interest || 0, rec: preset.rec || '' };
  if (!move) applyDefaults(S0, st);

  const sh = sheet({ title: move ? 'Editar movimiento' : 'Anotar movimiento', size: 'lg', cls: 'move-sheet' });
  sh.el.classList.add('move-form');
  bindFields(sh.el, (k) => { if (k === 'date') st.date = sh.el.querySelector('[data-k="date"]').value; });

  sh.el.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (k === 'amount') st.amount = e.target.value;
    else if (k === 'note') st.note = e.target.value;
    else if (k === 'interest') st.interest = e.target.value;
  });

  sh.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-mt],[data-cat],[data-ref],[data-sug],[data-a]');
    if (!t) return;
    if (t.dataset.mt) {
      if (t.dataset.mt === st.type) return;
      syncInputs();
      st.type = t.dataset.mt;
      st.cat = '';
      st.src = null; st.dst = null; st.interest = 0;
      applyDefaults(getState(), st);
      render(true);
      return;
    }
    if (t.dataset.cat) {
      st.cat = t.dataset.cat;
      sh.el.querySelectorAll('[data-cat]').forEach((b) => { const on = b === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      clearErrBox('cat');
      vibrate(8);
      return;
    }
    if (t.dataset.ref) {
      const role = t.closest('[data-role]').dataset.role;
      const r = parseRef(t.dataset.ref);
      syncInputs();
      st[role] = r;
      if (role === 'dst' && st.type === 'pay') {
        const S = getState(), bal = balances(S);
        if (r.k === 'card') { const ci = cardInfo(S, entity(S, r), todayISO(), bal); if (!move && !(Number(st.amount) > 0) && ci.dueAmount > 0) st.amount = amountInput(ci.dueAmount); st.interest = 0; }
        if (r.k === 'debt') {
          const d = entity(S, r), di = debtInfo(S, d, bal, todayISO());
          if (!move && d.payment > 0 && !(String(st.amount).trim())) st.amount = amountInput(Math.min(d.payment, di.pos));
          if (!move) st.interest = di.monthlyInterest > 0 ? amountInput(di.monthlyInterest) : '';
        }
        render(false);
        return;
      }
      sh.el.querySelectorAll(`[data-role="${role}"] [data-ref]`).forEach((b) => { const on = b === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      clearErrBox(role);
      vibrate(8);
      return;
    }
    if (t.dataset.sug) {
      const inp = sh.el.querySelector('[data-k="amount"]');
      inp.value = t.dataset.sug;
      st.amount = t.dataset.sug;
      return;
    }
    if (t.dataset.a === 'save' || t.dataset.a === 'again') { e.preventDefault(); await save(t.dataset.a === 'again'); return; }
    if (t.dataset.a === 'del') { e.preventDefault(); await remove(); return; }
    if (t.dataset.a === 'add-acc') {
      const { openAccountForm } = await import('./entityforms.js');
      openAccountForm(null, { onSaved: (acc) => { syncInputs(); const r = { k: 'acc', id: acc.id }; if (st.type === 'income') st.dst = r; else st.src = r; render(false); } });
    }
  });

  sh.el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'date') { e.preventDefault(); save(false); }
  });

  function syncInputs() {
    const a = sh.el.querySelector('[data-k="amount"]'); if (a) st.amount = a.value;
    const n = sh.el.querySelector('[data-k="note"]'); if (n) st.note = n.value;
    const i = sh.el.querySelector('[data-k="interest"]'); if (i) st.interest = i.value;
    const d = sh.el.querySelector('[data-k="date"]'); if (d && d.value) st.date = d.value;
  }

  function clearErrBox(k) { const s = sh.el.querySelector(`[data-err="${k}"]`); if (s) s.textContent = ''; }

  function render(focusAmount) {
    const S = getState(), bal = balances(S), today = todayISO();
    sh.el.innerHTML = build(S, bal, today).s;
    sh.el.dataset.type = st.type;
    if (focusAmount !== false) {
      const inp = sh.el.querySelector('[data-k="amount"]');
      if (inp && !move) try { inp.focus({ preventScroll: true }); } catch (e) { /* nada */ }
      sh.el.scrollTop = 0;
    }
    keepFocus(sh);
  }

  function build(S, bal, today) {
    const accs = S.accounts.filter((a) => !a.archived || sameRef(st.src, { k: 'acc', id: a.id }) || sameRef(st.dst, { k: 'acc', id: a.id }));
    const cards = S.cards.filter((c) => !c.archived || sameRef(st.src, { k: 'card', id: c.id }) || sameRef(st.dst, { k: 'card', id: c.id }));
    const accChip = (a, role) => pick({ k: 'acc', id: a.id }, a.name, money(bal.acc[a.id] || 0), a.color, role);
    const cardChip = (c, role) => { const ci = cardInfo(S, c, today, bal); return pick({ k: 'card', id: c.id }, c.name, ci.available != null ? 'Disponible ' + money(ci.available) : 'Usado ' + money(ci.used), c.color, role); };
    const pick = (r, name, sub, color, role) => {
      const on = sameRef(st[role], r);
      return html`<button type="button" class="pick ${on ? 'on' : ''}" data-ref="${refKey(r)}" role="radio" aria-checked="${on}" style="--c:${raw(color || '#6366F1')}"><i class="dot"></i><span><b>${name}</b><small>${sub}</small></span></button>`;
    };
    const noAcc = html`<div class="inline-note">${ic('info', 18)} <span>Aún no tienes cuentas.</span> <button type="button" class="btn small" data-a="add-acc">${ic('plus', 16)} Agregar cuenta</button></div>`;

    const catGrid = (kind) => {
      const cats = S.categories.filter((c) => c.type === kind && (!c.archived || c.id === st.cat));
      return html`<div class="field"><span>${kind === 'expense' ? '¿En qué gastaste?' : '¿Qué ingreso es?'}</span>
        <div class="cat-grid" role="radiogroup" aria-label="Categoría">${cats.map((c) => html`<button type="button" class="cat ${c.id === st.cat ? 'on' : ''}" data-cat="${c.id}" role="radio" aria-checked="${c.id === st.cat}" style="--c:${raw(c.color)}"><i>${c.icon}</i><span>${c.name}</span></button>`)}</div>
        <small class="err" data-err="cat" role="alert"></small></div>`;
    };

    let middle;
    if (st.type === 'expense') {
      middle = html`${catGrid('expense')}
        <div class="field"><span>¿Con qué pagaste?</span>
          <div class="picks" data-role="src" role="radiogroup" aria-label="Con qué pagaste">${accs.map((a) => accChip(a, 'src'))}${cards.map((c) => cardChip(c, 'src'))}</div>
          ${!accs.length && !cards.length ? noAcc : ''}<small class="err" data-err="src" role="alert"></small></div>`;
    } else if (st.type === 'income') {
      middle = html`${catGrid('income')}
        <div class="field"><span>¿A dónde entró el dinero?</span>
          <div class="picks" data-role="dst" role="radiogroup" aria-label="A dónde entró">${accs.map((a) => accChip(a, 'dst'))}</div>
          ${cards.length ? html`<details class="more-picks" ${st.dst && st.dst.k === 'card' ? raw('open') : ''}><summary>Devolución a una tarjeta de crédito</summary><div class="picks" data-role="dst">${cards.map((c) => cardChip(c, 'dst'))}</div></details>` : ''}
          ${!accs.length ? noAcc : ''}<small class="err" data-err="dst" role="alert"></small></div>`;
    } else if (st.type === 'pay') {
      const debts = S.debts.filter((d) => d.direction !== 'me_deben' && (!d.closed || sameRef(st.dst, { k: 'debt', id: d.id })));
      let sug = '';
      if (st.dst && st.dst.k === 'card' && entity(S, st.dst)) {
        const ci = cardInfo(S, entity(S, st.dst), today, bal);
        const opts = [];
        if (ci.dueAmount > 0) opts.push(['Saldo al corte', ci.dueAmount]);
        if (ci.used > 0 && Math.abs(ci.used - (ci.dueAmount || 0)) > 0.005) opts.push(['Todo lo usado', ci.used]);
        sug = opts.length ? html`<div class="sugs">${opts.map(([l, v]) => html`<button type="button" class="chip" data-sug="${amountInput(v)}">${l}: <b>${money(v)}</b></button>`)}</div>` : '';
      }
      let interestField = '';
      if (st.dst && st.dst.k === 'debt' && entity(S, st.dst)) {
        const d = entity(S, st.dst), di = debtInfo(S, d, bal, today);
        sug = d.payment > 0 ? html`<div class="sugs"><button type="button" class="chip" data-sug="${amountInput(Math.min(d.payment, di.pos))}">Cuota: <b>${money(Math.min(d.payment, di.pos))}</b></button>${di.pos > 0 ? html`<button type="button" class="chip" data-sug="${amountInput(di.pos)}">Todo el saldo: <b>${money(di.pos)}</b></button>` : ''}</div>` : '';
        const iv = parseAmount(st.interest);
        interestField = fAmount('interest', isNaN(iv) || iv === 0 ? '' : iv, { label: '¿Cuánto de este pago es interés? (opcional)', hint: di.monthlyInterest > 0 ? `Estimado según la tasa: ${money(di.monthlyInterest)}. Así la deuda baja solo por el capital.` : 'Si no lo sabes, déjalo vacío: todo el pago bajará la deuda.' });
      }
      middle = html`<div class="field"><span>¿Qué vas a pagar?</span>
          <div class="picks" data-role="dst" role="radiogroup" aria-label="Qué vas a pagar">
            ${cards.map((c) => { const ci = cardInfo(S, c, today, bal); return pick({ k: 'card', id: c.id }, c.name, ci.dueAmount > 0 ? 'A pagar ' + money(ci.dueAmount) : 'Usado ' + money(ci.used), c.color, 'dst'); })}
            ${debts.map((d) => { const di = debtInfo(S, d, bal, today); return pick({ k: 'debt', id: d.id }, d.name, 'Saldo ' + money(di.pos), d.color, 'dst'); })}
          </div>
          ${!cards.length && !debts.length ? html`<div class="inline-note">${ic('info', 18)} <span>Primero agrega una tarjeta (en Tarjetas) o una deuda (en Deudas).</span></div>` : ''}
          <small class="err" data-err="dst" role="alert"></small>${sug}</div>
        ${interestField}
        <div class="field"><span>¿Desde qué cuenta pagas?</span>
          <div class="picks" data-role="src" role="radiogroup" aria-label="Desde qué cuenta">${accs.map((a) => accChip(a, 'src'))}</div>
          ${!accs.length ? noAcc : ''}<small class="err" data-err="src" role="alert"></small></div>`;
    } else {
      const invs = S.investments.filter((i) => i.status !== 'cobrada' || sameRef(st.src, { k: 'inv', id: i.id }) || sameRef(st.dst, { k: 'inv', id: i.id }));
      const invChip = (i, role) => pick({ k: 'inv', id: i.id }, i.name, 'Valor ' + money(invInfo(i, bal, today).current), i.color, role);
      const extra = (role) => {
        const r = st[role];
        if (!r || (r.k !== 'debt' && r.k !== 'card')) return '';
        const e = entity(S, r);
        return e ? pick(r, e.name, r.k === 'debt' ? 'Saldo ' + money(bal.debt[e.id] || 0) : 'Tarjeta', e.color, role) : '';
      };
      middle = html`<div class="field"><span>Desde</span>
          <div class="picks" data-role="src" role="radiogroup" aria-label="Desde">${extra('src')}${accs.map((a) => accChip(a, 'src'))}${invs.map((i) => invChip(i, 'src'))}</div>
          ${!accs.length ? noAcc : ''}<small class="err" data-err="src" role="alert"></small></div>
        <div class="xfer-arrow">${ic('down', 22)}</div>
        <div class="field"><span>Hacia</span>
          <div class="picks" data-role="dst" role="radiogroup" aria-label="Hacia">${extra('dst')}${accs.map((a) => accChip(a, 'dst'))}${invs.map((i) => invChip(i, 'dst'))}</div>
          <small class="err" data-err="dst" role="alert"></small></div>`;
    }

    const amountVal = st.amount === '' || st.amount == null ? '' : typeof st.amount === 'number' ? st.amount : String(st.amount);
    return html`
      <div class="seg type-seg" role="tablist" aria-label="Tipo de movimiento">
        ${TYPES.map(([k, l, ico]) => html`<button type="button" class="seg-b t-${k} ${st.type === k ? 'on' : ''}" data-mt="${k}" role="tab" aria-selected="${st.type === k}">${ic(ico, 17)}<span>${l}</span></button>`)}
      </div>
      <label class="field big amount-field"><span class="sr-only">Monto</span>
        <div class="money-in big"><b>${moneySym()}</b><input class="input" data-k="amount" data-type="amount" inputmode="decimal" autocomplete="off" enterkeyhint="done" placeholder="0" value="${typeof amountVal === 'number' ? amountInput(amountVal) : amountVal}" aria-label="Monto"></div>
        <small class="err" data-err="amount" role="alert"></small></label>
      ${middle}
      ${fDate('date', st.date)}
      ${fText('note', st.note, { label: 'Descripción (opcional)', placeholder: st.type === 'expense' ? 'Ej.: compras de la semana' : st.type === 'income' ? 'Ej.: sueldo de noviembre' : 'Ej.: pago de noviembre', max: 120 })}
      <div class="form-actions">
        ${move ? html`<button type="button" class="btn ghost danger-text" data-a="del">${ic('trash', 18)} Eliminar</button>` : html`<button type="button" class="btn ghost" data-a="again">Guardar y anotar otro</button>`}
        <button type="button" class="btn primary big t-${st.type}" data-a="save">${ic('check', 20)} ${move ? 'Guardar cambios' : SAVE_TXT[st.type]}</button>
      </div>`;
  }

  async function save(again) {
    syncInputs();
    const v = readFields(sh.el);
    const S = getState();
    const amount = round2(v.amount);
    if (!(amount > 0)) return setErr(sh.el, 'amount', 'Escribe un monto mayor a cero.');
    if (!isISO(v.date)) return setErr(sh.el, 'date', 'Elige una fecha.');
    const m = { id: st.id || uid('m'), date: v.date, amount, note: v.note || '', createdAt: st.createdAt || new Date().toISOString() };
    if (st.rec) m.rec = st.rec;
    if (st.type === 'expense') {
      if (!st.cat) return setErr(sh.el, 'cat', 'Elige en qué gastaste.');
      if (!st.src || !entity(S, st.src)) return setErr(sh.el, 'src', 'Elige con qué pagaste.');
      Object.assign(m, { type: 'expense', cat: st.cat, src: st.src });
    } else if (st.type === 'income') {
      if (!st.cat) return setErr(sh.el, 'cat', 'Elige qué ingreso es.');
      if (!st.dst || !entity(S, st.dst)) return setErr(sh.el, 'dst', 'Elige a dónde entró el dinero.');
      Object.assign(m, { type: 'income', cat: st.cat, dst: st.dst });
    } else if (st.type === 'pay') {
      if (!st.dst || !entity(S, st.dst)) return setErr(sh.el, 'dst', 'Elige qué vas a pagar.');
      if (!st.src || !entity(S, st.src)) return setErr(sh.el, 'src', 'Elige desde qué cuenta pagas.');
      if (st.dst.k === 'card') Object.assign(m, { type: 'transfer', src: st.src, dst: st.dst });
      else {
        const interest = round2(isNaN(v.interest) ? 0 : v.interest);
        if (interest < 0 || interest > amount) return setErr(sh.el, 'interest', 'El interés no puede ser mayor que el pago.');
        const keepCat = move && move.type === 'expense' && move.cat ? move.cat : 'c_deu';
        Object.assign(m, { type: 'expense', cat: S.categories.some((c) => c.id === keepCat) ? keepCat : S.categories.find((c) => c.type === 'expense').id, src: st.src, dst: st.dst });
        if (interest > 0) m.interest = interest;
      }
    } else {
      if (!st.src || !entity(S, st.src)) return setErr(sh.el, 'src', 'Elige de dónde sale el dinero.');
      if (!st.dst || !entity(S, st.dst)) return setErr(sh.el, 'dst', 'Elige a dónde va el dinero.');
      if (sameRef(st.src, st.dst)) return setErr(sh.el, 'dst', 'Elige una cuenta distinta a la de origen.');
      Object.assign(m, { type: 'transfer', src: st.src, dst: st.dst });
    }
    if (!(await ensureOpenMonth([m.date, st.origDate]))) return;
    const isNew = !st.id;
    const undo = commit((s) => {
      const i = s.movements.findIndex((x) => x.id === m.id);
      if (i >= 0) s.movements[i] = m; else s.movements.push(m);
      s.ui.last[st.type] = { src: m.src || null, dst: m.dst || null };
    }, { undo: true });
    vibrate(15);
    const what = { expense: 'Gasto', income: 'Ingreso', pay: 'Pago', transfer: 'Transferencia' }[st.type];
    toast(`${what} ${isNew ? 'guardado' : 'actualizado'}: ${money(amount)}`, { action: { label: 'Deshacer', fn: undo }, kind: 'ok' });
    if (onSaved) onSaved(m);
    if (again && isNew) {
      st.id = null; st.amount = ''; st.note = ''; st.interest = 0; st.createdAt = null; st.rec = '';
      render(true);
    } else sh.close();
  }

  async function remove() {
    const ok = await confirmBox({ title: 'Eliminar movimiento', text: 'Se quitará de tus saldos y reportes.', ok: 'Eliminar', danger: true });
    if (!ok) return;
    if (!(await ensureOpenMonth([st.origDate]))) return;
    const undo = commit((s) => { s.movements = s.movements.filter((x) => x.id !== st.id); }, { undo: true });
    toast('Movimiento eliminado', { action: { label: 'Deshacer', fn: undo } });
    sh.close();
  }

  render(true);
  return sh;
}

function moneySym() { return money(0, { cents: false }).replace(/[\d.,\s•]+$/, '').trim() || '$'; }

function applyDefaults(S, st) {
  const last = (S.ui.last && S.ui.last[st.type]) || {};
  const lastSrc = last.src && typeof last.src === 'object' ? { k: String(last.src.k), id: String(last.src.id) } : null;
  const lastDst = last.dst && typeof last.dst === 'object' ? { k: String(last.dst.k), id: String(last.dst.id) } : null;
  if (st.type === 'expense') {
    if (!st.src) st.src = validRef(S, lastSrc) ? lastSrc : firstAccount(S);
  } else if (st.type === 'income') {
    if (!st.dst) st.dst = validRef(S, lastDst) && lastDst.k === 'acc' ? lastDst : firstAccount(S);
  } else if (st.type === 'pay') {
    if (!st.src) st.src = validRef(S, lastSrc) && lastSrc.k === 'acc' ? lastSrc : firstAccount(S);
  } else if (st.type === 'transfer') {
    if (!st.src) st.src = validRef(S, lastSrc) ? lastSrc : firstAccount(S);
  }
}

// ---------- Ajustar saldo ----------

const ADJ_TXT = {
  acc: ['Saldo real de la cuenta', 'Escribe lo que dice tu banco hoy. La diferencia se guarda como «Ajuste de saldo» (no cuenta como gasto ni ingreso).'],
  card: ['Saldo usado real de la tarjeta', 'Lo que debes hoy en la tarjeta según tu banco.'],
  debt: ['Saldo pendiente real', 'Lo que falta pagar según tu último estado de cuenta.'],
  inv: ['Valor actual de la inversión', 'Lo que vale hoy. La diferencia con lo invertido se muestra como ganancia o pérdida.'],
};

export function openAdjust(ref, { date = null } = {}) {
  const S = getState();
  const e = entity(S, ref);
  if (!e) return;
  const day = date || todayISO();
  const cur = balances(S, day)[ref.k][ref.id] || 0;
  const [lab, hint] = ADJ_TXT[ref.k];
  const sh = sheet({
    title: 'Ajustar saldo · ' + e.name, size: 'sm',
    body: html`<div class="form">
      <div class="info-box"><span>Saldo según la app${date ? ' al ' + date.split('-').reverse().join('/') : ''}</span><b>${money(cur)}</b></div>
      ${fAmount('real', '', { label: lab, hint, allowNeg: ref.k === 'acc', autofocus: true })}
      ${fDate('date', day, { label: 'Fecha del saldo', quick: !date })}
      ${fText('note', 'Ajuste de saldo', { label: 'Nota', max: 120 })}
      <div class="form-actions"><button type="button" class="btn primary big" data-a="save">${ic('check', 20)} Ajustar</button></div></div>`,
  });
  bindFields(sh.el);
  sh.el.addEventListener('click', async (ev) => {
    if (!ev.target.closest('[data-a="save"]')) return;
    const v = readFields(sh.el);
    if (isNaN(v.real)) return setErr(sh.el, 'real', 'Escribe el saldo real.');
    if (!isISO(v.date)) return setErr(sh.el, 'date', 'Elige una fecha.');
    const S2 = getState();
    const at = balances(S2, v.date)[ref.k][ref.id] || 0;
    const delta = round2(v.real - at);
    if (Math.abs(delta) < 0.005) { toast('El saldo ya coincide. No hubo cambios.'); sh.close(); return; }
    if (!(await ensureOpenMonth([v.date]))) return;
    const undo = commit((s) => { s.movements.push({ id: uid('m'), type: 'adjust', date: v.date, amount: delta, dst: { k: ref.k, id: ref.id }, note: v.note || 'Ajuste de saldo', createdAt: new Date().toISOString() }); }, { undo: true });
    toast('Saldo ajustado (' + money(delta, { sign: true }) + ')', { action: { label: 'Deshacer', fn: undo }, kind: 'ok' });
    sh.close();
  });
  return sh;
}

function openAdjustEdit(m) {
  const S = getState();
  const e = entity(S, m.dst);
  const sh = sheet({
    title: 'Ajuste de saldo', size: 'sm',
    body: html`<div class="form">
      <div class="info-box"><span>${e ? e.name : 'Cuenta eliminada'}</span><b>${money(m.amount, { sign: true })}</b></div>
      ${fAmount('amount', m.amount, { label: 'Diferencia ajustada', allowNeg: true, hint: 'Positivo sube el saldo; negativo lo baja.' })}
      ${fDate('date', m.date)}
      ${fText('note', m.note, { label: 'Nota', max: 120 })}
      <div class="form-actions"><button type="button" class="btn ghost danger-text" data-a="del">${ic('trash', 18)} Eliminar</button>
      <button type="button" class="btn primary big" data-a="save">${ic('check', 20)} Guardar</button></div></div>`,
  });
  bindFields(sh.el);
  sh.el.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'del') {
      if (!(await confirmBox({ title: 'Eliminar ajuste', text: 'El saldo volverá a como estaba antes del ajuste.', ok: 'Eliminar', danger: true }))) return;
      if (!(await ensureOpenMonth([m.date]))) return;
      const undo = commit((s) => { s.movements = s.movements.filter((x) => x.id !== m.id); }, { undo: true });
      toast('Ajuste eliminado', { action: { label: 'Deshacer', fn: undo } });
      sh.close();
      return;
    }
    const v = readFields(sh.el);
    if (isNaN(v.amount) || Math.abs(v.amount) < 0.005) return setErr(sh.el, 'amount', 'Escribe la diferencia.');
    if (!isISO(v.date)) return setErr(sh.el, 'date', 'Elige una fecha.');
    if (!(await ensureOpenMonth([v.date, m.date]))) return;
    commit((s) => { const x = s.movements.find((y) => y.id === m.id); if (x) { x.amount = round2(v.amount); x.date = v.date; x.note = v.note; } });
    toast('Ajuste actualizado', { kind: 'ok' });
    sh.close();
  });
  return sh;
}
