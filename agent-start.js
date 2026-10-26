// Read-only, source-backed launchpad for agents. Native issues/Cycles remain authoritative.
import { el, link, copyText } from './util.js?v=25';

const valid = u => /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\//.test(String(u || ''));
const active = c => !c.closed && c.state !== 'NOT_APPLICABLE';
const required = m => String(m?.cap || 'NOT_DEMONSTRATED');
const distinct = list => [...new Map(list.filter(x => valid(x.url)).map(x => [x.url, x])).values()];

export function agentStartModel(project, { family = null, step = null, revision = null } = {}) {
  const idx = project?.index || {}, raw = idx.milestones || {};
  const milestones = Object.entries(raw).sort((a,b) => (a[1].order || 0)-(b[1].order || 0));
  const familyKeys = family?.steps?.map(s => s.key) || null;
  const scoped = milestones.filter(([id]) => (!familyKeys || familyKeys.includes(id)) && (!step || id === step));
  const cards = Object.entries(project?.cards || {}).filter(([,c]) => active(c));
  const candidates = scoped.flatMap(([id,m]) => cards.filter(([,c]) => c.milestone === id)
    .map(([cardId,c]) => ({ id: cardId, card: c, milestoneId:id, milestone:m })));
  const incomplete = candidates.filter(c => c.card.state !== 'VERIFIED');
  const selected = step ? candidates : incomplete.length ? incomplete : candidates;
  const work = selected.slice(0,3).map(({id,card,milestoneId,milestone}) => ({
    id, milestoneId, name: milestone.name || milestoneId, wbs: milestone.wbs || '',
    label: card.label || id, state:card.state || 'UNKNOWN', next:card.next?.text || '',
    nextActor:card.next?.actor || '', status: card.now || '', source:card.src || '',
    refs: (card.refs || []).filter(r => valid(r.u)), capability:required(milestone),
    canDo:milestone.canDo || '', activity:milestone.activity || '',
  }));
  const focused = step && raw[step] ? {id:step, ...raw[step]} : null;
  const focusRefs = focused ? [
    {name:'Recorded capability evidence',url:focused.capSrc},
    ...(focused.repo && focused.commit ? [{name:'Recorded candidate commit',url:'https://github.com/'+focused.repo+'/commit/'+focused.commit}] : [])
  ] : [];
  const cardRefs = work.flatMap(x => [
    {name:x.label+' · latest recorded source',url:x.source},
    ...x.refs.map(r => ({name:r.l || r.k || 'Task reference',url:r.u}))
  ]);
  const sources = distinct([...focusRefs,...cardRefs,{name:'Owner aim source',url:idx.project?.aimSrc}]);
  const rev = revision || (idx.revisions || []).find(r=>r.status==='current')?.id || 'unrecorded';
  const summary = focused ? (focused.wbs ? 'WBS '+focused.wbs+' · ' : '')+(focused.name || step) :
    family ? family.label : 'Project-wide task selection';
  return { revision:rev, scope:summary, focused, work, sources,
    aim:idx.project?.aim || 'Owner aim not recorded', title:idx.project?.title || idx.project?.key || 'Project',
    projectKey:idx.project?.key || '', selectedCount: candidates.length,
    hiddenCount:Math.max(0,selected.length-work.length) };
}

export function agentStartText(m) {
  const lines = ['AGENT START (read-only orientation; verify original GitHub records)',
    'Project: '+m.title, 'Revision: '+m.revision, 'Scope: '+m.scope, 'Owner aim: '+m.aim];
  if (m.focused) {
    lines.push('Recorded capability: '+required(m.focused));
    if (m.focused.canDo) lines.push('Recorded user capability: '+m.focused.canDo);
    if (m.focused.activity) lines.push('Recorded activity: '+m.focused.activity);
    lines.push('Exact candidate SHA: '+(m.focused.commit ? m.focused.commit+' (recorded; verify current native PR head)' : 'NOT_RECORDED in the Page; verify the current native PR head before claiming exact-candidate PASS.'));
  }
  for(const w of m.work) lines.push('TASK '+w.id+' ['+w.state+'] '+w.label+
    '\n  Next: '+(w.next || 'Not recorded')+'; next actor label: '+(w.nextActor || 'unknown')+
    '\n  Recorded status: '+(w.status || 'Not recorded'));
  lines.push('Sources (open and verify):',...m.sources.map(x => '- '+x.name+': '+x.url));
  lines.push('BOUNDARY: A next-actor label is not an acknowledged assignment. A recorded capability is not independent test, original-file/browser acceptance, Writer/TARGET1 permission, or Owner authorization. Canonical native records override a stale projection.');
  return lines.join('\n');
}

export function renderAgentStart(root, project, opts = {}) {
  const m = agentStartModel(project, opts);
  const panel = el('section','agent-start');
  const head=el('div','agent-start-head');
  head.append(el('h3',null,'Agent Start · '+m.scope),el('span','pill',m.revision));
  panel.append(head);
  panel.append(el('p','agent-start-intro','Source-backed task orientation. Verify the current candidate and permissions in the original GitHub records.'));
  const note=el('p','agent-start-boundary','Authority boundary: this view does not assign a participant, independently verify a claim, or grant Owner acceptance, Writer/TARGET1 transfer, merge or release. An obsolete Page claim yields to its canonical source.');
  panel.append(note);
  panel.append(el('h3',null,opts.step?'Task in this step':'Next recorded tasks'));
  if(!m.work.length)panel.append(el('p','muted','No live agent task is recorded in this scope. Open the canonical issue before acting; do not infer a new assignment.'));
  m.work.forEach(w=>{
    const box=el('article','agent-start-task');
    const label=el('div','agent-start-task-title');
    label.append(el('b',null,w.label),el('span','pill',w.state),el('span','muted',w.milestoneId+(w.wbs?' · WBS '+w.wbs:'')));
    box.append(label);
    if(w.status)box.append(el('p',null,'Recorded status: '+w.status));
    box.append(el('p',null,'Next: '+(w.next||'No executable next action recorded')+' · Actor label: '+(w.nextActor||'not recorded')));
    const linkrow=el('div','agent-start-links');
    const local=opts.nav&&opts.projectKey ? opts.nav('#/'+encodeURIComponent(opts.projectKey)+'/start/'+encodeURIComponent(m.revision)+
       '/'+encodeURIComponent((w.wbs?'wbs:'+/^\d+/.exec(w.wbs)[0]:'other'))+'/'+encodeURIComponent(w.milestoneId),'Focus this step','agent-start-source') : null;
    if(local)linkrow.append(local);
    if(valid(w.source))linkrow.append(link(w.source,'Native source','agent-start-source'));
    if(linkrow.childNodes.length)box.append(linkrow);
    panel.append(box);
  });
  if(m.hiddenCount)panel.append(el('p','muted',m.hiddenCount+' more in this scope. Narrow to a WBS step to inspect it; no tasks were deleted.'));
  if(m.focused) {
    const capability=el('div','agent-start-cap');
    capability.append(el('b',null,'Recorded capability: '+required(m.focused)));
    if(m.focused.canDo)capability.append(el('p',null,m.focused.canDo));
    if(m.focused.activity)capability.append(el('p','muted','Recorded activity: '+m.focused.activity));
    capability.append(el('p','agent-start-candidate',m.focused.commit ?
      'Recorded candidate SHA (verify current PR head): '+m.focused.commit :
      'Exact candidate SHA: NOT RECORDED in this Page. Open the native PR and verify its current head before relying on exact-candidate checks.'));
    panel.append(capability);
  }
  const aim=el('details','agent-start-aim');
  aim.append(el('summary',null,'Owner aim · expand original wording'));
  aim.append(el('p',null,m.aim));
  panel.append(aim);
  const src=el('div','agent-start-sources');src.append(el('h3',null,'Starting sources · '+m.sources.length));
  m.sources.slice(0,5).forEach(x=>{const p=el('p');p.append(link(x.url,x.name));src.append(p);});
  if(m.sources.length>5){const details=el('details');details.append(el('summary',null,'Show '+(m.sources.length-5)+' more sources'));m.sources.slice(5).forEach(x=>{const p=el('p');p.append(link(x.url,x.name));details.append(p);});src.append(details);}
  if(!m.sources.length)src.append(el('p','muted','No public GitHub source recorded for this selection. Verify the canonical task independently.'));
  panel.append(src);
  const copy=el('button','btn pri','Copy source-backed handoff');copy.type='button';
  copy.addEventListener('click',()=>copyText(agentStartText(m),copy));
  panel.append(copy);
  root.append(panel);
}
