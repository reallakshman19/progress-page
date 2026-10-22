// Shell: loads the JSON, draws the project tabs and the three views, refreshes every two minutes.
import { el, link, tick, ago, whenText, isHttps } from './util.js?v=5';
import { renderProgress } from './progress.js?v=5';
import { renderActions, renderFixtures, openCount } from './actions.js?v=5';
import { rulesOf, holdOf, summary, needsAttention } from './triggers.js?v=5';

const LIVE_DATA = 'https://reallakshman19.github.io/progress-page/data/';
const q = new URLSearchParams(location.search);
// A local file (file://) has no data folder beside it, so it reads the live data and falls back to an embedded snapshot.
const BASE = new URL((q.get('data') || (location.protocol === 'file:' ? LIVE_DATA : 'data')).replace(/\/?$/, '/'), document.baseURI);
const FILES = ['index', 'cards', 'actions', 'fixtures'];
const snapshot = () => window.__PP_SNAPSHOT__ || null;
const state = { projects: [], data: {}, links: mergedLinks(), error: null, panel: false, offline: false };

function loadLinks() {
  try { return JSON.parse(localStorage.getItem('pp-links') || '{}'); } catch (e) { return {}; }
}

// Links embedded in a private local build come first; the ones you saved in this browser override them.
function mergedLinks() {
  return Object.assign({}, window.__PP_LINKS__ || {}, loadLinks());
}

function saveLinks(map) {
  const clean = {};
  Object.entries(map || {}).forEach(([k, v]) => { if (isHttps(v)) clean[k] = v; });
  try { localStorage.setItem('pp-links', JSON.stringify(clean)); } catch (e) { /* private window: keep in memory */ }
  state.links = mergedLinks();
}

async function get(path) {
  try {
    const r = await fetch(new URL(path, BASE), { cache: 'no-cache' });
    if (!r.ok) throw new Error(path + ' ' + r.status);
    return await r.json();
  } catch (e) {
    const s = snapshot();
    if (s && s.files && s.files[path]) { state.offline = true; return s.files[path]; }
    throw e;
  }
}

async function load() {
  state.offline = false;
  try {
    const pj = await get('projects.json');
    state.projects = (pj.projects || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    await Promise.all(state.projects.map(async (p) => {
      const parts = await Promise.all(FILES.map((f) => get(p.key + '/' + f + '.json')));
      state.data[p.key] = { key: p.key, label: p.label, mode: p.mode, replyTo: p.replyTo };
      FILES.forEach((f, i) => { state.data[p.key][f] = parts[i]; });
    }));
    state.error = null;
  } catch (e) {
    state.error = String(e.message || e);
  }
}

function route() {
  const [, pk, view] = (location.hash || '').split('/');
  const key = state.data[pk] ? pk : (state.projects[0] || {}).key;
  const v = ['progress', 'actions', 'fixtures'].includes(view) ? view : 'progress';
  return { key, v };
}

// In-page navigation: a real anchor with a hash target (link() only makes anchors for https URLs).
function navLink(href, text, cls) {
  const a = el('a', cls, text);
  a.href = href;
  return a;
}

function badge(n) {
  return n ? el('span', 'bd', String(n)) : null;
}

function sumOf(p) {
  return summary(Object.values(p.cards || {}), p.index);
}

function statusLine(p) {
  const pr = p.index.project || {};
  const line = el('div', 'live');
  if (state.offline) {
    line.className = 'live stale';
    line.append('Offline copy from ' + whenText((snapshot() || {}).builtAt) + '. Open it online to read the live data.');
    return line;
  }
  const mins = (Date.now() - Date.parse(pr.updatedAt)) / 60000;
  const stale = mins > rulesOf(p.index).staleAfterMin;
  line.className = 'live' + (stale ? ' stale' : '');
  line.append(stale ? 'Not updated for ' + ago(pr.updatedAt) + ', last ' : 'Live, updated ', whenText(pr.updatedAt));
  if (pr.updatedBy) line.append(' by ' + pr.updatedBy);
  return line;
}

function linksPanel() {
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
    try { saveLinks(JSON.parse(ta.value || '{}')); } catch (e) { alert('That is not valid JSON.'); return; }
    state.panel = false;
    render();
  });
  const clear = el('button', 'btn', 'Clear');
  clear.type = 'button';
  clear.addEventListener('click', () => { saveLinks({}); state.panel = false; render(); });
  box.append(ta, file, save, clear);
  return box;
}

function render() {
  const root = document.getElementById('root');
  root.replaceChildren();
  const head = el('header', 'top');
  head.append(el('h1', null, 'Progress page'));
  const tools = el('div', 'tools');
  if (window.__PP_LOCAL__) tools.append(link('https://reallakshman19.github.io/progress-page/', 'Live page', 'btn small'));
  const links = el('button', 'btn small', 'My links');
  links.type = 'button';
  links.addEventListener('click', () => { state.panel = !state.panel; render(); });
  tools.append(links);
  head.append(tools);
  root.append(head);
  if (state.error && !state.projects.length) {
    root.append(el('p', 'err', 'Could not read the data: ' + state.error));
    return;
  }
  if (state.panel) root.append(linksPanel());
  const { key, v } = route();
  const tabs = el('nav', 'tabs');
  state.projects.forEach((p) => {
    const d = state.data[p.key] || {};
    const a = navLink('#/' + p.key + '/progress', p.label, 'tab' + (p.key === key ? ' on' : ''));
    const b = badge(openCount(d.actions));
    if (b) a.append(b);
    if (d.index && needsAttention(sumOf(d))) a.append(el('span', 'warn', '!'));
    tabs.append(a);
  });
  root.append(tabs);
  const p = state.data[key];
  if (!p) { root.append(el('p', 'err', 'No project data.')); return; }
  const pr = p.index.project || {};
  const title = el('div', 'ptitle');
  title.append(el('h2', null, pr.title || p.label));
  if (pr.subtitle) title.append(el('p', 'muted', pr.subtitle));
  title.append(statusLine(p));
  root.append(title);
  const views = el('nav', 'views');
  [['progress', 'Progress', 0], ['actions', 'My actions', openCount(p.actions)], ['fixtures', 'Grounding fixtures', 0]].forEach(([id, label, n]) => {
    const a = navLink('#/' + key + '/' + id, label, 'view' + (id === v ? ' on' : ''));
    const bd = badge(n);
    if (bd) a.append(bd);
    views.append(a);
  });
  root.append(views);
  const body = el('div', 'body');
  const ctx = { chats: p.index.chats || {}, links: state.links, rules: rulesOf(p.index), hold: holdOf(p.index), sum: sumOf(p) };
  if (v === 'progress') renderProgress(body, p, ctx);
  else if (v === 'actions') renderActions(body, p);
  else renderFixtures(body, p.fixtures);
  root.append(body);
  root.append(el('p', 'foot muted', 'Read-only page. It re-reads the JSON files every two minutes. "Updated X ago" is the time of the latest recorded event behind each block.'));
  tick(root);
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
setInterval(() => tick(document), 30000);
setInterval(async () => { if (!document.hidden) { await load(); render(); } }, 120000);
load().then(render);
