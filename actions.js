// My actions (decision cards) and Grounding fixtures.
import { el, link, md, age, copyText } from './util.js?v=9';
import { issueUrl, pageUrl } from './reply.js?v=9';

export const openCount = (actions) => Object.values(actions || {}).filter((a) => a.status === 'open').length;

function table(t) {
  const tb = el('table', 'tb');
  const head = el('tr');
  (t.cols || []).forEach((c) => head.append(el('th', null, c)));
  tb.append(head);
  (t.rows || []).forEach((r) => {
    const tr = el('tr');
    r.forEach((cell, i) => tr.append(el('td', t.mono && t.mono[i] ? 'mono' : null, cell)));
    tb.append(tr);
  });
  return tb;
}

function sendUrl(a, o, project, rt) {
  return issueUrl(rt, {
    title: '[Owner input] ' + a.title + ' ' + o.key + ' (' + project.key + ')',
    project: project.key,
    type: 'DECISION',
    text: o.reply,
    evidence_link: pageUrl(rt) + '#/' + project.key + '/actions',
  });
}

function option(a, o, project) {
  const r = el('div', 'op' + (o.suggested ? ' sg' : ''));
  const k = el('div', 'op-k');
  k.append(el('div', 'ok', o.key + (o.suggested ? ' (suggested)' : '')));
  if (o.suggested) k.append(el('span', 'tag', 'Suggested'));
  const b = el('div', 'op-b');
  b.append(el('div', null), el('div', 'rp', o.reply));
  b.firstChild.append(md(o.body));
  const bt = el('div', 'bt');
  const cp = el('button', 'btn', 'Copy reply');
  cp.type = 'button';
  cp.addEventListener('click', () => copyText(o.reply, cp));
  bt.append(cp);
  const rt = project.replyTo;
  if (rt && rt.kind === 'github-issue') {
    const who = rt.target === 'OwnerTeammember' ? 'OTM' : rt.target;
    bt.append(link(sendUrl(a, o, project, rt), 'Send to ' + who, 'btn pri'),
      el('span', 'hint', 'Opens GitHub with this reply filled in. Tick "I am the Owner", then Submit new issue.'));
  } else {
    bt.append(el('span', 'hint', 'Copy only: paste your reply in the chat.'));
  }
  b.append(bt);
  r.append(k, b);
  return r;
}

function card(a, project) {
  const done = a.status === 'done';
  const c = el('section', 'dc' + (done ? ' done' : ''));
  const h = el('div', 'dc-h');
  h.append(el('h3', null, a.title), el('span', 'chip ' + (done ? 's' : 'w'), done ? 'answered' : 'open'));
  c.append(h);
  if (a.lead) c.append(el('p', 'lead', a.lead));
  (a.tables || []).forEach((t) => c.append(table(t)));
  if (a.ask) c.append(el('p', 'lead', a.ask));
  if (done) {
    const an = a.answer || {};
    const b = el('div', 'ans');
    b.append(el('b', null, 'Answer: '), an.text || '');
    if (an.at) b.append(' · ', age(an.at, '{t} ago', an.at));
    if (an.ref) b.append(' · ', link(an.ref, 'source'));
    c.append(b);
  } else {
    (a.options || []).forEach((o) => c.append(option(a, o, project)));
  }
  if ((a.links || []).length) {
    const l = el('div', 'lk');
    l.append('Links: ');
    a.links.forEach((x, i) => { if (i) l.append(', '); l.append(link(x.u, x.l)); });
    c.append(l);
  }
  return c;
}

export function renderActions(root, project) {
  const items = Object.entries(project.actions || {}).map(([id, a]) => ({ id, ...a }))
    .sort((x, y) => (x.status === y.status ? (x.order || 0) - (y.order || 0) : x.status === 'open' ? -1 : 1));
  if (!items.length) {
    root.append(el('p', 'empty', 'Nothing to answer here.'));
    return;
  }
  items.forEach((a) => root.append(card(a, project)));
}

const SECTIONS = [['repository', 'Repository'], ['issues', 'Issues'], ['pullRequests', 'Pull requests'], ['roadmap', 'Roadmap'],
  ['highRoi', 'High-ROI ideas'], ['future', 'Future'], ['intent', 'Intent'], ['inputs', 'Inputs'], ['knownIssues', 'Known issues'], ['pending', 'Pending']];

export function renderFixtures(root, fixtures) {
  root.append(el('p', 'lead', 'Read these first. Sources and starting context for any agent or Oracle joining this project.'));
  SECTIONS.forEach(([key, title]) => {
    const items = (fixtures || {})[key] || [];
    const s = el('section', 'fx');
    s.append(el('h3', null, title));
    if (!items.length) {
      s.append(el('p', 'muted', 'Nothing listed.'));
    } else {
      const ul = el('ul');
      items.forEach((i) => {
        const li = el('li');
        if (i.s) li.append(el('span', 'chip n', i.s), ' ');
        li.append(i.u ? link(i.u, i.t) : i.t);
        if (i.n) li.append(el('span', 'muted', ' — ' + i.n));
        ul.append(li);
      });
      s.append(ul);
    }
    root.append(s);
  });
}
