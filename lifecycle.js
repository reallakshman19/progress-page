// Project tabs with "+", the Archived list, the project header and the revision row.
import { el, link, whenText, isHttps, copyText } from './util.js?v=23';

const COMMON = 'https://github.com/reallakshman19/Common/tree/main/skills/agent-work/';
const MODULES = ['task-decomposer', 'nudge-designer', 'independent-review', 'gatekeeper', 'local-handover', 'progress-page'];
const WORD = { archived: 'Archived', superseded: 'Superseded', cancelled: 'Cancelled' };
  
// Presentation-only nesting; these remain the same independently addressable routes.
export const HOME_VIEWS = Object.freeze(['home','home-roadmap','home-sources','home-risks','oracle-continuity','actions','fixtures','timeline']);
export const HOME_SUBTABS = Object.freeze([
  ['home','Overview'], ['home-roadmap','Roadmap'], ['home-sources','Sources'],
  ['home-risks','Risks & handoffs'], ['oracle-continuity','Oracle continuity'],
  ['actions','My actions'], ['fixtures','Grounding fixtures'], ['timeline','Timeline'],
]);
export const PRIMARY_TABS = Object.freeze([['start','Agent Start'],['home','Project Home'],['progress','Progress / WBS']]);
export const primaryTabActive = (id, view) => id === 'home' ? HOME_VIEWS.includes(view) : id === 'start' ? view === 'start' : id === 'progress' && view === 'progress';


export const isActive = (p) => (p.status || 'active') === 'active';

// c: { active, closed, key, archivedOpen, nav(href, text, cls), decorate(anchor, project), addProject(), toggleArchived() }
export function tabsRow(c) {
  const nav = el('nav', 'tabs');
  c.active.forEach((p) => {
    const a = c.nav('#/' + p.key + '/start', p.label, 'tab' + (p.key === c.key ? ' on' : ''));
    c.decorate(a, p);
    nav.append(a);
  });
  const plus = el('button', 'tab plus', '+');
  plus.type = 'button';
  plus.title = 'Add a project: a copy-paste brief for another agent';
  plus.addEventListener('click', c.addProject);
  nav.append(plus);
  if (c.closed.length) {
    const arc = el('button', 'tab arch' + (c.archivedOpen || c.closed.some((p) => p.key === c.key) ? ' on' : ''), 'Archived (' + c.closed.length + ')');
    arc.type = 'button';
    arc.addEventListener('click', c.toggleArchived);
    nav.append(arc);
  }
  return nav;
}

export function archivedPanel(c) {
  const box = el('div', 'panel arch-list');
  c.closed.forEach((p) => {
    const row = el('div', 'arch-row');
    row.append(c.nav('#/' + p.key + '/progress', p.label, 'arch-nm'), el('span', 'chip w', WORD[p.status] || p.status));
    row.append(el('span', 'muted', ' ' + whenText(p.statusAt) + ' by ' + p.statusBy + ': ' + p.statusWhy + (p.supersededBy ? ' (replaced by ' + p.supersededBy + ')' : '') + ' '));
    if (isHttps(p.statusSrc)) row.append(link(p.statusSrc, 'source'));
    box.append(row);
  });
  return box;
}

// c: { key, view, rev, nav, addRevision(p) }
export function revisionRow(p, c) {
  const wrap = el('div', 'rev-row');
  wrap.append(el('span', 'h-label', 'Revisions'));
  (p.index.revisions || []).forEach((r) => {
    const cur = r.status === 'current';
    const on = c.rev ? c.rev === r.id : cur;
    const cls = 'rev ' + r.status + (on ? ' on' : '');
    const tip = r.id + ' · ' + r.status + '\nby ' + r.by + ' on ' + whenText(r.at) + '\n' + r.why + '\nOwner: ' + r.ownerWords
      + (cur || r.commit ? '' : '\n(no snapshot: this plan was current before snapshots were kept)');
    let box;
    if (cur || r.commit) box = c.nav('#/' + c.key + '/' + c.view + (cur ? '' : '/' + r.id), '', cls);
    else box = isHttps(r.src) ? link(r.src, '', cls) : el('span', cls);
    box.append(el('b', null, r.id), el('span', 'rev-d', whenText(r.at).split(',')[0]), el('span', 'rev-s', r.status));
    box.title = tip;
    wrap.append(box);
  });
  const plus = el('button', 'rev plus', '+');
  plus.type = 'button';
  plus.title = 'Add a revision (only when an Owner decision changes direction): a copy-paste brief for another agent';
  plus.addEventListener('click', () => c.addRevision(p));
  wrap.append(plus);
  return wrap;
}

// Private local folders (hub_serve /api/paths, local server only): { coding: [{path, note}], reference: [...] }.
function localPaths(lp) {
  const box = el('p', 'lpath');
  [['coding', 'Local repo path (coding): '], ['reference', '(Reference): ']].forEach(([k, label], i) => {
    if (i) box.append(' · ');
    box.append(el('b', null, label));
    const list = (lp[k] || []).filter((x) => x && x.path);
    if (!list.length) box.append(el('span', 'muted', 'not set'));
    list.forEach((x, j) => {
      if (j) box.append(', ');
      const code = el('code', null, x.path);
      if (x.note) code.title = x.note;
      const b = el('button', 'btn tiny', 'copy');
      b.type = 'button';
      b.addEventListener('click', () => copyText(x.path, b));
      box.append(code, ' ', b);
    });
  });
  return box;
}

// c adds: statusLine(p), revBanner (a node, or null) and paths (local server only)
export function projectHead(p, c) {
  const box = el('div', 'ptitle');
  const pj = p.index.project || {};
  box.append(el('h2', null, pj.title || p.label));
  if (!isActive(p)) {
    const b = el('div', 'banner');
    b.append(el('b', null, (WORD[p.status] || p.status) + ' '), whenText(p.statusAt) + ' by ' + p.statusBy + ': ' + p.statusWhy + (p.supersededBy ? ' (replaced by ' + p.supersededBy + ') ' : ' '));
    if (isHttps(p.statusSrc)) b.append(link(p.statusSrc, 'source'));
    b.append(' Nothing is deleted; the history stays readable.');
    box.append(b);
  }
  // Navigation always lists today's R1…Rn, but historical content comes from the selected snapshot.
  box.append(revisionRow(c.revisionListProject || p, c));
  if (c.revBanner) box.append(c.revBanner);
  if (pj.subtitle) box.append(el('p', 'muted', pj.subtitle));
  if (pj.aim) {
    const a = el('p', 'aim');
    a.append(el('b', null, 'Aim: '), pj.aim + ' ');
    if (isHttps(pj.aimSrc)) a.append(link(pj.aimSrc, 'source'));
    box.append(a);
  } else if (isActive(p)) box.append(el("div", "banner", "No aim written yet. The Owner's aim comes first: pp_cli.py project aim."));
  // Lesson links are presentation-only; the Lessons ledger remains untouched.
  if (p.key === 'lessons') {
    const lesson = el('p', 'muted');
    lesson.append(el('b', null, 'Lesson 2: '), link('https://github.com/reallakshman19/progress-page/blob/main/docs/lessons/lesson-02-outcome-led-oracle.md', 'Read Outcome-led Oracle (text file)'));
    box.append(lesson);
  }
  const m = el('p', 'muted');
  m.append('How we work: ');
  MODULES.forEach((n, i) => { if (i) m.append(' · '); m.append(link(COMMON + n, n)); });
  box.append(m);
  if (c.paths) box.append(localPaths(c.paths));
  box.append(c.snapshotNotice || c.statusLine(p));
  return box;
}
