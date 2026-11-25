// Apuntes: block de notas con colores, fijadas arriba y guardado automático.

import { getState, commit, uid } from '../store.js';
import { html, raw, ic, sheet, toast, confirmBox, debounce, esc } from '../ui.js';
import { fmtDate, todayISO } from '../format.js';
import { pageHead } from './common.js';
import { NOTE_COLORS } from '../config.js';

export const title = 'Apuntes';
let q = '';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function sorted(S) {
  const nq = norm(q).trim();
  return S.notes.filter((n) => !nq || norm(n.title + ' ' + n.body).includes(nq))
    .sort((a, b) => (b.pinned - a.pinned) || ((b.updatedAt || '') > (a.updatedAt || '') ? 1 : -1));
}

function grid(S) {
  const list = sorted(S);
  if (!list.length) {
    return S.notes.length ? html`<p class="muted small">Ninguna nota coincide con «${q}».</p>`
      : html`<div class="empty"><div class="empty-ic">${ic('note', 28)}</div><h3>Tu block de notas</h3><p>Anota ideas para ahorrar, datos de tus cuentas que no sean claves, recordatorios o lo que quieras. Se guarda solo.</p><button class="btn primary" data-act="add-note">${ic('plus', 18)} Nueva nota</button></div>`;
  }
  return html`<div class="notes">${list.map((n) => html`<button type="button" class="note" data-act="note" data-id="${n.id}" style="--n:${raw(n.color)}">
    ${n.pinned ? html`<i class="note-pin" title="Fijada">${ic('pin', 16)}</i>` : ''}
    ${n.title ? html`<b>${n.title}</b>` : ''}
    <p>${n.body.length > 420 ? n.body.slice(0, 420) + '…' : n.body}</p>
    <small>${n.updatedAt ? fmtDate(n.updatedAt.slice(0, 10), n.updatedAt.slice(0, 4) === todayISO().slice(0, 4) ? 'short' : 'medium') : ''}</small></button>`)}</div>`;
}

export function render(ctx) {
  const { S } = ctx;
  return html`${pageHead({ title: 'Apuntes', sub: 'Tu block de notas', actions: html`<button class="btn primary" data-act="add-note">${ic('plus', 18)} <span class="hide-s">Nota</span></button>` })}
    <div class="notes-page">
      ${S.notes.length ? html`<label class="search wide">${ic('search', 18)}<input type="search" data-note-q placeholder="Buscar en tus notas" value="${q}" aria-label="Buscar en tus notas"></label>` : ''}
      <div id="notes-grid">${grid(S)}</div>
      <p class="mini-help">${ic('lock', 16)} No guardes aquí contraseñas ni claves de tus tarjetas.</p>
    </div>`;
}

export function onInput(e, ctx, el) {
  if (!e.target.matches('[data-note-q]')) return;
  q = e.target.value;
  el.querySelector('#notes-grid').innerHTML = grid(ctx.S).s;
}

export function openNoteEditor(id = null) {
  const S = getState();
  const n0 = id ? S.notes.find((x) => x.id === id) : null;
  let noteId = n0 ? n0.id : null;
  let color = n0 ? n0.color : NOTE_COLORS[S.notes.length % NOTE_COLORS.length];
  let pinned = n0 ? n0.pinned : false;
  const sh = sheet({
    title: n0 ? 'Nota' : 'Nueva nota', size: 'md', cls: 'note-sheet',
    body: html`<div class="note-ed" style="--n:${raw(color)}">
      <input class="note-title" data-n="title" placeholder="Título" maxlength="120" value="${n0 ? n0.title : ''}" aria-label="Título">
      <textarea class="note-body" data-n="body" placeholder="Escribe aquí…" rows="9" aria-label="Contenido">${n0 ? n0.body : ''}</textarea>
      <div class="note-tools">
        <div class="note-colors" role="radiogroup" aria-label="Color">${NOTE_COLORS.map((c) => html`<button type="button" class="color sm ${c === color ? 'on' : ''}" data-c="${c}" style="--c:${raw(c)}" role="radio" aria-checked="${c === color}" aria-label="Color"></button>`)}</div>
        <button type="button" class="icon-btn ${pinned ? 'on' : ''}" data-a="pin" aria-pressed="${pinned}" title="Fijar arriba" aria-label="Fijar arriba">${ic('pin', 20)}</button>
        ${n0 ? html`<button type="button" class="icon-btn danger-text" data-a="del" title="Eliminar" aria-label="Eliminar nota">${ic('trash', 20)}</button>` : ''}
      </div>
      <div class="note-foot"><small data-saved class="muted">${n0 ? 'Guardada' : 'Se guarda sola mientras escribes'}</small><button type="button" class="btn primary" data-a="done">Listo</button></div>
    </div>`,
    onClose: () => save.flush(),
  });
  const ed = sh.el.querySelector('.note-ed');
  const ta = sh.el.querySelector('[data-n="body"]');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(window.innerHeight * 0.55, Math.max(180, ta.scrollHeight + 4)) + 'px'; };
  grow();
  if (!n0) setTimeout(() => { try { sh.el.querySelector('[data-n="title"]').focus(); } catch (e) { /* nada */ } }, 60);
  const save = debounce(() => {
    const title = sh.el.querySelector('[data-n="title"]').value.trim();
    const body = ta.value;
    if (!noteId && !title && !body.trim()) return;
    const now = new Date().toISOString();
    commit((s) => {
      let n = noteId ? s.notes.find((x) => x.id === noteId) : null;
      if (!n) { n = { id: uid('n'), title: '', body: '', color, pinned, createdAt: now, updatedAt: now }; s.notes.push(n); noteId = n.id; }
      Object.assign(n, { title, body, color, pinned, updatedAt: now });
    });
    const sv = sh.el.querySelector('[data-saved]');
    if (sv) sv.textContent = 'Guardada';
  }, 450);
  sh.el.addEventListener('input', () => { grow(); const sv = sh.el.querySelector('[data-saved]'); if (sv) sv.textContent = 'Guardando…'; save(); });
  sh.el.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-c]');
    if (c) {
      color = c.dataset.c; ed.style.setProperty('--n', color);
      sh.el.querySelectorAll('[data-c]').forEach((b) => { const on = b === c; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      save(); return;
    }
    const a = e.target.closest('[data-a]');
    if (!a) return;
    if (a.dataset.a === 'pin') { pinned = !pinned; a.classList.toggle('on', pinned); a.setAttribute('aria-pressed', pinned); save(); }
    else if (a.dataset.a === 'done') { save.flush(); sh.close(); }
    else if (a.dataset.a === 'del') {
      if (!(await confirmBox({ title: 'Eliminar nota', ok: 'Eliminar', danger: true }))) return;
      save.flush();
      const idDel = noteId;
      const undo = commit((s) => { s.notes = s.notes.filter((x) => x.id !== idDel); }, { undo: true });
      noteId = null;
      sh.el.querySelector('[data-n="title"]').value = ''; ta.value = '';
      sh.close();
      toast('Nota eliminada', { action: { label: 'Deshacer', fn: undo } });
    }
  });
  return sh;
}

export { esc };
