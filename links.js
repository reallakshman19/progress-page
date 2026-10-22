// Chat links: kept in this browser only, never in the repository.
import { el, isHttps } from './util.js?v=10';

export function loadLinks() {
  try { return JSON.parse(localStorage.getItem('pp-links') || '{}'); } catch (e) { return {}; }
}

export function storeLinks(map) {
  const clean = {};
  Object.entries(map || {}).forEach(([k, v]) => { if (isHttps(v)) clean[k] = v; });
  try { localStorage.setItem('pp-links', JSON.stringify(clean)); } catch (e) { /* private window or sandbox: keep in memory */ }
  return clean;
}

// A private setup link (page URL + #links=<base64url JSON>) saves the chat links in this browser once.
// The part after # never leaves the browser: it is not sent to any server.
// Returns null (no setup link), 'saved' with the count, or 'bad' when the link is cut short or damaged (nothing is saved then).
export function takeLinksFromHash() {
  const m = /^#links=(.*)$/.exec(location.hash || '');
  if (!m) return null;
  let out;
  try {
    const raw = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
    const map = JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, (ch) => ch.charCodeAt(0))));
    const good = map && typeof map === 'object' && !Array.isArray(map) && Object.values(map).some(isHttps);
    out = good ? { status: 'saved', count: Object.keys(storeLinks(map)).length } : { status: 'bad' };
  } catch (e) {
    out = { status: 'bad' };
  }
  try { history.replaceState(null, '', location.pathname + location.search + '#/'); } catch (e) { /* sandboxed frame */ }
  return out;
}

export function linksPanel(onSave) {
  const box = el('div', 'panel');
  box.append(el('p', 'muted', 'Chat links are never stored in the repository. Load your own map once ({"<chat id8>": "https://..."}); it stays in this browser only.'));
  const ta = el('textarea');
  ta.rows = 4;
  const saved = loadLinks();
  ta.value = Object.keys(saved).length ? JSON.stringify(saved, null, 2) : '';
  const file = el('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.addEventListener('change', async () => { if (file.files[0]) ta.value = await file.files[0].text(); });
  const save = el('button', 'btn pri', 'Save links');
  save.type = 'button';
  save.addEventListener('click', () => {
    try { storeLinks(JSON.parse(ta.value || '{}')); } catch (e) { alert('That is not valid JSON.'); return; }
    onSave();
  });
  const clear = el('button', 'btn', 'Clear');
  clear.type = 'button';
  clear.addEventListener('click', () => { storeLinks({}); onSave(); });
  box.append(ta, file, save, clear);
  return box;
}
