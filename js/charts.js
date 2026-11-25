// Gráficos en SVG hechos a mano (sin librerías: livianos y sin internet). Se adaptan al ancho y al tema claro/oscuro.

import { money, num } from './format.js';
import { esc, raw } from './ui.js';

let gid = 0;

function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const k of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * p >= v) return k * p;
  return 10 * p;
}

/** Dona por categorías. segs: [{ value, color, label }] */
export function donut(segs, { size = 200, stroke = 26, center = '', sub = '' } = {}) {
  const items = segs.filter((s) => s.value > 0);
  const total = items.reduce((s, x) => s + x.value, 0);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, cx = size / 2;
  const gap = items.length > 1 ? Math.min(3, c * 0.004 + 1.5) : 0;
  let off = 0, arcs = '';
  if (total > 0) {
    for (const s of items) {
      const len = (s.value / total) * c;
      const vis = Math.max(0.01, len - gap);
      arcs += `<circle r="${r}" cx="${cx}" cy="${cx}" fill="none" stroke="${esc(s.color)}" stroke-width="${stroke}" stroke-dasharray="${vis.toFixed(2)} ${(c - vis).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"><title>${esc(s.label)}: ${esc(money(s.value))} (${num((s.value / total) * 100, 0)}%)</title></circle>`;
      off += len;
    }
  } else arcs = `<circle r="${r}" cx="${cx}" cy="${cx}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>`;
  return raw(`<svg viewBox="0 0 ${size} ${size}" class="chart donut" role="img" aria-label="${esc(sub || 'Distribución')}">
    <g class="donut-g" transform="rotate(-90 ${cx} ${cx})">${arcs}</g>
    <text x="50%" y="${center && sub ? '47%' : '52%'}" class="donut-c" text-anchor="middle" dominant-baseline="middle">${esc(center)}</text>
    ${sub ? `<text x="50%" y="62%" class="donut-s" text-anchor="middle" dominant-baseline="middle">${esc(sub)}</text>` : ''}
  </svg>`);
}

/** Barras agrupadas por mes. data: [{ label, values:[n, n], hl }]; series: [{ color, label }] */
export function bars(data, series, { height = 220 } = {}) {
  const W = 640, H = height, pl = 54, pr = 8, pt = 14, pb = 30;
  const n = Math.max(1, data.length), k = series.length;
  const maxV = niceMax(Math.max(1, ...data.flatMap((d) => d.values.map((v) => Math.max(0, v)))));
  const gw = (W - pl - pr) / n;
  const bw = Math.max(4, Math.min(22, (gw * 0.72) / k));
  const y = (v) => pt + (H - pt - pb) * (1 - Math.max(0, v) / maxV);
  let g = '';
  for (let t = 0; t <= 4; t++) {
    const v = (maxV / 4) * t, yy = y(v);
    g += `<line x1="${pl}" x2="${W - pr}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" class="grid"/><text x="${pl - 8}" y="${(yy + 4).toFixed(1)}" class="axis" text-anchor="end">${esc(money(v, { short: true, cents: false }))}</text>`;
  }
  let b = '';
  data.forEach((d, i) => {
    const gx = pl + gw * i + (gw - bw * k - (k - 1) * 3) / 2;
    d.values.forEach((v, j) => {
      const x = gx + j * (bw + 3), yy = y(v), h = Math.max(v > 0 ? 2 : 0, H - pb - yy);
      b += `<rect x="${x.toFixed(1)}" y="${(H - pb - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(5, bw / 2).toFixed(1)}" fill="${esc(series[j].color)}" class="bar-r" style="animation-delay:${i * 30}ms"><title>${esc(d.title || d.label)} · ${esc(series[j].label)}: ${esc(money(v))}</title></rect>`;
    });
    b += `<text x="${(pl + gw * i + gw / 2).toFixed(1)}" y="${H - 9}" class="axis ${d.hl ? 'hl' : ''}" text-anchor="middle">${esc(d.label)}</text>`;
  });
  return raw(`<svg viewBox="0 0 ${W} ${H}" class="chart bars" role="img" aria-label="${esc(series.map((s) => s.label).join(' y '))} por mes" preserveAspectRatio="xMidYMid meet">${g}${b}</svg>`);
}

/** Línea con área (patrimonio, saldos). points: [{ label, value }] */
export function area(points, { height = 200, color = 'var(--brand)', showLast = true } = {}) {
  const W = 640, H = height, pl = 54, pr = 14, pt = 18, pb = 28;
  const id = 'ga' + ++gid;
  if (!points.length) return raw('');
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi === lo) { hi += Math.abs(hi) * 0.1 || 1; lo -= Math.abs(lo) * 0.1 || 1; }
  const padV = (hi - lo) * 0.12;
  hi += padV; lo -= lo >= 0 && lo - padV < 0 ? lo : padV;
  const n = points.length;
  const x = (i) => (n === 1 ? (pl + W - pr) / 2 : pl + ((W - pl - pr) * i) / (n - 1));
  const y = (v) => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
  const pts = points.map((p, i) => [x(i), y(p.value)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const base = y(Math.max(lo, Math.min(hi, lo >= 0 ? lo : 0)));
  const areaD = line + ` L${pts[n - 1][0].toFixed(1)} ${(H - pb).toFixed(1)} L${pts[0][0].toFixed(1)} ${(H - pb).toFixed(1)} Z`;
  let grid = '';
  for (let t = 0; t <= 3; t++) {
    const v = lo + ((hi - lo) / 3) * t, yy = y(v);
    grid += `<line x1="${pl}" x2="${W - pr}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" class="grid"/><text x="${pl - 8}" y="${(yy + 4).toFixed(1)}" class="axis" text-anchor="end">${esc(money(v, { short: true, cents: false }))}</text>`;
  }
  if (lo < 0 && hi > 0) grid += `<line x1="${pl}" x2="${W - pr}" y1="${base.toFixed(1)}" y2="${base.toFixed(1)}" class="zero"/>`;
  const every = Math.max(1, Math.ceil(n / 8));
  let labels = '';
  points.forEach((p, i) => { if (i % every === 0 || i === n - 1) labels += `<text x="${x(i).toFixed(1)}" y="${H - 8}" class="axis" text-anchor="middle">${esc(p.label)}</text>`; });
  const dots = pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === n - 1 ? 5 : 3}" class="pt ${i === n - 1 ? 'last' : ''}" style="color:${esc(color)}"><title>${esc(points[i].title || points[i].label)}: ${esc(money(points[i].value))}</title></circle>`).join('');
  const last = showLast ? `<text x="${Math.min(W - pr - 4, pts[n - 1][0]).toFixed(1)}" y="${Math.max(12, pts[n - 1][1] - 12).toFixed(1)}" class="lbl" text-anchor="${n > 1 ? 'end' : 'middle'}">${esc(money(points[n - 1].value, { short: true }))}</text>` : '';
  return raw(`<svg viewBox="0 0 ${W} ${H}" class="chart area" role="img" aria-label="Evolución" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${esc(color)}" stop-opacity=".32"/><stop offset="1" stop-color="${esc(color)}" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${areaD}" fill="url(#${id})" class="area-fill"/><path d="${line}" fill="none" stroke="${esc(color)}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" class="area-line"/>${dots}${labels}${last}</svg>`);
}

/** Línea mínima para tarjetas pequeñas. */
export function spark(values, { w = 120, h = 36, color = 'currentColor' } = {}) {
  if (!values || values.length < 2) return raw('');
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi === lo) { hi += 1; lo -= 1; }
  const n = values.length;
  const pts = values.map((v, i) => [(w * i) / (n - 1), 3 + (h - 6) * (1 - (v - lo) / (hi - lo))]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return raw(`<svg viewBox="0 0 ${w} ${h}" class="spark" width="${w}" height="${h}" aria-hidden="true" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${esc(color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`);
}

/** Anillo de progreso (metas). */
export function ring(pct, { size = 64, stroke = 7, color = 'var(--brand)', label = '' } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct || 0));
  return raw(`<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="ring" role="img" aria-label="${esc(label || Math.round(p * 100) + '%')}">
    <circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
    <circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="${esc(color)}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})" class="ring-p"/>
    <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" class="ring-t">${esc(label || Math.round(p * 100) + '%')}</text></svg>`);
}

/** Medidor semicircular (salud financiera, 0 a 100). */
export function gauge(score, { size = 180, color = 'var(--brand)' } = {}) {
  const s = Math.max(0, Math.min(100, score || 0));
  const r = size / 2 - 14, cx = size / 2, cy = size / 2 + 4, len = Math.PI * r;
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return raw(`<svg viewBox="0 0 ${size} ${size / 2 + 18}" class="gauge" role="img" aria-label="Puntaje ${s} de 100">
    <path d="${d}" fill="none" stroke="var(--track)" stroke-width="14" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${esc(color)}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${((len * s) / 100).toFixed(2)} ${len.toFixed(2)}" class="gauge-p"/>
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" class="gauge-t">${s}</text><text x="${cx}" y="${cy + 12}" text-anchor="middle" class="gauge-s">de 100</text></svg>`);
}

/** Barra apilada horizontal (HTML). parts: [{ value, color, label }] */
export function stack(parts, { height = 14 } = {}) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  if (total <= 0) return raw(`<div class="stack" style="height:${height}px"></div>`);
  return raw(`<div class="stack" style="height:${height}px">${parts.filter((p) => p.value > 0).map((p) => `<i style="width:${((p.value / total) * 100).toFixed(2)}%;background:${esc(p.color)}" title="${esc(p.label)}: ${esc(money(p.value))}"></i>`).join('')}</div>`);
}
