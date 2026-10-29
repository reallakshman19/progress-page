// CT-3 read-only source→Page reconciliation suggestion. Never a publisher.
export const BOARD_RECON_SCHEMA='cycle-board.reconciliation/v1';
const CB3_REPO='reallakshman19/XML_Compare_Utilities';
const CB3_SOURCE='https://github.com/'+CB3_REPO+'/pull/232';
const CB3_SHA=/^[a-f0-9]{40}$/i;
const CB3_SAFE=/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9]\d*$/;
const CB3_SCOPE=Object.freeze({'ciifr-node':Object.freeze({
  wbs:'2',card:'node-r0-code',source:CB3_SOURCE
})});
function cb3Empty(ctx,status,cause,extra={}){
  return {schema:BOARD_RECON_SCHEMA,project:ctx?.project||null,
    scope:{wbs:ctx?.scope?.wbs||null,card:ctx?.scope?.pageCard||null},
    status,reason:cause,reviewRequired:true,dataWritten:false,
    source:null,sourceOccurrenceId:null,sourceHead:null,pageAuditIds:[],
    proposalKey:null,writerCommand:null,dryRunCommand:null,
    publicationAuthority:'NOT_GRANTED',...extra};
}
export function previewBoardReconciliation(ctx){
  const rule=CB3_SCOPE[ctx?.project||''];
  if(!rule)return cb3Empty(ctx,'NOT_CONFIGURED','NO_EXPLICIT_SOURCE_SCOPE');
  if(ctx.scope?.wbs!==rule.wbs||ctx.scope?.pageCard!==rule.card||
      ctx.scope?.mapping!=='SOURCE_MATCHED')
    return cb3Empty(ctx,'REVIEW_REQUIRED','WBS_CARD_SCOPE_NOT_VERIFIED');
  if(ctx.coverage!=='COMPLETE'||!ctx.observedAt||
      !ctx.page?.observedAt||!Array.isArray(ctx.sources))
    return cb3Empty(ctx,'UNKNOWN_STOP','SOURCE_OR_PAGE_READ_INCOMPLETE');
  if(ctx.delta?.page!=='STALE_PAGE'||ctx.next?.advice!=='REVIEW_PAGE_DRIFT')
    return cb3Empty(ctx,'NOT_APPLICABLE','NO_QUALIFIED_PAGE_DRIFT');
  const matches=ctx.sources.filter(s=>s.url===rule.source&&s.kind==='PR_HEAD');
  if(matches.length!==1)return cb3Empty(ctx,'REVIEW_REQUIRED','CANDIDATE_NOT_UNIQUE');
  const source=matches[0];
  if(!CB3_SAFE.test(source.url)||!CB3_SHA.test(source.headSha||'')||
      !source.occurrenceId||
      source.occurrenceId!=='github:'+CB3_REPO+':pr-head:232:'+source.headSha.toLowerCase()||
      !source.observedAt||source.observedAt!==ctx.observedAt)
    return cb3Empty(ctx,'REVIEW_REQUIRED','CANDIDATE_IDENTITY_UNQUALIFIED');
  const pageEntries=Array.isArray(ctx.page.events)?ctx.page.events:[];
  const sameSource=pageEntries.filter(e=>e.source===source.url);
  const base={source:source.url,sourceHead:source.headSha,
    sourceOccurrenceId:source.occurrenceId,
    sourceObservedAt:source.observedAt,
    priorPageSource:ctx.page.recordedSource||null,
    pageRevision:ctx.scope.pageRevision||null,
    pageAuditIds:pageEntries.map(e=>e.auditId).filter(Boolean),
    existingSourceAuditIds:sameSource.map(e=>e.auditId).filter(Boolean),
    proposalKey:[ctx.project,rule.wbs,rule.card,source.occurrenceId].join(':'),
    limitation:'Native metadata is not engineering PASS. Only the existing authorized Page tools can create and publish a reviewed reference.'};
  if(sameSource.length){
    // A URL-only audit entry is not enough to identify a specific PR-head occurrence.
    const exact=sameSource.filter(e=>e.nativeOccurrenceId===source.occurrenceId&&
      e.card===rule.card&&e.wbs===rule.wbs);
    if(sameSource.length===1&&exact.length===1)
      return cb3Empty(ctx,'ALREADY_RECONCILED','EXACT_SOURCE_OCCURRENCE_AUDITED',base);
    return cb3Empty(ctx,'REVIEW_REQUIRED','POSSIBLE_DUPLICATE_OR_AMBIGUOUS_AUDIT',base);
  }
  const command='python tools/pp_cli.py propose --project '+ctx.project+
    ' --source '+source.url+' --actor AUTHORIZED_PAGE_WRITER'+
    ' --card '+rule.card+' --expected-head '+source.headSha+
    ' --output cycle-board-ct3-proposal.json';
  const dryRun='python tools/pp_batch.py cycle-board-ct3-proposal.json --data data';
  return cb3Empty(ctx,'PROGRESS_UPDATE_PENDING','REVIEW_ORIGINAL_BEFORE_PROPOSAL',
    {...base,writerCommand:command,dryRunCommand:dryRun,
      suggestion:'Append original native evidence reference only. Preserve Page state, next actor, WBS milestone, technical/IR HOLD and Owner acceptance.'});
}
export function boardWriterBrief(p){
  const lines=[
    'CYCLE BOARD CT-3 · REVIEW-ONLY PAGE WRITER BRIEF',
    'Status: '+p.status+' · '+p.reason,
    'Project: '+(p.project||'UNKNOWN')+' · WBS '+(p.scope?.wbs||'UNKNOWN')+
      ' · card '+(p.scope?.card||'UNKNOWN'),
    'Source: '+(p.source||'UNKNOWN'),
    'Native occurrence: '+(p.sourceOccurrenceId||'UNKNOWN'),
    'Exact PR head: '+(p.sourceHead||'UNKNOWN'),
    'Native observedAt: '+(p.sourceObservedAt||'UNKNOWN'),
    'Page revision: '+(p.pageRevision||'UNKNOWN')+
      ' · prior source: '+(p.priorPageSource||'UNKNOWN'),
    'Existing Page audit IDs: '+(p.pageAuditIds||[]).join(', '),
    'Source audit matches: '+(p.existingSourceAuditIds||[]).join(', '),
    'Proposal key: '+(p.proposalKey||'UNKNOWN'),
    'No Page data has been written. This is not native engineering PASS or dispatch.',
    'Independently inspect source, mapping, existing audit and current PR head.'
  ];
  if(p.writerCommand)lines.push('Authorized writer only; replace actor and verify fresh head:',
    p.writerCommand,'Reviewed dry-run only:',p.dryRunCommand);
  else lines.push('No writer command qualified; resolve '+p.reason+' first.');
  lines.push('After independent review, publication requires separate Page writer authority and append-only check.',
    'No automatic --apply, no duplicate achievement, no Cycle or Owner acceptance change.');
  return lines.join('\n');
}
