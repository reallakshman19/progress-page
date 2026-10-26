// My actions (decision cards) and Grounding fixtures.
import { ciifrRoiModel } from './roi.js?v=28';
import { el, link, md, age, copyText } from './util.js?v=28';
import { issueUrl, pageUrl } from './reply.js?v=28';
import { oracleContinuityModel } from './oracle-continuity.js?v=28';

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

const COMMON_RELAY = 'https://github.com/reallakshman19/Common/tree/main/relay/AGENT_WORK';
const RELAY_POLICY = 'https://github.com/reallakshman19/Common/blob/main/skills/agent-work/ARTIFACT_RELAY.md';

// Never infer byte delivery from a URL: these are curated fixture references, not verification.
export function relayInputRecords(fixtures) {
  const fx = fixtures || {};
  const items = [...(fx.inputs || []), ...(fx.repository || [])];
  return items.filter(i => {
    const status = String(i.s || '') + ' ' + String(i.t || '');
    const url = String(i.u || '');
    return /\b(?:ARTIFACT_RELAY|AGENT_INPUT|RELAY_RETURN|PRIVATE_CUSTODY|RELAY_REGISTERED|RECEIVED_CONFIRMED|BYTES_VERIFIED)\b/i.test(status)
      || /\/relay\/(?:AGENT_WORK\/[^/]+\/[^/]+|[^/]+\/(?:ARTIFACT_REGISTER\.md|receipt\.md|payload\/))/i.test(url);
  });
}

const SECTIONS = [['repository', 'Repository'], ['issues', 'Issues'], ['pullRequests', 'Pull requests'], ['roadmap', 'Roadmap'],
  ['highRoi', 'High-ROI ideas'], ['future', 'Future'], ['intent', 'Intent'], ['inputs', 'Inputs'], ['knownIssues', 'Known issues'], ['pending', 'Pending']];

function drawRoi(li, item) {
  li.append(el('strong', null, item.title));
  li.append(el('p', 'muted', 'Prospective only · Impact: ' + item.impact +
    ' · Likelihood: ' + item.likelihood + ' · Effort: ' + item.effort));
  li.append(el('p', 'muted', 'Dependencies/HOLDs: ' + item.dependency));
  const sources = el('ul', 'roi-sources');
  item.sources.forEach(r => {
    const entry = el('li');
    const label = r.from + (r.item.s ? ' · ' + r.item.s : '');
    entry.append(r.item.u ? link(r.item.u, label) : el('span', null, label));
    entry.append(' — ' + r.item.t);
    sources.append(entry);
  });
  li.append(sources);
}

function drawRoiOrigin(li, r) {
  li.append(el('b', null, r.from + ' · ' + r.category + ' · ' + r.reason), ' — ');
  li.append(r.item.u ? link(r.item.u, r.item.t) : r.item.t);
  if (r.item.s) li.append(' ', el('span', 'chip n', r.item.s));
}

function renderRoiProjection(root, roi) {
  root.append(el('p', 'home-note muted',
    'CIIFR ROI is a read-only classification of audited source records. High and Medium mean prospective priority, not measured savings or release approval. Original list (' + roi.rawCount + ' rows) remains unchanged in Git history and Timeline.'));
  homeList(root, 'High ROI · prospective opportunities', roi.high,
    'No qualified prospective High-ROI candidates found.', true, drawRoi);
  homeList(root, 'Medium ROI · conditional opportunities', roi.medium,
    'No qualified prospective Medium-ROI candidates found.', true, drawRoi);
  homeList(root, 'Original High-ROI source inventory · historical/reference/governance/prospective', roi.inventory,
    'No original records.', false, drawRoiOrigin);
  if (roi.unclassified.length)
    root.append(el('p', 'err', roi.unclassified.length + ' original High-ROI source rows changed or were added; they are NOT auto-promoted. Reclassify before publishing priorities.'));
}

export function renderFixtures(root, fixtures, projectKey = '', originals = fixtures) {
  root.append(el('p', 'lead', 'Read these first. Sources and starting context for any agent or Oracle joining this project.'));
  root.append(el('p', 'muted', 'Oracle maintains agent input/output fixture references through the audited fixture CLI. Preferred transport: '),
    link(COMMON_RELAY, 'Common relay/AGENT_WORK'), ' · ', link(RELAY_POLICY, 'relay policy'),
    '. Google Drive is private/fallback custody; public records never prove a recipient fetched bytes.');
  homeList(root, 'Oracle↔agent relay inputs and returns', relayInputRecords(fixtures),
    'No current task-scoped Common relay input/return has been recorded. Oracle must add the real fixture/receipt and delivery state; no file handoff is implied.', true);
  const roi = ciifrRoiModel(projectKey, fixtures, originals);
  if (roi) renderRoiProjection(root, roi);
  SECTIONS.forEach(([key, title]) => {
    if (roi && key === 'highRoi') return; // Original sources appear in the audited provenance detail above.
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
export function projectHomeModel(project, historical = false) {
  const pj = project?.index?.project || {};
  const fx = project?.fixtures || {};
  const roi = historical ? null : ciifrRoiModel(pj.key, fx);
  const refs = [...(fx.repository || []), ...(fx.intent || []), ...(fx.highRoi || [])];
  const matches = (item, re) => re.test([(item.t || ''), (item.s || ''), (item.n || ''), (item.u || '')].join(' '));
  const concepts = refs.filter(item => matches(item, /concept[ -]?note|project concept|concept brief|concept overview|CONCEPT_NOTE/i));
  const architecture = refs.filter(item => !concepts.includes(item) && matches(item,
    /architectur|complex concept|data model|source model|system model|engineering contract|physical model|topolog|ARCHITECTURE_CONCEPT|COMPLEX_CONCEPT/i));
  const milestones = Object.entries(project?.index?.milestones || {}).sort((a, b) =>
    (a[1].order || 0) - (b[1].order || 0)).map(([id, m]) => ({ id, text: (m.wbs ? 'WBS ' + m.wbs + ' · ' : '') + (m.name || id), detail: m.full || '' }));
  const currentTasks = Object.entries(project?.cards || {})
    .filter(([, c]) => !c.closed && c.state !== 'NOT_APPLICABLE' && c.state !== 'VERIFIED')
    .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
    .map(([id, c]) => ({ id, label: c.label || id, milestone: c.milestone || '', next: c.next?.text || '', actor: c.next?.actor || '' }));
  return {
    aim: pj.aim || '', aimSrc: pj.aimSrc || '',
    concepts, architecture, relayInputs: relayInputRecords(fx),
    roadmap: fx.roadmap || [], intent: fx.intent || [],
    sources: [...(fx.repository || []), ...(fx.issues || []), ...(fx.inputs || [])],
    roi, decisions: roi ? roi.high : (fx.highRoi || []), blockers: [...(fx.knownIssues || []), ...(fx.pending || [])],
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
    if (items.length > 12) {
      const input = el('input', 'home-filter');
      input.type = 'search';
      input.placeholder = 'Find in ' + heading.toLowerCase() + '…';
      input.setAttribute('aria-label', 'Filter ' + heading);
      const count = el('p', 'home-filter-count muted', 'Showing all ' + items.length + ' records');
      input.addEventListener('input', () => {
        const term = input.value.trim().toLocaleLowerCase();
        let visible = 0;
        ul.querySelectorAll('li').forEach(li => {
          li.hidden = !li.textContent.toLocaleLowerCase().includes(term);
          if (!li.hidden) visible++;
        });
        count.textContent = 'Showing ' + visible + ' of ' + items.length + ' records';
      });
      detail.append(input, count);
    }
    detail.append(ul);
  }
  root.append(detail);
}

// Stable grouping derived only from the existing roadmap labels; no new task status or acceptance is inferred.
export function projectRoadmapGroups(items = []) {
  const groups = [
    { title: 'Geometry · WBS 3', entries: [] },
    { title: 'Element · WBS 4', entries: [] },
    { title: 'Programme, integration and history', entries: [] },
  ];
  items.forEach(item => {
    const tag = String(item.s || '').toUpperCase();
    const group = /^(?:G[0-4](?:_|$)|WBS3_)/.test(tag) ? 0
      : /^(?:E[0-6](?:_|$)|WBS4_|NEXT_THREE$)/.test(tag) ? 1 : 2;
    groups[group].entries.push(item);
  });
  return groups;
}

export function renderProjectHome(root, project, mode = 'home', historical = false) {
  const m = projectHomeModel(project, historical);
  const key = project?.index?.project?.key || '';
  const box = el('section', 'project-home');
  const names = { home: 'Project Home', 'home-roadmap': 'Roadmap and WBS',
    'home-sources': 'Architecture and sources', 'home-risks': 'Work, risks and handoffs' };
  box.append(el('h3', null, names[mode] || names.home));
  box.append(el('p', 'muted home-note',
    'Read-only, source-linked project context. Original GitHub records govern; this page grants no task, review, Writer or merge authority.'));

  if (mode === 'home') {
    if (!m.aim) box.append(el('p', 'muted', 'Owner aim not recorded in this project.'));
    // projectHead already displays the Owner aim and source; do not repeat the long text here.
    const nav = el('div', 'home-tiles');
    const destinations = [
      ['Roadmap', m.roadmap.length + ' plan entries', 'home-roadmap', 'Delivery sequence and numbered WBS'],
      ['Architecture', m.architecture.length + ' source records', 'home-sources', 'Engineering concepts and original references'],
      ['Work and risks', m.currentTasks.length + ' current tasks', 'home-risks', 'Open issues, actors and handoff custody'],
      ['Oracle continuity', oracleContinuityModel(project).cards.length + ' source-linked records', 'oracle-continuity', 'Oracle onboarding and handover checkpoints'],
      ['My actions', openCount(project.actions) + ' open decisions', 'actions', 'Owner decisions and replies'],
      ['Execution status', m.milestones.length + ' milestones', 'progress', 'Actual agent results and evidence'],
    ];
    destinations.forEach(([title, count, dest, detail]) => {
      const a = el('a', 'home-tile');
      a.href = '#/' + encodeURIComponent(key) + '/' + dest;
      a.append(el('strong', null, title), el('span', 'home-tile-count', count), el('span', 'home-tile-desc', detail));
      nav.append(a);
    });
    box.append(nav);
    homeList(box, 'Concept note and purpose', m.concepts,
      'No source-grounded concept recorded yet; link an existing project note in Grounding Fixtures.', m.concepts.length > 0 && m.concepts.length <= 3);
    box.append(el('p', 'home-tip muted',
      'Plans are not verified deliverables. Use Execution status for current PASS / HOLD / NOT_RUN evidence and actors.'));
  } else if (mode === 'home-roadmap') {
    box.append(el('p', 'home-note', 'Planned sequence only. Open a WBS group to read its source entries; check Progress for actual execution and release qualification.'));
    projectRoadmapGroups(m.roadmap).forEach(g => {
      if (g.entries.length) homeList(box, g.title, g.entries, 'No entries in this workstream.');
    });
    homeList(box, 'Numbered WBS and milestone definitions', m.milestones, 'No WBS milestones recorded.', false,
      (li, item) => { li.append(el('b', null, item.text)); if (item.detail) li.append(el('span', 'muted', ' — ' + item.detail)); });
  } else if (mode === 'home-sources') {
    homeList(box, 'Architecture and complex concepts', m.architecture,
      'No source-grounded architecture records yet.');
    homeList(box, 'Original sources and ground fixtures', m.sources, 'No sources recorded.');
    homeList(box, 'Owner decisions and revisions', m.intent, 'No decision/source entries recorded.');
    if (m.roi) renderRoiProjection(box, m.roi);
    else homeList(box, 'Architecture improvement rationale', m.decisions, 'No rationale entries recorded.');
  } else if (mode === 'home-risks') {
    homeList(box, 'Current WBS tasks and next actions', m.currentTasks, 'No open work recorded.', false,
      (li, item) => {
        li.append(el('b', null, item.label), ' · ' + (item.milestone || 'project'));
        if (item.actor) li.append(' · ' + item.actor);
        if (item.next) li.append(el('span', 'muted', ' — ' + item.next));
      });
    homeList(box, 'Known issues, blockers and pending work', m.blockers, 'No issues/pending entries recorded.');
    const relayInfo = el('p', 'home-note muted', 'Oracle↔agent custody: preferred ');
    relayInfo.append(link(COMMON_RELAY, 'Common relay/AGENT_WORK'), ' · ', link(RELAY_POLICY, 'handoff protocol'),
      '. A producer hash or public link alone does not verify recipient bytes.');
    box.append(relayInfo);
    homeList(box, 'Current agent inputs and artifact returns', m.relayInputs,
      'No task-scoped Common relay fixture/receipt is recorded. This does not imply delivery.', false);
  }
  root.append(box);
}
