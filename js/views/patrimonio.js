// Patrimonio: lo que tienes menos lo que debes, su composición, su evolución y tus bienes.

import { html, raw, ic, amt } from '../ui.js';
import { money, pct, monthLabel, fmtDate } from '../format.js';
import { netWorth, series } from '../calc.js';
import { area, stack } from '../charts.js';
import { pageHead, card } from './common.js';
import { ASSET_TYPES, label, emojiOf } from '../config.js';

export const title = 'Patrimonio';

export function render(ctx) {
  const { S, today, bal } = ctx;
  const nw = netWorth(S, bal, today);
  const ser = series(S, today, 12);
  const prev = ser.length > 1 ? ser[ser.length - 2] : null;
  const delta = prev ? nw.total - prev.nw : null;
  const A = [
    { k: 'cash', label: 'Bancos y efectivo', icon: '🏦', v: nw.cash, color: '#6366F1', href: '#/bancos' },
    { k: 'inv', label: 'Inversiones', icon: '📈', v: nw.inv, color: '#10B981', href: '#/inversiones' },
    { k: 'assets', label: 'Bienes (casa, auto…)', icon: '🏠', v: nw.assets, color: '#0EA5E9', href: '' },
    { k: 'rec', label: 'Lo que me deben', icon: '🤝', v: nw.rec, color: '#14B8A6', href: '#/deudas' },
  ];
  const L = [
    { k: 'cards', label: 'Tarjetas de crédito', icon: '💳', v: nw.cards, color: '#F43F5E', href: '#/tarjetas' },
    { k: 'debts', label: 'Préstamos y deudas', icon: '🏦', v: nw.debts, color: '#F59E0B', href: '#/deudas' },
  ];
  const rows = (xs, tot) => html`<ul class="nw-rows">${xs.map((x) => html`<li>${x.href ? html`<a href="${x.href}"><i class="dot" style="background:${raw(x.color)}"></i><span>${x.icon} ${x.label}</span><b>${money(x.v)}</b><em>${tot > 0 ? pct(x.v / tot) : ''}</em></a>` : html`<span class="nw-r"><i class="dot" style="background:${raw(x.color)}"></i><span>${x.icon} ${x.label}</span><b>${money(x.v)}</b><em>${tot > 0 ? pct(x.v / tot) : ''}</em></span>`}</li>`)}</ul>`;
  const lev = nw.totalAssets > 0 ? nw.totalLiab / nw.totalAssets : null;
  return html`${pageHead({ title: 'Patrimonio', sub: 'Lo que tienes menos lo que debes', actions: html`<button class="btn primary" data-act="add-asset">${ic('plus', 18)} <span class="hide-s">Bien</span></button>` })}
    <div class="dash">
      <section class="hero violet span-7"><div class="hero-glow" aria-hidden="true"></div>
        <div class="hero-top"><span>${ic('compass', 18)} Tu patrimonio neto</span></div>
        <b class="hero-v">${money(nw.total)}</b>
        <div class="hero-sub">${delta != null ? html`${amt(delta, { sign: true, cls: 'on-hero' })} desde ${monthLabel(prev.ym, { capital: false })}` : 'Con el tiempo verás cómo crece'}</div>
        <div class="hero-pills"><span class="pill">Tienes: <b>${money(nw.totalAssets)}</b></span><span class="pill">Debes: <b>${money(nw.totalLiab)}</b></span></div>
      </section>
      ${card({ title: '¿Qué tan endeudado estás?', icon: 'scale', cls: 'span-5', body: html`${stack([{ value: Math.max(0, nw.total), color: 'var(--pos)', label: 'Patrimonio' }, { value: nw.totalLiab, color: 'var(--neg)', label: 'Deudas' }], { height: 18 })}
        <p class="big-note">${lev == null ? 'Agrega tus cuentas y bienes para calcularlo.' : html`De cada ${money(100, { cents: false })} que tienes, <b>${money(lev * 100)}</b> son deuda.`}</p>
        <p class="mini-help">${ic('bulb', 16)} ${lev == null ? '' : lev <= 0.3 ? 'Muy bien: tus deudas son bajas frente a lo que tienes.' : lev <= 0.5 ? 'Aceptable. Ir bajando deudas hará crecer tu patrimonio.' : 'Tus deudas pesan mucho frente a lo que tienes: prioriza pagarlas.'}</p>` })}
      ${card({ title: 'Lo que tienes', icon: 'wallet', cls: 'span-6', action: html`<b class="pos">${money(nw.totalAssets)}</b>`, body: html`${stack(A.map((x) => ({ value: x.v, color: x.color, label: x.label })))}${rows(A, nw.totalAssets)}` })}
      ${card({ title: 'Lo que debes', icon: 'debt', cls: 'span-6', action: html`<b class="neg">${money(nw.totalLiab)}</b>`, body: nw.totalLiab > 0 ? html`${stack(L.map((x) => ({ value: x.v, color: x.color, label: x.label })))}${rows(L, nw.totalLiab)}` : html`<p class="muted small">No tienes deudas registradas. 🎉</p>` })}
      ${card({ title: 'Evolución', icon: 'trend', cls: 'span-12', body: ser.length > 1 ? area(ser.map((x) => ({ label: monthLabel(x.ym, { short: true, year: false }), title: monthLabel(x.ym), value: x.nw })), { color: 'var(--violet)' }) : html`<p class="muted small">Cada mes que cierres quedará aquí. Así verás si tu patrimonio crece.</p>` })}
      <section class="card span-12">
        <header class="card-head"><h2><i class="card-ic">${ic('wallet', 18)}</i>Mis bienes</h2><button class="btn small" data-act="add-asset">${ic('plus', 16)} Agregar</button></header>
        ${S.assets.length ? html`<ul class="asset-list">${S.assets.map((a) => html`<li><button type="button" data-act="asset" data-id="${a.id}"><i class="asset-e">${emojiOf(ASSET_TYPES, a.type)}</i><span><b>${a.name}</b><small>${label(ASSET_TYPES, a.type)}${a.updatedAt ? ' · valor al ' + fmtDate(a.updatedAt.slice(0, 10), 'medium') : ''}</small></span><b>${money(a.value)}</b></button></li>`)}</ul>`
          : html`<p class="muted small">Agrega tu casa, terreno, auto o negocio con su valor aproximado. Así tu patrimonio queda completo.</p>`}
      </section>
    </div>`;
}
