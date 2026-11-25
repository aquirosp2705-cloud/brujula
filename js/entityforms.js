// Formularios de cuentas, tarjetas, inversiones, deudas, bienes, metas, categorías, pagos fijos y presupuesto.

import { getState, commit, uid } from './store.js';
import { sheet, html, raw, ic, toast, confirmBox, esc } from './ui.js';
import { fAmount, fText, fArea, fDate, fChips, fColor, fSelect, fDay, fNumber, bindFields, readFields, setErr } from './fields.js';
import { money, todayISO, addDays, round2, isISO, diffDays, fmtDate, num, amountInput, addMonths, ymOf } from './format.js';
import { ACC_TYPES, CARD_NETWORKS, INV_TYPES, DEBT_TYPES, ASSET_TYPES, PALETTE, EMOJIS, GROUPS, label } from './config.js';
import { balances, invInfo, debtInfo, monthSummary, firstMonth } from './calc.js';
import { openMoveForm, openAdjust, ensureOpenMonth } from './moveform.js';

const nowISO = () => new Date().toISOString();

/** Hoja con formulario y botones Guardar / Eliminar. onSave devuelve false si hay un error (la hoja sigue abierta). */
function formSheet({ title, body, saveLabel = 'Guardar', onSave, onDelete = null, delLabel = 'Eliminar', size = 'md', onChange = null }) {
  const sh = sheet({
    title, size,
    body: html`<div class="form">${body}<div class="form-actions">
      ${onDelete ? html`<button type="button" class="btn ghost danger-text" data-a="del">${ic('trash', 18)} ${delLabel}</button>` : ''}
      <button type="button" class="btn primary big" data-a="save">${ic('check', 20)} ${saveLabel}</button></div></div>`,
  });
  bindFields(sh.el, (k) => onChange && onChange(k, sh));
  sh.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a="save"],[data-a="del"]');
    if (!b) return;
    if (b.dataset.a === 'save') { const r = await onSave(readFields(sh.el), sh); if (r !== false) sh.close(); }
    else { const r = await onDelete(sh); if (r !== false) sh.close(); }
  });
  sh.el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'date' && e.target.type !== 'checkbox') { e.preventDefault(); sh.el.querySelector('[data-a="save"]').click(); }
  });
  return sh;
}

/** Ventana con opciones; devuelve el valor elegido o null. */
export function choose({ title, text = '', options }) {
  return new Promise((resolve) => {
    let done = false;
    const sh = sheet({
      title, size: 'sm',
      body: html`<div class="confirm">${text ? html`<p class="confirm-text">${text}</p>` : ''}<div class="choice-list">
        ${options.map((o) => html`<button type="button" class="btn ${o.cls || 'ghost'} block" data-v="${o.v}">${o.icon ? ic(o.icon, 18) : ''} ${o.label}</button>`)}</div></div>`,
      onClose: () => { if (!done) { done = true; resolve(null); } },
    });
    sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; done = true; resolve(b.dataset.v); sh.close(); });
  });
}

const usesRef = (m, k, id) => (m.src && m.src.k === k && m.src.id === id) || (m.dst && m.dst.k === k && m.dst.id === id);

/** Elimina (o archiva) una cuenta, tarjeta, inversión o deuda, con aviso si tiene movimientos. */
async function removeEntity(k, e) {
  const S = getState();
  const n = S.movements.filter((m) => usesRef(m, k, e.id)).length;
  const listKey = { acc: 'accounts', card: 'cards', inv: 'investments', debt: 'debts' }[k];
  const noun = { acc: 'Esta cuenta', card: 'Esta tarjeta', inv: 'Esta inversión', debt: 'Esta deuda' }[k];
  let mode = 'delete';
  if (n) {
    const archLabel = k === 'inv' ? 'Marcar como cobrada' : k === 'debt' ? 'Marcar como pagada' : 'Archivar (recomendado)';
    mode = await choose({
      title: 'Eliminar ' + e.name,
      text: `${noun} tiene ${n} movimiento${n === 1 ? '' : 's'}. Si la archivas, desaparece de las listas pero tu historial queda intacto.`,
      options: [{ v: 'archive', label: archLabel, cls: 'primary', icon: 'check' }, { v: 'delete', label: `Eliminar con sus ${n} movimientos`, cls: 'danger', icon: 'trash' }, { v: 'cancel', label: 'Cancelar' }],
    });
    if (!mode || mode === 'cancel') return false;
  } else if (!(await confirmBox({ title: 'Eliminar ' + e.name, text: 'Esta acción se puede deshacer justo después.', ok: 'Eliminar', danger: true }))) return false;
  const undo = commit((s) => {
    if (mode === 'archive') {
      const x = s[listKey].find((y) => y.id === e.id);
      if (k === 'inv') x.status = 'cobrada'; else if (k === 'debt') x.closed = true; else x.archived = true;
      return;
    }
    s[listKey] = s[listKey].filter((y) => y.id !== e.id);
    s.movements = s.movements.filter((m) => !usesRef(m, k, e.id));
    if (k === 'acc') {
      for (const i of s.investments) if (i.acc === e.id) i.acc = '';
      for (const d of s.debts) if (d.acc === e.id) d.acc = '';
    }
    for (const r of s.recurring) if (r.ref && r.ref.k === k && r.ref.id === e.id) r.ref = null;
  }, { undo: true });
  toast(mode === 'archive' ? 'Listo, quedó archivada' : 'Eliminada', { action: { label: 'Deshacer', fn: undo } });
  return true;
}

// ---------- Cuentas ----------

export function openAccountForm(acc = null, { onSaved = null, type = 'ahorros' } = {}) {
  const S = getState(), isNew = !acc;
  const a = acc || { name: '', type, color: PALETTE[(S.accounts.length * 3) % PALETTE.length], initial: '', last4: '' };
  const body = html`
    ${fText('name', a.name, { label: 'Nombre del banco o cuenta', placeholder: 'Ej.: Banco del Barrio, Efectivo', autofocus: isNew })}
    ${fChips('type', ACC_TYPES, a.type, { label: 'Tipo de cuenta' })}
    ${fAmount('initial', a.initial, { label: isNew ? '¿Cuánto tienes hoy en esta cuenta?' : 'Saldo con el que empezaste', allowNeg: true, hint: isNew ? 'Si no lo sabes exacto, pon un aproximado: lo puedes ajustar después.' : 'Para corregir el saldo de hoy usa «Ajustar saldo» dentro de la cuenta.' })}
    ${fText('last4', a.last4, { label: 'Últimos 4 dígitos (opcional)', placeholder: 'Para distinguir cuentas del mismo banco', max: 4, inputmode: 'numeric' })}
    ${fColor('color', a.color)}`;
  return formSheet({
    title: isNew ? 'Nueva cuenta' : 'Editar cuenta', body, saveLabel: isNew ? 'Agregar cuenta' : 'Guardar',
    onSave: (v, sh) => {
      if (!v.name) return setErr(sh.el, 'name', 'Escribe el nombre del banco o de la cuenta.');
      const initial = isNaN(v.initial) ? 0 : round2(v.initial);
      const last4 = (v.last4 || '').replace(/\D/g, '').slice(0, 4);
      let saved;
      commit((s) => {
        if (isNew) { saved = { id: uid('a'), name: v.name, type: v.type || 'ahorros', last4, color: v.color, initial, since: todayISO(), archived: false, createdAt: nowISO() }; s.accounts.push(saved); }
        else { saved = s.accounts.find((y) => y.id === acc.id); Object.assign(saved, { name: v.name, type: v.type, last4, color: v.color, initial }); }
      });
      toast(isNew ? 'Cuenta agregada' : 'Cuenta actualizada', { kind: 'ok' });
      if (onSaved) onSaved(saved);
    },
    onDelete: isNew ? null : () => removeEntity('acc', acc),
  });
}

export function toggleArchive(k, e) {
  const key = k === 'acc' ? 'accounts' : 'cards';
  commit((s) => { const x = s[key].find((y) => y.id === e.id); if (x) x.archived = !x.archived; });
  toast(e.archived ? 'Volvió a la lista' : 'Archivada', { kind: 'ok' });
}

// ---------- Tarjetas de crédito ----------

export function openCardForm(card = null, { onSaved = null } = {}) {
  const S = getState(), isNew = !card;
  const c = card || { name: '', network: 'Visa', limit: '', initial: '', cutDay: 0, payDay: 0, last4: '', color: ['#4F46E5', '#0F172A', '#7C3AED', '#0E7490', '#B45309', '#BE185D'][S.cards.length % 6] };
  const body = html`
    ${fText('name', c.name, { label: 'Nombre de la tarjeta', placeholder: 'Ej.: Visa del Banco del Barrio', autofocus: isNew })}
    ${fChips('network', CARD_NETWORKS.map((n) => [n, n]), c.network, { label: 'Marca' })}
    <div class="grid2">
      ${fAmount('limit', c.limit, { label: 'Cupo total' })}
      ${fAmount('initial', c.initial, { label: isNew ? '¿Cuánto debes hoy?' : 'Saldo usado al registrarla', hint: isNew ? 'El saldo usado según tu banco.' : 'Para corregir el saldo de hoy usa «Ajustar saldo».' })}
    </div>
    <div class="grid2">
      ${fDay('cutDay', c.cutDay, { label: 'Día de corte' })}
      ${fDay('payDay', c.payDay, { label: 'Día máximo de pago' })}
    </div>
    <p class="mini-help">${ic('bulb', 16)} Con el día de corte y de pago te avisamos cuánto pagar y cuándo, para que no pagues intereses.</p>
    ${fText('last4', c.last4, { label: 'Últimos 4 dígitos (opcional)', placeholder: '1234', max: 4, inputmode: 'numeric' })}
    ${fColor('color', c.color, { label: 'Color de la tarjeta' })}`;
  return formSheet({
    title: isNew ? 'Nueva tarjeta de crédito' : 'Editar tarjeta', body, saveLabel: isNew ? 'Agregar tarjeta' : 'Guardar',
    onSave: (v, sh) => {
      if (!v.name) return setErr(sh.el, 'name', 'Escribe un nombre para la tarjeta.');
      if (!isNaN(v.limit) && v.limit < 0) return setErr(sh.el, 'limit', 'El cupo no puede ser negativo.');
      const data = { name: v.name, network: v.network || '', limit: isNaN(v.limit) ? 0 : round2(v.limit), initial: isNaN(v.initial) ? 0 : round2(v.initial), cutDay: Number(v.cutDay) || 0, payDay: Number(v.payDay) || 0, last4: (v.last4 || '').replace(/\D/g, '').slice(0, 4), color: v.color };
      let saved;
      commit((s) => {
        if (isNew) { saved = { id: uid('t'), ...data, since: todayISO(), archived: false, createdAt: nowISO() }; s.cards.push(saved); }
        else { saved = s.cards.find((y) => y.id === card.id); Object.assign(saved, data); }
      });
      toast(isNew ? 'Tarjeta agregada' : 'Tarjeta actualizada', { kind: 'ok' });
      if (onSaved) onSaved(saved);
    },
    onDelete: isNew ? null : () => removeEntity('card', card),
  });
}

// ---------- Inversiones ----------

const accOptions = (S, first) => [['', first]].concat(S.accounts.filter((a) => !a.archived).map((a) => [a.id, a.name]));

export function openInvestmentForm(inv = null) {
  const S = getState(), isNew = !inv;
  const t = todayISO();
  const i = inv || { name: '', type: 'plazo', institution: '', capital: '', rate: '', start: t, end: addDays(t, 180), tax: 0, acc: '', notes: '', color: PALETTE[(S.investments.length * 5 + 9) % PALETTE.length] };
  const body = html`
    ${fText('name', i.name, { label: 'Nombre', placeholder: 'Ej.: Póliza a 180 días', autofocus: isNew })}
    ${fChips('type', INV_TYPES, i.type, { label: 'Tipo de inversión', cls: 'wrap' })}
    ${fText('institution', i.institution, { label: 'Institución (opcional)', placeholder: 'Banco, cooperativa, casa de valores…' })}
    <div class="grid2">
      ${fAmount('capital', i.capital, { label: 'Monto invertido' })}
      ${fNumber('rate', i.rate, { label: 'Tasa de interés anual', suffix: '%', placeholder: 'Ej.: 7,5' })}
    </div>
    ${fDate('start', i.start, { label: 'Fecha de inicio', quick: false })}
    <div data-show="plazo">
      <div class="field"><span>Plazo</span><div class="sugs">${[30, 60, 90, 180, 270, 360].map((d) => html`<button type="button" class="chip" data-term="${d}">${d} días</button>`)}</div></div>
      ${fDate('end', i.end, { label: 'Fecha de vencimiento', quick: false })}
      ${fNumber('tax', i.tax || '', { label: 'Retención o impuesto sobre los intereses (opcional)', suffix: '%', placeholder: '0' })}
    </div>
    ${isNew || !i.acc ? fSelect('acc', accOptions(S, 'Ya lo tenía invertido (no mover mis cuentas)'), i.acc, { label: '¿De dónde salió el dinero?', hint: 'Si eliges una cuenta, su saldo baja por el monto invertido.' }) : fSelect('acc', accOptions(S, 'No mover mis cuentas'), i.acc, { label: '¿De dónde salió el dinero?' })}
    <div class="preview" data-preview></div>
    ${fArea('notes', i.notes, { label: 'Notas (opcional)', placeholder: 'Número de certificado, condiciones…', rows: 2 })}`;
  const sh = formSheet({
    title: isNew ? 'Nueva inversión' : 'Editar inversión', body, saveLabel: isNew ? 'Agregar inversión' : 'Guardar',
    onChange: () => update(),
    onSave: (v, s2) => {
      if (!v.name) return setErr(s2.el, 'name', 'Escribe un nombre.');
      if (!(v.capital > 0)) return setErr(s2.el, 'capital', 'Escribe el monto invertido.');
      if (!isISO(v.start)) return setErr(s2.el, 'start', 'Elige la fecha de inicio.');
      const plazo = v.type === 'plazo';
      if (plazo && (!isISO(v.end) || v.end <= v.start)) return setErr(s2.el, 'end', 'El vencimiento debe ser después del inicio.');
      const data = { name: v.name, type: v.type, institution: v.institution, capital: round2(v.capital), rate: isNaN(v.rate) ? 0 : v.rate, start: v.start, end: plazo ? v.end : '', tax: plazo && !isNaN(v.tax) ? v.tax : 0, acc: v.acc || '', notes: v.notes };
      if (isNew || !inv.opened || inv.opened === inv.start) data.opened = v.start;
      commit((s) => {
        if (isNew) s.investments.push({ id: uid('i'), ...data, status: 'activa', color: i.color, createdAt: nowISO() });
        else Object.assign(s.investments.find((y) => y.id === inv.id), data);
      });
      toast(isNew ? 'Inversión agregada' : 'Inversión actualizada', { kind: 'ok' });
    },
    onDelete: isNew ? null : () => removeEntity('inv', inv),
  });
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-term]');
    if (!b) return;
    const st = sh.el.querySelector('[data-k="start"]').value || todayISO();
    sh.el.querySelector('[data-k="end"]').value = addDays(st, Number(b.dataset.term));
    update();
  });
  function update() {
    const v = readFields(sh.el);
    sh.el.querySelectorAll('[data-show="plazo"]').forEach((x) => { x.hidden = v.type !== 'plazo'; });
    const box = sh.el.querySelector('[data-preview]');
    const cap = v.capital, rate = isNaN(v.rate) ? 0 : v.rate;
    if (!(cap > 0) || !(rate > 0)) { box.innerHTML = ''; return; }
    if (v.type === 'plazo' && isISO(v.start) && isISO(v.end) && v.end > v.start) {
      const days = diffDays(v.start, v.end), tax = isNaN(v.tax) ? 0 : v.tax;
      const it = round2(cap * (rate / 100) * (days / 365) * (1 - tax / 100));
      box.innerHTML = html`${ic('sparkle', 18)}<span>En ${days} días ganarás aprox. <b>${money(it)}</b> y recibirás <b>${money(cap + it)}</b> el ${fmtDate(v.end, 'long')}.</span>`.s;
    } else {
      const y = round2(cap * (rate / 100));
      box.innerHTML = html`${ic('sparkle', 18)}<span>A esa tasa ganarías aprox. <b>${money(y)}</b> al año (${money(y / 12)} al mes).</span>`.s;
    }
  }
  update();
  return sh;
}

export function openInvestmentActions(inv) {
  const S = getState(), t = todayISO(), bal = balances(S), info = invInfo(inv, bal, t);
  const plazo = inv.type === 'plazo';
  const sh = sheet({
    title: inv.name, size: 'sm',
    body: html`<div class="act-summary">
        <div><span>Valor hoy</span><b>${money(info.current)}</b></div>
        ${plazo && info.term ? html`<div><span>${info.matured ? 'Venció' : 'Vence'}</span><b>${fmtDate(inv.end, 'medium')}</b></div>` : html`<div><span>Ganancia</span><b class="${info.gain >= 0 ? 'pos' : 'neg'}">${money(info.gain, { sign: true })}</b></div>`}
      </div>
      <div class="act-list">
        ${inv.status !== 'cobrada' ? html`
          ${plazo ? html`<button class="act" data-x="cobrar">${ic('download', 20)}<span><b>Cobrar</b><small>El dinero y los intereses pasan a una cuenta</small></span></button>
            <button class="act" data-x="renovar">${ic('refresh', 20)}<span><b>Renovar</b><small>Otro plazo, con o sin los intereses</small></span></button>` : html`
            <button class="act" data-x="valor">${ic('trend', 20)}<span><b>Actualizar valor</b><small>Registra cuánto vale hoy</small></span></button>
            <button class="act" data-x="aportar">${ic('plus', 20)}<span><b>Aportar más</b><small>Desde una de tus cuentas</small></span></button>
            <button class="act" data-x="retirar">${ic('minus', 20)}<span><b>Retirar una parte</b><small>Hacia una de tus cuentas</small></span></button>
            <button class="act" data-x="cobrar">${ic('download', 20)}<span><b>Vender o retirar todo</b><small>Cierra la inversión</small></span></button>`}` : html`<p class="mini-help">${ic('check', 16)} Esta inversión ya fue cobrada.</p>`}
        <button class="act" data-x="editar">${ic('edit', 20)}<span><b>Editar datos</b><small>Nombre, tasa, fechas…</small></span></button>
        <button class="act danger-text" data-x="eliminar">${ic('trash', 20)}<span><b>Eliminar</b><small>Quitarla de la lista</small></span></button>
      </div>`,
  });
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    const x = b.dataset.x;
    sh.close();
    const r = { k: 'inv', id: inv.id };
    if (x === 'editar') openInvestmentForm(inv);
    else if (x === 'eliminar') removeEntity('inv', inv);
    else if (x === 'valor') openAdjust(r);
    else if (x === 'aportar') openMoveForm({ type: 'transfer', preset: { dst: r } });
    else if (x === 'retirar') openMoveForm({ type: 'transfer', preset: { src: r } });
    else if (x === 'cobrar') openCollect(inv);
    else if (x === 'renovar') openRenew(inv);
  });
}

function openCollect(inv) {
  const S = getState(), t = todayISO(), bal = balances(S), info = invInfo(inv, bal, t);
  const plazo = inv.type === 'plazo';
  const interest = plazo ? (info.matured ? info.interestAtEnd : info.accrued) : 0;
  const accs = S.accounts.filter((a) => !a.archived);
  if (!accs.length) { toast('Primero agrega una cuenta para recibir el dinero.'); return; }
  const body = html`
    ${fChips('acc', accs.map((a) => [a.id, a.name]), (inv.acc && accs.some((a) => a.id === inv.acc)) ? inv.acc : accs[0].id, { label: '¿A qué cuenta entra el dinero?' })}
    ${fAmount('capital', info.value, { label: plazo ? 'Capital que recibes' : 'Valor que recibes' })}
    ${plazo ? fAmount('interest', interest, { label: 'Intereses que recibes', hint: info.matured ? 'Calculado al vencimiento. Corrígelo si tu banco pagó otro valor.' : 'Cobro anticipado: solo los intereses ganados hasta hoy (tu banco podría pagar menos).' }) : ''}
    ${fDate('date', plazo && info.matured && inv.end <= t ? inv.end : t, { label: 'Fecha del cobro' })}`;
  formSheet({
    title: 'Cobrar ' + inv.name, body, saveLabel: 'Cobrar', size: 'sm',
    onSave: async (v, sh) => {
      if (!(v.capital >= 0)) return setErr(sh.el, 'capital', 'Escribe el valor recibido.');
      if (!isISO(v.date)) return setErr(sh.el, 'date', 'Elige la fecha.');
      if (!(await ensureOpenMonth([v.date]))) return false;
      const it = plazo && !isNaN(v.interest) ? round2(v.interest) : 0;
      const value = balances(getState(), v.date).inv[inv.id] || 0;
      const undo = commit((s) => {
        const now = nowISO();
        if (it > 0) s.movements.push({ id: uid('m'), type: 'income', date: v.date, amount: it, cat: s.categories.some((c) => c.id === 'i_ren') ? 'i_ren' : s.categories.find((c) => c.type === 'income').id, dst: { k: 'acc', id: v.acc }, note: 'Intereses de ' + inv.name, createdAt: now });
        const cap = round2(v.capital);
        if (cap > 0) s.movements.push({ id: uid('m'), type: 'transfer', date: v.date, amount: cap, src: { k: 'inv', id: inv.id }, dst: { k: 'acc', id: v.acc }, note: 'Cobro de ' + inv.name, createdAt: now });
        const diff = round2(value - cap);
        if (Math.abs(diff) >= 0.005) s.movements.push({ id: uid('m'), type: 'adjust', date: v.date, amount: -diff, dst: { k: 'inv', id: inv.id }, note: 'Cierre de ' + inv.name, createdAt: now });
        s.investments.find((y) => y.id === inv.id).status = 'cobrada';
      }, { undo: true });
      toast('Inversión cobrada', { action: { label: 'Deshacer', fn: undo }, kind: 'ok' });
    },
  });
}

function openRenew(inv) {
  const S = getState(), t = todayISO(), bal = balances(S), info = invInfo(inv, bal, t);
  const term = info.term || 180;
  const start = inv.end && inv.end <= t ? inv.end : t;
  const accs = S.accounts.filter((a) => !a.archived);
  const body = html`
    ${fAmount('interest', info.matured ? info.interestAtEnd : info.accrued, { label: 'Intereses ganados en este plazo' })}
    ${fChips('dest', [['inv', 'Sumarlos a la inversión', '📈'], ['acc', 'Pasarlos a una cuenta', '🏦']], 'inv', { label: '¿Qué haces con los intereses?' })}
    <div data-show="acc" hidden>${accs.length ? fChips('acc', accs.map((a) => [a.id, a.name]), accs[0].id, { label: 'Cuenta' }) : html`<p class="mini-help">No tienes cuentas: los intereses se sumarán a la inversión.</p>`}</div>
    ${fDate('start', start, { label: 'Nuevo inicio', quick: false })}
    <div class="field"><span>Nuevo plazo</span><div class="sugs">${[30, 60, 90, 180, 270, 360].map((d) => html`<button type="button" class="chip ${d === term ? 'on' : ''}" data-term="${d}">${d} días</button>`)}</div></div>
    ${fDate('end', addDays(start, term), { label: 'Nuevo vencimiento', quick: false })}
    ${fNumber('rate', inv.rate, { label: 'Nueva tasa anual', suffix: '%' })}`;
  const sh = formSheet({
    title: 'Renovar ' + inv.name, body, saveLabel: 'Renovar', size: 'sm',
    onChange: (k, s2) => { if (k === 'dest') { const v = readFields(s2.el); s2.el.querySelector('[data-show="acc"]').hidden = v.dest !== 'acc'; } },
    onSave: async (v, s2) => {
      if (!isISO(v.start) || !isISO(v.end) || v.end <= v.start) return setErr(s2.el, 'end', 'El vencimiento debe ser después del inicio.');
      if (!(await ensureOpenMonth([v.start]))) return false;
      const it = isNaN(v.interest) ? 0 : round2(v.interest);
      const toAcc = v.dest === 'acc' && v.acc;
      const undo = commit((s) => {
        if (it > 0) s.movements.push({ id: uid('m'), type: 'income', date: v.start, amount: it, cat: s.categories.some((c) => c.id === 'i_ren') ? 'i_ren' : s.categories.find((c) => c.type === 'income').id, dst: toAcc ? { k: 'acc', id: v.acc } : { k: 'inv', id: inv.id }, note: 'Intereses de ' + inv.name, createdAt: nowISO() });
        const x = s.investments.find((y) => y.id === inv.id);
        if (!x.opened) x.opened = x.start; // la apertura (y el dinero que salió de la cuenta) queda en su fecha original
        x.start = v.start; x.end = v.end; x.rate = isNaN(v.rate) ? x.rate : v.rate;
      }, { undo: true });
      toast('Inversión renovada', { action: { label: 'Deshacer', fn: undo }, kind: 'ok' });
    },
  });
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-term]');
    if (!b) return;
    sh.el.querySelectorAll('[data-term]').forEach((x) => x.classList.toggle('on', x === b));
    sh.el.querySelector('[data-k="end"]').value = addDays(sh.el.querySelector('[data-k="start"]').value || t, Number(b.dataset.term));
  });
}

// ---------- Deudas (las que debo y las que me deben) ----------

export function openDebtForm(debt = null, { direction = 'debo' } = {}) {
  const S = getState(), isNew = !debt;
  let d = debt ? { ...debt } : { name: '', type: direction === 'me_deben' ? 'personal' : 'consumo', direction, who: '', original: '', initial: '', rate: '', payment: '', payDay: 0, start: todayISO(), acc: '', notes: '', color: PALETTE[(S.debts.length * 3 + 5) % PALETTE.length] };
  const build = () => {
    const me = d.direction === 'me_deben';
    return html`
      ${isNew ? fChips('direction', [['debo', 'Yo debo', '🙋'], ['me_deben', 'Me deben', '🤝']], d.direction, { label: '¿Qué vas a registrar?' }) : ''}
      ${fText('name', d.name, { label: 'Nombre', placeholder: me ? 'Ej.: Préstamo a mi primo' : 'Ej.: Préstamo del carro', autofocus: isNew })}
      ${me ? '' : fChips('type', DEBT_TYPES, d.type, { label: 'Tipo de deuda', cls: 'wrap' })}
      ${fText('who', d.who, { label: me ? '¿Quién te debe?' : '¿A quién le debes?', placeholder: me ? 'Nombre de la persona' : 'Banco, cooperativa, persona…' })}
      <div class="grid2">
        ${fAmount('initial', d.initial, { label: isNew ? (me ? '¿Cuánto te debe hoy?' : '¿Cuánto debes hoy?') : 'Saldo al registrarla', hint: isNew ? 'El saldo pendiente.' : 'Para corregirlo hoy usa «Ajustar saldo».' })}
        ${fAmount('original', d.original, { label: 'Monto original (opcional)' })}
      </div>
      <div class="grid2">
        ${fAmount('payment', d.payment, { label: me ? 'Cuota que te paga (opcional)' : 'Cuota mensual' })}
        ${fDay('payDay', d.payDay, { label: 'Día de pago' })}
      </div>
      ${me ? '' : fNumber('rate', d.rate, { label: 'Tasa de interés anual (opcional)', suffix: '%', placeholder: 'Ej.: 15,5', hint: 'Con la tasa calculamos cuánto pagas de intereses y cuándo terminas.' })}
      ${fDate('start', d.start, { label: me ? 'Fecha del préstamo' : 'Fecha en que empezó la deuda', quick: false })}
      ${isNew ? fSelect('acc', accOptions(S, me ? 'No, ya se lo había prestado antes' : 'No, es una deuda que ya tenía'), d.acc, { label: me ? '¿El dinero salió de una de tus cuentas?' : '¿El dinero del préstamo entró a una de tus cuentas?', hint: 'Elige una cuenta solo si es un préstamo nuevo: su saldo se moverá por el monto.' }) : ''}
      ${fArea('notes', d.notes, { label: 'Notas (opcional)', rows: 2 })}
      ${fColor('color', d.color)}`;
  };
  const sh = formSheet({
    title: isNew ? 'Nueva deuda o préstamo' : 'Editar ' + (d.direction === 'me_deben' ? 'préstamo' : 'deuda'), body: build(), saveLabel: isNew ? 'Agregar' : 'Guardar',
    onChange: (k, s2) => {
      if (k !== 'direction') return;
      const v = readFields(s2.el);
      d = { ...d, ...clean(v), direction: v.direction };
      if (d.direction === 'me_deben') d.type = 'personal';
      const form = s2.el.querySelector('.form');
      const actions = form.querySelector('.form-actions');
      form.innerHTML = build().s;
      form.appendChild(actions);
    },
    onSave: (v, s2) => {
      if (!v.name) return setErr(s2.el, 'name', 'Escribe un nombre.');
      if (isNaN(v.initial) || v.initial < 0) return setErr(s2.el, 'initial', 'Escribe el saldo pendiente.');
      if (!isISO(v.start)) return setErr(s2.el, 'start', 'Elige la fecha.');
      const dir = isNew ? v.direction || 'debo' : debt.direction;
      const data = { name: v.name, type: dir === 'me_deben' ? 'personal' : v.type || 'otro', direction: dir, who: v.who, initial: round2(v.initial), original: isNaN(v.original) ? 0 : round2(v.original), payment: isNaN(v.payment) ? 0 : round2(v.payment), payDay: Number(v.payDay) || 0, rate: dir === 'me_deben' || isNaN(v.rate) ? 0 : v.rate, start: v.start, notes: v.notes, color: v.color };
      if (isNew) data.acc = v.acc || '';
      commit((s) => {
        if (isNew) s.debts.push({ id: uid('d'), ...data, closed: false, createdAt: nowISO() });
        else Object.assign(s.debts.find((y) => y.id === debt.id), data);
      });
      toast(isNew ? 'Registrado' : 'Actualizado', { kind: 'ok' });
    },
    onDelete: isNew ? null : () => removeEntity('debt', debt),
  });
  return sh;
}

function clean(v) { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = typeof x === 'number' && isNaN(x) ? '' : x; return o; }

export function openDebtActions(debt) {
  const S = getState(), t = todayISO(), bal = balances(S), info = debtInfo(S, debt, bal, t);
  const me = debt.direction === 'me_deben';
  const r = { k: 'debt', id: debt.id };
  const sh = sheet({
    title: debt.name, size: 'sm',
    body: html`<div class="act-summary">
        <div><span>${me ? 'Te debe' : 'Debes'}</span><b>${money(info.pos)}</b></div>
        <div><span>Pagado</span><b>${Math.round(info.paidPct * 100)}%</b></div>
      </div>
      <div class="act-list">
        ${!debt.closed ? (me ? html`
          <button class="act" data-x="cobro">${ic('download', 20)}<span><b>Registrar un pago que me hicieron</b><small>Entra a una de tus cuentas</small></span></button>
          <button class="act" data-x="prestar">${ic('plus', 20)}<span><b>Prestarle más</b><small>Sale de una de tus cuentas</small></span></button>` : html`
          <button class="act" data-x="pagar">${ic('check', 20)}<span><b>Pagar cuota</b><small>Baja el saldo y cuenta como gasto del mes</small></span></button>
          <button class="act" data-x="desembolso">${ic('plus', 20)}<span><b>Recibí más dinero de este préstamo</b><small>Sube la deuda y entra a una cuenta</small></span></button>`) : ''}
        <button class="act" data-x="ajustar">${ic('scale', 20)}<span><b>Ajustar saldo</b><small>Según tu último estado de cuenta</small></span></button>
        <button class="act" data-x="editar">${ic('edit', 20)}<span><b>Editar datos</b><small>Cuota, tasa, día de pago…</small></span></button>
        <button class="act" data-x="cerrar">${ic(debt.closed ? 'refresh' : 'flag', 20)}<span><b>${debt.closed ? 'Reabrir' : me ? 'Marcar como cobrada' : 'Marcar como pagada'}</b><small>${debt.closed ? 'Vuelve a la lista de pendientes' : 'Pasa a la lista de terminadas'}</small></span></button>
        <button class="act danger-text" data-x="eliminar">${ic('trash', 20)}<span><b>Eliminar</b><small>Quitarla de la lista</small></span></button>
      </div>`,
  });
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    const x = b.dataset.x;
    sh.close();
    if (x === 'pagar') openMoveForm({ type: 'pay', preset: { dst: r } });
    else if (x === 'desembolso') openMoveForm({ type: 'transfer', preset: { src: r, note: 'Desembolso de ' + debt.name } });
    else if (x === 'cobro') openMoveForm({ type: 'transfer', preset: { src: r, amount: debt.payment > 0 ? amountInput(Math.min(debt.payment, info.pos)) : '', note: 'Pago de ' + (debt.who || debt.name) } });
    else if (x === 'prestar') openMoveForm({ type: 'transfer', preset: { dst: r, note: 'Préstamo a ' + (debt.who || debt.name) } });
    else if (x === 'ajustar') openAdjust(r);
    else if (x === 'editar') openDebtForm(debt);
    else if (x === 'eliminar') removeEntity('debt', debt);
    else if (x === 'cerrar') {
      commit((s) => { const y = s.debts.find((z) => z.id === debt.id); y.closed = !y.closed; });
      toast(debt.closed ? 'Reabierta' : '¡Felicitaciones! Quedó como terminada', { kind: 'ok' });
    }
  });
}

// ---------- Bienes (patrimonio) ----------

export function openAssetForm(asset = null) {
  const isNew = !asset;
  const a = asset || { name: '', type: 'inmueble', value: '', notes: '' };
  return formSheet({
    title: isNew ? 'Nuevo bien' : 'Editar bien',
    body: html`
      ${fText('name', a.name, { label: 'Nombre', placeholder: 'Ej.: Departamento, Auto', autofocus: isNew })}
      ${fChips('type', ASSET_TYPES, a.type, { label: 'Tipo', cls: 'wrap' })}
      ${fAmount('value', a.value, { label: '¿Cuánto vale hoy (aproximado)?', hint: 'El precio en que lo podrías vender. Actualízalo de vez en cuando.' })}
      ${fArea('notes', a.notes, { label: 'Notas (opcional)', rows: 2 })}`,
    saveLabel: isNew ? 'Agregar bien' : 'Guardar',
    onSave: (v, sh) => {
      if (!v.name) return setErr(sh.el, 'name', 'Escribe un nombre.');
      if (!(v.value >= 0)) return setErr(sh.el, 'value', 'Escribe el valor aproximado.');
      const data = { name: v.name, type: v.type, value: round2(v.value), notes: v.notes, updatedAt: nowISO() };
      commit((s) => { if (isNew) s.assets.push({ id: uid('b'), ...data }); else Object.assign(s.assets.find((y) => y.id === asset.id), data); });
      toast(isNew ? 'Bien agregado' : 'Bien actualizado', { kind: 'ok' });
    },
    onDelete: isNew ? null : async () => {
      if (!(await confirmBox({ title: 'Eliminar ' + asset.name, ok: 'Eliminar', danger: true }))) return false;
      const undo = commit((s) => { s.assets = s.assets.filter((y) => y.id !== asset.id); }, { undo: true });
      toast('Bien eliminado', { action: { label: 'Deshacer', fn: undo } });
    },
  });
}

// ---------- Metas de ahorro ----------

const GOAL_EMOJIS = ['🛟', '✈️', '🏠', '🚗', '🎓', '💍', '👶', '💻', '🏖️', '🎁', '🩺', '⭐'];

export function openGoalForm(goal = null) {
  const isNew = !goal;
  const g = goal || { name: '', icon: '🛟', target: '', deadline: '', color: '#8B5CF6' };
  return formSheet({
    title: isNew ? 'Nueva meta de ahorro' : 'Editar meta',
    body: html`
      ${fText('name', g.name, { label: '¿Para qué estás ahorrando?', placeholder: 'Ej.: Fondo de emergencia, viaje', autofocus: isNew })}
      ${fChips('icon', GOAL_EMOJIS.map((e) => [e, '', e]), g.icon, { label: 'Ícono', cls: 'emoji-chips' })}
      ${fAmount('target', g.target, { label: '¿Cuánto necesitas?' })}
      ${fDate('deadline', g.deadline, { label: '¿Para cuándo? (opcional)', quick: false, hint: 'Te diremos cuánto ahorrar cada mes para llegar.' })}
      ${fColor('color', g.color)}`,
    saveLabel: isNew ? 'Crear meta' : 'Guardar',
    onSave: (v, sh) => {
      if (!v.name) return setErr(sh.el, 'name', 'Escribe el nombre de la meta.');
      if (!(v.target > 0)) return setErr(sh.el, 'target', 'Escribe cuánto necesitas.');
      const data = { name: v.name, icon: v.icon || '⭐', target: round2(v.target), deadline: isISO(v.deadline) ? v.deadline : '', color: v.color };
      commit((s) => { if (isNew) s.goals.push({ id: uid('g'), ...data, log: [], createdAt: nowISO() }); else Object.assign(s.goals.find((y) => y.id === goal.id), data); });
      toast(isNew ? 'Meta creada' : 'Meta actualizada', { kind: 'ok' });
    },
    onDelete: isNew ? null : async () => {
      if (!(await confirmBox({ title: 'Eliminar meta', text: 'Se borrará la meta y lo registrado en ella (tus cuentas no cambian).', ok: 'Eliminar', danger: true }))) return false;
      const undo = commit((s) => { s.goals = s.goals.filter((y) => y.id !== goal.id); }, { undo: true });
      toast('Meta eliminada', { action: { label: 'Deshacer', fn: undo } });
    },
  });
}

export function openGoalMove(goal, sign = 1) {
  return formSheet({
    title: (sign > 0 ? 'Agregar a ' : 'Retirar de ') + goal.name, size: 'sm',
    body: html`${fAmount('amount', '', { label: sign > 0 ? '¿Cuánto separaste para esta meta?' : '¿Cuánto sacaste?', autofocus: true, hint: 'Es un registro de tu avance: no mueve el saldo de tus cuentas.' })}${fDate('date', todayISO())}`,
    saveLabel: sign > 0 ? 'Agregar' : 'Retirar',
    onSave: (v, sh) => {
      if (!(v.amount > 0)) return setErr(sh.el, 'amount', 'Escribe un monto mayor a cero.');
      if (!isISO(v.date)) return setErr(sh.el, 'date', 'Elige la fecha.');
      commit((s) => { s.goals.find((y) => y.id === goal.id).log.push({ date: v.date, amount: round2(sign * v.amount) }); });
      toast(sign > 0 ? '¡Un paso más cerca!' : 'Registrado', { kind: 'ok' });
    },
  });
}

// ---------- Categorías ----------

export function openCategoryForm(cat = null, type = 'expense') {
  const S = getState(), isNew = !cat;
  const c = cat || { name: '', icon: type === 'expense' ? '🛍️' : '💰', color: PALETTE[S.categories.length % PALETTE.length], group: 'gus', budget: '', type };
  const kind = c.type;
  return formSheet({
    title: isNew ? (kind === 'expense' ? 'Nueva categoría de gasto' : 'Nueva categoría de ingreso') : 'Editar categoría',
    body: html`
      ${fText('name', c.name, { label: 'Nombre', placeholder: kind === 'expense' ? 'Ej.: Gimnasio' : 'Ej.: Bonos', max: 40, autofocus: isNew })}
      ${fChips('icon', EMOJIS.map((e) => [e, '', e]), c.icon, { label: 'Ícono', cls: 'emoji-chips' })}
      ${kind === 'expense' ? fChips('group', Object.entries(GROUPS).map(([k, g]) => [k, g.label]), c.group || 'gus', { label: 'Es un gasto de…', hint: 'Sirve para la regla 50/30/20 del resumen.' }) : ''}
      ${kind === 'expense' ? fAmount('budget', c.budget || '', { label: 'Presupuesto mensual (opcional)', hint: 'Cuánto quieres gastar como máximo al mes.' }) : ''}
      ${fColor('color', c.color)}`,
    saveLabel: isNew ? 'Crear categoría' : 'Guardar',
    onSave: (v, sh) => {
      if (!v.name) return setErr(sh.el, 'name', 'Escribe un nombre.');
      const data = { name: v.name, icon: v.icon || '•', color: v.color, group: kind === 'expense' ? v.group || 'gus' : null, budget: kind === 'expense' && !isNaN(v.budget) ? round2(Math.max(0, v.budget)) : 0 };
      commit((s) => { if (isNew) s.categories.push({ id: uid('c'), type: kind, ...data, archived: false }); else Object.assign(s.categories.find((y) => y.id === cat.id), data); });
      toast(isNew ? 'Categoría creada' : 'Categoría actualizada', { kind: 'ok' });
    },
    onDelete: isNew ? null : async () => {
      const S2 = getState();
      const others = S2.categories.filter((x) => x.type === kind && x.id !== cat.id && !x.archived);
      if (!others.length) { toast('Debe quedar al menos una categoría.'); return false; }
      const n = S2.movements.filter((m) => m.cat === cat.id).length;
      const fb = others.find((x) => x.id === (kind === 'expense' ? 'c_otr' : 'i_otr')) || others[0];
      if (!(await confirmBox({ title: 'Eliminar ' + cat.name, text: n ? `Sus ${n} movimientos pasarán a «${fb.name}».` : 'No tiene movimientos.', ok: 'Eliminar', danger: true }))) return false;
      const undo = commit((s) => {
        for (const m of s.movements) if (m.cat === cat.id) m.cat = fb.id;
        for (const r of s.recurring) if (r.cat === cat.id) r.cat = fb.id;
        s.categories = s.categories.filter((y) => y.id !== cat.id);
      }, { undo: true });
      toast('Categoría eliminada', { action: { label: 'Deshacer', fn: undo } });
    },
  });
}

// ---------- Pagos fijos (recurrentes) ----------

export function openRecurringForm(rec = null) {
  const S = getState(), isNew = !rec;
  let r = rec ? { ...rec } : { type: 'expense', name: '', amount: '', cat: '', ref: null, day: 1 };
  const build = () => {
    const cats = S.categories.filter((c) => c.type === r.type && !c.archived);
    const refs = r.type === 'expense'
      ? S.accounts.filter((a) => !a.archived).map((a) => ['acc:' + a.id, a.name]).concat(S.cards.filter((c) => !c.archived).map((c) => ['card:' + c.id, c.name + ' (tarjeta)']))
      : S.accounts.filter((a) => !a.archived).map((a) => ['acc:' + a.id, a.name]);
    return html`
      ${fChips('type', [['expense', 'Gasto fijo', '📤'], ['income', 'Ingreso fijo', '📥']], r.type, { label: 'Tipo' })}
      ${fText('name', r.name, { label: 'Nombre', placeholder: r.type === 'expense' ? 'Ej.: Arriendo, Internet, Streaming' : 'Ej.: Sueldo', autofocus: isNew })}
      <div class="grid2">${fAmount('amount', r.amount, { label: 'Monto aproximado' })}${fDay('day', r.day, { label: 'Día del mes' })}</div>
      ${fSelect('cat', [['', 'Elige una categoría']].concat(cats.map((c) => [c.id, c.icon + ' ' + c.name])), r.cat, { label: 'Categoría' })}
      ${fSelect('ref', [['', r.type === 'expense' ? 'Elige con qué pagas' : 'Elige la cuenta']].concat(refs), r.ref ? r.ref.k + ':' + r.ref.id : '', { label: r.type === 'expense' ? '¿Con qué lo pagas normalmente?' : '¿A qué cuenta llega?' })}
      <p class="mini-help">${ic('bulb', 16)} Cada mes te recordaremos este pago y lo anotas con un toque.</p>`;
  };
  return formSheet({
    title: isNew ? 'Nuevo pago fijo' : 'Editar pago fijo', body: build(), saveLabel: isNew ? 'Agregar' : 'Guardar',
    onChange: (k, sh) => {
      if (k !== 'type') return;
      const v = readFields(sh.el);
      r = { ...r, ...clean(v), type: v.type, cat: '', ref: null };
      const form = sh.el.querySelector('.form'), actions = form.querySelector('.form-actions');
      form.innerHTML = build().s; form.appendChild(actions);
    },
    onSave: (v, sh) => {
      if (!v.name) return setErr(sh.el, 'name', 'Escribe un nombre.');
      if (!(v.amount > 0)) return setErr(sh.el, 'amount', 'Escribe el monto.');
      if (!(Number(v.day) >= 1)) return setErr(sh.el, 'day', 'Elige el día del mes.');
      if (!v.cat) return setErr(sh.el, 'cat', 'Elige una categoría.');
      const i = (v.ref || '').indexOf(':');
      const ref = i > 0 ? { k: v.ref.slice(0, i), id: v.ref.slice(i + 1) } : null;
      const data = { type: v.type, name: v.name, amount: round2(v.amount), day: Number(v.day), cat: v.cat, ref, active: true };
      commit((s) => { if (isNew) s.recurring.push({ id: uid('r'), ...data }); else Object.assign(s.recurring.find((y) => y.id === rec.id), data); });
      toast(isNew ? 'Pago fijo agregado' : 'Pago fijo actualizado', { kind: 'ok' });
    },
    onDelete: isNew ? null : async () => {
      if (!(await confirmBox({ title: 'Eliminar ' + rec.name, text: 'Los movimientos ya anotados no se borran.', ok: 'Eliminar', danger: true }))) return false;
      const undo = commit((s) => { s.recurring = s.recurring.filter((y) => y.id !== rec.id); }, { undo: true });
      toast('Pago fijo eliminado', { action: { label: 'Deshacer', fn: undo } });
    },
  });
}

/** Anota un pago fijo: abre el formulario ya lleno para confirmar el monto. */
export function registerRecurring(rec, ym) {
  const t = todayISO();
  const date = ymOf(t) === ym ? t : ym + '-' + String(Math.min(rec.day, 28)).padStart(2, '0');
  const preset = { amount: amountInput(rec.amount), cat: rec.cat, date, note: rec.name, rec: rec.id };
  if (rec.type === 'expense') preset.src = rec.ref; else preset.dst = rec.ref && rec.ref.k === 'acc' ? rec.ref : null;
  openMoveForm({ type: rec.type, preset });
}

// ---------- Presupuesto ----------

export function openBudgetEditor() {
  const S = getState(), t = todayISO();
  const cats = S.categories.filter((c) => c.type === 'expense' && !c.archived);
  const f = firstMonth(S), months = [];
  for (let k = 1; k <= 3; k++) { const ym = addMonths(ymOf(t), -k); if (ym >= f) months.push(monthSummary(S, ym)); }
  if (!months.length) months.push(monthSummary(S, ymOf(t)));
  const avgOf = (id) => months.reduce((s, m) => s + (m.byCat[id] || 0), 0) / months.length;
  const income = Math.max(S.settings.expectedIncome || 0, months.reduce((s, m) => s + m.income, 0) / months.length);
  const sh = sheet({
    title: 'Presupuesto mensual', size: 'lg',
    body: html`<div class="form budget-form">
      <div class="budget-top">
        <div><span>Total presupuestado</span><b data-total>${money(0)}</b></div>
        ${income > 0 ? html`<div><span>Tus ingresos del mes</span><b>${money(income)}</b></div>` : ''}
      </div>
      ${income > 0 ? html`<p class="mini-help">${ic('bulb', 16)}<span>Regla 50/30/20: hasta <b>${money(income * 0.5)}</b> en necesidades, <b>${money(income * 0.3)}</b> en gustos y al menos <b>${money(income * 0.2)}</b> para ahorrar o pagar deudas.</span></p>` : html`<p class="mini-help">${ic('bulb', 16)}<span>Pon cuánto quieres gastar como máximo en cada categoría. Deja en blanco las que no quieras controlar.</span></p>`}
      <div class="row-btns left"><button type="button" class="btn small" data-a="avg">${ic('sparkle', 16)} Usar mi gasto promedio</button><button type="button" class="btn small ghost" data-a="clear">Borrar todo</button></div>
      <div class="budget-list">${cats.map((c) => html`<div class="budget-row">
        <i class="cat-ic" style="--c:${raw(c.color)}">${c.icon}</i>
        <span><b>${c.name}</b><small>${months.length ? 'Promedio: ' + money(avgOf(c.id)) : ''}</small></span>
        <div class="money-in sm"><b>${money(0, { cents: false }).replace(/[\d.,\s•]+$/, '')}</b><input class="input" data-cat="${c.id}" inputmode="decimal" placeholder="—" value="${c.budget ? amountInput(c.budget) : ''}" aria-label="Presupuesto de ${c.name}"></div></div>`)}</div>
      <div class="form-actions"><button type="button" class="btn primary big" data-a="save">${ic('check', 20)} Guardar presupuesto</button></div></div>`,
  });
  const total = () => {
    let s = 0;
    sh.el.querySelectorAll('[data-cat]').forEach((i) => { const v = i.value.trim() ? parseFloatLoose(i.value, S.settings.style) : 0; if (v > 0) s += v; });
    sh.el.querySelector('[data-total]').textContent = money(s);
  };
  total();
  sh.el.addEventListener('input', total);
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'avg') {
      sh.el.querySelectorAll('[data-cat]').forEach((i) => { const a = avgOf(i.dataset.cat); i.value = a > 0 ? amountInput(Math.ceil(a / 5) * 5) : ''; });
      total();
    } else if (b.dataset.a === 'clear') { sh.el.querySelectorAll('[data-cat]').forEach((i) => { i.value = ''; }); total(); }
    else if (b.dataset.a === 'save') {
      const vals = {};
      sh.el.querySelectorAll('[data-cat]').forEach((i) => { const raw2 = i.value.trim(); const v = raw2 ? parseFloatLoose(raw2, S.settings.style) : 0; vals[i.dataset.cat] = v > 0 ? round2(v) : 0; });
      commit((s) => { for (const c of s.categories) if (c.id in vals) c.budget = vals[c.id]; });
      toast('Presupuesto guardado', { kind: 'ok' });
      sh.close();
    }
  });
}

function parseFloatLoose(s, style) {
  s = s.replace(/[^\d.,]/g, '');
  if (style === 'es') s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  const v = parseFloat(s);
  return isFinite(v) ? v : 0;
}

export { removeEntity, label, esc, num };
