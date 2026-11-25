// Instalar la app (Windows, Mac, iPhone/iPad y Android). En Chrome/Edge se usa el aviso del navegador;
// en Safari (iPhone, iPad y Mac) se explican los pasos, porque allí no existe ese aviso.

import { APP_NAME } from './config.js';
import { sheet, html, raw, ic, toast } from './ui.js';

let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; document.dispatchEvent(new CustomEvent('br-install-ready')); });
window.addEventListener('appinstalled', () => { deferred = null; toast('¡' + APP_NAME + ' quedó instalada!', { kind: 'ok' }); });

export const isStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
export const canPrompt = () => !!deferred;

export async function promptInstall() {
  if (!deferred) return false;
  const d = deferred; deferred = null;
  d.prompt();
  try { const r = await d.userChoice; return r && r.outcome === 'accepted'; } catch (e) { return false; }
}

export function platform() {
  const ua = navigator.userAgent || '';
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh/.test(ua)) return /Chrome|Edg\//.test(ua) ? 'desktop' : 'mac';
  return 'desktop';
}

const GUIDES = {
  ios: ['iPhone o iPad', [
    'Abre esta página en <b>Safari</b>.',
    'Toca el botón <b>Compartir</b> (el cuadrado con una flecha hacia arriba).',
    'Baja y elige <b>«Agregar a pantalla de inicio»</b>.',
    'Toca <b>«Agregar»</b>. El ícono aparecerá junto a tus otras apps.',
  ]],
  android: ['Celular Android', [
    'Abre esta página en <b>Chrome</b>.',
    'Toca el menú <b>⋮</b> (arriba a la derecha).',
    'Elige <b>«Instalar app»</b> o <b>«Agregar a la pantalla principal»</b>.',
    'Confirma. La app quedará en tu pantalla y en tu lista de apps.',
  ]],
  desktop: ['Computadora con Windows (Chrome o Edge)', [
    'Abre esta página en <b>Google Chrome</b> o <b>Microsoft Edge</b>.',
    'En la barra de direcciones, haz clic en el ícono <b>Instalar</b> (una pantalla con una flecha).',
    'Si no lo ves: menú <b>⋮</b> o <b>⋯</b> → <b>«Transmitir, guardar y compartir»</b> o <b>«Aplicaciones»</b> → <b>«Instalar»</b>.',
    'Se abrirá en su propia ventana y tendrá acceso directo en el menú Inicio.',
  ]],
  mac: ['Mac (Safari)', [
    'Abre esta página en <b>Safari</b> (macOS Sonoma o más nuevo).',
    'En el menú <b>Archivo</b>, elige <b>«Agregar al Dock»</b>.',
    'Confirma. La app quedará en tu Dock y en Launchpad.',
    'En Chrome para Mac: usa el ícono <b>Instalar</b> de la barra de direcciones.',
  ]],
};

export function openInstallHelp() {
  if (isStandalone()) { toast('Ya estás usando la app instalada.'); return; }
  const p = platform();
  const order = [p].concat(Object.keys(GUIDES).filter((k) => k !== p));
  const guide = (k, open) => { const [t, steps] = GUIDES[k]; return `<details class="guide" ${open ? 'open' : ''}><summary>${t}${k === p ? ' <em class="tag good">tu equipo</em>' : ''}</summary><ol>${steps.map((s) => `<li>${s}</li>`).join('')}</ol></details>`; };
  const sh = sheet({
    title: 'Instalar ' + APP_NAME, size: 'md',
    body: html`<div class="install">
      <p>Instalada, ${APP_NAME} se abre como cualquier app, a pantalla completa y <b>funciona sin internet</b>. Tus datos se guardan solo en este equipo.</p>
      ${canPrompt() ? html`<button type="button" class="btn primary big block" data-a="prompt">${ic('download', 20)} Instalar ahora</button>` : ''}
      ${raw(order.map((k, i) => guide(k, i === 0)).join(''))}
    </div>`,
  });
  sh.el.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-a="prompt"]')) return;
    const ok = await promptInstall();
    if (ok) sh.close();
  });
}
