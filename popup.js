// A small modal dialog: title, body, footer. Escape, the Close button and a click outside close it.
import { el } from './util.js?v=32';

export function dialog(title, cls) {
  const ov = el('div', 'ov');
  const box = el('div', 'dlg' + (cls ? ' ' + cls : ''));
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  const hd = el('div', 'dlg-h');
  hd.append(el('h3', null, title));
  const x = el('button', 'btn small', 'Close');
  x.type = 'button';
  hd.append(x);
  const body = el('div', 'dlg-b');
  const foot = el('div', 'dlg-f');
  box.append(hd, body, foot);
  ov.append(box);
  document.body.append(ov);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  x.addEventListener('click', close);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', onKey);
  return { body, foot, close };
}
