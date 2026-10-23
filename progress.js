// Progress view: attention strip, milestone strip, then groups of agent blocks.
import { el, link, md, age } from './util.js?v=14';
import { cardTags, fmt, nudgeTag } from './triggers.js?v=14';
import { nudgeRow } from './nudge.js?v=14';

const RANK = { NOT_STARTED: 0, UNKNOWN: 1, STALE: 1, IN_PROGRESS: 2, SUBMITTED: 3, VERIFIED: 4 };
const ICON = { VERIFIED: '✓', SUBMITTED: '↑', IN_PROGRESS: '●', BLOCKED: '!', NOT_STARTED: '○', STALE: '?', UNKNOWN: '?', NOT_APPLICABLE: '–' };
const KIND = { VERIFIED: 'done', IN_PROGRESS: 'working', SUBMITTED: 'waiting', BLOCKED: 'hold', NOT_STARTED: 'idle', STALE: 'gap', UNKNOWN: 'gap', NOT_APPLICABLE: 'done' };
const COUNT_ORDER = [['VERIFIED', 'verified'], ['SUBMITTED', 'submitted'], ['IN_PROGRESS', 'in progress'], ['BLOCKED', 'blocked'], ['NOT_STARTED', 'not started']];

// A milestone is BLOCKED if any of its cards is; VERIFIED only when every card is. Otherwise it takes the weakest
// state among the cards that have started, and is NOT_STARTED when none has. Superseded and cancelled cards do not count.
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

// What the user can do with a WBS step, set by its Oracle with evidence; agent block states never decide it.
const CAP = { NOT_DEMONSTRATED: 'not demonstrated', CANDIDATE: 'candidate demonstrated', BENCHMARK_SUPPORTED: 'benchmark supported',
  INDEPENDENTLY_VERIFIED: 'independently verified', AVAILABLE: 'available to the user' };

// The WBS step picked per project; kept across the two-minute refresh, cleared with "All".
const picks = {};
let picked = null;  // the pick of the project being drawn

// Read or set the picked step (a milestone key, or null for all). The page's WBS row and the strip share it.
export function wbsPick(project, key) {
  if (key !== undefined) picks[project] = key;
  return picks[project] || null;
}

// The steps for the page's WBS row: every milestone in order, labelled with its WBS number when it has one.
export function wbsSteps(index) {
  const list = Object.entries((index || {}).milestones || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  if (!list.some(([, m]) => m.wbs)) return [];
  return list.map(([key, m]) => ({ key, label: (m.wbs ? 'WBS ' + m.wbs : key) + ' · ' + m.name }));
}

function applyPick(root) {
  root.querySelectorAll('.ms[data-ms]').forEach((b) => b.classList.toggle('on', b.dataset.ms === picked));
  root.querySelectorAll('.ms-all').forEach((b) => b.classList.toggle('on', !picked));
  root.querySelectorAll('.card').forEach((c) => { c.hidden = !!picked && c.dataset.ms !== picked; });
  root.querySelectorAll('.grp').forEach((g) => { g.hidden = !!picked && !g.querySelector('.card:not([hidden])'); });
  root.querySelectorAll('.flow .arrow').forEach((a) => {
    const prev = a.previousElementSibling;
    const next = a.nextElementSibling;
    a.hidden = !!picked && (!prev || prev.hidden || !next || next.hidden);
  });
}

function strip(index, cards, ctx) {
  const wrap = el('div', 'ms-wrap');
  const pk = (index.project || {}).key || '';
  const keep = () => { picks[pk] = picked; };
  const redraw = () => (ctx && ctx.rerender ? ctx.rerender() : applyPick(wrap.parentNode));
  const list = Object.entries(index.milestones || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  const wbs = list.some(([, m]) => m.wbs);
  const hd = el('div', 'h-label', wbs ? 'Work breakdown (WBS)' : 'Milestones');
  wrap.append(hd);
  const row = el('div', 'ms-row');
  const all = el('button', 'ms-all', 'All');
  all.type = 'button';
  all.title = 'Show the agent blocks of every step';
  all.addEventListener('click', () => { picked = null; keep(); redraw(); });
  row.append(all);
  list.forEach(([key, m], i) => {
    const mine = cards.filter((c) => c.milestone === key);
    const live = mine.filter((c) => c.state !== 'NOT_APPLICABLE');
    const state = milestoneState(mine);
    const box = el('div', 'ms ms-' + state + (m.cap ? ' cap cap-' + m.cap : ''));
    box.setAttribute('role', 'button');
    box.tabIndex = 0;
    box.dataset.ms = key;
    box.title = (m.full || m.name) + ' (click to show only this step’s agent blocks)';
    const top = el('div', 'ms-top');
    top.append(el('span', 'ms-ic', ICON[state] || '○'), el('span', 'ms-key', m.wbs ? 'WBS ' + m.wbs : key));
    if (m.wbs) top.append(el('span', 'ms-id', key));
    box.append(top, el('div', 'ms-name', m.name));
    if (m.cap) {
      box.append(el('div', 'ms-cap', CAP[m.cap] || m.cap));
      if (m.canDo) box.append(el('div', 'ms-can', 'Can do: ' + m.canDo));
    } else {
      box.append(el('div', 'ms-state', state));
    }
    if (m.bench || m.keeps) box.append(el('div', 'ms-bench', [m.bench, m.keeps ? 'keeps ' + m.keeps : ''].filter(Boolean).join(' · ')));
    box.append(el('div', 'ms-count', live.filter((c) => c.state === 'VERIFIED').length + ' of ' + live.length + ' agent blocks verified'));
    const pick = () => { picked = picked === key ? null : key; keep(); redraw(); };
    box.addEventListener('click', (e) => { if (!e.target.closest('a')) pick(); });
    box.addEventListener('keydown', (e) => { if (e.target === box && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(); } });
    row.append(box);
    if (i < list.length - 1) row.append(el('span', 'ms-sep', '›'));
  });
  wrap.append(row);
  const ev = list.filter(([, m]) => m.cap && m.capSrc);
  if (ev.length) {
    const p = el('p', 'ms-line', 'Evidence: ');
    ev.forEach(([key, m], i) => { if (i) p.append(' · '); p.append(link(m.capSrc, m.wbs ? 'WBS ' + m.wbs : key)); });
    wrap.append(p);
  }
  const live = cards.filter((c) => c.state !== 'NOT_APPLICABLE');
  const n = {};
  live.forEach((c) => { n[c.state] = (n[c.state] || 0) + 1; });
  const parts = COUNT_ORDER.filter(([s]) => n[s]).map(([s, label]) => n[s] + ' ' + label);
  const closed = cards.length - live.length;
  wrap.append(el('p', 'ms-line', (parts.join(' · ') || 'no cards') + ' of ' + live.length + ' cards' + (closed ? ' (' + closed + ' superseded or cancelled not counted)' : '')
    + '. A card count on a partial list, not a delivery percentage.'));
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

function closedLine(c, ctx) {
  const x = c.closed;
  const by = x.by && ctx.cards && ctx.cards[x.by] ? ctx.cards[x.by].label : x.by;
  const b = el('div', 'c-closed');
  b.append(el('b', null, x.kind === 'superseded' ? 'Superseded' + (by ? ' by ' + by : '') : 'Cancelled'), ': ' + x.why + ' ', link(x.src, 'source'));
  return b;
}

function cardEl(c, ctx) {
  const kind = c.kind || KIND[c.state] || 'idle';
  const d = el('article', 'card k-' + kind + (c.closed ? ' closed' : ''));
  d.dataset.card = c.id;
  if (c.milestone) d.dataset.ms = c.milestone;
  const hd = el('div', 'c-hd');
  hd.append(el('span', 'c-nm', c.label), age(c.updatedAt, '(updated {t} ago)', c.state === 'NOT_STARTED' ? '(not started)' : '(updated: no GitHub time)'));
  d.append(hd);
  const who = c.who || {};
  const chat = (ctx.chats || {})[who.chat] || {};
  const sub = el('div', 'c-sub');
  const chatUrl = chat.id8 ? (ctx.links || {})[chat.id8] : null;
  if (chat.id8) sub.append(chatUrl ? link(chatUrl, chat.id8) : chat.id8);
  [who.role, chat.engine].filter(Boolean).forEach((x) => sub.append((sub.childNodes.length ? ' · ' : '') + x));
  const from = who.from && (ctx.chats || {})[who.from];
  if (from) sub.append(' · took over from ' + (from.label || from.id8));
  if (sub.childNodes.length) d.append(sub);
  const pills = el('div', 'c-pills');
  pills.append(el('span', 'pill st-' + c.state, c.state));
  if (c.milestone) pills.append(el('span', 'pill', c.milestone));
  const tags = c.closed ? [] : cardTags(c, ctx.rules || {}, undefined, ctx.hold);
  const nt = c.closed || !ctx.nudge ? null : nudgeTag(ctx.nudge.openList(c.id), ctx.rules || {});
  if (nt) tags.push(nt);
  d.dataset.trig = tags.map((t) => t.k).join(' ');
  tags.forEach((t) => pills.append(el('span', 'chip ' + (t.sev === 2 ? 'd' : t.sev === 1 ? 'w' : 'n'), t.t)));
  (c.chips || []).forEach((x) => pills.append(el('span', 'chip ' + (x.c || 'n'), x.t)));
  d.append(pills);
  if (c.closed) d.append(closedLine(c, ctx));
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
  const ft = el('div', 'c-ft');
  if (c.src) {
    const s = el('div', 'c-src');
    s.append('source: ', link(c.src, 'event'));
    ft.append(s);
  }
  if (ctx.nudge && !c.closed) {
    if (ctx.nudge.static) {
      const list = ctx.nudge.list(c.id);
      if (list.length) {
        const dt = el('details', 'nd');
        dt.append(el('summary', null, 'Nudges (' + list.length + ')'));
        list.forEach((n) => dt.append(nudgeRow(n)));
        d.append(dt);
      }
    } else if (!ctx.readOnly) {
      const open = ctx.nudge.openList(c.id).length;
      const b = el('button', 'btn small nudge', 'Nudge +' + (open ? ' (' + open + ')' : ''));
      b.type = 'button';
      b.title = 'Instructions for ' + ((ctx.rules || {}).coordinator || 'OTM') + ' to fold into the next message to this agent';
      b.addEventListener('click', () => ctx.nudge.open(c));
      ft.append(b);
    }
  }
  if (ft.childNodes.length) d.append(ft);
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

// Attention strip: the trigger counts for this project. Clicking a count jumps to the first matching block.
function attention(sum, rules) {
  const wrap = el('div', 'attn');
  const coord = (rules || {}).coordinator || 'OTM';
  [['needsYou', 'needs-you', 'Needs you', 'd'], ['owes', 'owes', coord + ' owes', 'w'], ['nudges', 'nudge', 'Nudges for ' + coord, 'w'],
    ['quiet', 'quiet', 'Quiet agents', 'w'], ['waiting', 'waiting', 'Waiting on others', 'w']]
    .forEach(([slot, k, label, cls]) => {
      const n = sum[slot] || 0;
      const b = el('button', 'chip big ' + (n ? cls : 'n'), label + ' ' + n);
      b.type = 'button';
      if (n) {
        b.addEventListener('click', () => {
          const t = document.querySelector('.card[data-trig~="' + k + '"]');
          if (!t) return;
          t.scrollIntoView({ block: 'center', behavior: 'smooth' });
          t.classList.add('flash');
          setTimeout(() => t.classList.remove('flash'), 1600);
        });
      }
      wrap.append(b);
    });
  wrap.append(el('span', 'chip big ' + (sum.stale ? 'w' : 'n'), sum.stale ? 'Tab stale ' + fmt(sum.staleFor) : 'Tab fresh'));
  return wrap;
}

// The revision a card was born in: the rev of its first Timeline event (events before revisions existed count as the first).
export function birthRev(project, id) {
  const revs = (project.index || {}).revisions || [];
  const first = ((project.audit || {}).events || []).find((e) => e.card === id);
  return (first && first.rev) || (revs[0] || {}).id || null;
}

// A superseded or cancelled card shows only in the revision it was born in; older ones are seen by opening that revision.
export function visibleCards(project) {
  const cur = (((project.index || {}).revisions || []).find((r) => r.status === 'current') || {}).id;
  const all = Object.entries(project.cards || {}).map(([id, c]) => Object.assign({ id }, c));
  const shown = all.filter((c) => !c.closed || !cur || birthRev(project, c.id) === cur);
  return { shown, hidden: all.length - shown.length };
}

export function renderProgress(root, project, ctx) {
  const { shown: cards, hidden } = visibleCards(project);
  ctx.cards = project.cards;
  if (ctx.sum) root.append(attention(ctx.sum, ctx.rules));
  if (hidden) root.append(el('p', 'ms-line', hidden + ' closed cards from earlier revisions are not shown; open that revision above to see them.'));
  picked = picks[(project.index.project || {}).key || ''] || null;
  root.append(strip(project.index, cards, ctx));
  const groups = Object.entries(project.index.groups || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  const used = new Set();
  groups.forEach(([gk, g]) => {
    const mine = cards.filter((c) => c.group === gk).sort((a, b) => (Number(!!a.closed) - Number(!!b.closed)) || ((a.order || 0) - (b.order || 0)));
    if (!mine.length) return;
    mine.forEach((c) => used.add(c.id));
    root.append(groupBlock(g, mine, ctx));
  });
  const rest = cards.filter((c) => !used.has(c.id));
  if (rest.length) root.append(groupBlock({ title: 'Other' }, rest, ctx));
  picked = picks[(project.index.project || {}).key || ''] || null;
  if (picked && !(project.index.milestones || {})[picked]) picked = picks[(project.index.project || {}).key || ''] = null;
  applyPick(root);
}
