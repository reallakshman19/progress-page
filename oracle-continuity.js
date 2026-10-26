// Oracle-specific continuity presentation. Only source-recorded Oracle transitions appear.
// Engineering G0/coder onboarding stays in WBS evidence and is never promoted to Oracle readiness.
import { el, link } from './util.js?v=28';

export const CONTINUITY_PROTOCOL =
  'https://github.com/reallakshman19/Common/tree/main/skills/agent-work/oracle-continuity';
const START_HERE =
  'https://github.com/reallakshman19/Common/blob/main/skills/agent-work/START_HERE.md';
const CHECKS = [
  'Identify the authorized incumbent and successor; distinguish PREPARED from ACTIVE.',
  'Pin the current canonical source, control epoch, project revision and assignments.',
  'Confirm original fixture access and source receipt for the new Oracle.',
  'Record in-flight coder and reviewer tasks, exact PR heads and surviving blockers.',
  'Resolve predecessor write exclusion and competing assignments before cutover.',
  'Obtain a distinct, source-backed authorization for any control transfer.',
  'Prove the successor can continue from GitHub alone; record the next action.',
];

export function oracleContinuityModel(project) {
  const groups = project?.index?.groups || {};
  const cards = Object.entries(project?.cards || {}).filter(([id,c]) => {
    const name = [id,c.label].join(' ');
    const context = [c.who?.role, groups[c.group]?.title].join(' ');
    // Do not treat "G0 · Onboarding" or a coder's readiness as Oracle onboarding.
    return /onboard|continuity|successor|succession|handover|cutover/i.test(name)
      && /oracle|successor|continuity|handover|cutover/i.test(name + ' ' + context)
      && !/coder|builder/i.test(c.who?.role || '');
  }).map(([id,c]) => ({id, ...c}));
  const ids = new Set(cards.map(c=>c.id));
  const events = (project?.audit?.events || []).filter(e => ids.has(e.card)
    && (e.kind === 'BASELINE' || e.kind === 'TRANSFER'
      || /onboard|handover|successor|cutover|continuity/i.test(e.summary || '')));
  const latest = ((project?.index?.revisions || []).find(r=>r.status === 'current') || {}).id || '';
  return { cards, events, revision: latest };
}

function evidence(root, source, label = 'Source') {
  if (/^https:\/\/github\.com\//.test(source || '')) root.append(link(source,label));
  else if (source) root.append(el('span','muted','Public evidence unavailable: '+source));
  else root.append(el('span','muted','No public evidence recorded'));
}
export function renderOracleContinuity(root, project) {
  const model = oracleContinuityModel(project);
  const panel = el('section','project-home oracle-continuity');
  panel.append(el('h3',null,'Oracle continuity · onboarding and handover'));
  panel.append(el('p','muted',
    'Read-only source evidence. This is Oracle-level continuity, not coder onboarding, an engineering PASS, assignment activation or Owner acceptance.'));
  const guides = el('p','muted');
  guides.append('Protocols: ',link(CONTINUITY_PROTOCOL,'Oracle continuity'), ' · ',link(START_HERE,'Common START_HERE'));
  panel.append(guides);
  if (!model.cards.length) {
    panel.append(el('p','banner',
      'No Oracle-specific onboarding or handover card is recorded. Do not infer an active successor from a generic task or G0 coder card.'));
  }
  model.cards.forEach(c => {
    const details = el('details','home-detail oracle-handover');
    const wbs = project?.index?.milestones?.[c.milestone]?.wbs;
    // CIIFR's original Geometry 3.0 is an engineering WBS record; display its seam
    // as a contextual reference, not as a replacement for canonical Oracle authority.
    const heading = (project?.index?.project?.key === 'ciifr'
      ? '3.0 · Onboarding and integration seam · ' : 'Oracle onboarding and handover · ')
      + (c.label || c.id);
    details.append(el('summary',null,heading));
    const inner=el('div','onb-detail-body');
    inner.append(el('p',null,'Recorded state: '+(c.state||'UNKNOWN')+
      ' · Plan revision: '+(model.revision||'unrecorded')+
      (wbs ? ' · Source task WBS '+wbs : '')+
      ' · Task ID: '+c.id));
    if(c.now)inner.append(el('p',null,c.now));
    const to = c.next || {};
    if(to.actor||to.text)inner.append(el('p',null,'Next: '+(to.actor||'unassigned')+' — '+(to.text||'not recorded')));
    const currentSource=el('p',null,'Current evidence: ');
    evidence(currentSource,c.src);inner.append(currentSource);
    if (c.refs?.length) {
      const list=el('ul');
      c.refs.forEach(r=>{const li=el('li');evidence(li,r.u,r.l||'Reference');list.append(li);});
      inner.append(list);
    }
    const guide=el('details','onb-details');
    guide.append(el('summary',null,'Oracle handover checks (read-only, not auto-passed)'));
    const ol=el('ol','onb-guide');
    CHECKS.forEach(t=>ol.append(el('li',null,t)));
    guide.append(ol);inner.append(guide);
    const history=model.events.filter(e=>e.card===c.id);
    if (history.length) {
      const records=el('details','onb-details');
      records.append(el('summary',null,'Recorded onboarding and transfer events ('+history.length+')'));
      const ul=el('ul');
      history.forEach(e=>{
        const li=el('li');
        li.append((e.rev||'')+' · '+(e.kind||'')+' · '+(e.summary||'Event')+' · ');
        evidence(li,e.source,'record');
        ul.append(li);
      });
      records.append(ul);inner.append(records);
    }
    details.append(inner);panel.append(details);
  });
  root.append(panel);
}
