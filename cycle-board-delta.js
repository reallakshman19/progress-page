// CT-2 pure on-demand source/Page/Cycle delta classifier. Advisory only.
// Requires CT-1 cycle-board.context/v1; never makes a task, receipt, or Page write.
export const CB2_SCHEMA='cycle-board.delta/v1';
const CB2_ID=/^[a-f0-9]{40}$/i;
const CB2_RULES=Object.freeze({
  'ciifr-node':Object.freeze({
    wbs:'2',card:'node-r0-code',
    prior:'https://github.com/reallakshman19/XML_Compare_Utilities/pull/226',
    current:'https://github.com/reallakshman19/XML_Compare_Utilities/pull/232',
    task:'https://github.com/reallakshman19/XML_Compare_Utilities/issues/231',
    review:'https://github.com/reallakshman19/XML_Compare_Utilities/issues/228'
  })
});
const CB2_SOURCE_LINK=/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:issues|pull)\/[1-9]\d*$/;

export function compareBoardNative(now,prior=null){
  if(!now||now.coverage!=='COMPLETE'||!now.observedAt||
      !Array.isArray(now.sources)||!now.sources.length||
      now.sources.some(s=>!s.occurrenceId||!CB2_SOURCE_LINK.test(s.url||'')))
    return {status:'UNKNOWN',cause:'CURRENT_SOURCE_INCOMPLETE'};
  if(!prior||prior.schema!==now.schema||prior.project!==now.project||
      prior.coverage!=='COMPLETE'||!prior.observedAt||
      !Array.isArray(prior.sources)||!prior.sources.length)
    return {status:'UNKNOWN',cause:'BASELINE_REQUIRED'};
  const map=items=>new Map(items.map(s=>[s.url,s.occurrenceId]));
  const a=map(now.sources),b=map(prior.sources);
  if(a.size!==now.sources.length||b.size!==prior.sources.length||
      a.size!==b.size||[...a.keys()].some(url=>!b.has(url)))
    return {status:'UNKNOWN',cause:'NONCOMPARABLE_SOURCE_SCOPE'};
  return {status:[...a].some(([url,id])=>id!==b.get(url))?'CHANGED':'UNCHANGED',cause:null};
}

export function compareBoardPage(ctx){
  if(!ctx?.scope||ctx.scope.mapping!=='SOURCE_MATCHED')
    return {status:'UNMAPPED',cause:'MISSING_WBS_CARD_MAPPING'};
  if(!ctx.page?.observedAt)return {status:'UNKNOWN',cause:'PAGE_READ_NOT_VERIFIED'};
  if(ctx.coverage!=='COMPLETE')return {status:'UNKNOWN',cause:'NATIVE_SOURCE_INCOMPLETE'};
  const rule=CB2_RULES[ctx.project],sources=ctx.sources||[],urlSet=new Set(sources.map(s=>s.url));
  if(rule&&ctx.scope.wbs===rule.wbs&&ctx.scope.pageCard===rule.card){
    if(!urlSet.has(rule.current)||!urlSet.has(rule.task))
      return {status:'UNKNOWN',cause:'REQUIRED_NATIVE_ORIGINAL_MISSING'};
    const recorded=ctx.page.recordedSource;
    if(recorded===rule.prior){
      return {status:'STALE_PAGE',cause:'PRIOR_PAGE_CANDIDATE_SUPERSEDED',
        links:[rule.task,rule.current,rule.review],prior:rule.prior};
    }
    if(recorded===rule.current){
      const published=(ctx.page.events||[]).some(e=>e.source===rule.current);
      return published ? {status:'CURRENT',cause:null} :
        {status:'CONFLICT',cause:'PAGE_CARD_WITHOUT_CORRELATED_AUDIT'};
    }
    return {status:'CONFLICT',cause:'UNEXPECTED_PAGE_CANDIDATE'};
  }
  if(ctx.page.recordedSource&&urlSet.has(ctx.page.recordedSource))
    return {status:'CURRENT',cause:null};
  return {status:'UNKNOWN',cause:'NO_QUALIFIED_SOURCE_LINEAGE'};
}

// A browser or public alias cannot authenticate an agent. Only a separately
// trusted integration could supply this proof; the current UI never does so.
export function qualifyBoardCycle(ctx,proof=null){
  if(ctx?.cycle?.binding!=='SCOPED')return {status:'UNMAPPED',returnState:'NOT_APPLICABLE',
    cause:'NO_EXPLICIT_CYCLE_BINDING'};
  if(!proof||proof.origin!=='TRUSTED_INTEGRATION'||!proof.canonicalRead||
      !CB2_ID.test(proof.canonicalRead.sha||'')||!proof.canonical)
    return {status:'UNKNOWN',returnState:'UNKNOWN',cause:'CANONICAL_SOURCE_NOT_VERIFIED'};
  const c=proof.canonical,b=proof.binding||{},a=c.active_assignment||{};
  if(c.schema!=='oracle-cycle-current/v1'||c.mode!=='standalone'||
      c.project!==b.project||b.pageProject!==ctx.project||
      !/^wbs:[1-9]\d*$/.test(b.scope||'')||
      String(ctx.scope?.wbs||'').split('.')[0]!==b.scope.slice(4)||
      c.progress_projection?.project_key!==ctx.project)
    return {status:'STALE_ASSIGNMENT',returnState:'UNKNOWN',cause:'CANONICAL_PROJECT_OR_WBS_MISMATCH'};
  if(c.activation!=='ACTIVE')return {status:'INACTIVE',returnState:'NOT_APPLICABLE',cause:'CYCLE_NOT_ACTIVE'};
  if(typeof a.id!=='string'||!a.id.trim()||!Number.isInteger(a.generation)||a.generation<1||
     typeof a.recipient_role!=='string'||!a.recipient_role||
     typeof a.recipient_chat_id8!=='string'||!/^[a-f0-9]{8}$/i.test(a.recipient_chat_id8)||
     !proof.candidateChecked||!proof.holdsChecked||!proof.receiptInboxChecked)
    return {status:'UNKNOWN',returnState:'UNKNOWN',cause:'ASSIGNMENT_OR_EVIDENCE_UNQUALIFIED'};
  if(!proof.caller||proof.caller.source!=='TRUSTED_PRIVATE_BINDING'||!proof.caller.verified)
    return {status:'UNKNOWN',returnState:'UNKNOWN',cause:'RECIPIENT_AUTHENTICATION_UNAVAILABLE'};
  if(proof.caller.role!==a.recipient_role||proof.caller.chatId8!==a.recipient_chat_id8)
    return {status:'WRONG_RECIPIENT',returnState:'NOT_APPLICABLE',cause:'RECIPIENT_MISMATCH'};
  const ret=proof.returnEvidence;
  if(ret?.assignmentId===a.id&&ret?.generation===a.generation&&ret?.nativeReturned===true){
    if(ret.receiptAccepted===true)
      return {status:'AUTHORIZED',returnState:'RETURNED_ACCEPTED',cause:'SAME_ASSIGNMENT_ALREADY_RETURNED'};
    return {status:'AUTHORIZED',returnState:'MISSING_ROUTING_RECEIPT',cause:'REPAIR_ROUTING_ENVELOPE_ONLY'};
  }
  if(!proof.originalInputChecked||!proof.currentCandidateChecked)
    return {status:'UNKNOWN',returnState:'UNKNOWN',cause:'CURRENT_ORIGINAL_OR_CANDIDATE_NOT_CHECKED'};
  return {status:'AUTHORIZED',returnState:'NOT_RETURNED',cause:null};
}

export function classifyBoardDelta(ctx,{prior=null,cycleProof=null,historical=false}={}){
  if(ctx?.schema!=='cycle-board.context/v1')throw Error('CT-2 requires cycle-board.context/v1');
  const native=historical?{status:'UNKNOWN',cause:'HISTORICAL_PAGE'}:compareBoardNative(ctx,prior);
  const page=historical?{status:'UNKNOWN',cause:'HISTORICAL_PAGE'}:compareBoardPage(ctx);
  const cycle=historical?{status:'UNKNOWN',returnState:'UNKNOWN',cause:'HISTORICAL_PAGE'}:
    qualifyBoardCycle(ctx,cycleProof);
  const conflicts=[native,page,cycle].filter(x=>x.cause)
    .map(x=>x.cause);
  let advice='UNKNOWN_STOP',responsibleRole=null;
  if(cycle.status==='WRONG_RECIPIENT')advice='NO_ACTION';
  else if(cycle.returnState==='RETURNED_ACCEPTED'){
    advice='AWAIT_ORACLE_RECONCILIATION';responsibleRole='ORACLE';
  }else if(cycle.returnState==='MISSING_ROUTING_RECEIPT'){
    advice='SCOPED_CORRECTION_BRIEF';responsibleRole='ASSIGNED_RECIPIENT';
  }else if(page.status==='STALE_PAGE'){
    advice='REVIEW_PAGE_DRIFT';responsibleRole='PAGE_WRITER';
  }else if(cycle.status==='AUTHORIZED'&&cycle.returnState==='NOT_RETURNED'&&
    page.status!=='CONFLICT'&&page.status!=='STALE_PAGE'){
    advice='CONTINUE_AUTHORIZED';responsibleRole='ASSIGNED_RECIPIENT';
  }
  // Missing or unreadable native source never becomes an instruction to continue.
  if(ctx.coverage!=='COMPLETE'&&
     !['NO_ACTION','AWAIT_ORACLE_RECONCILIATION'].includes(advice)){
    advice='UNKNOWN_STOP';responsibleRole=null;
  }
  const ids=advice==='REVIEW_PAGE_DRIFT'?(ctx.sources||[]).map(x=>x.occurrenceId):
    advice==='UNKNOWN_STOP'||advice==='NO_ACTION'?[]:(ctx.sources||[]).map(x=>x.occurrenceId);
  return {...ctx,delta:{schema:CB2_SCHEMA,native:native.status,page:page.status,
      cycle:cycle.status,receipt:cycle.returnState,
      evidence:'UNKNOWN',conflicts,causes:{native:native.cause,page:page.cause,cycle:cycle.cause}},
    next:{advice,responsibleRole,sourceOccurrenceIds:ids},
    publication:{...ctx.publication,status:'NOT_CHECKED'}};
}
