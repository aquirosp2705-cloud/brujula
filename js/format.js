// Formatos de dinero, números y fechas (en español). Todo sin depender de Intl para que se vea igual en
// Windows, Mac, iPhone y Android.

const FMT = { cur: 'USD', sym: '$', style: 'en', cents: true, hide: false };

export function setFormat(o) { Object.assign(FMT, o); }
export function getFormat() { return { ...FMT }; }

const pad = (n) => String(n).padStart(2, '0');

function group(intStr, sep) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, sep); }

/** Número con separadores según el estilo elegido: «1,234.56» (en) o «1.234,56» (es). */
export function num(n, dec = 2) {
  n = Number(n);
  if (!isFinite(n)) n = 0;
  const neg = n < 0 && Math.abs(n) >= 0.5 * Math.pow(10, -dec);
  const s = Math.abs(n).toFixed(dec);
  let [i, d] = s.split('.');
  const gs = FMT.style === 'es' ? '.' : ',';
  const ds = FMT.style === 'es' ? ',' : '.';
  i = group(i, gs);
  return (neg ? '−' : '') + i + (d ? ds + d : '');
}

function compactBody(a) {
  const one = (v, big) => { const r = Math.round(v * 10) / 10; return num(r, !big && r % 1 !== 0 ? 1 : 0); };
  if (a >= 1e6) return one(a / 1e6, a >= 1e8) + ' M';
  if (a >= 1e3) return one(a / 1e3, a >= 1e5) + ' mil';
  return num(a, 0);
}

/** Dinero: «$1,234.50», «−$12.00», «+$5.00» (sign), «$12 mil» (short). Con montos ocultos: «$ •••». */
export function money(n, opts = {}) {
  const { sign = false, cents = FMT.cents, short = false } = opts;
  const sp = FMT.sym.length > 1 ? ' ' : '';
  if (FMT.hide) return FMT.sym + sp + '•••';
  n = Number(n) || 0;
  const r = Math.round(n * 100) / 100;
  const dec = cents ? 2 : 0;
  const neg = r < 0 && Math.abs(r) >= 0.5 * Math.pow(10, -dec);
  const a = Math.abs(r);
  const body = short && a >= 1000 ? compactBody(a) : num(a, dec);
  return (neg ? '−' : sign && r > 0 && Math.abs(r) >= 0.5 * Math.pow(10, -dec) ? '+' : '') + FMT.sym + sp + body;
}

/** Porcentaje a partir de una razón: 0.256 → «26%». */
export function pct(r, dec = 0) {
  if (r == null || !isFinite(r)) return '—';
  if (FMT.hide) return '••%';
  return num(r * 100, dec) + '%';
}

/** Lee un monto escrito por la persona: «1,234.56», «1.234,56», «1234», «12,5», «$ 300». Devuelve NaN si no hay número. */
export function parseAmount(s) {
  if (typeof s === 'number') return s;
  s = String(s == null ? '' : s).trim().replace(/−/g, '-').replace(/[^\d.,-]/g, '');
  if (!s || !/\d/.test(s)) return NaN;
  const neg = s.startsWith('-');
  s = s.replace(/-/g, '');
  const lastDot = s.lastIndexOf('.'), lastCom = s.lastIndexOf(',');
  let dec = -1;
  if (lastDot >= 0 && lastCom >= 0) dec = Math.max(lastDot, lastCom);
  else if (lastDot >= 0 || lastCom >= 0) {
    const p = Math.max(lastDot, lastCom), ch = s[p];
    const count = s.split(ch).length - 1, after = s.length - p - 1;
    if (count === 1 && after !== 3) dec = p;
    else if (count === 1 && after === 3) dec = ch === (FMT.style === 'es' ? ',' : '.') ? p : -1;
  }
  const ip = (dec >= 0 ? s.slice(0, dec) : s).replace(/[.,]/g, '');
  const dp = dec >= 0 ? s.slice(dec + 1).replace(/[.,]/g, '') : '';
  const v = Number((ip || '0') + (dp ? '.' + dp : ''));
  if (!isFinite(v)) return NaN;
  return neg ? -v : v;
}

/** Monto para poner en un campo de texto (sin símbolo, con el separador decimal del estilo). */
export function amountInput(n) {
  if (n == null || n === '' || !isFinite(n)) return '';
  const r = Math.round(n * 100) / 100;
  let s = String(r);
  if (FMT.style === 'es') s = s.replace('.', ',');
  return s;
}

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ---------- Fechas (siempre texto 'AAAA-MM-DD' en hora local) ----------

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function todayISO(d = new Date()) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function parseISO(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
export const isISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseISO(s));
export const ymOf = (iso) => String(iso).slice(0, 7);

export function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return todayISO(d); }
export function diffDays(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 864e5); }

export function addMonths(ym, n) {
  let [y, m] = ym.split('-').map(Number);
  m += n;
  y += Math.floor((m - 1) / 12);
  m = (((m - 1) % 12) + 12) % 12 + 1;
  return y + '-' + pad(m);
}
export function daysInMonth(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); }
export const monthStart = (ym) => ym + '-01';
export const monthEnd = (ym) => ym + '-' + pad(daysInMonth(ym));
/** Fecha con el día pedido dentro del mes (si el mes es más corto, el último día). */
export function dayInMonth(ym, day) { return ym + '-' + pad(Math.min(Math.max(1, day | 0), daysInMonth(ym))); }

export function monthsBetween(a, b) { // a y b 'AAAA-MM', inclusive, a <= b
  const out = [];
  if (!a || !b || a > b) return out;
  for (let x = a; x <= b && out.length < 600; x = addMonths(x, 1)) out.push(x);
  return out;
}

export function monthLabel(ym, { short = false, year = true, capital = true } = {}) {
  const [y, m] = ym.split('-').map(Number);
  const n = (short ? MES3 : MESES)[m - 1];
  const s = year ? n + (short ? ' ' + String(y).slice(2) : ' ' + y) : n;
  return capital ? cap(s) : s;
}

export function fmtDate(iso, style = 'short') {
  if (!iso) return '';
  const d = parseISO(iso);
  const dd = d.getDate(), mm = d.getMonth(), yy = d.getFullYear();
  if (style === 'num') return pad(dd) + '/' + pad(mm + 1) + '/' + yy;
  if (style === 'long') return dd + ' de ' + MESES[mm] + ' de ' + yy;
  if (style === 'day') return cap(DIAS[d.getDay()]) + ' ' + dd + ' de ' + MESES[mm];
  if (style === 'dayyear') return cap(DIAS[d.getDay()]) + ' ' + dd + ' de ' + MESES[mm] + ' de ' + yy;
  if (style === 'medium') return dd + ' ' + MES3[mm] + ' ' + yy;
  return dd + ' ' + MES3[mm];
}

/** «hoy», «mañana», «en 3 días», «ayer», «hace 5 días». */
export function relDays(n) {
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  if (n > 1) return 'en ' + n + ' días';
  return 'hace ' + -n + ' días';
}

export function plural(n, one, many) { return n === 1 ? one : many; }
