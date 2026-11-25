// Metas de ahorro con anillos de progreso y cuánto ahorrar al mes para llegar.

import { html, raw, ic } from '../ui.js';
import { money, fmtDate, plural } from '../format.js';
import { goalInfo } from '../calc.js';
import { ring } from '../charts.js';
import { pageHead, card } from './common.js';

export const title = 'Metas de ahorro';

export function render(ctx) {
  const { S, today } = ctx;
  const goals = S.goals.map((g) => ({ g, i: goalInfo(g, today) }));
  const active = goals.filter((x) => !x.i.done), done = goals.filter((x) => x.i.done);
  const saved = goals.reduce((s, x) => s + x.i.saved, 0), target = goals.reduce((s, x) => s + x.i.target, 0);
  const perMonth = active.reduce((s, x) => s + (x.i.perMonth || 0), 0);
  const goalCard = ({ g, i }) => html`<article class="goal ${i.done ? 'done' : ''}" style="--c:${raw(g.color)}">
    <div class="goal-top">${ring(i.pct, { size: 92, stroke: 9, color: g.color })}<div><span class="goal-e">${g.icon}</span><b>${g.name}</b><small>${money(i.saved)} de ${money(i.target)}</small></div></div>
    ${i.done ? html`<p class="goal-msg good">${ic('check', 16)} ¡Meta cumplida! 🎉</p>`
      : html`<p class="goal-msg">Te faltan <b>${money(i.left)}</b>${g.deadline ? html` para el ${fmtDate(g.deadline, 'long')}` : ''}.</p>
        ${i.perMonth ? html`<p class="goal-msg ${i.late ? 'bad' : ''}">${i.late ? 'La fecha ya pasó: ' : ''}Ahorra <b>${money(i.perMonth)}</b> al mes${i.monthsLeft ? ` durante ${i.monthsLeft} ${plural(i.monthsLeft, 'mes', 'meses')}` : ''}.</p>` : ''}`}
    <div class="row-btns left">
      ${i.done ? '' : html`<button class="btn small primary" data-act="goal-add" data-id="${g.id}">${ic('plus', 16)} Agregar</button>`}
      <button class="btn small ghost" data-act="goal-sub" data-id="${g.id}">${ic('minus', 16)} Retirar</button>
      <button class="btn small ghost" data-act="goal-edit" data-id="${g.id}">${ic('edit', 16)} Editar</button>
    </div></article>`;
  return html`${pageHead({ title: 'Metas de ahorro', sub: 'Ponle nombre a lo que quieres lograr', actions: html`<button class="btn primary" data-act="add-goal">${ic('plus', 18)} <span class="hide-s">Meta</span></button>` })}
    <div class="dash">
      ${goals.length ? html`<section class="hero pink span-12"><div class="hero-glow" aria-hidden="true"></div>
        <div class="hero-top"><span>${ic('target', 18)} Llevas ahorrado para tus metas</span></div>
        <b class="hero-v">${money(saved)}</b>
        <div class="hero-sub">de ${money(target)} en ${goals.length} ${plural(goals.length, 'meta', 'metas')}</div>
        ${perMonth ? html`<div class="hero-pills"><span class="pill">Para llegar a tiempo: <b>${money(perMonth)}</b> al mes</span></div>` : ''}</section>
        <div class="goals span-12">${active.map(goalCard)}${done.map(goalCard)}</div>`
      : html`<div class="span-12">${card({ body: html`<div class="empty"><div class="empty-ic">${ic('target', 28)}</div><h3>¿Para qué estás ahorrando?</h3><p>Un fondo de emergencia, un viaje, tu casa, los estudios… Crea una meta y te diremos cuánto separar cada mes.</p><button class="btn primary" data-act="add-goal">${ic('plus', 18)} Crear meta</button></div>` })}</div>`}
      ${card({ cls: 'span-12 tip', body: html`<p>${ic('bulb', 18)} <span><b>Págate primero:</b> apenas recibas tu sueldo, separa lo de tus metas. Lo ideal es empezar por un fondo de emergencia de 3 a 6 meses de gastos.</span></p>` })}
    </div>`;
}
