// Small helpers. Everything is drawn with textContent and createElement; only https links are rendered.
export const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export const isHttps = (u) => typeof u === 'string' && /^https:\/\//.test(u);

export function link(url, text, cls) {
  if (!isHttps(url)) return el('span', cls, text);
  const a = el('a', cls, text);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

// Minimal markdown: only [text](https://...) is understood. Everything else stays plain text.
export function md(text) {
  const frag = document.createDocumentFragment();
  const src = String(text == null ? '' : text);
  const re = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;
  let i = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m.index > i) frag.append(src.slice(i, m.index));
    frag.append(link(m[2], m[1]));
    i = re.lastIndex;
  }
  if (i < src.length) frag.append(src.slice(i));
  return frag;
}

export function ago(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 48) return h + 'h ' + (m % 60) + 'm';
  return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
}

// A span whose text is "(updated 5m ago)" and is refreshed by tick().
export function age(iso, fmt, none) {
  const s = el('span', 'tk');
  s.dataset.ts = iso || '';
  s.dataset.f = fmt;
  s.dataset.n = none || '';
  paint(s);
  return s;
}

function paint(e) {
  const a = ago(e.dataset.ts);
  e.textContent = a ? e.dataset.f.replace('{t}', a) : e.dataset.n || '';
}

export function tick(root) {
  root.querySelectorAll('.tk').forEach(paint);
}

export function whenText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

// Copy inside the click gesture first (works where the async clipboard is blocked), then try the async clipboard.
// If both fail, select the reply text so Ctrl+C works.
export async function copyText(text, btn) {
  const old = btn.textContent;
  let ok = false;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  if (!ok) {
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { ok = false; }
  }
  if (!ok) {
    const box = btn.closest('.op-b');
    const rp = box && box.querySelector('.rp');
    if (rp) {
      const range = document.createRange();
      range.selectNodeContents(rp);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
  btn.textContent = ok ? 'Copied' : 'Selected: press Ctrl+C';
  setTimeout(() => { btn.textContent = old; }, 2000);
}
