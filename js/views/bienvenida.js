// Bienvenida: 4 pasos cortos para empezar (nombre y moneda, cuentas, tarjetas, ingreso del mes).

import { getState, commit, uid, replaceState, askPersist } from '../store.js';
import { html, raw, ic, toast, go } from '../ui.js';
import { todayISO, ymOf, parseAmount, getFormat, setFormat, money } from '../format.js';
import { CURRENCIES, APP_NAME, APP_TAGLINE, PALETTE, ACC_TYPES } from '../config.js';
import { buildDemo } from '../demo.js';
import { restoreFromFile } from '../backup.js';
import { icon } from '../icons.js';

export const title = 'Bienvenida';

const ob = {
  step: 0, name: '', currency: 'USD', style: 'en',
  accs: [{ name: 'Efectivo', type: 'efectivo', amount: '' }, { name: '', type: 'ahorros', amount: '' }],
  cards: [], income: '', err: '',
};

const STEPS = 4;

function dots() {
  return html`<div class="ob-dots" aria-label="Paso ${ob.step} de ${STEPS}">${Array.from({ length: STEPS }, (_, i) => html`<i class="${i + 1 === ob.step ? 'on' : i + 1 < ob.step ? 'ok' : ''}"></i>`)}</div>`;
}

function sym() { const c = CURRENCIES.find((x) => x[0] === ob.currency); return c ? c[2] : '$'; }

function welcome() {
  return html`<div class="ob-hero">
    <div class="ob-logo" aria-hidden="true">${raw(icon('logo', 64))}</div>
    <h1>${APP_NAME}</h1>
    <p class="ob-tag">${APP_TAGLINE}</p>
    <ul class="ob-benefits">
      <li><i>${ic('lightning', 20)}</i><span><b>Anota en segundos</b> tus gastos e ingresos, con un toque.</span></li>
      <li><i>${ic('pie', 20)}</i><span><b>Mira en qué se va tu dinero</b> y si estás gastando de más.</span></li>
      <li><i>${ic('compass', 20)}</i><span><b>Bancos, tarjetas, inversiones y deudas</b> en un solo lugar.</span></li>
      <li><i>${ic('lock', 20)}</i><span><b>Privado:</b> tus datos se quedan en tu equipo.</span></li>
    </ul>
    <div class="ob-actions">
      <button type="button" class="btn primary big block" data-act="ob-next">Empezar ${ic('right', 20)}</button>
      <button type="button" class="btn ghost block" data-act="ob-demo">${ic('sparkle', 18)} Ver con datos de ejemplo</button>
      <label class="link-btn center">${ic('upload', 16)} Ya tengo una copia de seguridad<input type="file" accept=".json,application/json" data-ob-restore hidden></label>
    </div></div>`;
}

function stepProfile() {
  return html`<h2>Hola 👋 Empecemos</h2><p class="ob-p">Solo te tomará un minuto.</p>
    <label class="field"><span>¿Cómo te llamas? (opcional)</span><input class="input big-in" data-ob="name" value="${ob.name}" maxlength="60" placeholder="Tu nombre" autocomplete="given-name"></label>
    <label class="field"><span>¿En qué moneda manejas tu dinero?</span><div class="select-in"><select class="input" data-ob="currency">${CURRENCIES.map(([c, n, s]) => html`<option value="${c}" ${c === ob.currency ? raw('selected') : ''}>${s} · ${n}</option>`)}</select>${ic('down', 18)}</div></label>
    <div class="field"><span>¿Cómo escribes los números?</span><div class="seg"><button type="button" class="seg-b ${ob.style === 'en' ? 'on' : ''}" data-act="ob-style" data-v="en">1,234.56</button><button type="button" class="seg-b ${ob.style === 'es' ? 'on' : ''}" data-act="ob-style" data-v="es">1.234,56</button></div></div>`;
}

function stepAccounts() {
  return html`<h2>¿Dónde tienes tu dinero?</h2><p class="ob-p">Escribe tus bancos, tu efectivo o tu billetera digital, con lo que tienes hoy en cada uno. Si no sabes el saldo exacto, pon un aproximado.</p>
    <div class="ob-rows">${ob.accs.map((a, i) => html`<div class="ob-row">
      <span class="ob-e">${(ACC_TYPES.find((t) => t[0] === a.type) || ['', '', '🏦'])[2]}</span>
      <input class="input" data-ob="acc-name" data-i="${i}" value="${a.name}" placeholder="${a.type === 'efectivo' ? 'Efectivo' : 'Nombre de tu banco'}" maxlength="60" aria-label="Nombre de la cuenta">
      <div class="money-in sm"><b>${sym()}</b><input class="input" data-ob="acc-amount" data-i="${i}" value="${a.amount}" inputmode="decimal" placeholder="0" aria-label="Saldo de hoy"></div>
      <button type="button" class="icon-btn" data-act="ob-del" data-kind="accs" data-i="${i}" aria-label="Quitar">${ic('x', 18)}</button></div>`)}</div>
    <div class="sugs">${ACC_TYPES.map(([t, l, e]) => html`<button type="button" class="chip" data-act="ob-add" data-kind="accs" data-type="${t}">${e} + ${l}</button>`)}</div>
    ${ob.err ? html`<p class="err">${ob.err}</p>` : ''}`;
}

function stepCards() {
  return html`<h2>¿Tienes tarjetas de crédito?</h2><p class="ob-p">Escribe cuánto debes hoy en cada una y su cupo. Si no tienes, sigue adelante.</p>
    <div class="ob-rows">${ob.cards.map((c, i) => html`<div class="ob-row cardrow">
      <span class="ob-e">💳</span>
      <input class="input" data-ob="card-name" data-i="${i}" value="${c.name}" placeholder="Ej.: Visa de mi banco" maxlength="60" aria-label="Nombre de la tarjeta">
      <div class="money-in sm"><b>${sym()}</b><input class="input" data-ob="card-used" data-i="${i}" value="${c.used}" inputmode="decimal" placeholder="Debo" aria-label="Cuánto debes"></div>
      <div class="money-in sm"><b>${sym()}</b><input class="input" data-ob="card-limit" data-i="${i}" value="${c.limit}" inputmode="decimal" placeholder="Cupo" aria-label="Cupo"></div>
      <button type="button" class="icon-btn" data-act="ob-del" data-kind="cards" data-i="${i}" aria-label="Quitar">${ic('x', 18)}</button></div>`)}</div>
    <button type="button" class="btn ghost" data-act="ob-add" data-kind="cards">${ic('plus', 18)} Agregar tarjeta</button>
    <p class="mini-help">${ic('bulb', 16)} Después podrás poner el día de corte y de pago para que te avisemos cuándo pagar.</p>`;
}

function stepIncome() {
  return html`<h2>¿Cuánto ganas al mes?</h2><p class="ob-p">Un aproximado de tus ingresos mensuales (sueldo, negocio…). Con esto te decimos si vas bien o si estás gastando de más, aunque tu sueldo todavía no llegue.</p>
    <label class="field big"><span class="sr-only">Ingreso mensual</span><div class="money-in big"><b>${sym()}</b><input class="input" data-ob="income" value="${ob.income}" inputmode="decimal" placeholder="0" aria-label="Ingreso mensual"></div></label>
    <p class="mini-help">${ic('lock', 16)} Es opcional y solo se guarda en tu equipo.</p>`;
}

export function render() {
  const S = getState();
  if (S.settings.onboarded) return html`<div class="ob"><div class="ob-card"><p>Ya configuraste la app.</p><a class="btn primary" href="#/inicio">Ir al inicio</a></div></div>`;
  const body = ob.step === 0 ? welcome() : ob.step === 1 ? stepProfile() : ob.step === 2 ? stepAccounts() : ob.step === 3 ? stepCards() : stepIncome();
  return html`<div class="ob ${ob.step === 0 ? 'is-welcome' : ''}">
    <div class="ob-bg" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="ob-card">
      ${ob.step > 0 ? html`<div class="ob-top"><button type="button" class="icon-btn" data-act="ob-back" aria-label="Atrás">${ic('left', 22)}</button>${dots()}<span></span></div>` : ''}
      <div class="ob-body">${body}</div>
      ${ob.step > 0 ? html`<div class="ob-foot">${ob.step === 3 && !ob.cards.length ? html`<button type="button" class="btn primary big block" data-act="ob-next">No tengo tarjetas ${ic('right', 20)}</button>` : ob.step < STEPS ? html`<button type="button" class="btn primary big block" data-act="ob-next">Siguiente ${ic('right', 20)}</button>` : html`<button type="button" class="btn primary big block" data-act="ob-finish">${ic('check', 20)} Listo, ir a mi tablero</button>`}</div>` : ''}
    </div></div>`;
}

export function mount(el) {
  const f = el.querySelector('[data-ob="name"], [data-ob="acc-name"][data-i="1"], [data-ob="income"]');
  if (f && !matchMedia('(pointer: coarse)').matches) try { f.focus({ preventScroll: true }); } catch (e) { /* nada */ }
}

export function onInput(e) {
  const t = e.target, k = t.dataset.ob, i = Number(t.dataset.i);
  if (!k) return;
  if (k === 'name') ob.name = t.value;
  else if (k === 'income') ob.income = t.value;
  else if (k === 'acc-name') ob.accs[i].name = t.value;
  else if (k === 'acc-amount') ob.accs[i].amount = t.value;
  else if (k === 'card-name') ob.cards[i].name = t.value;
  else if (k === 'card-used') ob.cards[i].used = t.value;
  else if (k === 'card-limit') ob.cards[i].limit = t.value;
}

export function onChange(e) {
  const t = e.target;
  if (t.dataset.ob === 'currency') { ob.currency = t.value; return; }
  if (t.matches('[data-ob-restore]')) { const f = t.files && t.files[0]; t.value = ''; if (f) restoreFromFile(f).then((ok) => { if (ok) go('#/inicio'); }); }
}

const val = (s) => { const v = parseAmount(s); return isNaN(v) ? 0 : Math.round(v * 100) / 100; };

export const actions = {
  'ob-next': (b, ctx, el, rerender) => {
    ob.err = '';
    if (ob.step === 1) setFormat({ style: ob.style });
    if (ob.step === 2) {
      ob.accs = ob.accs.filter((a) => a.name.trim() || String(a.amount).trim());
      for (const a of ob.accs) if (!a.name.trim()) a.name = a.type === 'efectivo' ? 'Efectivo' : (ACC_TYPES.find((t) => t[0] === a.type) || ['', 'Cuenta'])[1];
      if (!ob.accs.length) { ob.accs = [{ name: '', type: 'ahorros', amount: '' }]; ob.err = 'Agrega al menos una cuenta (puede ser tu efectivo).'; rerender(); return; }
    }
    if (ob.step === 3) ob.cards = ob.cards.filter((c) => c.name.trim() || String(c.used).trim() || String(c.limit).trim()).map((c) => ({ ...c, name: c.name.trim() || 'Tarjeta de crédito' }));
    ob.step = Math.min(STEPS, ob.step + 1);
    rerender();
    window.scrollTo(0, 0);
  },
  'ob-back': (b, ctx, el, rerender) => { ob.err = ''; ob.step = Math.max(0, ob.step - 1); rerender(); },
  'ob-style': (b, ctx, el, rerender) => { ob.style = b.dataset.v; rerender(); },
  'ob-add': (b, ctx, el, rerender) => {
    if (b.dataset.kind === 'accs') { const t = b.dataset.type; ob.accs.push({ name: t === 'efectivo' ? 'Efectivo' : t === 'digital' ? 'Billetera digital' : '', type: t, amount: '' }); }
    else ob.cards.push({ name: '', used: '', limit: '' });
    rerender();
    const rows = el.querySelectorAll('.ob-row input[data-ob$="-name"]');
    if (rows.length) try { rows[rows.length - 1].focus(); } catch (e) { /* nada */ }
  },
  'ob-del': (b, ctx, el, rerender) => { ob[b.dataset.kind].splice(Number(b.dataset.i), 1); rerender(); },
  'ob-demo': async () => {
    await replaceState(buildDemo());
    toast('Datos de ejemplo cargados. Cuando quieras, empieza con los tuyos desde Ajustes.', { kind: 'ok', timeout: 6000 });
    go('#/inicio');
  },
  'ob-finish': async () => {
    const t = todayISO(), now = new Date().toISOString();
    const cur = CURRENCIES.find((x) => x[0] === ob.currency) || CURRENCIES[0];
    commit((s) => {
      Object.assign(s.settings, { name: ob.name.trim().slice(0, 60), currency: cur[0], style: ob.style, cents: cur[3] > 0, expectedIncome: val(ob.income), onboarded: true, demo: false, startMonth: ymOf(t) });
      ob.accs.forEach((a, i) => s.accounts.push({ id: uid('a'), name: a.name.trim().slice(0, 60), type: a.type, last4: '', color: PALETTE[(i * 3) % PALETTE.length], initial: val(a.amount), since: t, archived: false, createdAt: now }));
      ob.cards.forEach((c, i) => s.cards.push({ id: uid('t'), name: c.name.slice(0, 60), network: '', last4: '', limit: Math.max(0, val(c.limit)), initial: val(c.used), cutDay: 0, payDay: 0, color: ['#4F46E5', '#0F172A', '#7C3AED', '#0E7490'][i % 4], since: t, archived: false, createdAt: now }));
    });
    askPersist();
    ob.step = 0;
    toast('¡Todo listo! Toca «+» para anotar tu primer movimiento.', { kind: 'ok', timeout: 6000 });
    go('#/inicio');
  },
};

export { money, getFormat };
