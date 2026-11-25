// Instalar la app (Windows, Mac, iPhone/iPad y Android). En Chrome/Edge se usa el aviso del navegador;
// en Safari (iPhone, iPad y Mac) se explican los pasos, porque allí no existe ese aviso.

import { APP_NAME } from './config.js';
import { sheet, html, raw, ic, toast } from './ui.js';

let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; document.dispatchEvent(new CustomEvent('br-install-ready')); });
window.addEventListener('appinstalled', () => { deferred = null; toast('¡' + APP_NAME + ' quedó instalada! Búscala en el menú Inicio o en tu pantalla de apps.', { kind: 'ok', timeout: 8000 }); });

export const isStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
export const canPrompt = () => !!deferred;

export async function promptInstall() {
  if (!deferred) return false;
  const d = deferred; deferred = null;
  d.prompt();
  try { const r = await d.userChoice; return r && r.outcome === 'accepted'; } catch (e) { return false; }
}

/** ¿Dónde se está viendo? (decide qué instrucciones mostrar primero). */
export function platform() {
  const ua = navigator.userAgent || '';
  if (/Electron\/|; wv\)|FBAN|FBAV|Instagram|Line\//.test(ua)) return 'embedded';
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Edg\//.test(ua)) return 'edge';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua)) return 'mac';
  return 'other';
}

const GUIDES = {
  chrome: ['Computadora con Google Chrome', [
    'En la barra de direcciones, a la derecha, haz clic en el ícono <b>Instalar</b> (una pantalla con una flecha hacia abajo).',
    'Si no lo ves: menú <b>⋮</b> → <b>«Transmitir, guardar y compartir»</b> → <b>«Instalar página como aplicación»</b>.',
    'Confirma con <b>Instalar</b>: se abre en su propia ventana, sin barra del navegador.',
    'Para tenerla a mano en Windows: búscala en el menú <b>Inicio</b>, haz clic derecho y elige <b>«Anclar a la barra de tareas»</b>, o arrástrala desde el menú Inicio al escritorio.',
  ]],
  edge: ['Computadora con Microsoft Edge', [
    'En la barra de direcciones, haz clic en el ícono <b>«Aplicación disponible»</b> (tres cuadritos con un +).',
    'Si no lo ves: menú <b>⋯</b> → <b>«Aplicaciones»</b> → <b>«Instalar este sitio como una aplicación»</b>.',
    'Confirma con <b>Instalar</b>. Edge te ofrece anclarla a la barra de tareas, al Inicio y crear un ícono en el escritorio: marca lo que quieras.',
  ]],
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
  mac: ['Mac con Safari', [
    'Abre esta página en <b>Safari</b> (macOS Sonoma o más nuevo).',
    'En el menú <b>Archivo</b>, elige <b>«Agregar al Dock»</b>.',
    'Confirma. La app quedará en tu Dock y en Launchpad.',
  ]],
};

export function openInstallHelp() {
  if (isStandalone()) { toast('Ya estás usando la app instalada.'); return; }
  const p = platform();
  const first = GUIDES[p] ? p : 'chrome';
  const order = [first].concat(Object.keys(GUIDES).filter((k) => k !== first));
  const guide = (k, open) => { const [t, steps] = GUIDES[k]; return `<details class="guide" ${open ? 'open' : ''}><summary>${t}${k === p ? ' <em class="tag good">tu navegador</em>' : ''}</summary><ol>${steps.map((s) => `<li>${s}</li>`).join('')}</ol></details>`; };
  const link = location.href.split('#')[0];
  const sh = sheet({
    title: 'Instalar ' + APP_NAME, size: 'md',
    body: html`<div class="install">
      ${p === 'embedded' || p === 'other' ? html`<div class="inline-note">${ic('alert', 18)}<span>Estás viendo ${APP_NAME} dentro de otra aplicación o en un navegador que no permite instalar. Ábrela en <b>Google Chrome</b> o <b>Microsoft Edge</b> (en el celular: Chrome o Safari) con este enlace:</span>
        <code class="link-box">${link}</code><button type="button" class="btn small" data-a="copy">${ic('share', 16)} Copiar enlace</button></div>` : ''}
      <p>Instalada, ${APP_NAME} se abre como cualquier app, a pantalla completa y <b>funciona sin internet</b>. Tus datos se guardan solo en este equipo.</p>
      ${canPrompt() ? html`<button type="button" class="btn primary big block" data-a="prompt">${ic('download', 20)} Instalar ahora</button>` : ''}
      ${raw(order.map((k, i) => guide(k, i === 0)).join(''))}
    </div>`,
  });
  sh.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-a="copy"]')) {
      try { await navigator.clipboard.writeText(link); toast('Enlace copiado. Pégalo en Chrome o Edge.', { kind: 'ok' }); } catch (err) { toast('Copia el enlace a mano: ' + link, { timeout: 9000 }); }
      return;
    }
    if (!e.target.closest('[data-a="prompt"]')) return;
    const ok = await promptInstall();
    if (ok) sh.close();
  });
}
