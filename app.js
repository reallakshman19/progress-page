// Shell: loads the JSON, draws the project tabs and the views, refreshes every two minutes.
import { el, link, tick, ago, whenText } from './util.js?v=9';
import { renderProgress } from './progress.js?v=9';
import { renderActions, renderFixtures, openCount } from './actions.js?v=9';
import { renderTimeline } from './timeline.js?v=9';
import { tabsRow, archivedPanel, projectHead, isActive } from './lifecycle.js?v=9';
import { nudgesOf, openNudge } from './nudge.js?v=9';
import { addProjectDialog, addRevisionDialog } from './briefs.js?v=9';
import { loadLinks, takeLinksFromHash, linksPanel } from './links.js?v=9';
import { rulesOf, holdOf, summary, needsAttention } from './triggers.js?v=9';

const LIVE_DATA = 'https://reallakshman19.github.io/progress-page/data/';
const q = new URLSearchParams(location.search);
const isWeb = location.protocol === 'http:' || location.protocol === 'https:';
// A local file, a preview or a sandboxed frame has no data folder beside it: it reads the live data and keeps an embedded snapshot as a fallback.
const BASE = new URL((q.get('data') || (isWeb ? 'data' : LIVE_DATA)).replace(/\/?$/, '/'), isWeb ? location.href : LIVE_DATA);
const FILES = ['index', 'cards', 'actions', 'fixtures', 'nudges', 'audit'];
const OPTIONAL = { nudges: { schema: 3, nudges: {} }, audit: { events: [] } };
const VIEWS = ['progress', 'actions', 'fixtures', 'timeline'];
const snapshot = () => window.__PP_SNAPSHOT__ || null;
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

const setupLink = takeLinksFromHash();
// A setup link pasted into a tab that already shows the page changes only the hash: reload so it is read.
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#links=')) location.reload(); });

// The route is kept in memory as well as in the address, because a preview frame cannot always change its address.
let hash = location.hash;
function go(href) {
  hash = href;
  try { history.pushState(null, '', href); } catch (e) { /* preview frame: the in-memory route is enough */ }
  render();
  window.scrollTo(0, 0);
}

// Links embedded in a private local build come first; the ones saved in this browser override them.
function mergedLinks() {
  return Object.assign({}, window.__PP_LINKS__ || {}, loadLinks());
}

const state = { projects: [], data: {}, site: {}, links: mergedLinks(), error: null, panel: false, offline: false, archivedOpen: false, rev: null };

async function get(path) {
  const r = await fetch(new URL(path, BASE), { cache: 'no-cache' });
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}

async function loadAll(getter) {
  const pj = await getter('projects.json');
  const projects = (pj.projects || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const data = {};
  await Promise.all(projects.map(async (p) => {
    const parts = await Promise.all(FILES.map(async (f) => {
      try { return await getter(p.key + '/' + f + '.json'); } catch (e) { if (OPTIONAL[f]) return OPTIONAL[f]; throw e; }
    }));
    data[p.key] = Object.assign({}, p);
    FILES.forEach((f, i) => { data[p.key][f] = parts[i]; });
  }));
  return { projects, data, site: pj.site || {} };
}

async function refresh() {
  try {
    const r = await withTimeout(loadAll(get), 12000);
    state.projects = r.projects;
    state.data = r.data;
    state.site = r.site;
    state.offline = false;
    state.error = null;
  } catch (e) {
    state.error = String(e.message || e);
  }
}

// Draw from the embedded snapshot at once (if there is one), then replace it with the live data.
async function start() {
  const s = snapshot();
  if (s && s.files) {
    try {
      const r = await loadAll(async (p) => { if (s.files[p]) return s.files[p]; throw new Error('no snapshot for ' + p); });
      state.projects = r.projects;
      state.data = r.data;
      state.site = r.site;
      state.offline = true;
      render();
    } catch (e) { /* no usable snapshot */ }
  }
  await refresh();
  render();
}

function site() {
  const m = /^([^.]+)\.github\.io$/.exec(location.hostname);
  return Object.assign({ repo: m ? m[1] + '/' + (location.pathname.split('/')[1] || '') : '', page: isWeb ? location.origin + location.pathname : '', tools: 'tools/', guide: '' }, state.site);
}

function route() {
  const [, pk, view, rev] = (hash || '').split('/');
  const active = state.projects.filter(isActive);
  const key = state.data[pk] ? pk : (active[0] || state.projects[0] || {}).key;
  return { key, v: VIEWS.includes(view) ? view : 'progress', rev: rev || null };
}

// An older revision is opened read-only from the git commit it was last current in.
async function loadRev(key, id) {
  const p = state.data[key];
  const r = ((p.index || {}).revisions || []).find((x) => x.id === id);
  const s = site();
  if (!r || !r.commit || !s.repo) throw new Error('this revision has no snapshot');
  const base = 'https://raw.githubusercontent.com/' + s.repo + '/' + r.commit + '/data/' + key + '/';
  const one = async (f) => {
    const x = await fetch(base + f + '.json');
    if (!x.ok) { if (OPTIONAL[f]) return OPTIONAL[f]; throw new Error(f + '.json is not at that commit (HTTP ' + x.status + ')'); }
    return x.json();
  };
  const parts = await Promise.all(FILES.map(one));
  const out = Object.assign({}, p);
  FILES.forEach((f, i) => { out[f] = parts[i]; });
  return out;
}

function ensureRev(key, id) {
  const cur = state.rev;
  if (cur && cur.key === key && cur.id === id) return cur;
  const now = { key, id, status: 'loading', data: null, error: null };
  state.rev = now;
  loadRev(key, id).then((d) => { now.status = 'ready'; now.data = d; }, (e) => { now.status = 'error'; now.error = String(e.message || e); }).then(() => { if (state.rev === now) render(); });
  return now;
}

// In-page navigation: a real anchor (it can be opened in a new tab) whose plain click is handled here (link() only makes anchors for https URLs).
function navLink(href, text, cls) {
  const a = el('a', cls, text);
  a.href = href;
  a.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(href);
  });
  return a;
}

function badge(n) {
  return n ? el('span', 'bd', String(n)) : null;
}

function sumOf(p) {
  return summary(p.cards || {}, p.index, undefined, (p.nudges || {}).nudges);
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
  const stale = isActive(p) && mins > rulesOf(p.index).staleAfterMin;
  line.className = 'live' + (stale ? ' stale' : '');
  line.append(stale ? 'Not updated for ' + ago(pr.updatedAt) + ', last ' : 'Live, updated ', whenText(pr.updatedAt));
  if (pr.updatedBy) line.append(' by ' + pr.updatedBy);
  return line;
}

// Banner for a read-only older revision.
function revBanner(p, id, rv) {
  const r = ((p.index || {}).revisions || []).find((x) => x.id === id);
  const b = el('div', 'banner');
  if (!rv || rv.status === 'loading') b.append('Opening revision ' + id + ' from GitHub history...');
  else if (rv.status === 'error') {
    b.append('Could not open revision ' + id + ': ' + rv.error + '. ');
    if (r && r.commit && site().repo) b.append(link('https://github.com/' + site().repo + '/tree/' + r.commit + '/data/' + p.key, 'Open it on GitHub'));
  } else b.append(el('b', null, 'Revision ' + id + ' (' + (r ? r.status : '') + '), read-only. '), 'The project as it was in commit ' + (r || {}).commit + '. ');
  const cur = ((p.index || {}).revisions || []).find((x) => x.status === 'current');
  if (cur) b.append(navLink('#/' + p.key + '/progress', 'Back to the current revision ' + cur.id, 'btn small'));
  return b;
}

function render() {
  const root = document.getElementById('root');
  root.replaceChildren();
  const head = el('header', 'top');
  head.append(el('h1', null, 'Progress page'));
  const tools = el('div', 'tools');
  if (window.__PP_LOCAL__) tools.append(link(site().page || 'https://reallakshman19.github.io/progress-page/', 'Live page', 'btn small'));
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
  if (setupLink && setupLink.status === 'bad') {
    root.append(el('p', 'banner', 'This setup link is incomplete or damaged (often its end was cut off when it was copied), so no chat links were saved. Copy the whole link again and open it.'));
  } else if (setupLink && setupLink.status === 'saved') {
    root.append(el('p', 'banner', 'Setup link read: ' + setupLink.count + ' chat links saved in this browser.'));
  }
  if (state.panel) root.append(linksPanel(() => { state.links = mergedLinks(); state.panel = false; render(); }));
  if (!Object.keys(state.links).length) {
    root.append(el('p', 'hintbar', 'Chat ids are not clickable in this browser yet. Open your private setup link once, or paste your links under "My links".'));
  }
  const { key, v, rev } = route();
  const p = state.data[key];
  if (!p) { root.append(el('p', 'err', 'No project data.')); return; }
  const active = state.projects.filter(isActive).map((x) => state.data[x.key]);
  const closed = state.projects.filter((x) => !isActive(x)).map((x) => state.data[x.key]);
  const cur = ((p.index || {}).revisions || []).find((x) => x.status === 'current');
  const older = rev && (!cur || rev !== cur.id);
  const rv = older ? ensureRev(key, rev) : null;
  const view = rv && rv.status === 'ready' ? rv.data : p;
  const c = {
    key, view: v, rev: older ? rev : null, nav: navLink, active, closed, archivedOpen: state.archivedOpen,
    decorate: (a, pr) => {
      const b = badge(openCount(pr.actions));
      if (b) a.append(b);
      if (pr.index && needsAttention(sumOf(pr))) a.append(el('span', 'warn', '!'));
    },
    addProject: () => addProjectDialog(site()),
    addRevision: (pr) => addRevisionDialog(site(), pr),
    toggleArchived: () => { state.archivedOpen = !state.archivedOpen; render(); },
    statusLine,
    revBanner: older ? revBanner(p, rev, rv) : null,
  };
  root.append(tabsRow(c));
  if (state.archivedOpen) root.append(archivedPanel(c));
  root.append(projectHead(p, c));
  const views = el('nav', 'views');
  [['progress', 'Progress', 0], ['actions', 'My actions', openCount(view.actions)], ['fixtures', 'Grounding fixtures', 0], ['timeline', 'Timeline', 0]].forEach(([id, label, n]) => {
    const a = navLink('#/' + key + '/' + id + (older ? '/' + rev : ''), label, 'view' + (id === v ? ' on' : ''));
    const bd = badge(n);
    if (bd) a.append(bd);
    views.append(a);
  });
  root.append(views);
  const body = el('div', 'body');
  if (older && (!rv || rv.status !== 'ready')) {
    body.append(el('p', 'muted', rv && rv.status === 'error' ? 'This revision cannot be shown here.' : 'Loading...'));
  } else {
    const rules = rulesOf(view.index);
    const ctx = {
      chats: view.index.chats || {}, links: state.links, rules, hold: holdOf(view.index), sum: sumOf(view), readOnly: !!older || !isActive(p),
      nudge: { openList: (id) => nudgesOf(view, id).filter((n) => n.status === 'open'), list: (id) => nudgesOf(view, id), open: (card) => openNudge(view, card, rules.coordinator) },
    };
    if (v === 'progress') renderProgress(body, view, ctx);
    else if (v === 'actions') renderActions(body, view);
    else if (v === 'fixtures') renderFixtures(body, view.fixtures);
    else renderTimeline(body, view);
  }
  root.append(body);
  root.append(el('p', 'foot muted', 'Read-only page. It re-reads the JSON files every two minutes. "Updated X ago" is the time of the latest recorded event behind each block.'));
  tick(root);
}

// If something breaks before the page is drawn, say so instead of staying on "Loading...".
function showError(msg) {
  const root = document.getElementById('root');
  if (root && !root.querySelector('.card, .dc, .fx')) root.replaceChildren(el('p', 'err', 'Page error: ' + msg));
}
window.addEventListener('error', (e) => showError(e.message));
window.addEventListener('unhandledrejection', (e) => showError(String((e.reason && e.reason.message) || e.reason)));

// Back and forward, or an edited address: follow the address (after go() the two already agree).
const follow = () => { if (hash === location.hash) return; hash = location.hash; render(); window.scrollTo(0, 0); };
window.addEventListener('hashchange', follow);
window.addEventListener('popstate', follow);
setInterval(() => tick(document), 30000);
setInterval(async () => { if (!document.hidden) { await refresh(); render(); } }, 120000);
start();
