// Datos de ejemplo (todo inventado) para explorar la app o mostrarla. Se arman relativos a la fecha de hoy.

import { emptyState } from './store.js';
import { todayISO, ymOf, addMonths, addDays, dayInMonth, daysInMonth, monthsBetween, monthEnd } from './format.js';
import { snapshot, cardInfo } from './calc.js';

export function buildDemo(today = todayISO()) {
  let seed = 20261125;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const amount = (a, b) => Math.round((a + (b - a) * rnd()) * 100) / 100;
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];

  const S = emptyState();
  const cur = ymOf(today), start = addMonths(cur, -3), since = start + '-01';
  const stamp = (d, i = 0) => d + 'T12:' + String(10 + (i % 50)).padStart(2, '0') + ':00.000Z';
  Object.assign(S.settings, { name: 'Ana', currency: 'USD', style: 'en', cents: true, expectedIncome: 2400, onboarded: true, demo: true, startMonth: start });

  const A = (id, name, type, color, initial, last4 = '') => ({ id, name, type, color, initial, last4, since, archived: false, createdAt: stamp(since) });
  S.accounts = [
    A('a_main', 'Banco Horizonte', 'ahorros', '#6366F1', 1850, '4821'),
    A('a_coop', 'Cooperativa Futuro', 'ahorros', '#10B981', 3200),
    A('a_cash', 'Efectivo', 'efectivo', '#F59E0B', 120),
    A('a_dig', 'Billetera digital', 'digital', '#EC4899', 45),
  ];
  S.cards = [
    { id: 't_visa', name: 'Visa Oro', network: 'Visa', last4: '7310', limit: 3000, initial: 380, cutDay: 20, payDay: 5, color: '#4338CA', since, archived: false, createdAt: stamp(since) },
    { id: 't_mc', name: 'Mastercard Black', network: 'Mastercard', last4: '9054', limit: 5000, initial: 0, cutDay: 10, payDay: 25, color: '#0F172A', since, archived: false, createdAt: stamp(since) },
  ];
  const iv = (o) => ({ status: 'activa', tax: 0, acc: '', notes: '', createdAt: stamp(since), ...o });
  const p1 = addDays(today, -150), p2 = addDays(today, -84);
  S.investments = [
    iv({ id: 'i_pol', name: 'Póliza a 180 días', type: 'plazo', institution: 'Cooperativa Futuro', capital: 6000, rate: 7.25, start: p1, opened: p1, end: addDays(p1, 180), color: '#10B981', notes: 'Certificado de ejemplo' }),
    iv({ id: 'i_pol2', name: 'Póliza a 90 días', type: 'plazo', institution: 'Banco Horizonte', capital: 2500, rate: 5.5, start: p2, opened: p2, end: addDays(p2, 90), color: '#14B8A6' }),
    iv({ id: 'i_fon', name: 'Fondo de inversión', type: 'fondo', institution: 'Administradora Andina', capital: 2500, rate: 5.5, start: addDays(today, -200), color: '#6366F1' }),
    iv({ id: 'i_acc', name: 'Acciones', type: 'acciones', institution: 'Casa de valores', capital: 1200, rate: 0, start: addDays(today, -300), color: '#EC4899' }),
  ];
  S.debts = [
    { id: 'd_auto', name: 'Crédito del auto', type: 'vehiculo', direction: 'debo', who: 'Banco Horizonte', original: 15000, initial: 9800, rate: 11.5, payment: 420, payDay: 15, start: addMonths(cur, -26) + '-15', acc: '', notes: '', color: '#F97316', closed: false, createdAt: stamp(since) },
    { id: 'd_fam', name: 'Préstamo familiar', type: 'personal', direction: 'debo', who: 'Tía Carmen', original: 2000, initial: 1200, rate: 0, payment: 200, payDay: 28, start: addMonths(cur, -7) + '-01', acc: '', notes: 'Sin intereses', color: '#A855F7', closed: false, createdAt: stamp(since) },
    { id: 'd_car', name: 'Préstamo a Carlos', type: 'personal', direction: 'me_deben', who: 'Carlos', original: 500, initial: 400, rate: 0, payment: 100, payDay: 30, start: addMonths(cur, -4) + '-10', acc: '', notes: '', color: '#14B8A6', closed: false, createdAt: stamp(since) },
  ];
  S.assets = [
    { id: 'b_dep', name: 'Departamento', type: 'inmueble', value: 85000, notes: 'Valor aproximado', updatedAt: stamp(since) },
    { id: 'b_auto', name: 'Auto', type: 'vehiculo', value: 14500, notes: '', updatedAt: stamp(since) },
  ];
  const budgets = { c_sup: 420, c_res: 120, c_tra: 200, c_ser: 120, c_ent: 80, c_rop: 80, c_viv: 100, c_sal: 70, c_sus: 50, c_mas: 40 };
  for (const c of S.categories) if (budgets[c.id]) c.budget = budgets[c.id];
  S.recurring = [
    { id: 'r_q1', type: 'income', name: 'Sueldo (1.ª quincena)', amount: 1200, cat: 'i_sue', ref: { k: 'acc', id: 'a_main' }, day: 15, active: true },
    { id: 'r_q2', type: 'income', name: 'Sueldo (2.ª quincena)', amount: 1200, cat: 'i_sue', ref: { k: 'acc', id: 'a_main' }, day: 30, active: true },
    { id: 'r_gym', type: 'expense', name: 'Gimnasio', amount: 30, cat: 'c_ent', ref: { k: 'card', id: 't_mc' }, day: 1, active: true },
    { id: 'r_cond', type: 'expense', name: 'Condominio', amount: 85, cat: 'c_viv', ref: { k: 'acc', id: 'a_main' }, day: 5, active: true },
    { id: 'r_int', type: 'expense', name: 'Internet', amount: 35, cat: 'c_ser', ref: { k: 'card', id: 't_visa' }, day: 10, active: true },
    { id: 'r_luz', type: 'expense', name: 'Luz', amount: 38, cat: 'c_ser', ref: { k: 'acc', id: 'a_main' }, day: 12, active: true },
    { id: 'r_str', type: 'expense', name: 'Streaming', amount: 12, cat: 'c_sus', ref: { k: 'card', id: 't_mc' }, day: 15, active: true },
    { id: 'r_cel', type: 'expense', name: 'Plan de celular', amount: 25, cat: 'c_ser', ref: { k: 'card', id: 't_visa' }, day: 27, active: true },
  ];

  const M = [];
  let n = 0;
  const acc = (id) => ({ k: 'acc', id }), card = (id) => ({ k: 'card', id });
  let autoBal = 9800;
  const emer = [{ date: since, amount: 2700 }], trip = [{ date: since, amount: 200 }];

  for (const ym of monthsBetween(start, cur)) {
    const last = ym === cur ? Number(today.slice(8)) : daysInMonth(ym);
    const add = (day, m) => {
      if (day > last) return;
      const date = dayInMonth(ym, day);
      if (date > today) return;
      M.push({ id: 'dm' + ++n, date, createdAt: stamp(date, n), note: '', ...m });
    };
    const E = (day, amt, cat, src, note = '', extra = {}) => add(day, { type: 'expense', amount: amt, cat, src, note, ...extra });
    // Ingresos
    add(15, { type: 'income', amount: 1200, cat: 'i_sue', dst: acc('a_main'), note: 'Sueldo', rec: 'r_q1' });
    add(Math.min(30, daysInMonth(ym)), { type: 'income', amount: 1200, cat: 'i_sue', dst: acc('a_main'), note: 'Sueldo', rec: 'r_q2' });
    if (rnd() > 0.3) add(20 + Math.floor(rnd() * 4), { type: 'income', amount: amount(220, 460), cat: 'i_ind', dst: acc('a_dig'), note: pick(['Diseño de logo', 'Clases particulares', 'Asesoría contable']) });
    // Pagos fijos
    E(1, 30, 'c_ent', card('t_mc'), 'Gimnasio', { rec: 'r_gym' });
    E(5, 85, 'c_viv', acc('a_main'), 'Condominio', { rec: 'r_cond' });
    E(10, 35, 'c_ser', card('t_visa'), 'Internet', { rec: 'r_int' });
    E(12, amount(32, 44), 'c_ser', acc('a_main'), 'Luz', { rec: 'r_luz' });
    E(15, 12, 'c_sus', card('t_mc'), 'Streaming', { rec: 'r_str' });
    E(27, 25, 'c_ser', card('t_visa'), 'Plan de celular', { rec: 'r_cel' });
    E(14, amount(15, 22), 'c_ser', acc('a_main'), 'Agua');
    // Día a día
    for (const d of [3, 10, 17, 24]) E(d, amount(62, 118), 'c_sup', pick([card('t_visa'), card('t_visa'), acc('a_main'), acc('a_cash')]), pick(['Supermercado', 'Compras de la semana', 'Mercado']));
    for (let i = 0; i < 4; i++) E(2 + Math.floor(rnd() * 26), amount(11, 38), 'c_res', pick([card('t_mc'), acc('a_cash'), acc('a_dig')]), pick(['Almuerzo', 'Cena con amigos', 'Cafetería', 'Pizza']));
    for (const d of [2, 9, 16, 23]) E(d, amount(30, 42), 'c_tra', card('t_visa'), 'Gasolina');
    E(6 + Math.floor(rnd() * 20), amount(4, 9), 'c_tra', acc('a_cash'), 'Taxi');
    E(8 + Math.floor(rnd() * 15), amount(18, 70), 'c_sal', acc('a_main'), pick(['Farmacia', 'Consulta médica']));
    E(11, amount(24, 32), 'c_mas', acc('a_cash'), 'Comida del perro');
    for (let i = 0; i < 2; i++) E(5 + Math.floor(rnd() * 22), amount(9, 26), 'c_ent', pick([acc('a_dig'), card('t_mc')]), pick(['Cine', 'Concierto', 'Libro']));
    if (rnd() > 0.45) E(13 + Math.floor(rnd() * 10), amount(35, 95), 'c_rop', card('t_mc'), pick(['Zapatos', 'Ropa', 'Peluquería']));
    if (rnd() > 0.6) E(7 + Math.floor(rnd() * 15), amount(25, 60), 'c_reg', acc('a_main'), 'Regalo de cumpleaños');
    if (rnd() > 0.6) E(9 + Math.floor(rnd() * 12), amount(20, 45), 'c_hog', acc('a_cash'), 'Arreglo en casa');
    // Deudas
    const it = Math.round(autoBal * 0.115 / 12 * 100) / 100;
    if (15 <= last && dayInMonth(ym, 15) <= today) { E(15, 420, 'c_deu', acc('a_main'), 'Cuota del auto', { dst: { k: 'debt', id: 'd_auto' }, interest: it }); autoBal -= 420 - it; }
    E(28, 200, 'c_deu', acc('a_main'), 'Préstamo familiar', { dst: { k: 'debt', id: 'd_fam' } });
    if (ym !== cur) add(Math.min(30, daysInMonth(ym)), { type: 'transfer', amount: 100, src: { k: 'debt', id: 'd_car' }, dst: acc('a_cash'), note: 'Pago de Carlos' });
    // Movimientos entre cuentas
    add(4, { type: 'transfer', amount: 80, src: acc('a_main'), dst: acc('a_cash'), note: 'Retiro de cajero' });
    add(19, { type: 'transfer', amount: 80, src: acc('a_main'), dst: acc('a_cash'), note: 'Retiro de cajero' });
    add(8, { type: 'transfer', amount: 40, src: acc('a_main'), dst: acc('a_dig'), note: 'Recarga' });
    add(16, { type: 'transfer', amount: 300, src: acc('a_main'), dst: acc('a_coop'), note: 'Ahorro del mes' });
    if (dayInMonth(ym, 16) <= today) { emer.push({ date: dayInMonth(ym, 16), amount: 300 }); trip.push({ date: dayInMonth(ym, 16), amount: 100 }); }
  }
  // Valor de las inversiones variables
  M.push({ id: 'dm' + ++n, type: 'adjust', date: addDays(today, -60), amount: 184.5, dst: { k: 'inv', id: 'i_acc' }, note: 'Actualización de valor', createdAt: stamp(addDays(today, -60), n) });
  M.push({ id: 'dm' + ++n, type: 'adjust', date: addDays(today, -20), amount: 61.3, dst: { k: 'inv', id: 'i_fon' }, note: 'Rendimiento del fondo', createdAt: stamp(addDays(today, -20), n) });
  S.movements = M;

  // Pagos de tarjeta en orden de fecha (pagan el saldo al corte). La Mastercard del mes actual queda pendiente.
  const pays = [];
  for (const ym of monthsBetween(start, cur)) for (const c of S.cards) { const d = dayInMonth(ym, c.payDay); if (d <= today && !(c.id === 't_mc' && ym === cur)) pays.push({ c, d }); }
  pays.sort((a, b) => (a.d < b.d ? -1 : 1));
  for (const { c, d } of pays) {
    const due = cardInfo(S, c, d).dueAmount;
    if (due > 0.005) S.movements.push({ id: 'dm' + ++n, type: 'transfer', date: d, amount: due, src: acc('a_main'), dst: card(c.id), note: 'Pago de ' + c.name, createdAt: stamp(d, n) });
  }

  S.goals = [
    { id: 'g_emer', name: 'Fondo de emergencia', icon: '🛟', color: '#8B5CF6', target: 9000, deadline: '', log: emer, createdAt: stamp(since) },
    { id: 'g_trip', name: 'Viaje a la playa', icon: '🏖️', color: '#0EA5E9', target: 1500, deadline: addMonths(cur, 5) + '-15', log: trip, createdAt: stamp(since) },
    { id: 'g_pc', name: 'Computadora nueva', icon: '💻', color: '#10B981', target: 900, deadline: '', log: [{ date: since, amount: 900 }], createdAt: stamp(since) },
  ];
  S.notes = [
    { id: 'n1', title: 'Ideas para ahorrar', body: '• Llevar almuerzo al trabajo 3 días por semana\n• Revisar suscripciones que no uso\n• Comparar el seguro del auto antes de renovarlo\n• Comprar productos de limpieza al por mayor', color: '#FEF3C7', pinned: true, createdAt: stamp(since), updatedAt: stamp(addDays(today, -3)) },
    { id: 'n2', title: 'Pendientes', body: '☐ Renovar la póliza de 90 días\n☐ Pagar el impuesto del auto\n☑ Actualizar el valor de las acciones', color: '#DCFCE7', pinned: false, createdAt: stamp(since), updatedAt: stamp(addDays(today, -6)) },
    { id: 'n3', title: 'Regalos de fin de año', body: 'Mamá: perfume (~$40)\nPapá: libro (~$25)\nSobrinos: juguetes (~$60)', color: '#FCE7F3', pinned: false, createdAt: stamp(since), updatedAt: stamp(addDays(today, -12)) },
  ];

  // Los dos primeros meses quedan cerrados; el mes pasado queda sin cerrar para ver el aviso.
  for (const ym of monthsBetween(start, addMonths(cur, -2))) {
    S.months[ym] = { closed: true, closedAt: stamp(addDays(monthEnd(ym), 2)), note: ym === start ? 'Primer mes llevando mis cuentas' : '', snap: snapshot(S, ym) };
  }
  return S;
}
