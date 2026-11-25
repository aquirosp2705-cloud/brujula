// Ajustes: perfil y moneda, apariencia, categorías, pagos fijos, copias, instalación, ejemplo y borrar todo.

import { getState, commit, wipe, replaceState } from '../store.js';
import { html, raw, ic, toast, confirmBox, go } from '../ui.js';
import { money, fmtDate, parseAmount, amountInput, getFormat } from '../format.js';
import { pageHead, card } from './common.js';
import { CURRENCIES, GROUPS, APP_NAME, VERSION } from '../config.js';
import { downloadBackup, shareBackup, canShareFiles, restoreFromFile, exportCSV } from '../backup.js';
import { isStandalone, openInstallHelp, canPrompt, promptInstall } from '../install.js';
import { openCategoryForm, openRecurringForm, openBudgetEditor } from '../entityforms.js';
import { buildDemo } from '../demo.js';

export const title = 'Ajustes';
let catTab = 'expense';

export function render(ctx) {
  const sub = ctx.route.parts[1];
  if (sub === 'categorias') return categoriesPage(ctx);
  if (sub === 'fijos') return recurringPage(ctx);
  return mainPage(ctx);
}

function mainPage(ctx) {
  const { S } = ctx;
  const st = S.settings;
  const lb = st.lastBackup ? fmtDate(st.lastBackup.slice(0, 10), 'long') : null;
  const hasData = S.accounts.length || S.movements.length || S.cards.length;
  const sym = getFormat().sym;
  return html`${pageHead({ title: 'Ajustes', sub: 'Personaliza la app y cuida tus datos' })}
    <div class="settings">
      ${card({ title: 'Tú y tu moneda', icon: 'coins', body: html`
        <label class="set-row"><span><b>Tu nombre</b><small>Para saludarte en el inicio</small></span><input class="input" data-set="name" value="${st.name}" maxlength="60" placeholder="Opcional" autocomplete="given-name"></label>
        <label class="set-row"><span><b>Moneda</b></span><div class="select-in"><select class="input" data-set="currency">${CURRENCIES.map(([c, n, s]) => html`<option value="${c}" ${c === st.currency ? raw('selected') : ''}>${s} · ${n}</option>`)}</select>${ic('down', 18)}</div></label>
        <div class="set-row"><span><b>Formato de números</b></span><div class="seg small"><button type="button" class="seg-b ${st.style === 'en' ? 'on' : ''}" data-act="set" data-k="style" data-v="en">1,234.56</button><button type="button" class="seg-b ${st.style === 'es' ? 'on' : ''}" data-act="set" data-k="style" data-v="es">1.234,56</button></div></div>
        <label class="set-row"><span><b>Mostrar centavos</b><small>${money(1234.5)}</small></span><input type="checkbox" class="switch" data-set="cents" ${st.cents ? raw('checked') : ''}></label>
        <label class="set-row"><span><b>Ingreso mensual esperado</b><small>Se usa para saber cómo vas cuando tu sueldo aún no llega</small></span><div class="money-in sm"><b>${sym}</b><input class="input" data-set="expectedIncome" inputmode="decimal" value="${st.expectedIncome ? amountInput(st.expectedIncome) : ''}" placeholder="0"></div></label>` })}
      ${card({ title: 'Apariencia', icon: 'sun', body: html`
        <div class="set-row"><span><b>Tema</b></span><div class="seg small">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => html`<button type="button" class="seg-b ${st.theme === v ? 'on' : ''}" data-act="set" data-k="theme" data-v="${v}">${l}</button>`)}</div></div>
        <label class="set-row"><span><b>Ocultar montos</b><small>Para usar la app en público. También con el ojito del inicio.</small></span><input type="checkbox" class="switch" data-set="hide" ${st.hide ? raw('checked') : ''}></label>` })}
      ${card({ title: 'Organiza tus finanzas', icon: 'grid', body: html`
        <a class="set-link" href="#/ajustes/categorias"><span><b>Categorías</b><small>${S.categories.filter((c) => c.type === 'expense').length} de gasto · ${S.categories.filter((c) => c.type === 'income').length} de ingreso</small></span>${ic('right', 18)}</a>
        <a class="set-link" href="#/ajustes/fijos"><span><b>Pagos fijos</b><small>${S.recurring.length ? S.recurring.length + ' registrados: arriendo, servicios, sueldo…' : 'Arriendo, servicios, sueldo: te los recordamos cada mes'}</small></span>${ic('right', 18)}</a>
        <button type="button" class="set-link" data-act="budget"><span><b>Presupuesto mensual</b><small>Límite de gasto por categoría</small></span>${ic('right', 18)}</button>` })}
      ${card({ title: 'Copia de seguridad', icon: 'download', body: html`
        <p class="set-p">${ic('lock', 16)}<span>Tus datos se guardan <b>solo en este equipo</b>: nadie más los ve. Descarga una copia de vez en cuando; con ella puedes pasar tus datos a otro celular o computadora.</span></p>
        <p class="set-p muted">${lb ? 'Última copia: ' + lb : 'Aún no has hecho ninguna copia.'}</p>
        <div class="row-btns left wrap">
          <button type="button" class="btn primary" data-act="backup">${ic('download', 18)} Descargar copia</button>
          ${canShareFiles() ? html`<button type="button" class="btn" data-act="share-backup">${ic('share', 18)} Compartir copia</button>` : ''}
          <label class="btn ghost file-btn">${ic('upload', 18)} Restaurar copia<input type="file" accept=".json,application/json" data-restore hidden></label>
          <button type="button" class="btn ghost" data-act="csv">${ic('list', 18)} Exportar a Excel</button>
        </div>` })}
      ${card({ title: 'Instalar la app', icon: 'phone', body: isStandalone() ? html`<p class="set-p">${ic('check', 16)} Ya la estás usando instalada.</p>` : html`<p class="set-p">Funciona en Windows, Mac, iPhone, iPad y Android, incluso sin internet.</p><button type="button" class="btn" data-act="install">${ic('download', 18)} Cómo instalar</button>` })}
      ${card({ title: 'Datos de ejemplo', icon: 'sparkle', body: st.demo ? html`<p class="set-p">Estás viendo datos de ejemplo.</p><button type="button" class="btn primary" data-act="demo-exit">Borrar el ejemplo y empezar con mis datos</button>`
        : hasData ? html`<p class="set-p muted">Para ver el ejemplo, primero descarga una copia y borra tus datos (abajo).</p>` : html`<p class="set-p">Carga datos inventados para explorar la app sin miedo a equivocarte.</p><button type="button" class="btn" data-act="demo-load">${ic('sparkle', 18)} Ver con datos de ejemplo</button>` })}
      ${card({ title: 'Zona de cuidado', icon: 'alert', cls: 'danger-zone', body: html`<p class="set-p">Borra todas tus cuentas, movimientos, notas y ajustes de este equipo. No se puede deshacer (salvo que tengas una copia).</p><button type="button" class="btn danger" data-act="wipe">${ic('trash', 18)} Borrar todos los datos</button>` })}
      ${card({ title: 'Acerca de', icon: 'info', body: html`<p class="set-p"><b>${APP_NAME}</b> · versión ${VERSION}</p><p class="set-p muted">Finanzas personales simples: bancos, tarjetas, inversiones, deudas, patrimonio y control mensual. Sin cuentas ni servidores: tu información no sale de tu equipo.</p>` })}
    </div>`;
}

function categoriesPage(ctx) {
  const { S } = ctx;
  const list = S.categories.filter((c) => c.type === catTab);
  return html`${pageHead({ title: 'Categorías', back: '#/ajustes', actions: html`<button class="btn primary" data-act="add-cat" data-type="${catTab}">${ic('plus', 18)} <span class="hide-s">Nueva</span></button>` })}
    <div class="settings">
      <div class="seg" role="tablist"><button type="button" class="seg-b ${catTab === 'expense' ? 'on' : ''}" data-act="cat-tab" data-t="expense">Gastos</button><button type="button" class="seg-b ${catTab === 'income' ? 'on' : ''}" data-act="cat-tab" data-t="income">Ingresos</button></div>
      ${card({ body: html`<ul class="cat-admin">${list.map((c) => html`<li><button type="button" data-act="cat-edit" data-id="${c.id}">
        <i class="cat-ic" style="--c:${raw(c.color)}">${c.icon}</i><span><b>${c.name}</b><small>${c.type === 'expense' ? GROUPS[c.group || 'gus'].label + (c.budget ? ' · presupuesto ' + money(c.budget) : '') : 'Ingreso'}</small></span>${ic('right', 18)}</button></li>`)}</ul>` })}
      <p class="mini-help">${ic('bulb', 16)} Toca una categoría para cambiar su nombre, ícono, color o presupuesto.</p>
    </div>`;
}

function recurringPage(ctx) {
  const { S } = ctx;
  const cats = {}; for (const c of S.categories) cats[c.id] = c;
  const name = (r) => { if (!r) return 'Sin cuenta'; const l = r.k === 'acc' ? S.accounts : S.cards; const e = l.find((x) => x.id === r.id); return e ? e.name : 'Sin cuenta'; };
  return html`${pageHead({ title: 'Pagos fijos', sub: 'Lo que pagas o recibes todos los meses', back: '#/ajustes', actions: html`<button class="btn primary" data-act="add-rec">${ic('plus', 18)} <span class="hide-s">Nuevo</span></button>` })}
    <div class="settings">
      ${S.recurring.length ? card({ body: html`<ul class="cat-admin">${S.recurring.slice().sort((a, b) => a.day - b.day).map((r) => html`<li class="${r.active ? '' : 'off'}"><button type="button" data-act="rec-edit" data-id="${r.id}">
          <i class="cat-ic" style="--c:${raw((cats[r.cat] && cats[r.cat].color) || '#94A3B8')}">${(cats[r.cat] && cats[r.cat].icon) || '🔁'}</i>
          <span><b>${r.name}</b><small>Día ${r.day} · ${name(r.ref)}${r.type === 'income' ? ' · ingreso' : ''}</small></span><b class="${r.type === 'income' ? 'pos' : ''}">${money(r.amount)}</b></button>
          <label class="mini-switch" title="Activo"><input type="checkbox" class="switch sm" data-rec-active="${r.id}" ${r.active ? raw('checked') : ''} aria-label="Activo"></label></li>`)}</ul>` })
      : card({ body: html`<div class="empty"><div class="empty-ic">${ic('repeat', 28)}</div><h3>Sin pagos fijos</h3><p>Agrega el arriendo, la luz, el internet, tus suscripciones o tu sueldo. Cada mes aparecerán en el inicio para anotarlos con un toque.</p><button class="btn primary" data-act="add-rec">${ic('plus', 18)} Agregar pago fijo</button></div>` })}
    </div>`;
}

function setSetting(k, v) {
  commit((s) => {
    s.settings[k] = v;
    if (k === 'currency') { const c = CURRENCIES.find((x) => x[0] === v); if (c) s.settings.cents = c[3] > 0; }
  });
}

export const actions = {
  set: (b) => { setSetting(b.dataset.k, b.dataset.v); },
  'cat-tab': (b, ctx, el, rerender) => { catTab = b.dataset.t; rerender(); },
  'cat-edit': (b) => { const c = getState().categories.find((x) => x.id === b.dataset.id); if (c) openCategoryForm(c); },
  'add-cat': (b) => openCategoryForm(null, b.dataset.type || 'expense'),
  'rec-edit': (b) => { const r = getState().recurring.find((x) => x.id === b.dataset.id); if (r) openRecurringForm(r); },
  'share-backup': () => shareBackup(),
  csv: () => exportCSV(),
  install: async () => { if (canPrompt()) { if (!(await promptInstall())) openInstallHelp(); } else openInstallHelp(); },
  'demo-load': async () => {
    const S = getState();
    if (S.accounts.length || S.movements.length) { toast('Primero borra tus datos para ver el ejemplo.'); return; }
    await replaceState(buildDemo());
    toast('Datos de ejemplo cargados', { kind: 'ok' });
    go('#/inicio');
  },
  wipe: async () => {
    const ok = await confirmBox({ title: 'Borrar todos los datos', text: 'Se borrarán tus cuentas, movimientos, notas y ajustes de este equipo. ¿Ya descargaste una copia?', ok: 'Borrar todo', danger: true, typeToConfirm: 'BORRAR' });
    if (!ok) return;
    await wipe();
    toast('Listo. La app quedó como nueva.');
    go('#/bienvenida');
  },
};

export function onChange(e) {
  const t = e.target;
  if (t.matches('[data-restore]')) { const f = t.files && t.files[0]; t.value = ''; if (f) restoreFromFile(f).then((ok) => { if (ok) go('#/inicio'); }); return; }
  if (t.matches('[data-rec-active]')) { const id = t.dataset.recActive, on = t.checked; commit((s) => { const r = s.recurring.find((x) => x.id === id); if (r) r.active = on; }); return; }
  const k = t.dataset && t.dataset.set;
  if (!k) return;
  if (k === 'name') setSetting('name', t.value.trim().slice(0, 60));
  else if (k === 'currency') setSetting('currency', t.value);
  else if (k === 'cents' || k === 'hide') setSetting(k, t.checked);
  else if (k === 'expectedIncome') { const v = parseAmount(t.value); setSetting('expectedIncome', isNaN(v) || v < 0 ? 0 : Math.round(v * 100) / 100); }
}

export { openBudgetEditor };
