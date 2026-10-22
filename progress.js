// Progress view: milestone strip, then groups of agent blocks.
import { el, link, md, age } from './util.js';

const RANK = { NOT_STARTED: 0, UNKNOWN: 1, STALE: 1, IN_PROGRESS: 2, SUBMITTED: 3, VERIFIED: 4 };
const ICON = { VERIFIED: '✓', SUBMITTED: '↑', IN_PROGRESS: '●', BLOCKED: '!', NOT_STARTED: '○', STALE: '?', UNKNOWN: '?', NOT_APPLICABLE: '–' };
const KIND = { VERIFIED: 'done', IN_PROGRESS: 'working', SUBMITTED: 'waiting', BLOCKED: 'hold', NOT_STARTED: 'idle', STALE: 'gap', UNKNOWN: 'gap', NOT_APPLICABLE: 'done' };
const COUNT_ORDER = [['VERIFIED', 'verified'], ['SUBMITTED', 'submitted'], ['IN_PROGRESS', 'in progress'], ['BLOCKED', 'blocked'], ['NOT_STARTED', 'not started']];

// A milestone is BLOCKED if any of its cards is; VERIFIED only when every card is. Otherwise it takes the weakest
// state among the cards that have started, and is NOT_STARTED when none has.
export function milestoneState(cards) {
  const live = cards.filter((c) => c.state !== 'NOT_APPLICABLE');
  if (!live.length) return 'NOT_STARTED';
  if (live.some((c) => c.state === 'BLOCKED')) return 'BLOCKED';
  if (live.every((c) => c.state === 'VERIFIED')) return 'VERIFIED';
  const started = live.filter((c) => c.state !== 'NOT_STARTED');
  if (!started.length) return 'NOT_STARTED';
  const weakest = started.reduce((w, c) => ((RANK[c.state] || 0) < (RANK[w] || 0) ? c.state : w), started[0].state);
  return weakest === 'VERIFIED' ? 'IN_PROGRESS' : weakest;
}

function strip(index, cards) {
  const wrap = el('div', 'ms-wrap');
  wrap.append(el('div', 'h-label', 'Milestones'));
  const row = el('div', 'ms-row');
  const list = Object.entries(index.milestones || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  list.forEach(([key, m], i) => {
    const mine = cards.filter((c) => c.milestone === key);
    const live = mine.filter((c) => c.state !== 'NOT_APPLICABLE');
    const state = milestoneState(mine);
    const box = el('div', 'ms ms-' + state);
    box.title = m.full || m.name;
    const top = el('div', 'ms-top');
    top.append(el('span', 'ms-ic', ICON[state] || '○'), el('span', 'ms-key', key));
    box.append(top, el('div', 'ms-name', m.name), el('div', 'ms-state', state),
      el('div', 'ms-count', live.filter((c) => c.state === 'VERIFIED').length + ' of ' + live.length + ' verified'));
    row.append(box);
    if (i < list.length - 1) row.append(el('span', 'ms-sep', '›'));
  });
  wrap.append(row);
  const n = {};
  cards.forEach((c) => { n[c.state] = (n[c.state] || 0) + 1; });
  const parts = COUNT_ORDER.filter(([s]) => n[s]).map(([s, label]) => n[s] + ' ' + label);
  wrap.append(el('p', 'ms-line', parts.join(' · ') + ' of ' + cards.length + ' cards. A card count on a partial list, not a delivery percentage.'));
  return wrap;
}

function refLine(label, items) {
  const p = el('div', 'c-ln');
  p.append(label + ': ');
  if (!items.length) { p.append('none'); return p; }
  items.forEach((r, i) => {
    if (i) p.append(' · ');
    p.append(link(r.u, r.l));
    if (r.s) p.append(' · ' + r.s);
  });
  return p;
}

function cardEl(c, ctx) {
  const kind = c.kind || KIND[c.state] || 'idle';
  const d = el('article', 'card k-' + kind);
  const hd = el('div', 'c-hd');
  hd.append(el('span', 'c-nm', c.label), age(c.updatedAt, '(updated {t} ago)', c.state === 'NOT_STARTED' ? '(not started)' : '(updated: no GitHub time)'));
  d.append(hd);
  const who = c.who || {};
  const chat = (ctx.chats || {})[who.chat] || {};
  const sub = [chat.id8, who.role, chat.engine].filter(Boolean).join(' · ');
  if (sub) d.append(el('div', 'c-sub', sub));
  const pills = el('div', 'c-pills');
  pills.append(el('span', 'pill st-' + c.state, c.state));
  if (c.milestone) pills.append(el('span', 'pill', c.milestone));
  if ((c.flags || []).includes('needs-you')) pills.append(el('span', 'chip d', 'needs you'));
  (c.chips || []).forEach((x) => pills.append(el('span', 'chip ' + (x.c || 'n'), x.t)));
  d.append(pills);
  const st = el('div', 'c-st');
  st.append(el('b', null, 'Status: '), el('span', 'ico ic-' + kind, ICON[c.state] || '○'), ' ', md(c.now));
  d.append(st);
  if (c.next && c.next.text) {
    const n = el('div', 'c-nx');
    const actor = c.next.actor && c.next.actor !== '-' ? ' (' + c.next.actor + ')' : '';
    n.append(el('b', null, 'Next' + actor + ': '), md(c.next.text));
    d.append(n);
  }
  const refs = c.refs || [];
  d.append(refLine('Issue', refs.filter((r) => r.k === 'issue' || r.k === 'comment')));
  d.append(refLine('PR', refs.filter((r) => r.k === 'pr')));
  const cl = el('div', 'c-ln');
  cl.append('Chat/AG: ');
  if (chat.id8) {
    const url = (ctx.links || {})[chat.id8];
    cl.append(url ? link(url, 'chat ' + chat.id8) : el('span', 'nolink', 'chat ' + chat.id8));
  } else cl.append('none');
  d.append(cl);
  if (c.src) {
    const s = el('div', 'c-src');
    s.append('source: ', link(c.src, 'event'));
    d.append(s);
  }
  return d;
}

// Arrow glyph between two neighbouring cards a (left) and b (right), or null.
function arrowBetween(a, b) {
  const g = { to: '→', back: '←', both: '⇄' };
  const fwd = (a.edges || []).find((e) => e.to === b.id);
  if (fwd) return g[fwd.k] || null;
  const rev = (b.edges || []).find((e) => e.to === a.id);
  if (rev) return { to: g.back, back: g.to, both: g.both }[rev.k] || null;
  return null;
}

function groupBlock(g, mine, ctx) {
  const sec = el('section', 'grp');
  const h = el('div', 'grp-h');
  h.append(el('span', 'grp-t', g.title));
  (g.chips || []).forEach((c) => h.append(el('span', 'chip ' + (c.c || 'n'), c.t)));
  sec.append(h);
  if (g.sub) sec.append(el('p', 'grp-s', g.sub));
  const flow = el('div', 'flow');
  mine.forEach((c, i) => {
    flow.append(cardEl(c, ctx));
    const nxt = mine[i + 1];
    const glyph = nxt ? arrowBetween(c, nxt) : null;
    if (glyph) flow.append(el('span', 'arrow', glyph));
  });
  sec.append(flow);
  return sec;
}

export function renderProgress(root, project, ctx) {
  const cards = Object.entries(project.cards || {}).map(([id, c]) => ({ id, ...c }));
  root.append(strip(project.index, cards));
  const groups = Object.entries(project.index.groups || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  const used = new Set();
  groups.forEach(([gk, g]) => {
    const mine = cards.filter((c) => c.group === gk).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!mine.length) return;
    mine.forEach((c) => used.add(c.id));
    root.append(groupBlock(g, mine, ctx));
  });
  const rest = cards.filter((c) => !used.has(c.id));
  if (rest.length) root.append(groupBlock({ title: 'Other' }, rest, ctx));
}
