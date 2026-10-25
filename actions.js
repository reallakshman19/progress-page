// My actions (decision cards) and Grounding fixtures.
import { el, link, md, age, copyText } from './util.js?v=16';
import { issueUrl, pageUrl } from './reply.js?v=16';

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
  items.forEach((a) => {
    const c = card(a, project);
    if (a.wholeProject) c.prepend(el('span', 'chip n', 'whole project'));
    root.append(c);
  });
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
        if (i.wholeProject) li.append(' ', el('span', 'chip n', 'whole project'));
        ul.append(li);
      });
      s.append(ul);
    }
    root.append(s);
  });
}

 
// Project Home is a read-only projection of existing audited project/fixture records.
// The Oracle is responsible for source-grounded concept/architecture/roadmap content;
// the viewer must never invent source documents, approval or engineering authority.
export function projectHomeModel(project) {
  const pj = project?.index?.project || {};
  const fx = project?.fixtures || {};
  const refs = [...(fx.repository || []), ...(fx.intent || []), ...(fx.highRoi || [])];
  const matches = (item, re) => re.test([(item.t || ''), (item.s || ''), (item.n || ''), (item.u || '')].join(' '));
  const concepts = refs.filter(item => matches(item, /concept[ -]?note|project concept|concept brief|concept overview|CONCEPT_NOTE/i));
  const architecture = refs.filter(item => matches(item,
    /architectur|complex concept|data model|source model|system model|engineering contract|physical model|topolog|ARCHITECTURE_CONCEPT|COMPLEX_CONCEPT/i));
  const milestones = Object.entries(project?.index?.milestones || {}).sort((a, b) =>
    (a[1].order || 0) - (b[1].order || 0)).map(([id, m]) => ({ id, text: (m.wbs ? 'WBS ' + m.wbs + ' · ' : '') + (m.name || id), detail: m.full || '' }));
  const currentTasks = Object.entries(project?.cards || {})
    .filter(([, c]) => !c.closed && c.state !== 'NOT_APPLICABLE' && c.state !== 'VERIFIED')
    .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
    .map(([id, c]) => ({ id, label: c.label || id, milestone: c.milestone || '', next: c.next?.text || '', actor: c.next?.actor || '' }));
  return {
    aim: pj.aim || '', aimSrc: pj.aimSrc || '',
    concepts, architecture,
    roadmap: fx.roadmap || [], intent: fx.intent || [],
    sources: [...(fx.repository || []), ...(fx.issues || []), ...(fx.inputs || [])],
    decisions: fx.highRoi || [], blockers: [...(fx.knownIssues || []), ...(fx.pending || [])],
    milestones, currentTasks,
  };
}

function homeList(root, heading, items, empty, open = false, draw = null) {
  const detail = el('details', 'home-detail');
  if (open) detail.open = true;
  const summary = el('summary', null, heading + ' (' + items.length + ')');
  detail.append(summary);
  if (!items.length) detail.append(el('p', 'muted', empty));
  else {
    const ul = el('ul', 'home-items');
    items.forEach(item => {
      const li = el('li');
      if (draw) draw(li, item);
      else {
        if (item.s) li.append(el('span', 'chip n', item.s), ' ');
        li.append(item.u ? link(item.u, item.t || 'Source') : (item.t || 'Source'));
        if (item.n) li.append(el('span', 'muted', ' — ' + item.n));
      }
      ul.append(li);
    });
    detail.append(ul);
  }
  root.append(detail);
}

export function renderProjectHome(root, project) {
  const m = projectHomeModel(project);
  const box = el('section', 'project-home');
  box.append(el('h3', null, 'Project Home · Owner concept, architecture and roadmap'));
  box.append(el('p', 'muted', 'Source-linked project grounding curated by the Oracle. Existing GitHub records remain authoritative; this display grants no task, review or merge permission.'));
  if (m.aim) {
    const aim = el('p', 'home-aim');
    aim.append(el('b', null, 'Owner aim: '), m.aim + ' ');
    if (/^https:\/\//.test(m.aimSrc)) aim.append(link(m.aimSrc, 'Owner source'));
    box.append(aim);
  } else box.append(el('p', 'muted', 'Owner aim not recorded in this project.'));
  homeList(box, 'Concept note and purpose', m.concepts,
    'Not recorded: Oracle should add a source-linked project concept note to existing Grounding Fixtures.', true);
  homeList(box, 'Architecture and complex concepts', m.architecture,
    'Not recorded: Oracle should link source-grounded architecture and difficult concept explanations.', true);
  homeList(box, 'Roadmap and delivery sequence', m.roadmap,
    'No source-grounded roadmap recorded yet.', true);
  homeList(box, 'WBS and dependency context', m.milestones, 'No WBS milestones recorded.', false,
    (li, item) => { li.append(el('b', null, item.text)); if (item.detail) li.append(el('span', 'muted', ' — ' + item.detail)); });
  homeList(box, 'Current WBS tasks and next actions', m.currentTasks, 'No open work recorded.', false,
    (li, item) => {
      li.append(el('b', null, item.label), ' · ' + (item.milestone || 'project'));
      if (item.actor) li.append(' · ' + item.actor);
      if (item.next) li.append(el('span', 'muted', ' — ' + item.next));
    });
  homeList(box, 'Original sources and ground fixtures', m.sources, 'No sources recorded.');
  homeList(box, 'Owner decisions and revisions', m.intent, 'No decision/source entries recorded.');
  homeList(box, 'Architecture improvement rationale', m.decisions, 'No rationale entries recorded.');
  homeList(box, 'Known issues, blockers and pending work', m.blockers, 'No issues/pending entries recorded.');
  root.append(box);
}
