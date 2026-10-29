// CT-2: pure, on-demand comparison of source-bound Page/native context.
// A Board recommendation is never a Cycle dispatch, engineering PASS or Page write.
import { el, link } from './util.js?v=34';
import { cycleSource } from './checkpoint.js?v=34';

const when=x=>{const n=Date.parse(x||'');return Number.isFinite(n)?n:null;};
const safe=x=>typeof x==='string'&&x.trim()?x.trim():null;
const target=(e,page)=>{
  const m=page?.index?.milestones?.[e?.milestone];
  return m?.wbs&&e?.wbs===m.wbs&&e?.scope==='SOURCE_MATCHED'?
    {milestone:m,milestoneId:e.milestone}:null;
};
const isReturn=x=>/^(?:RETURNED|REVIEW_RETURNED|BLOCKED_RECONCILED)(?:_|$)/.test(x||'');

// Native event identity is immutable per occurrence; observing it twice does
// not create a second achievement. Completeness must be explicit.
export function classifyNativeDelta(previous,current){
  if(!previous||previous.project!==current?.project||
     previous.native?.coverage!=='COMPLETE'||current?.native?.coverage!=='COMPLETE'||
     !Array.isArray(previous.sources)||!Array.isArray(current.sources))
    return {status:'UNKNOWN',reason:'A complete comparable prior and current source observation is required.'};
  const fingerprint=model=>JSON.stringify(model.sources.map(x=>[
    x.source,x.occurrenceId,x.revision,x.state,x.qualification,x.reportedHold,
    x.scope,x.wbs
  ]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  const changed=fingerprint(previous)!==fingerprint(current);
  return {status:changed?'CHANGED':'UNCHANGED',reason:changed?
    'Native source identity or recorded qualification changed; inspect affected originals.':
    'Configured native occurrences and recorded qualification were unchanged since the prior successful check.'};
}

// Page publication is a separate axis from native evidence. Source-later does
// NOT mean engineering PASS, accepted WBS status, or an authorized Page update.
export function classifyPageCoverage(page,context){
  const entries=context?.sources||[],project=page?.index?.project;
  if(context?.page?.status!=='ok'||context?.native?.coverage!=='COMPLETE'||
     !entries.length||!project?.updatedAt||when(project.updatedAt)===null)
    return {status:'UNKNOWN',reason:'Full source and successfully fetched Page baseline are not established.',sources:[]};
  if(entries.some(e=>!target(e,page)))
    return {status:'UNMAPPED',reason:'Native observation has no exact published WBS mapping.',sources:[]};
  const audit=page?.audit?.events||[],cards=page?.cards||{};
  // An exact original Page audit entry is required before declaring CURRENT.
  // Mutable PR/issue URLs alone cannot identify an accepted commit or review.
  const findings=[];
  for(const e of entries){
    const {milestone,milestoneId}=target(e,page),nativeTime=when(e.sourceAt);
    if(nativeTime===null)return {status:'UNKNOWN',reason:'Native source timestamp is not established.',sources:[]};
    const mappedAudit=audit.filter(a=>a?.scope==='milestone:'+milestoneId||
      (a?.card&&cards[a.card]?.milestone===milestoneId));
    const publishedTime=Math.max(when(project.updatedAt)||0,
      ...mappedAudit.map(a=>when(a.at)||0));
    const publishedRefs=new Set([milestone.capSrc,
      ...Object.values(cards).filter(c=>c.milestone===milestoneId).map(c=>c.src),
      ...mappedAudit.map(a=>a.source)].filter(Boolean));
    const sourceKnown=publishedRefs.has(e.source);
    if(!sourceKnown&&nativeTime>publishedTime)
      findings.push({source:e.source,revision:e.revision,milestoneId,wbs:e.wbs,
        status:'NEWER_NATIVE_UNPUBLISHED'});
    else if(!sourceKnown)
      findings.push({source:e.source,revision:e.revision,milestoneId,wbs:e.wbs,
        status:'REVIEW_REQUIRED'});
    else {
      // Same URL may point to a new PR head. Never claim exact Page equivalence
      // without versioned native identity in a checked, published audit.
      // Exact structured identity, not free-form summary text or URL equality.
      // An audit event must bind this immutable occurrence and the actual
      // Page WBS/card, otherwise a newer mutable PR head remains unverified.
      const versioned=mappedAudit.some(a=>a.source===e.source&&
        a.nativeOccurrenceId===e.occurrenceId&&
        a.wbs===e.wbs&&
        a.card&&cards[a.card]?.milestone===milestoneId);
      if(!versioned)findings.push({source:e.source,revision:e.revision,
        milestoneId,wbs:e.wbs,status:'VERSION_UNVERIFIED'});
    }
  }
  const newer=findings.filter(x=>x.status==='NEWER_NATIVE_UNPUBLISHED');
  if(newer.length)return {status:'STALE_PAGE',reason:
    'Explicitly mapped native evidence is newer than published Page WBS evidence. Review originals; no WBS capability or PASS is promoted.',
    sources:newer};
  if(!findings.length)return {status:'CURRENT',reason:
    'The exact observed native revisions appear in scoped, already-published Page audit entries. This is publication correlation, NOT engineering PASS.',
    sources:[]};
  return {status:'UNKNOWN',reason:
    'Exact native revision-to-audit publication correlation is not established. URL matching alone is insufficient.',
    sources:findings};
}

// Guard available only to a caller carrying its OWN verified private recipient
// and exact current Cycle assignment. The public Board deliberately supplies
// neither; it can safely identify a mismatched role but must not dispatch.
export function classifyCycleAuthority(pageKey,{binding=null,record=null,
  readStatus='unknown',recipient=null,assignment=null,receipt=null,proof=null}={}){
  if(!cycleSource(binding,pageKey))
    return {status:'UNMAPPED',reason:'No explicitly scoped canonical Cycle binding; native/OTM work stays independent.'};
  if(readStatus!=='ok'||!record)
    return {status:'UNKNOWN',reason:'A successful fresh canonical Cycle read is required.'};
  if(record.schema!=='oracle-cycle-current/v1'||record.project!==binding.project||
     record.mode!=='standalone'||record.progress_projection?.project_key!==pageKey)
    return {status:'UNKNOWN',reason:'Canonical project, mode or Page projection identity conflicts.'};
  if(record.activation!=='ACTIVE')
    return {status:'INACTIVE',reason:'Canonical standalone Cycle is not active.'};
  const next=record.next||{};
  const role=safe(recipient?.role)?.toLowerCase();
  const nextRole=safe(next.recipient_role)?.toLowerCase();
  if(!nextRole)return {status:'UNKNOWN',reason:'Canonical next recipient role is not established.'};
  if(role&&role!==nextRole)
    return {status:'WRONG_RECIPIENT',reason:'Recipient role differs from the canonical next actor.'};
  // A public JavaScript field like verified:true is not authentication.
  // There is no trusted private recipient integration in this viewer.
  // Proof is evaluated for correspondence below, but NEVER grants dispatch.
  if(!role||!recipient?.verified)
    return {status:'UNKNOWN',reason:'Public Board does not verify a private recipient or dispatch.'};
  if(proof?.origin!=='TRUSTED_PRIVATE_CYCLE_PRECHECK'||
     !proof.canonicalReadSha||!/^[a-f0-9]{40}$/i.test(proof.canonicalReadSha)||
     !proof.canonicalChecked||!proof.originalInputChecked)
    return {status:'UNKNOWN',reason:'No source-pinned private Cycle preflight; public role flags cannot establish authority.'};
  const assignments=Array.isArray(record.assignments)?record.assignments:[];
  const actual=assignments.find(a=>a.id===assignment?.id&&a.generation===assignment?.generation);
  if(!actual||actual.recipient_role!==role||!safe(assignment?.candidate)||
     actual.candidate!==assignment.candidate||actual.id!==proof?.assignmentId||
     actual.generation!==proof?.generation||actual.candidate!==proof?.candidate||
     record.revision!==proof?.canonicalRevision||
     proof?.taskVerified!==true||proof?.holdsVerified!==true)
    return {status:'STALE_ASSIGNMENT',reason:'Assignment ID, generation, candidate or role is not current and exact.'};
  if(safe(actual.recipient_chat_id8)&&
      actual.recipient_chat_id8!==safe(recipient?.chatId8))
    return {status:'WRONG_RECIPIENT',reason:'Selected recipient does not match canonical short ID.'};
  if(actual.native_return_url&&!actual.cycle_receipt_url&&
     receipt?.inboxChecked&&receipt.found===false)
    return {status:'MISSING_ROUTING_RECEIPT',reason:'A checked receipt inbox has no routing envelope for the already-returned native evidence. Repair only the existing envelope.'};
  if(actual.native_return_url&&!actual.cycle_receipt_url&&
     !receipt?.inboxChecked)
    return {status:'UNKNOWN',reason:'Native return exists, but required Cycle receipt inbox was not checked.'};
  if(isReturn(actual.dispatch)||receipt?.accepted===true||
     (safe(actual.cycle_receipt_url)&&actual.native_return_url))
    return {status:'RETURNED_ACCEPTED',reason:'An already-returned assignment must not be reexecuted; await Oracle reconciliation.'};
  if(next.recipient_role==='owner')
    return {status:'WRONG_RECIPIENT',reason:'Canonical next step is for Owner; no worker dispatch.'};
  if(actual.dispatch!=='ACTIVE'&&actual.dispatch!=='ASSIGNED')
    return {status:'UNKNOWN',reason:'No live unreturned dispatch was established.'};
  if(!Number.isInteger(record.revision)||assignment.observedRevision!==record.revision)
    return {status:'STALE_ASSIGNMENT',reason:'Current canonical revision was not checked by the recipient.'};
  // History entries are not a current dispatch. A public Cycle may have an
  // assignments[] archive, but no active_assignment pointer.
  const active=record.active_assignment;
  if(!active||active.id!==actual.id||active.generation!==actual.generation||
     active.candidate!==actual.candidate||active.recipient_role!==actual.recipient_role)
    return {status:'UNKNOWN',reason:'No exact canonical active_assignment pointer; historic assignments never authorize execution.'};
  if(!recipient?.taskChecked||!recipient?.holdsChecked||!recipient?.sourceChecked||
     !receipt?.inboxChecked)
    return {status:'UNKNOWN',reason:'Task, holds, native source or receipt inbox has not been verified.'};
  if(receipt?.alreadyReturned)
    return {status:'RETURNED_ACCEPTED',reason:'Existing accepted return must not be duplicated.'};
  return {status:'PREFLIGHT_MATCHED',reason:
    'Source and assignment fields correspond in this advisory model, but a browser cannot authenticate the private actor. Invoke the real Cycle now guard; this Board grants no continuation.'};
}

export function cycleBoardDeltaModel(page,current,{previous=null,binding=null,
  cycleRead=null,recipient=null,assignment=null,receipt=null}={}){
  const native=classifyNativeDelta(previous,current);
  const publication=classifyPageCoverage(page,current);
  const cycle=classifyCycleAuthority(current?.project,{binding,
    record:cycleRead?.record,readStatus:cycleRead?.status||'unknown',
    recipient,assignment,receipt,proof:cycleRead?.proof||null});
  const holds=(current?.sources||[]).some(e=>e.reportedHold===true);
  let advice='UNKNOWN_STOP',reason='Source and authority are not sufficient to authorize a new task.';
  if(cycle.status==='WRONG_RECIPIENT'||cycle.status==='INACTIVE'){
    advice='NO_ACTION';reason=cycle.reason;
  }else if(cycle.status==='RETURNED_ACCEPTED'){
    advice='AWAIT_ORACLE_RECONCILIATION';reason=cycle.reason;
  }else if(cycle.status==='MISSING_ROUTING_RECEIPT'){
    advice='SCOPED_CORRECTION_BRIEF';reason=cycle.reason;
  }else if(publication.status==='STALE_PAGE'){
    advice='REVIEW_PAGE_DRIFT';reason=publication.reason;
  }else if(cycle.status==='PREFLIGHT_MATCHED'){
    advice='UNKNOWN_STOP';reason='Private source checks correspond but browser identity/dispatch authority is never established. Use canonical Cycle now.';
  }
  // No UI or synthetic proof may turn this read-only Board into a dispatcher.
  return {schema:'cycle-board.delta/v1',native,publication,cycle,
    next:{advice,reason},holds,previousObservedAt:previous?.native?.observedAt||null,
    currentObservedAt:current?.native?.observedAt||null};
}

export function renderCycleBoardDelta(root,model,{onRecheck=null,checking=false}={}){
  const panel=el('section','cb-delta');
  panel.append(el('h4',null,'Delta and continuation · advisory only'),
    el('p','muted','Compare source observations without re-onboarding or posting another status. This does not assign work, establish PASS or update the Page.'));
  const values=el('div','cb-delta-facts');
  for(const [label,detail] of [
    ['Native change',model.native],
    ['Page reconciliation',model.publication],
    ['Cycle authority',model.cycle]]){
    const block=el('div','cb-delta-fact');
    block.append(el('span','muted',label),el('strong',null,detail.status),
      el('p','muted',detail.reason));
    values.append(block);
  }
  panel.append(values);
  const advice=el('div','cb-advice');
  advice.append(el('b',null,'One suggested next step · '+model.next.advice),
    el('p',null,model.next.reason));
  if(model.holds)advice.append(el('p','muted',
    'Native source reports a HOLD. It remains in force; no independent review PASS or Owner acceptance inferred.'));
  panel.append(advice);
  if(model.publication.sources?.length){
    const sources=el('div','cb-delta-sources');
    for(const s of model.publication.sources){
      const p=el('p');
      p.append('WBS '+s.wbs+' · '+s.status+' · ',link(s.source,'original source'));
      sources.append(p);
    }
    panel.append(sources);
  }
  if(typeof onRecheck==='function'){
    const button=el('button','btn small',checking?'Checking native sources…':'Recheck native evidence');
    button.type='button';button.disabled=!!checking;
    button.addEventListener('click',()=>{if(!checking)onRecheck();});
    panel.append(button);
  }
  panel.append(el('p','muted','Previous complete observation: '+(model.previousObservedAt||'UNKNOWN')+
    ' · current: '+(model.currentObservedAt||'UNKNOWN')+
    '. UNKNOWN before the first comparable successful recheck is expected.'));
  root.append(panel);
}
