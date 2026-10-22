// Project tabs with "+", the Archived list, the project header and the revision row.
import { el, link, whenText, isHttps } from './util.js?v=10';

const COMMON = 'https://github.com/reallakshman19/Common/tree/main/skills/agent-work/';
const MODULES = ['task-decomposer', 'nudge-designer', 'independent-review', 'gatekeeper', 'local-handover', 'progress-page'];
const WORD = { archived: 'Archived', superseded: 'Superseded', cancelled: 'Cancelled' };

export const isActive = (p) => (p.status || 'active') === 'active';

// c: { active, closed, key, archivedOpen, nav(href, text, cls), decorate(anchor, project), addProject(), toggleArchived() }
export function tabsRow(c) {
  const nav = el('nav', 'tabs');
  c.active.forEach((p) => {
    const a = c.nav('#/' + p.key + '/progress', p.label, 'tab' + (p.key === c.key ? ' on' : ''));
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

// c adds: statusLine(p) and revBanner (a node, or null)
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
  box.append(revisionRow(p, c));
  if (c.revBanner) box.append(c.revBanner);
  if (pj.subtitle) box.append(el('p', 'muted', pj.subtitle));
  if (pj.aim) {
    const a = el('p', 'aim');
    a.append(el('b', null, 'Aim: '), pj.aim + ' ');
    if (isHttps(pj.aimSrc)) a.append(link(pj.aimSrc, 'source'));
    box.append(a);
  } else if (isActive(p)) box.append(el("div", "banner", "No aim written yet. The Owner's aim comes first: pp_cli.py project aim."));
  const m = el('p', 'muted');
  m.append('How we work: ');
  MODULES.forEach((n, i) => { if (i) m.append(' · '); m.append(link(COMMON + n, n)); });
  box.append(m);
  box.append(c.statusLine(p));
  return box;
}
