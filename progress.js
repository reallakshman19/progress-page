// Progress view: attention strip, milestone strip, then groups of agent blocks.
import { el, link, md, age } from './util.js?v=9';
import { cardTags, fmt, nudgeTag } from './triggers.js?v=9';
import { nudgeRow } from './nudge.js?v=9';

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

export function renderProgress(root, project, ctx) {
  const cards = Object.entries(project.cards || {}).map(([id, c]) => Object.assign({ id }, c));
  ctx.cards = project.cards;
  if (ctx.sum) root.append(attention(ctx.sum, ctx.rules));
  root.append(strip(project.index, cards));
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
}
