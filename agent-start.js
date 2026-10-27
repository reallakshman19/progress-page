// Agent Start: choose an explicit scope before showing tasks. Never infer assignment or verdict.
import { el, link, copyText } from './util.js?v=31';
import { wbsGroups } from './progress.js?v=31';
import { onboardingModel, renderOnboarding } from './onboarding.js?v=31';

const valid = u => /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\//.test(String(u || ''));
const live = c => !!c && !c.closed && c.state !== 'NOT_APPLICABLE';
const cap = m => String(m?.cap || 'NOT_DEMONSTRATED');
const distinct = list => [...new Map(list.filter(x => valid(x.url)).map(x => [x.url, x])).values()];
const actor = value => /^(?:|[-–—]|none|unassigned|unknown)$/i.test(String(value || '').trim()) ?
  'Not recorded / unassigned' : String(value).trim();
const short = (value, limit = 195) => {
  const text = String(value || '').trim();
  if (text.length <= limit) return text;
  const piece = text.slice(0, limit);
  const end = Math.max(piece.lastIndexOf(' '), limit - 35);
  return piece.slice(0, end).trimEnd() + '…';
};
export const agentStartHref = (key, rev, group, step, cardId = null) => '#/' + encodeURIComponent(key) + '/start/' + encodeURIComponent(rev) +
  (group ? '/' + encodeURIComponent(group) + (step ? '/' + encodeURIComponent(step) +
    (cardId ? '/' + encodeURIComponent(cardId) : '') : '') : '');
const milestoneCards = (cards, id) => Object.entries(cards || {}).filter(([,c]) => live(c) && c.milestone === id);

export function agentStartModel(project, { family = null, step = null, revision = null, cardId = null } = {}) {
  const idx = project?.index || {}, milestones = idx.milestones || {};
  const groups = wbsGroups(idx);
  const mode = step && milestones[step] && family?.steps?.some(s => s.key === step) ? 'step' :
    family && groups.some(g => g.key === family.key) ? 'family' : 'choose';
  const selectedFamily = mode === 'choose' ? null : groups.find(g => g.key === family.key);
  const selectedMilestone = mode === 'step' ? {id: step, ...milestones[step]} : null;
  const cards = project?.cards || {};
  const groupChoices = groups.map(g => ({
    key:g.key, label:g.label, title:g.title, description:g.description,
    count:g.steps.length, workCount:g.steps.reduce((n,s)=>n+milestoneCards(cards,s.key).length,0)
  }));
  const steps = selectedFamily ? selectedFamily.steps.map(s => {
    const m = milestones[s.key] || {};
    const items = milestoneCards(cards,s.key);
    return {id:s.key,wbs:s.wbs,name:m.name || s.name || s.key,label:s.label,
      capability:cap(m),items:items.length,blocked:items.filter(([,c])=>c.state==='BLOCKED').length};
  }) : [];
  const work = selectedMilestone ? milestoneCards(cards,step).map(([id,c])=>({
    id,label:c.label || id,state:c.state || 'UNKNOWN',
    next:c.next?.text || '',nextActor:actor(c.next?.actor),
    status:c.now || '',source:c.src || '',
    refs:(c.refs || []).filter(r => valid(r.u)),who:c.who?.role || '',updatedAt:c.updatedAt || '',
    recipient:[(idx.chats || {})[c.who?.chat]?.label, (idx.chats || {})[c.who?.chat]?.id8].filter(Boolean).join(' · ') || null,
    publicSource:valid(c.src) ? c.src : (c.refs || []).find(r => valid(r.u))?.u || null
  })) : [];
  const sources = mode === 'step' ? distinct([
    {name:'Milestone evidence',url:selectedMilestone.capSrc},
    ...(selectedMilestone.repo && selectedMilestone.commit ?
      [{name:'Recorded candidate commit',url:'https://github.com/'+selectedMilestone.repo+'/commit/'+selectedMilestone.commit}] : []),
    ...work.flatMap(w=>[{name:w.label+' · recorded evidence',url:w.source},
      ...w.refs.map(r=>({name:r.l || r.k || 'Reference',url:r.u}))])
  ]) : [];
  const selected = mode === 'step' && cardId ? work.find(w=>w.id===cardId) || null : null;
  const selectionError = !!cardId && !selected;
  const rev = revision || (idx.revisions || []).find(r=>r.status==='current')?.id || 'unrecorded';
  return {
    mode, revision:rev, family:selectedFamily, focused:selectedMilestone, work, sources, steps,
    requestedCardId:cardId, selected, selectionError,
    choices:groupChoices, totalItems:groupChoices.reduce((n,g)=>n+g.workCount,0),
    title:idx.project?.title || idx.project?.key || 'Project',
    projectKey:idx.project?.key || '', aim:idx.project?.aim || 'Owner aim not recorded',
    aimSrc:valid(idx.project?.aimSrc) ? idx.project.aimSrc : null,
    scope:mode==='step' ? 'WBS '+(selectedMilestone.wbs || step)+' · '+(selectedMilestone.name || step) :
      mode==='family' ? selectedFamily.label : 'Choose a workstream'
  };
}

export function agentStartText(m) {
  const lines=['AGENT START (read-only; verify native evidence before action)',
    'Project: '+m.title,'Revision: '+m.revision,'Scope: '+m.scope,
    'Owner aim: '+m.aim];
  if(m.mode !== 'step') {
    lines.push('No specific task or actor selected; select a WBS workstream and step before acting.');
    return lines.join('\n');
  }
  lines.push('Recorded capability: '+cap(m.focused));
  if(m.focused?.canDo) lines.push('Recorded user capability: '+m.focused.canDo);
  if(m.focused?.activity) lines.push('Recorded activity: '+m.focused.activity);
  lines.push('Exact candidate SHA: '+(m.focused?.commit ?
    m.focused.commit+' (recorded; verify current native PR head)' :
    'NOT_RECORDED in the Page; verify the current native PR head before claiming exact-candidate PASS.'));
  for(const w of m.work) lines.push('WORK ITEM '+w.id+' ['+w.state+'] '+w.label+
    '\n  Recorded next action: '+(w.next || 'NOT_RECORDED')+
    '\n  Next actor: '+w.nextActor+' (not an acknowledged assignment)'+
    '\n  Recorded status/evidence scope: '+(w.status || 'NOT_RECORDED'));
  lines.push('Sources (open and verify):',...m.sources.map(x=>'- '+x.name+': '+x.url));
  lines.push('BOUNDARY: A next-actor label is not an acknowledged assignment. A recorded capability is not independent test, original-file/browser acceptance, Writer/TARGET1 permission, or Owner authorization. Canonical native records override a stale projection.');
  return lines.join('\n');
}

// Only the exact selected card is an exportable task. Unrelated milestone items stay visible
// as context, but are never silently added to this task packet.
export function agentStartTaskText(m) {
  if (m.mode !== 'step' || !m.selected || m.selectionError) return null;
  const w=m.selected;
  const lines=[
    'AGENT TASK PACKET (read-only; no dispatch or acknowledgement)',
    'Project: '+m.title,'Plan revision: '+m.revision,
    'WBS scope: '+m.scope,'Task ID: '+w.id,
    'Task: '+w.label+' ['+w.state+']',
    'Owner aim (approved wording): '+m.aim,
    'Owner aim source: '+(m.aimSrc || 'NOT_RECORDED'),
    'Parent WBS aim: NOT_RECORDED as a separate approved statement; verify the planning source.',
    'Recorded task recipient: '+(w.recipient || 'UNKNOWN')+' (not an acknowledged assignment)',
    'Recorded role: '+(w.who || 'UNKNOWN'),
    'Recorded next actor: '+w.nextActor+' (not an acknowledged assignment)',
    'One recorded next action: '+(w.next || 'NOT_RECORDED'),
    'Return criteria: NOT_RECORDED separately; consult the original native task.',
    'Full recorded status / surviving limitations: '+(w.status || 'NOT_RECORDED'),
    'Recorded milestone capability: '+cap(m.focused),
    'Milestone capability scope: '+(m.focused?.canDo || 'NOT_RECORDED'),
    'Milestone qualification source: '+(valid(m.focused?.capSrc) ? m.focused.capSrc : 'NOT_RECORDED'),
    'Task-level tested candidate / generation: NOT_RECORDED as structured Page fields; check the native record.',
    'Milestone candidate (not automatically the task candidate): '+(m.focused?.commit || 'NOT_RECORDED'),
    'Native task evidence: '+(w.publicSource || 'NOT_RECORDED'),
    'Record observed at: '+(w.updatedAt || 'UNKNOWN'),
    'Task references (open and verify):'
  ];
  const refs=distinct([{name:'Recorded task',url:w.source},...w.refs.map(r=>({name:r.l || r.k || 'Reference',url:r.u}))]);
  lines.push(...refs.map(r=>'- '+r.name+': '+r.url));
  lines.push('BOUNDARY: Evidence, HOLDs, contrary results and UNKNOWNs remain operative. Verify native assignment, exact candidate, current head and authority. Copying does not send or change status.');
  return lines.join('\n');
}

export function renderAgentStart(root, project, opts = {}) {
  const m=agentStartModel(project,opts);
  const section=el('section','agent-start');
  section.setAttribute('data-agent-start-mode',m.mode);
  const nav = (text,group,step,cls,cardId=null) => {
    const url=agentStartHref(opts.projectKey || m.projectKey,m.revision,group,step,cardId);
    if(opts.nav) return opts.nav(url,text,cls || 'agent-start-route');
    const a=el('a',cls || 'agent-start-route',text);a.href=url;return a;
  };
  const heading=el('div','agent-start-head');
  heading.append(el('h3',null,'Agent Start · '+m.scope),el('span','pill',m.revision));
  section.append(heading);
  if(m.selectionError && m.mode !== 'step') {
    const err=el('p','banner agent-start-selection-error',
      'Requested task '+m.requestedCardId+' cannot be resolved in this scope. No alternative task was selected. Check the source link and WBS path.');
    err.setAttribute('role','alert');
    section.append(err);
  }
  if(m.mode === 'choose') {
    section.append(el('p','agent-start-intro',
      'Select the WBS of the task you were given. This page does not assign work or rank unfinished items.'));
    const choices=el('div','agent-start-choices');
    for(const g of m.choices.filter(g=>g.key!=='other')){
      const box=el('article','agent-start-choice');
      const main=nav(g.label,g.key,null,'agent-start-choice-link');
      box.append(main);
      if (g.title) box.append(el('h4','agent-start-choice-title',g.title));
      if (g.description) {
        const description=el('p','agent-start-choice-description',g.description);
        description.title=g.description;
        box.append(description);
      }
      box.append(el('p','muted agent-start-choice-counts',g.count+' WBS steps · '+g.workCount+' recorded work items'));
      choices.append(box);
    }
    section.append(choices);
    const other=m.choices.find(g=>g.key==='other');
    if(other){
      const p=el('p','agent-start-other');
      p.append(nav('Other / legacy milestones',other.key,null),
        el('span','muted',' · '+other.count+' milestones, not a recommended next task'));
      section.append(p);
    }
    if(!m.choices.length)section.append(el('p','muted',
      'No WBS workstreams are recorded. Use Project Home and the authoritative GitHub task; do not invent an assignment.'));
  } else {
    const breadcrumbs=el('nav','agent-start-breadcrumb');
    breadcrumbs.setAttribute('aria-label','Agent Start scope');
    breadcrumbs.append(nav('All workstreams',null,null));
    breadcrumbs.append(el('span','muted',' / '));
    if(m.mode==='family')breadcrumbs.append(el('b',null,m.family.label));
    else {
      breadcrumbs.append(nav(m.family.label,m.family.key,null));
      breadcrumbs.append(el('span','muted',' / '),el('b',null,m.focused.wbs || m.focused.id));
    }
    section.append(breadcrumbs);
  }
  if(m.mode === 'family') {
    section.append(el('p','agent-start-intro',
      'Choose the step from your native task. Capability labels describe recorded evidence, not a new PASS or assignment.'));
    const steps=el('div','agent-start-steps');
    for(const s of m.steps){
      const row=el('article','agent-start-step');
      const h=el('div','agent-start-step-heading');
      h.append(nav(s.label,m.family.key,s.id,'agent-start-step-link'),
        el('span','pill',s.capability));
      row.append(h,el('p','muted',s.items+' work item'+(s.items===1?'':'s')+
        (s.blocked ? ' · '+s.blocked+' BLOCKED record'+(s.blocked===1?'':'s') : '')));
      steps.append(row);
    }
    section.append(steps);
  }
  const workspace=m.mode === 'step' ? el('div','agent-start-workspace') : null;
  const mainCol=m.mode === 'step' ? el('section','agent-start-primary') : section;
  const sideCol=m.mode === 'step' ? el('aside','agent-start-aside') : section;
  if(workspace){ workspace.append(mainCol,sideCol); section.append(workspace); }
  if(m.mode === 'step') {
    const gate=el('section','agent-start-gate');
    gate.append(el('p','agent-start-gate-status','Recorded capability · '+cap(m.focused)));
    if(m.focused.canDo)gate.append(el('p',null,m.focused.canDo));
    gate.append(el('p','agent-start-candidate',m.focused.commit ?
      'Recorded candidate '+m.focused.commit+' · recheck exact current head at source' :
      'Candidate identity NOT_RECORDED here · verify the exact native PR head before claiming PASS'));
    if(valid(m.focused.capSrc))gate.append(link(m.focused.capSrc,'Open milestone evidence','agent-start-source'));
    const single=m.work.length===1;
    if(single)mainCol.append(el('p','agent-start-single-cap','Recorded capability · '+cap(m.focused)));
    if(!single)sideCol.append(gate);
    if(m.selectionError) {
      const error=el('p','banner agent-start-selection-error',
        'Requested task '+m.requestedCardId+' is not an active card in this WBS step. No other task was substituted. Open the native task or choose a recorded card below.');
      error.setAttribute('role','alert');
      mainCol.append(error);
    }
    if(m.selected) {
      const w=m.selected;
      const brief=el('section','agent-start-brief');
      brief.append(el('h4',null,'Selected task · '+w.label+' ['+w.state+']'));
      brief.append(el('p',null,'Task ID: '+w.id+' · Recorded recipient: '+(w.recipient || 'UNKNOWN')+' (not an acknowledged assignment) · Role: '+(w.who || 'UNKNOWN')));
      brief.append(el('p',null,'Parent WBS aim: NOT_RECORDED as a separate approved statement; consult native planning evidence.'));
      brief.append(el('p',null,'Owner aim: '+m.aim));
      if(m.aimSrc)brief.append(link(m.aimSrc,'Original Owner aim source','agent-start-source'));
      brief.append(el('p',null,'Recorded next actor: '+w.nextActor));
      brief.append(el('p',null,'Next action: '+(w.next || 'NOT_RECORDED')));
      brief.append(el('p',null,'Expected return: NOT_RECORDED separately; check the original task.'));
      brief.append(el('p',null,'Record observed: '+(w.updatedAt || 'UNKNOWN')+' · Task-level candidate/generation: UNKNOWN until sourced'));
      if(w.status)brief.append(el('p',null,'Status and limitations: '+w.status));
      if(w.publicSource)brief.append(link(w.publicSource,'Original task evidence','agent-start-source'));
      const packet=agentStartTaskText(m);
      const controls=el('div','agent-start-packet-controls');
      const taskCopy=el('button','btn pri','Copy this task');
      taskCopy.type='button';taskCopy.addEventListener('click',()=>copyText(packet,taskCopy));
      controls.append(taskCopy,el('span','muted',packet.length+' characters · '+
        (packet.length > 3000 ? 'Above 3,000-character usability target; necessary evidence retained without truncation' :
          'Source-backed full text; no truncation')));
      brief.append(controls);
      const preview=el('details','agent-start-detail');
      preview.append(el('summary',null,'Preview exact task packet ('+packet.length+' characters)'));
      preview.append(el('pre','agent-start-packet-preview',packet));
      brief.append(preview);
      const onb=onboardingModel(project,{cardId:w.id});
      if(onb)renderOnboarding(brief,project,{embedded:true,model:onb});
      mainCol.append(brief);
    }
    mainCol.append(el('h4',null,single ? 'Recorded next action · not an assignment' :
      m.work.length+' recorded work items · not priority ranked'));
    for(const w of m.work){
      const row=el('article','agent-start-item');
      const h=el('div','agent-start-task-title');
      h.append(el('strong',null,w.label),el('span','pill',w.state));
      const taskLink=nav(m.selected?.id===w.id ? 'Selected task link' : 'Select this task',m.family.key,m.focused.id,
        'agent-start-task-link',w.id);
      taskLink.setAttribute('aria-label','Open task '+w.id+' · '+w.label);
      row.append(h,taskLink);
      if(m.selected?.id===w.id)row.className+=' agent-start-selected';
      row.append(el('p','agent-start-next','Recorded next: '+(w.next?short(w.next):'No next action recorded')));
      row.append(el('p','agent-start-actor','Actor: '+w.nextActor));
      const links=el('div','agent-start-links');
      if(w.publicSource)links.append(link(w.publicSource,'Open original GitHub record','agent-start-source'));
      else links.append(el('span','muted','Public task source not recorded'));
      row.append(links);
      if(w.status || w.next || w.refs.length) {
        const detail=el('details','agent-start-detail');
        detail.append(el('summary',null,'Full recorded evidence and limitations'));
        if(w.next)detail.append(el('p',null,'Full next-action text: '+w.next));
        if(w.status)detail.append(el('p',null,'Recorded status: '+w.status));
        for(const r of w.refs)detail.append(link(r.u,r.l || r.k || 'Reference','agent-start-source'));
        row.append(detail);
      }
      mainCol.append(row);
    }
    if(single)sideCol.append(gate);
    if(!m.work.length)mainCol.append(el('p','muted',
      'No current work items are recorded for this step. An independent GitHub task is needed before acting.'));
    const sources=el('details','agent-start-sources');
    sources.append(el('summary',null,'All recorded evidence links ('+m.sources.length+')'));
    if(!m.sources.length)sources.append(el('p','muted','No public sources recorded; verify the native task.'));
    m.sources.forEach(s=>{const p=el('p');p.append(link(s.url,s.name));sources.append(p);});
    sideCol.append(sources);
    const milestonePacket=agentStartText(m);
    const copy=el('button','btn','Copy milestone evidence');
    copy.type='button';copy.addEventListener('click',()=>copyText(milestonePacket,copy));
    mainCol.append(copy,el('span','muted',' Full milestone: '+milestonePacket.length+' characters. Includes all tasks.'));
    const fullPreview=el('details','agent-start-detail');
    fullPreview.append(el('summary',null,'Preview full milestone evidence ('+milestonePacket.length+' characters)'));
    fullPreview.append(el('pre','agent-start-packet-preview',milestonePacket));
    mainCol.append(fullPreview);
  }
  const rules=el('details','agent-start-rules');
  rules.append(el('summary',null,'Authority and evidence rules'));
  rules.append(el('p',null,'Read-only projection. No assignment, independent PASS, Owner acceptance, Writer/TARGET1 transfer, merge or release permission is granted here. Verify exact candidate and current Cycle in canonical GitHub sources.'));
  sideCol.append(rules);
  const aim=el('details','agent-start-aim');
  aim.append(el('summary',null,'Owner outcome · original wording'));
  aim.append(el('p',null,m.aim));
  if(m.aimSrc)aim.append(link(m.aimSrc,'Owner aim source','agent-start-source'));
  sideCol.append(aim);
  root.append(section);
}
