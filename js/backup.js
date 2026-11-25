// Copias de seguridad (archivo .json) y exportación de movimientos para Excel (.csv).

import { getState, commit, replaceState } from './store.js';
import { APP_NAME, VERSION } from './config.js';
import { todayISO } from './format.js';
import { catMap, entityName } from './calc.js';
import { toast, confirmBox } from './ui.js';

const SLUG = APP_NAME.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function backupBlob() {
  const data = { app: 'brujula', format: 1, version: VERSION, exportedAt: new Date().toISOString(), data: getState() };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}
export const backupName = () => `${SLUG}-copia-${todayISO()}.json`;

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
}

function markBackup() { commit((s) => { s.settings.lastBackup = new Date().toISOString(); }); }

export function downloadBackup() {
  downloadBlob(backupBlob(), backupName());
  markBackup();
  toast('Copia descargada. Guárdala en un lugar seguro: tu correo, la nube o una memoria USB.', { kind: 'ok', timeout: 6000 });
}

export function canShareFiles() {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })); } catch (e) { return false; }
}

export async function shareBackup() {
  const file = new File([backupBlob()], backupName(), { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Copia de ' + APP_NAME });
      markBackup();
      toast('Copia compartida', { kind: 'ok' });
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  downloadBackup();
}

export async function readBackupFile(file) {
  if (!file) throw new Error('No elegiste ningún archivo.');
  if (file.size > 30 * 1024 * 1024) throw new Error('El archivo es demasiado grande para ser una copia.');
  let obj;
  try { obj = JSON.parse(await file.text()); } catch (e) { throw new Error('El archivo no es una copia válida.'); }
  const data = obj && obj.app === 'brujula' && obj.data ? obj.data : obj && obj.settings && Array.isArray(obj.movements) ? obj : null;
  if (!data || typeof data !== 'object') throw new Error(`El archivo no parece una copia de ${APP_NAME}.`);
  return { data, exportedAt: obj.exportedAt || null };
}

export async function restoreFromFile(file) {
  let res;
  try { res = await readBackupFile(file); } catch (e) { toast(e.message, { kind: 'err' }); return false; }
  const d = res.data;
  const n = Array.isArray(d.movements) ? d.movements.length : 0, a = Array.isArray(d.accounts) ? d.accounts.length : 0;
  const when = res.exportedAt ? new Date(res.exportedAt).toLocaleDateString('es') : 'fecha desconocida';
  const ok = await confirmBox({
    title: 'Restaurar copia',
    text: `Copia del ${when}: ${a} cuentas y ${n} movimientos. Esto reemplaza TODO lo que tienes ahora en este equipo.`,
    ok: 'Restaurar', danger: true,
  });
  if (!ok) return false;
  d.settings = { ...(d.settings || {}), onboarded: true };
  await replaceState(d);
  toast('Copia restaurada', { kind: 'ok' });
  return true;
}

/** Movimientos a CSV (se abre en Excel). Separador «;» y decimales según el formato elegido. */
export function exportCSV() {
  const S = getState(), cats = catMap(S);
  const dec = S.settings.style === 'es' ? ',' : '.';
  const q = (s) => { s = String(s == null ? '' : s); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const n = (x) => (Math.round(x * 100) / 100).toFixed(2).replace('.', dec);
  const TYPE = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia', adjust: 'Ajuste de saldo' };
  const rows = [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Desde', 'Hacia', 'Monto', 'Interés'].join(';')];
  const list = S.movements.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const m of list) {
    const signed = m.type === 'expense' ? -m.amount : m.amount;
    rows.push([m.date.split('-').reverse().join('/'), TYPE[m.type], m.cat && cats[m.cat] ? cats[m.cat].name : '', q(m.note), q(m.src ? entityName(S, m.src) : ''), q(m.dst ? entityName(S, m.dst) : ''), n(signed), m.interest ? n(m.interest) : ''].map((x, i) => (i === 1 || i === 2 ? q(x) : x)).join(';'));
  }
  const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${SLUG}-movimientos-${todayISO()}.csv`);
  toast(`Exportados ${list.length} movimientos`, { kind: 'ok' });
}
