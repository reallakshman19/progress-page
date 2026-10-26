// Agent Start: choose an explicit scope before showing tasks. Never infer assignment or verdict.
import { el, link, copyText } from './util.js?v=28';
import { wbsGroups } from './progress.js?v=28';

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
const agentStartHref = (key, rev, group, step) => '#/' + encodeURIComponent(key) + '/start/' + encodeURIComponent(rev) +
  (group ? '/' + encodeURIComponent(group) + (step ? '/' + encodeURIComponent(step) : '') : '');
const milestoneCards = (cards, id) => Object.entries(cards || {}).filter(([,c]) => live(c) && c.milestone === id);

export function agentStartModel(project, { family = null, step = null, revision = null } = {}) {
  const idx = project?.index || {}, milestones = idx.milestones || {};
  const groups = wbsGroups(idx);
  const mode = step && milestones[step] && family?.steps?.some(s => s.key === step) ? 'step' :
    family && groups.some(g => g.key === family.key) ? 'family' : 'choose';
  const selectedFamily = mode === 'choose' ? null : groups.find(g => g.key === family.key);
  const selectedMilestone = mode === 'step' ? {id: step, ...milestones[step]} : null;
  const cards = project?.cards || {};
  const groupChoices = groups.map(g => ({
    key:g.key, label:g.label, count:g.steps.length, workCount:g.steps.reduce((n,s)=>n+milestoneCards(cards,s.key).length,0)
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
    publicSource:valid(c.src) ? c.src : (c.refs || []).find(r => valid(r.u))?.u || null
  })) : [];
  const sources = mode === 'step' ? distinct([
    {name:'Milestone evidence',url:selectedMilestone.capSrc},
    ...(selectedMilestone.repo && selectedMilestone.commit ?
      [{name:'Recorded candidate commit',url:'https://github.com/'+selectedMilestone.repo+'/commit/'+selectedMilestone.commit}] : []),
    ...work.flatMap(w=>[{name:w.label+' · recorded evidence',url:w.source},
      ...w.refs.map(r=>({name:r.l || r.k || 'Reference',url:r.u}))])
  ]) : [];
  const rev = revision || (idx.revisions || []).find(r=>r.status==='current')?.id || 'unrecorded';
  return {
    mode, revision:rev, family:selectedFamily, focused:selectedMilestone, work, sources, steps,
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

export function renderAgentStart(root, project, opts = {}) {
  const m=agentStartModel(project,opts);
  const section=el('section','agent-start');
  section.setAttribute('data-agent-start-mode',m.mode);
  const nav = (text,group,step,cls) => {
    const url=agentStartHref(opts.projectKey || m.projectKey,m.revision,group,step);
    if(opts.nav) return opts.nav(url,text,cls || 'agent-start-route');
    const a=el('a',cls || 'agent-start-route',text);a.href=url;return a;
  };
  const heading=el('div','agent-start-head');
  heading.append(el('h3',null,'Agent Start · '+m.scope),el('span','pill',m.revision));
  section.append(heading);
  if(m.mode === 'choose') {
    section.append(el('p','agent-start-intro',
      'Select the WBS of the task you were given. This page does not assign work or rank unfinished items.'));
    const choices=el('div','agent-start-choices');
    for(const g of m.choices.filter(g=>g.key!=='other')){
      const box=el('article','agent-start-choice');
      const main=nav(g.label,g.key,null,'agent-start-choice-link');
      box.append(main,el('p','muted',g.count+' WBS steps · '+g.workCount+' recorded work items'));
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
    mainCol.append(el('h4',null,single ? 'Recorded next action · not an assignment' :
      m.work.length+' recorded work items · not priority ranked'));
    for(const w of m.work){
      const row=el('article','agent-start-item');
      const h=el('div','agent-start-task-title');
      h.append(el('strong',null,w.label),el('span','pill',w.state));
      row.append(h);
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
    const copy=el('button','btn pri','Copy scoped handoff');
    copy.type='button';copy.addEventListener('click',()=>copyText(agentStartText(m),copy));
    mainCol.append(copy);
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
