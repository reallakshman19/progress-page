// Read-only Project/WBS checkpoint and optional canonical Cycle projection.
// Nothing in this module changes task assignments, verdicts or the Page ledger.
import { el, link } from './util.js?v=32';

const github = x => typeof x === 'string' && /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\//.test(x);
const recent = x => {const n=Date.parse(x||'');return Number.isFinite(n)?n:-Infinity;};
const currentRev = p => (p.index?.revisions || []).find(r=>r.status==='current')?.id || 'UNKNOWN';
const pending = c => !c.closed && c.state !== 'NOT_APPLICABLE' && c.state !== 'VERIFIED';
const text = (x,unknown='NOT_RECORDED') => typeof x==='string' && x.trim() ? x.trim() : unknown;
const sortRecent=(a,b)=>recent(b[1].updatedAt)-recent(a[1].updatedAt) || a[0].localeCompare(b[0]);

// Only explicitly configured sources are used; name matching never auto-binds
// an entire Page project to a narrower engineering Cycle.
export function cycleSource(binding,pageKey) {
  if (!binding || typeof binding!=='object' || binding.pageProject!==pageKey ||
      typeof binding.scope!=='string' || !/^wbs:\d+$/.test(binding.scope)) return null;
  const url=String(binding.url||'');
  const m=/^https:\/\/raw\.githubusercontent\.com\/reallakshman19\/Common\/main\/oracle-cycles\/([a-z0-9-]+)\/CURRENT\.json$/.exec(url);
  return m && m[1]===binding.project ? url : null;
}
export function cycleSummary(cycle,binding,pageKey) {
  if (!cycleSource(binding,pageKey)) return {status:'UNMAPPED',message:'No explicit scoped canonical Cycle binding; native task remains authoritative.'};
  if (!cycle || cycle.schema!=='oracle-cycle-current/v1' ||
      cycle.project!==binding.project || cycle.mode!=='standalone' ||
      cycle.progress_projection?.repository!=='reallakshman19/progress-page' ||
      cycle.progress_projection?.project_key!==pageKey)
    return {status:'INVALID',message:'Cycle identity or projection scope could not be verified; no actor inferred.'};
  if (cycle.activation!=='ACTIVE') return {status:'INACTIVE',revision:cycle.revision,
    message:'Canonical Cycle is not ACTIVE; no dispatch inferred.'};
  const next=cycle.next || {};
  return {status:'OBSERVED',revision:cycle.revision,scope:binding.scope,
    actor:text(next.recipient_role,'UNKNOWN'),id8:text(next.recipient_chat_id8,'UNKNOWN'),
    action:text(next.instruction),nextStatus:text(next.status,'UNKNOWN'),
    evidence:github(next.evidence_ref)?next.evidence_ref:null,
    expected:text(next.required_return),candidate:text(next.source),
    projection:text(cycle.progress_projection?.publication_status,'UNKNOWN'),
    message:'Canonical next record observed; opening the Page does not dispatch, accept or authorize an action.'};
}
export function checkpointModel(project,{family=null,step=null,cycle=null,binding=null,cycleCheck=null,pageFetch=null,historical=false}={}) {
  const idx=project?.index||{},pj=idx.project||{};
  const milestones=idx.milestones||{};
  const allowed=step ? new Set([step]) : family ? new Set(family.steps.map(x=>x.key)) : null;
  const rows=Object.entries(project?.cards||{}).filter(([,c])=>!allowed||allowed.has(c.milestone));
  const visible=rows.filter(([,c])=>!c.closed).sort(sortRecent);
  const latest=visible[0] || null;
  // Reuse the existing audited Timeline; collapse identical source/kind/summary
  // in this tiny summary only. No new Page event or coordinator log is created.
  const seen=new Set();
  const changes=(project?.audit?.events||[]).filter(e=>!allowed ||
    (e.card && allowed.has((project?.cards||{})[e.card]?.milestone)) ||
    (typeof e.scope==='string' && e.scope.startsWith('milestone:') && allowed.has(e.scope.slice(10))) ||
    (e.action && allowed.has((project?.actions||{})[e.action]?.milestone)))
    .filter(e=>!!e.summary).sort((a,b)=>recent(b.at)-recent(a.at))
    .filter(e=>{const identity=[e.source,e.kind,e.summary].join('|');if(seen.has(identity))return false;seen.add(identity);return true;})
    .slice(0,3).map(e=>({id:e.id||'UNKNOWN',when:e.at||'UNKNOWN',summary:e.summary,
      source:github(e.source)?e.source:null}));
  const blockers=visible.filter(([,c])=>c.state==='BLOCKED');
  const open=visible.filter(([,c])=>pending(c));
  const scope=step ? (milestones[step]?.wbs ? 'WBS '+milestones[step].wbs : step) :
    family ? family.label : 'Project';
  const record=step ? milestones[step] : family ?
    (family.steps.find(x=>x.wbs===family.key.slice(4)) || (family.steps.length===1?family.steps[0]:null)) : null;
  const milestone=record ? milestones[record.key] : null;
  const item=latest?.[1],itemId=latest?.[0];
  const taskSource=github(item?.src)?item.src:null;
  const nativeCycle=historical ? {status:'HISTORICAL',message:'Historical snapshot: do not mix a live Cycle into this revision.'} :
    cycleCheck?.status==='error' ? {status:'UNAVAILABLE',message:'Canonical Cycle retrieval failed; current assignment is UNKNOWN.'} :
    cycleCheck?.status==='loading' ? {status:'LOADING',message:'Checking explicitly configured Cycle source; no actor inferred yet.'} :
    cycleSummary(cycle,binding,pj.key);
  const scopedCycle= !family && !step ? nativeCycle : nativeCycle.scope && (
    (step && String(milestones[step]?.wbs||'').split('.')[0]===nativeCycle.scope.slice(4)) ||
    (family && family.key===nativeCycle.scope)) ? nativeCycle :
    {status:'OUT_OF_SCOPE',message:'Canonical Cycle is not established for this selected WBS; do not transfer another workstream’s assignment.'};
  return {project:pj.key||'UNKNOWN',title:pj.title||'Project',scope,
    revision:currentRev(project),aim:text(pj.aim),aimSource:github(pj.aimSrc)?pj.aimSrc:null,
    purpose:step ? text(milestone?.full) : family ? text(family.description) : null,
    capability:milestone?text(milestone.cap,'NOT_DEMONSTRATED'):null,
    canDo:milestone?text(milestone.canDo):null,
    capSource:milestone&&github(milestone.capSrc)?milestone.capSrc:null,
    last:latest ? {id:itemId,label:text(item.label,itemId),state:text(item.state,'UNKNOWN'),
      detail:text(item.now),observedAt:text(item.updatedAt,'UNKNOWN'),
      source:taskSource,sourceLimit:item.src&&!taskSource?'Not a public GitHub source':'NOT_RECORDED'} : null,
    blockers:blockers.length,open:open.length,changes,
    explicitHold:!!idx.hold?.active,holdReason:idx.hold?.active?text(idx.hold.why):null,
    advisory:open.length===1 ? {actor:text(open[0][1].next?.actor,'UNKNOWN'),action:text(open[0][1].next?.text),source:github(open[0][1].src)?open[0][1].src:null}:null,
    cycle:scopedCycle,
    cycleUrl:!historical?cycleSource(binding,pj.key):null,
    checkedAt:cycleCheck?.observedAt||null,pageFetch:pageFetch||null,
    historical,scopeKey:family?.key||null,step};
}
function row(label,value) {
  const div=el('div','checkpoint-fact');
  div.append(el('span','checkpoint-label',label),el('p',null,value));
  return div;
}
function sourceAnchor(url,label) {return url ? link(url,label) : el('span','muted','Public source NOT_RECORDED');}
export function renderCheckpoint(root,model,{projectKey='',revision='',isWbs=false}={}) {
  const panel=el('section','checkpoint');
  panel.setAttribute('aria-label',model.scope+' evidence checkpoint');
  const title=el('div','checkpoint-heading');
  title.append(el('h3',null,(isWbs?'WBS checkpoint · ':'Project checkpoint · ')+model.scope),
    el('span','muted','Read-only · '+model.revision));
  panel.append(title);
  panel.append(row('Owner aim',model.aim));
  const aim=el('p','checkpoint-evidence');
  aim.append(sourceAnchor(model.aimSource,'Original Owner aim'));panel.append(aim);
  if(model.purpose) panel.append(row('Recorded WBS purpose',model.purpose));
  const body=el('div','checkpoint-grid');
  const latest=row('Most recently updated recorded task (not project acceptance)',
    model.last ? model.last.label+' · '+model.last.state+' · '+model.last.observedAt : 'No task evidence recorded for this scope');
  if(model.last) {
    latest.append(el('p','muted',model.last.detail));
    latest.append(sourceAnchor(model.last.source,'Open native evidence'));
  }
  body.append(latest);
  const limits=row('Surviving limits / unqualified scope',
    model.explicitHold ? 'Explicit project HOLD: '+model.holdReason :
    model.blockers ? model.blockers+' recorded BLOCKED tasks (not automatically the current gate)' :
    'No explicit BLOCKED card in this scope; absence of a block is NOT a PASS');
  if(model.capability) limits.append(el('p','muted','Milestone capability: '+model.capability+' · '+model.canDo));
  if(model.capSource)limits.append(sourceAnchor(model.capSource,'Capability evidence'));
  body.append(limits);
  panel.append(body);
  const changes=row('Recent audited Page changes (not native-source revalidation)',
    model.changes.length?'Already recorded in the Page audit ledger':'No scoped audit changes recorded');
  for(const e of model.changes){
    const p=el('p','checkpoint-change',e.when+' · '+e.summary+' ');
    if(e.source)p.append(sourceAnchor(e.source,'source'));
    changes.append(p);
  }
  panel.append(changes);
  const next=row('Canonical Cycle / next authorized action',model.cycle.message);
  next.append(el('p','checkpoint-cycle-state',model.cycle.status+
    (model.cycle.revision!=null?' · Cycle revision '+model.cycle.revision:'')+
    (model.cycle.projection?' · Page projection '+model.cycle.projection:'')));
  if(model.cycle.status==='OBSERVED'){
    next.append(el('p',null,'Recorded next: '+model.cycle.actor+' · '+model.cycle.id8+' · '+model.cycle.nextStatus));
    next.append(el('p','muted',model.cycle.action));
    if(model.cycle.evidence)next.append(sourceAnchor(model.cycle.evidence,'Canonical next evidence'));
  } else if(model.advisory)next.append(el('p','muted',
    'Page-only next label (NOT an assignment): '+model.advisory.actor+' · '+model.advisory.action));
  if(model.cycleUrl){
    const l=model.cycleUrl.replace('raw.githubusercontent.com','github.com').replace('/main/','/blob/main/');
    next.append(link(l,'Open explicitly mapped Common Cycle'));
  } else next.append(el('p','muted','For Cycle now, use the independently verified Common project locator and role.'));
  panel.append(next);
  const f=row('Evidence freshness',
    model.historical?'Historical snapshot, not live execution status':
      model.pageFetch?.status==='error'?'PAGE FETCH FAILED; retained Page data may be stale':
      model.pageFetch?.observedAt?'Page JSON fetch succeeded at '+model.pageFetch.observedAt:
      'Page fetch verification UNKNOWN');
  if(model.checkedAt)f.append(el('p','muted','Canonical Cycle last checked at '+model.checkedAt));
  else f.append(el('p','muted','Native source last checked: UNKNOWN (a Page refresh does not check PR/issue heads)'));
  panel.append(f);
  panel.append(el('p','checkpoint-footer muted',
    'This is a source-linked projection. No generated assignment, PASS, receipt, extra agent report, or Timeline entry.'));
  root.append(panel);
  return panel;
}
