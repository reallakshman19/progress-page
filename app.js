// Shell: loads the JSON, draws the project tabs and the views, refreshes every two minutes.
import { el, link, tick, ago, whenText } from './util.js?v=26';
import { buildSearchIndex, searchProgress } from './search.js?v=26';
import { renderOracleContinuity } from './oracle-continuity.js?v=26';
import { renderProgress, wbsPick, wbsGroups, wbsFamily, wbsRevisionScope, wbsRoute } from './progress.js?v=26';
import { renderAgentStart } from './agent-start.js?v=26';
import { renderLessons } from './lessons.js?v=26';
import { renderActions, renderFixtures, renderProjectHome, openCount } from './actions.js?v=26';
import { renderTimeline } from './timeline.js?v=26';
import { tabsRow, archivedPanel, projectHead, revisionRow, isActive, HOME_VIEWS, HOME_SUBTABS, PRIMARY_TABS, primaryTabActive } from './lifecycle.js?v=26';
import { nudgesOf, openNudge } from './nudge.js?v=26';
import { addProjectDialog, addRevisionDialog } from './briefs.js?v=26';
import { loadLinks, takeLinksFromHash, linksPanel } from './links.js?v=26';
import { rulesOf, holdOf, summary, needsAttention } from './triggers.js?v=26';

const LIVE_DATA = 'https://reallakshman19.github.io/progress-page/data/';
const q = new URLSearchParams(location.search);
const isWeb = location.protocol === 'http:' || location.protocol === 'https:';
// A local file, a preview or a sandboxed frame has no data folder beside it: it reads the live data and keeps an embedded snapshot as a fallback.
const BASE = new URL((q.get('data') || (isWeb ? 'data' : LIVE_DATA)).replace(/\/?$/, '/'), isWeb ? location.href : LIVE_DATA);
const FILES = ['index', 'cards', 'actions', 'fixtures', 'nudges', 'audit'];
const OPTIONAL = { nudges: { schema: 3, nudges: {} }, audit: { events: [] } };
const VIEWS = ['start', 'progress', ...HOME_VIEWS, 'actions', 'fixtures', 'timeline'];
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
}

// Links embedded in a private local build come first; the ones saved in this browser override them.
function mergedLinks() {
  return Object.assign({}, window.__PP_LINKS__ || {}, loadLinks());
}

const state = { projects: [], data: {}, site: {}, links: mergedLinks(), error: null, panel: false, offline: false, archivedOpen: false, rev: null, paths: null, repo: {}, searchOpen: false, searchQuery: '', searchIndex: [] };

// The local hub server (127.0.0.1) serves each project's private coding and reference folders; the website never has them.
async function loadPaths() {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) return;
  try {
    const r = await fetch('/api/paths', { cache: 'no-cache' });
    if (r.ok) state.paths = await r.json();
    await Promise.all(Object.keys(state.paths || {}).filter((k) => !k.startsWith('_') && k !== 'updated').map(async (k) => {
      const g = await fetch('/api/repo/' + encodeURIComponent(k), { cache: 'no-cache' });
      if (g.ok) state.repo[k] = await g.json();
    }));
  } catch (e) { /* no hub server: no paths line, no live git state */ }
}

// Repo state bar of the picked WBS step: the step's recorded repo, branch, commit and activity, plus live git state on the local server.
function repoBar(index, ms, live) {
  const m = ms ? ((index || {}).milestones || {})[ms] || {} : {};
  const g = live ? (ms && (live.wbs || {})[ms]) || live.project : null;
  if (!m.repo && !m.commit && !m.activity && !m.canDo && !g) return null;
  const bar = el('div', 'repobar');
  bar.append(el('b', null, 'Repo state' + (ms ? ' · ' + (m.wbs ? 'WBS ' + m.wbs : ms) : ' · project') + ': '));
  const act = m.activity || (m.canDo ? (m.cap ? m.cap.replace(/_/g, ' ').toLowerCase() + ': ' : '') + m.canDo : '');
  if (act) bar.append(act, ' · ');
  if (m.repo || m.commit) {
    const where = (m.repo || '') + (m.branch ? ' @ ' + m.branch : '');
    if (where) bar.append(where + ' ');
    if (m.commit) bar.append(m.repo ? link('https://github.com/' + m.repo + '/commit/' + m.commit, m.commit.slice(0, 7)) : el('code', null, m.commit.slice(0, 7)));
    bar.append(' · ');
  }
  if (g && g.git) {
    const sync = !g.upstream ? 'no upstream' : (g.ahead || g.behind) ? [g.ahead ? g.ahead + ' ahead' : '', g.behind ? g.behind + ' behind' : ''].filter(Boolean).join(', ') + ' of ' + g.upstream : 'pushed (' + g.upstream + ')';
    bar.append('local ', el('code', null, (g.branch || '?') + ' ' + (g.head || '')), ' ' + (g.at ? whenText(g.at) : '') + ' "' + (g.subject || '') + '" · ' + (g.dirty ? g.dirty + ' uncommitted' : 'clean') + ' · ' + sync);
    if (m.commit && g.head && !m.commit.startsWith(g.head) && !g.head.startsWith(m.commit.slice(0, 7))) bar.append(el('span', 'rb-warn', ' · local head differs from the recorded commit'));
  } else if (g) bar.append(el('span', 'muted', 'local folder is not a git checkout'));
  else if (!m.commit) bar.append(el('span', 'muted', 'no commit recorded'));
  return bar;
}

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
    if (p.key === 'learned') data[p.key].lessons = await getter('learned/lessons.json');
  }));
  return { projects, data, site: pj.site || {} };
}

async function refresh() {
  try {
    const r = await withTimeout(loadAll(get), 12000);
    state.projects = r.projects;
    state.data = r.data;
    state.site = r.site;
    state.searchIndex = buildSearchIndex(r.projects, r.data);
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
      state.searchIndex = buildSearchIndex(r.projects, r.data);
      state.offline = true;
      render();
    } catch (e) { /* no usable snapshot */ }
  }
  await Promise.all([refresh(), loadPaths()]);
  render();
}

function site() {
  const m = /^([^.]+)\.github\.io$/.exec(location.hostname);
  return Object.assign({ repo: m ? m[1] + '/' + (location.pathname.split('/')[1] || '') : '', page: isWeb ? location.origin + location.pathname : '', tools: 'tools/', guide: '' }, state.site);
}

function route() {
  const [, pk, view, rev, family, step] = (hash || '').split('/');
  const safe = (v) => { try { return v ? decodeURIComponent(v) : null; } catch { return null; } };
  const active = state.projects.filter(isActive);
  const key = state.data[pk] ? pk : (active[0] || state.projects[0] || {}).key;
  const lessonIds = (state.data.learned?.lessons?.items || []).map(item => item.id);
  const choices = key === 'learned' ? ['progress', ...lessonIds] : VIEWS;
  return { key, v: choices.includes(view) ? view : 'progress', rev: safe(rev), family: safe(family), step: safe(step) };
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

// Search updates only its result list while the Owner types; no page rerender or navigation.
function globalSearchPanel() {
  const panel = el('section', 'global-search');
  panel.setAttribute('aria-label', 'Search all projects');
  const prompt = el('label', 'global-search-label', 'Search all projects · PR, issue, WBS or description');
  const input = el('input', 'global-search-input');
  input.type = 'search';
  input.placeholder = 'e.g. PR 185, issue 170, WBS 3.1, topology';
  input.value = state.searchQuery;
  input.setAttribute('aria-label', 'Search progress records across projects');
  const results = el('div', 'global-search-results');
  const draw = () => {
    results.replaceChildren();
    const term = state.searchQuery.trim();
    if (!term) {
      results.append(el('p', 'muted', 'Search across project tasks, evidence, decisions, milestones and Timeline.'));
      return;
    }
    const found = searchProgress(state.searchIndex, term);
    results.append(el('p', 'muted', found.length
      ? 'Showing the top ' + found.length + ' matching records'
      : 'No published record matches. This does not search unrecorded GitHub work.'));
    found.forEach(row => {
      const item = el('div', 'global-search-result');
      const a = el('a', 'global-search-target', row.title);
      a.href = row.url;
      a.addEventListener('click', (e) => {
        if (e.button || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
        e.preventDefault();
        state.searchOpen = false;
        state.searchQuery = '';
        go(a.href);
        if (row.type === 'Agent') {
          const cardId = row.key.slice((row.projectKey + ':Agent:').length);
          const target = [...document.querySelectorAll('[data-card]')].find(n => n.dataset.card === cardId);
          if (target) target.scrollIntoView({block:'nearest'});
        }
      });
      const meta = el('span', 'global-search-meta',
        row.project + ' · ' + row.type + (row.wbs ? ' · WBS ' + row.wbs : '')
        + (row.revision ? ' · ' + row.revision : ''));
      item.append(a, meta);
      if (row.detail) item.append(el('span','global-search-description',row.detail.slice(0,200)));
      if (row.source && /^https:\/\/github\.com\//.test(row.source))
        item.append(link(row.source, 'source', 'global-search-source'));
      results.append(item);
    });
  };
  input.addEventListener('input', () => {state.searchQuery = input.value; draw();});
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      state.searchOpen = false; state.searchQuery = ''; panel.remove();
    }
  });
  prompt.append(input); panel.append(prompt, results); draw();
  return panel;
}

function render() {
  const root = document.getElementById('root');
  root.replaceChildren();
  const head = el('header', 'top');
  head.append(el('h1', null, 'Progress page'));
  const tools = el('div', 'tools');
  const searchButton = el('button', 'btn small', 'Search all');
  searchButton.type = 'button';
  searchButton.setAttribute('aria-expanded', String(state.searchOpen));
  searchButton.addEventListener('click', () => { state.searchOpen = !state.searchOpen; render(); if (state.searchOpen) document.querySelector('.global-search-input')?.focus(); });
  tools.append(searchButton);
  if (window.__PP_LOCAL__) tools.append(link(site().page || 'https://reallakshman19.github.io/progress-page/', 'Live page', 'btn small'));
  const links = el('button', 'btn small', 'My links');
  links.type = 'button';
  links.addEventListener('click', () => { state.panel = !state.panel; render(); });
  tools.append(links);
  head.append(tools);
  root.append(head);
  if (state.searchOpen) root.append(globalSearchPanel());
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
  if (!Object.keys(state.links).length && route().v !== 'start') {
    root.append(el('p', 'hintbar', 'Chat ids are not clickable in this browser yet. Open your private setup link once, or paste your links under "My links".'));
  }
  const { key, v, rev, family: routedFamily, step: routedStep } = route();
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
      if (pr.key !== 'learned' && pr.index && needsAttention(sumOf(pr))) a.append(el('span', 'warn', '!'));
    },
    addProject: () => addProjectDialog(site()),
    addRevision: (pr) => addRevisionDialog(site(), pr),
    toggleArchived: () => { state.archivedOpen = !state.archivedOpen; render(); },
    statusLine,
    paths: (state.paths || {})[key] || null,
    revisionListProject: p,
    snapshotNotice: older && rv?.status === 'ready' ?
      el('p', 'muted', 'Historical snapshot ' + rev + ' at ' + (((p.index.revisions || []).find(r => r.id === rev) || {}).commit || '?')
        + '. Read-only evidence from this revision; not current execution status.') : null,
    revBanner: older ? revBanner(p, rev, rv) : null,
  };
  root.append(tabsRow(c));
  if (state.archivedOpen) root.append(archivedPanel(c));
  // Never show R4 aim/WBS/cards while the requested R1/R2/R3 snapshot is loading or unavailable.
  if (older && (!rv || rv.status !== 'ready')) {
    const header = el('div', 'ptitle');
    header.append(el('h2', null, p.index.project?.title || p.label), revisionRow(p, c), revBanner(p, rev, rv));
    root.append(header, el('p', 'banner', rv?.status === 'error'
      ? 'Historical source unavailable; no current data substituted.' : 'Loading historical revision without showing current project data.'));
    return;
  }
  if (key === 'learned') {
    // Lessons is a top-level tab with its own visible second row of subtabs.
    // Sections inside L01/L02 remain vertical full-page documents, not horizontal sections.
    const subnav = el('nav', 'views lesson-subtabs');
    subnav.setAttribute('aria-label', 'Lessons subtabs');
    const destinations = [{ id: 'progress', label: 'Overview' }]
      .concat((p.lessons?.items || []).map((item, i) => ({ id: item.id, label: 'Lesson ' + (i + 1) })));
    destinations.forEach(({ id, label }) => {
      const a = navLink('#/learned/' + id, label, 'view' + (v === id ? ' on' : ''));
      if (v === id) a.setAttribute('aria-current', 'page');
      subnav.append(a);
    });
    root.append(subnav);
    const page = el('div', 'body');
    renderLessons(page, p.lessons, v, navLink);
    root.append(page);
    return;
  }
  root.append(projectHead(view, c));
  // A two-level selector: WBS family (3/4/Other), then only that family's numbered steps.
  const groups = wbsGroups(view.index);
  const wbsScope = wbsRevisionScope(key, rev || cur?.id);
  const family = groups.find(g => g.key === routedFamily) || null;
  const step = family?.steps.some(s => s.key === routedStep) ? routedStep : null;
  wbsFamily(wbsScope, family?.key || null);
  wbsPick(wbsScope, step);
  const navSuffix = family ? '/' + encodeURIComponent(rev || cur?.id || 'current') + '/'
    + encodeURIComponent(family.key) + (step ? '/' + encodeURIComponent(step) : '')
    : older ? '/' + encodeURIComponent(rev) : '';
  // Agent Start puts the task before secondary WBS navigation on small screens.
  // The same WBS controls remain available below the briefing, with original routes.
  const deferredWbsNav = [];
  const appendWbsNav = (node) => v === 'start' ? deferredWbsNav.push(node) : root.append(node);
  const selectWbs = (href) => {
    go(href);
    if (v === 'start') window.scrollTo(0, 0);
  };
  if (groups.length && !HOME_VIEWS.includes(v) && v !== 'start') {
    const families = el('nav', 'wbs-family-nav');
    families.setAttribute('aria-label', 'WBS families');
    [{ key: null, label: 'All WBS' }, ...groups].forEach(g => {
      const b = el('button', 'wbs-family-tab' + (family?.key === g.key ? ' on' : ''), g.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String((family?.key || null) === g.key));
      b.addEventListener('click', () => selectWbs(wbsRoute(key, v, g.key ? (rev || cur?.id) : (older ? rev : null), g.key, null)));
      families.append(b);
    });
    appendWbsNav(families);
    if (family) {
      const children = el('nav', 'wbs-children');
      children.setAttribute('aria-label', family.label + ' steps');
      [{ key: null, short: 'All ' + family.label + ' steps', name: 'All steps' }, ...family.steps].forEach(x => {
        const b = el('button', 'wbs-child-tab' + (step === x.key ? ' on' : ''), x.short);
        b.type = 'button'; b.title = x.name;
        b.setAttribute('aria-pressed', String(step === x.key));
        b.addEventListener('click', () => selectWbs(wbsRoute(key, v, rev || cur?.id, family.key, x.key)));
        children.append(b);
      });
      appendWbsNav(children);
    }
  }
  const bar = HOME_VIEWS.includes(v) || v === 'start' ? null : repoBar(view.index, groups.length ? step : null, older ? null : state.repo[key]);
  if (bar) root.append(bar);
  const views = el('nav', 'views');
  PRIMARY_TABS.forEach(([id, label]) => {
    const n = id === 'actions' ? openCount(view.actions) : 0;
    const on = primaryTabActive(id, v);
    // Entering Project Home starts at the project-wide view, not an invisible WBS-filtered one.
    const targetSuffix = id === 'home' ? (older ? '/' + encodeURIComponent(rev) : '') : navSuffix;
    const a = navLink('#/' + key + '/' + id + targetSuffix, label, 'view' + (on ? ' on' : ''));
    if (on) a.setAttribute('aria-current', 'page');
    const bd = badge(n);
    if (bd) a.append(bd);
    views.append(a);
  });
  root.append(views);
  if (HOME_VIEWS.includes(v)) {
    const homeNav = el('nav', 'views home-subtabs');
    homeNav.setAttribute('aria-label', 'Project Home sections');
    HOME_SUBTABS.forEach(([id, label]) => {
      // Home subtabs start project-wide; legacy WBS-scoped deep links remain readable.
      const homeSuffix = older ? '/' + encodeURIComponent(rev) : '';
      const a = navLink('#/' + key + '/' + id + homeSuffix, label, 'view' + (id === v ? ' on' : ''));
      if (id === 'actions') { const n = openCount(view.actions); if (n) a.append(badge(n)); }
      if (id === v) a.setAttribute('aria-current', 'page');
      homeNav.append(a);
    });
    root.append(homeNav);
  }
  const body = el('div', 'body');
  if (older && (!rv || rv.status !== 'ready')) {
    body.append(el('p', 'muted', rv && rv.status === 'error' ? 'This revision cannot be shown here.' : 'Loading...'));
  } else {
    const rules = rulesOf(view.index);
    const ctx = {
      chats: view.index.chats || {}, links: state.links, rules, hold: holdOf(view.index), sum: sumOf(view), readOnly: !!older || !isActive(p),
      nudge: { openList: (id) => nudgesOf(view, id).filter((n) => n.status === 'open'), list: (id) => nudgesOf(view, id), open: (card) => openNudge(view, card, rules.coordinator) },
    };
    ctx.rerender = render;
    ctx.wbsScope = wbsScope;
    ctx.navigateWbs = (nextFamily, nextStep) =>
      go(wbsRoute(key, v, nextFamily ? (rev || cur?.id) : (older ? rev : null), nextFamily, nextStep));
    const shownStep = v.startsWith('home') ? null : step;
    if (shownStep && v !== 'start') body.append(el('p', 'muted', 'Showing ' + ((family?.steps.find(x => x.key === shownStep))?.label || shownStep) + ' only; whole-project records remain marked.'));
    else if (family && v !== 'start' && !HOME_VIEWS.includes(v)) body.append(el('p', 'muted', 'Showing ' + family.label + ' only (' + family.steps.length + ' steps); whole-project records remain marked.'));
    if (family && (v === 'fixtures' || v === 'timeline')) {
      const info = el('p', 'muted');
      info.append('Showing ' + (shownStep ? (family.steps.find(x => x.key === shownStep)?.label || shownStep) : family.label)
        + ' evidence only. ');
      info.append(navLink('#/' + key + '/' + v + (older ? '/' + encodeURIComponent(rev) : ''), 'Show entire project', ''));
      body.append(info);
    }
    const sv = shownStep ? stepView(view, [shownStep]) : family ? stepView(view, family.steps.map(x => x.key)) : view;
    if (v.startsWith('home')) renderProjectHome(body, view, v, !!older);
    else if (v === 'progress') renderProgress(body, view, ctx);
    else if (v === 'start') renderAgentStart(body, view, { family, step, revision: rev || cur?.id, nav: navLink, projectKey: key, readOnly: ctx.readOnly });
    else if (v === 'actions') renderActions(body, sv);
    else if (v === 'oracle-continuity') renderOracleContinuity(body, view);
    else if (v === 'fixtures') renderFixtures(body, sv.fixtures, older ? '' : key, view.fixtures);
    else if (shownStep || family) renderTimeline(body, sv);
    else renderTimeline(body, view);
  }
  root.append(body);
  if (v === 'start') root.append(...deferredWbsNav);
  root.append(el('p', 'foot muted', 'Read-only page. It re-reads the JSON files every two minutes. "Updated X ago" is the time of the latest recorded event behind each block.'));
  tick(root);
}

// The project as seen from one WBS step: its decisions and fixtures (plus whole-project ones, marked), and the
// Timeline entries of its agent blocks, of its own decisions and of the step itself.
function stepView(view, steps) {
  const selected = new Set(steps);
  const mine = new Set(Object.entries(view.cards || {}).filter(([, c]) => selected.has(c.milestone)).map(([id]) => id));
  const acts = Object.fromEntries(Object.entries(view.actions || {}).filter(([, a]) => !a.milestone || selected.has(a.milestone))
    .map(([id, a]) => [id, a.milestone ? a : Object.assign({}, a, { wholeProject: true })]));
  const fixtures = Object.fromEntries(Object.entries(view.fixtures || {}).map(([k, items]) => [k, (items || [])
    .filter((i) => !i.milestone || selected.has(i.milestone)).map((i) => (i.milestone ? i : Object.assign({}, i, { wholeProject: true })))]));
  const audit = view.audit || {};
  const events = (audit.events || []).filter((e) => (e.card && mine.has(e.card)) || (e.target && mine.has(e.target))
    || (e.action && (view.actions || {})[e.action] && selected.has((view.actions || {})[e.action].milestone))
    || (e.scope && [...selected].some(k => e.scope === 'milestone:' + k)));
  return Object.assign({}, view, { actions: acts, fixtures, audit: Object.assign({}, audit, { events }) });
}

// If something breaks before the page is drawn, say so instead of staying on "Loading...".
function showError(msg) {
  const root = document.getElementById('root');
  if (root && !root.querySelector('.card, .dc, .fx')) root.replaceChildren(el('p', 'err', 'Page error: ' + msg));
}
window.addEventListener('error', (e) => showError(e.message));
window.addEventListener('unhandledrejection', (e) => showError(String((e.reason && e.reason.message) || e.reason)));

// Back and forward, or an edited address: follow the address (after go() the two already agree).
const follow = () => { if (hash === location.hash) return; hash = location.hash; render(); };
window.addEventListener('hashchange', follow);
window.addEventListener('popstate', follow);
setInterval(() => tick(document), 30000);
setInterval(async () => { if (!document.hidden) { await Promise.all([refresh(), loadPaths()]); render(); } }, 120000);
start();
