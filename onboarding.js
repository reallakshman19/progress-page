// Reusable read-only onboarding panel. Uses existing audited cards/fixtures; never grants assignment or approval.
import { el, link } from './util.js?v=26';

// Common/main is the single normative role-and-mode entry after its companion Common PR merges.
// This link does not select authority, authenticate recipients or promote readiness.
export const COMMON_START_HERE = 'https://github.com/reallakshman19/Common/blob/main/skills/agent-work/START_HERE.md';
const ONB_STAGES = ['Not assigned', 'Sources checked', 'Access verified', 'Ready for bounded task'];
const ONB_CODES = ['ONB_SOURCES_CHECKED', 'ONB_ACCESS_VERIFIED', 'ONB_READY'];
const ONB_GUIDE = [
  ['Owner intent', 'Read the aim and exact Owner decision before changing scope.'],
  ['Canonical sources', 'Open the current task, original fixtures, pinned skills and repo instructions.'],
  ['Role and task', 'Check the recipient, assignment generation and one next operation.'],
  ['Access probe', 'Confirm the exact source bytes, GitHub permissions, runtime and return channel.'],
  ['Protected boundaries', 'Honor READ_ONLY qualification, shared-file claims, privacy and Writer HOLD.'],
  ['Runnable slice', 'Demonstrate the assigned step with an actual source/target pair.'],
  ['Evidence return', 'Report exact head, checks/NOT_RUN, a surviving-error case, handoff and Owner boundary.'],
];

// Progress Page doesn't own a second assignment ledger. Stages beyond zero require *recorded*,
// participant-bound GitHub evidence in the existing native fixture + audit workflow.
export function onboardingModel(project) {
  const index = project?.index || {};
  const groups = Object.entries(index.groups || {})
    .filter(([id, g]) => /onboard/i.test(id) || /onboard/i.test(g.title || ''))
    .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  if (!groups.length) return null;
  const [groupId, group] = groups[0];
  const assigned = Object.entries(project.cards || {})
    .filter(([, c]) => c.group === groupId && !c.closed && c.state !== 'NOT_APPLICABLE')
    .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  if (!assigned.length) return null;
  const [cardId, card] = assigned[0];
  const recipient = (index.chats || {})[(card.who || {}).chat] || null;
  const id8 = recipient?.id8 || null;
  // A source/recipient ID alone is replayable after a reassignment or candidate change.
  // The newest native assignment reference is the explicit current task binding.
  const assignments = (card.refs || []).filter((r) =>
    r.l === 'Onboarding assignment' && /^https:\/\/github\.com\//.test(r.u || ''));
  const assignment = assignments.length ? assignments[assignments.length - 1].u : null;
  const candidate = (index.milestones || {})[card.milestone]?.commit || null;
  const evidence = (project.fixtures?.pending || []).filter((f) => {
    const tokens = String(f.t || '').split(/\s+/);
    return f.milestone === card.milestone && f.n === id8 && !!id8 && !!assignment &&
      /^https:\/\/github\.com\//.test(f.u || '') &&
      tokens.includes('ONB_ASSIGNMENT=' + assignment) &&
      (!candidate || tokens.includes('ONB_COMMIT=' + candidate));
  });
  let stage = 0;
  if (id8) {
    for (const code of ONB_CODES) {
      if (!evidence.some((f) => f.s === code)) break;
      stage += 1;
    }
  }
  const milestones = Object.entries(index.milestones || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  const pos = milestones.findIndex(([key]) => key === card.milestone);
  const nextTwo = pos < 0 ? [] : milestones.slice(pos + 1, pos + 3)
    .map(([id, m]) => ({ id, label: (m.wbs ? 'WBS ' + m.wbs + ' · ' : '') + m.name, cap: m.cap || null }));
  const refs = (project.fixtures?.repository || []).filter((f) =>
    /CONTRIBUTION_HANDOFF\.md|oracle-continuity\/PROTOCOL\.md|oracle-standalone\/SKILL\.md/.test(f.u || ''));
  const protocols = ['CONTRIBUTION_HANDOFF.md', 'oracle-continuity/PROTOCOL.md', 'oracle-standalone/SKILL.md']
    .map((path) => refs.filter((f) => (f.u || '').includes(path))
      .sort((a, b) => (b.u?.includes('a9491531') ? 1 : 0) - (a.u?.includes('a9491531') ? 1 : 0))[0])
    .filter(Boolean);
  return {
    stage, stageLabel: ONB_STAGES[stage], cardId, card, groupId, group,
    recipient: id8, assignment, evidence, protocols, nextTwo,
    revision: ((index.revisions || []).find((r) => r.status === 'current') || {}).id || 'not recorded',
    candidate,
  };
}

function onbDetails(label, build) {
  const box = el('details', 'onb-details');
  box.append(el('summary', null, label));
  const inner = el('div', 'onb-detail-body');
  build(inner);
  box.append(inner);
  return box;
}

export function renderOnboarding(root, project, { embedded = false, model = null } = {}) {
  const m = model || onboardingModel(project);
  if (!m) return;
  const sec = el('section', 'onb-panel' + (embedded ? ' onb-embedded' : ''));
  sec.setAttribute('aria-label', 'Oracle and agent onboarding');
  const head = el('div', 'onb-head');
  head.append(el('h3', null, 'Onboarding · ' + m.group.title),
    el('span', 'onb-phase', m.stageLabel));
  if (!embedded) sec.append(head);
  const stages = el('ol', 'onb-stages');
  ONB_STAGES.forEach((name, i) => {
    const step = el('li', 'onb-stage' + (i === m.stage ? ' current' : i < m.stage ? ' completed' : ''), name);
    if (i === m.stage) step.setAttribute('aria-current', 'step');
    stages.append(step);
  });
  sec.append(stages);
  const note = el('p', 'onb-note',
    'Recorded readiness, not permission to edit, engineering PASS, Oracle cutover or Owner acceptance.');
  sec.append(note);
  const now = el('div', 'onb-now');
  now.append(el('b', null, 'One current task · ' + m.card.label),
    el('span', 'onb-muted', m.recipient ? 'Recorded recipient ' + m.recipient : 'No recipient assigned'));
  now.append(el('p', null, m.card.next?.text || 'No executable next action recorded.'));
  if (m.card.next?.actor) now.append(el('p', 'onb-note', 'Next actor: ' + m.card.next.actor));
  for (const ref of (m.card.refs || []).filter((r) => r.u).slice(0, 2)) {
    now.append(link(ref.u, ref.l || 'Task source', 'onb-reference'));
  }
  if (!embedded) sec.append(now);
  const extra = el('div', 'onb-extra');
  extra.append(onbDetails('Start Here · seven checks', (inner) => {
    inner.append(el('p', null, link(COMMON_START_HERE, 'Common START HERE · choose role and mode')));
    const ol = el('ol', 'onb-guide');
    ONB_GUIDE.forEach(([name, hint]) => {
      const row = el('li'); row.append(el('b', null, name + ': '), hint); ol.append(row);
    });
    inner.append(ol);
    m.protocols.forEach((p) => inner.append(el('p', null, link(p.u, p.t))));
  }));
  extra.append(onbDetails('Continuity checkpoint', (inner) => {
    inner.append(el('p', null, 'Plan revision: ' + m.revision + ' · Task card: ' + m.cardId));
    inner.append(el('p', null, 'Exact candidate: ' + (m.candidate || 'not recorded for this step')));
    inner.append(el('p', null, 'Oracle control epoch and in-flight assignments: consult current canonical GitHub state. This page does not activate cutover.'));
    if (m.nextTwo.length) {
      const list = el('ol');
      m.nextTwo.forEach((step) => list.append(el('li', null, step.label + ' · ' + (step.cap || 'not demonstrated'))));
      inner.append(el('b', null, 'Next two connected slices'), list);
    }
  }));
  extra.append(onbDetails('Contribution and independence', (inner) => {
    inner.append(el('p', null, 'Separate FACT_OBSERVED, REPORTED, SELF_ASSESSED, FAIL, NOT_RUN and independently reviewed claims. A contributor cannot independently approve affected work.'));
    inner.append(el('p', null, 'For each consequential PASS: name the exact candidate, independent expectation and a plausible wrong outcome that the check could miss.'));
  }));
  extra.append(onbDetails('Resume-from-GitHub check', (inner) => {
    inner.append(el('p', null, 'Can the successor identify the current issue/commit, one unresolved counterexample and one executable next action without this chat?'));
    inner.append(el('p', null, 'If not, mark the missing source or access BLOCKED/UNKNOWN and repair the existing checkpoint. Do not invent authority or another tracker.'));
  }));
  sec.append(extra);
  root.append(sec);
}
