// CT-4: deterministic three-project falsification on *existing Page data*
// and synthetic native/Cycle counterexamples. This is author CI, not real
// independent IR, native engineering PASS, an Owner trial or effort evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cycleBoardContextModel,loadBoardNative} from '../cycle-board-context.js';
import {cycleBoardDeltaModel,classifyPageCoverage,classifyCycleAuthority,
  classifyNativeDelta} from '../cycle-board-delta.js';
import {cycleBoardWriterModel} from '../cycle-board-writer.js';

const readProject=key=>{
 const dir=new URL('../data/'+key+'/',import.meta.url);
 return Object.fromEntries(['index','cards','audit'].map(f=>
  [f,JSON.parse(readFileSync(new URL(f+'.json',dir),'utf8'))]));
};
const node=readProject('ciifr-node'),ciifr=readProject('ciifr'),grade9=readProject('g9v35');
const before=Object.fromEntries([['ciifr-node',node],['ciifr',ciifr],['g9v35',grade9]]
  .map(([k,v])=>[k,JSON.stringify(v)]));
const repo='reallakshman19/XML_Compare_Utilities';
const PR='https://github.com/'+repo+'/pull/232';
const ISSUE='https://github.com/'+repo+'/issues/231';
const SHA='7f5dc773ac7bb08544d086be734e4337295088a0';
const NEW_SHA='f'.repeat(40);
const OBS='2026-10-29T09:02:00Z';
const PR_SOURCE_AT='2026-10-29T08:00:00Z';
const issueRevision='2026-10-29T08:01:00Z';

function native(prHead=SHA){
 const pr={kind:'PULL',number:232,revision:prHead,
  occurrenceId:'github:'+repo+':pull-head:232:'+prHead,
  source:PR,sourceAt:PR_SOURCE_AT,observedAt:OBS,milestone:'M3',
  label:'Repair candidate',state:'DRAFT',qualification:'SELF_ASSESSED',
  reportedHold:true,technicalPass:'NOT_ESTABLISHED'};
 const issue={kind:'ISSUE',number:231,revision:issueRevision,
  occurrenceId:'github:'+repo+':issue-revision:231:'+issueRevision,
  source:ISSUE,sourceAt:issueRevision,observedAt:OBS,milestone:'M3',
  label:'Native repair task',state:'OPEN',qualification:'SELF_ASSESSED',
  reportedHold:true,technicalPass:'NOT_ESTABLISHED'};
 return {status:'ok',observedAt:OBS,observations:[pr,issue],failures:[]};
}
function context(project=node,observation=native()){
 return cycleBoardContextModel(project,{
  native:observation,cycleStatus:'UNMAPPED',
  pageFetch:{status:'ok',observedAt:OBS}
 });
}
const getContextSources=ctx=>ctx.sources.map(x=>({url:x.source,identity:x.occurrenceId}));

test('CT-4 CIIFR-Node: published R1 PR226 vs Issue231/PR232 stays review-only and no Cycle',()=>{
 const ctx=context(),delta=cycleBoardDeltaModel(node,ctx);
 assert.equal(ctx.project,'ciifr-node');
 assert.equal(ctx.cycle.status,'UNMAPPED');
 assert.equal(ctx.native.coverage,'COMPLETE');
 assert.ok(ctx.sources.every(s=>s.wbs==='2'&&s.scope==='SOURCE_MATCHED'));
 assert.equal(delta.publication.status,'STALE_PAGE');
 assert.equal(delta.cycle.status,'UNMAPPED');
 assert.equal(delta.next.advice,'REVIEW_PAGE_DRIFT');
 assert.equal(delta.holds,true);
 assert.ok(ctx.sources.every(s=>s.technicalPass==='NOT_ESTABLISHED'));
 const writer=cycleBoardWriterModel(node,ctx,delta);
 assert.equal(writer.status,'REVIEW_PENDING');
 assert.ok(writer.items.every(i=>i.technicalPass==='NOT_ESTABLISHED'&&
   i.publication==='NOT_PUBLISHED_BY_BOARD'));
 assert.ok(writer.items.every(i=>i.command===null ||
   i.command.every(command=>!command.includes('--apply'))));
 assert.equal(JSON.stringify(node),before['ciifr-node']);
});

test('CT-4 same native source reread is not another engineering achievement',()=>{
 const ctx=context(),again=context();
 assert.deepEqual(getContextSources(ctx),getContextSources(again));
 assert.equal(classifyNativeDelta(ctx,again).status,'UNCHANGED');
 const different=context(node,native(NEW_SHA));
 assert.equal(classifyNativeDelta(ctx,different).status,'CHANGED');
 assert.equal(classifyNativeDelta(null,different).status,'UNKNOWN');
 assert.equal(classifyNativeDelta(ctx,{...different,native:{...different.native,coverage:'PARTIAL'}}).status,'UNKNOWN');
});

test('CT-4 mutable PR URL with old occurrence in Page audit never means CURRENT',()=>{
 const pg=structuredClone(node),current=native(NEW_SHA);
 pg.audit.events.push({id:'CT4-OLD',kind:'EVIDENCE',source:PR,
  scope:'milestone:M3',card:'node-r0-code',wbs:'2',
  nativeOccurrenceId:'github:'+repo+':pull-head:232:'+SHA,
  at:'2026-10-29T09:01:00Z',summary:'old PR head '+SHA});
 const onlyPR={...current,observations:[current.observations[0]]};
 const ctx=context(pg,onlyPR);
 const classification=classifyPageCoverage(pg,ctx);
 assert.notEqual(classification.status,'CURRENT');
 const delta=cycleBoardDeltaModel(pg,ctx);
 assert.notEqual(delta.next.advice,'CONTINUE_AUTHORIZED');
 const writer=cycleBoardWriterModel(pg,ctx,delta);
 // PR #85: same URL, different exact immutable occurrence can be proposed
 // for ORIGINAL review. It cannot be called published, applied or PASS.
 assert.equal(writer.items[0].status,'PROPOSAL_CANDIDATE');
 assert.equal(writer.items[0].occurrenceId,ctx.sources[0].occurrenceId);
 assert.equal(writer.items[0].publication,'NOT_PUBLISHED_BY_BOARD');
 assert.ok(writer.items[0].command?.length>0);
 assert.ok(writer.items[0].command.every(command=>!command.includes('--apply')));
 assert.equal(JSON.stringify(node),before['ciifr-node']);
});

test('CT-4 same exact source occurrence/WBS/card is recorded only once',()=>{
 const pg=structuredClone(node),current=native(SHA);
 pg.audit.events.push({id:'CT4-SAME',kind:'EVIDENCE',source:PR,
  scope:'milestone:M3',card:'node-r0-code',wbs:'2',
  nativeOccurrenceId:'github:'+repo+':pull-head:232:'+SHA,
  at:'2026-10-29T09:01:00Z',summary:'same exact native head'});
 const ctx=context(pg,{...current,observations:[current.observations[0]]});
 const delta=cycleBoardDeltaModel(pg,ctx);
 const writer=cycleBoardWriterModel(pg,ctx,delta);
 assert.equal(writer.items[0].status,'ALREADY_RECORDED');
 assert.equal(writer.items[0].command,null);
 assert.equal(writer.recordedCount,1);
 assert.equal(writer.pendingCount,0);
 assert.equal(classifyPageCoverage(pg,ctx).status,'CURRENT');
 assert.equal(ctx.sources[0].technicalPass,'NOT_ESTABLISHED');
 assert.equal(JSON.stringify(node),before['ciifr-node']);
});

test('CT-4 URL-only legacy audit remains UNKNOWN and requires explicit review',()=>{
 const pg=structuredClone(node),current=native(NEW_SHA);
 pg.audit.events.push({id:'CT4-LEGACY',kind:'EVIDENCE',source:PR,
  scope:'milestone:M3',card:'node-r0-code',wbs:'2',
  at:'2026-10-29T09:01:00Z',summary:'legacy URL-only record'});
 const ctx=context(pg,{...current,observations:[current.observations[0]]});
 const delta=cycleBoardDeltaModel(pg,ctx);
 assert.equal(classifyPageCoverage(pg,ctx).status,'UNKNOWN');
 const writer=cycleBoardWriterModel(pg,ctx,delta);
 assert.equal(writer.items[0].status,'LEGACY_REVIEW_REQUIRED');
 assert.equal(writer.items[0].command,null);
 assert.equal(writer.pendingCount,0);
 assert.notEqual(delta.next.advice,'CONTINUE_AUTHORIZED');
 assert.equal(JSON.stringify(node),before['ciifr-node']);
});

test('CT-4 inaccessible native source fails closed with retained prior Page audit',()=>{
 const partial={...native(),status:'partial',
  observations:[native().observations[1]],failures:[{source:PR,error:'HTTP 403'}]};
 const ctx=context(node,partial),delta=cycleBoardDeltaModel(node,ctx);
 assert.equal(ctx.native.coverage,'PARTIAL');
 assert.equal(delta.publication.status,'UNKNOWN');
 assert.equal(delta.next.advice,'UNKNOWN_STOP');
 const writer=cycleBoardWriterModel(node,ctx,delta);
 assert.equal(writer.status,'UNKNOWN');
 assert.equal(writer.pendingCount,0);
 assert.ok(ctx.page.latestId,'previous Page audit remains readable');
});

test('CT-4 Grade9 OTM: Page and WBS survive without invented standalone Cycle',()=>{
 const ctx=cycleBoardContextModel(grade9,{
   pageFetch:{status:'ok',observedAt:OBS},cycleStatus:'UNMAPPED'});
 const delta=cycleBoardDeltaModel(grade9,ctx);
 assert.equal(ctx.project,'g9v35');
 assert.equal(ctx.cycle.status,'UNMAPPED');
 assert.equal(ctx.cycle.authority,'NOT_ESTABLISHED');
 assert.equal(ctx.native.coverage,'UNKNOWN');
 assert.equal(delta.publication.status,'UNKNOWN');
 assert.equal(delta.cycle.status,'UNMAPPED');
 assert.equal(delta.next.advice,'UNKNOWN_STOP');
 const writer=cycleBoardWriterModel(grade9,ctx,delta);
 assert.equal(writer.status,'UNKNOWN');
 assert.equal(writer.pendingCount,0);
 assert.equal(JSON.stringify(grade9),before.g9v35);
});

const bind={pageProject:'ciifr',project:'ciifr',scope:'wbs:3',
 url:'https://raw.githubusercontent.com/reallakshman19/Common/main/oracle-cycles/ciifr/CURRENT.json'};
const a={id:'CT4-TASK',generation:3,recipient_role:'coder',
 recipient_chat_id8:'abc12345',candidate:'sha-pinned-candidate',dispatch:'ASSIGNED'};
const canonical={schema:'oracle-cycle-current/v1',mode:'standalone',project:'ciifr',
 activation:'ACTIVE',revision:22,progress_projection:{project_key:'ciifr'},
 next:{recipient_role:'coder'},assignments:[a],active_assignment:{...a}};
const recipient={role:'coder',chatId8:'abc12345',verified:true,
 taskChecked:true,holdsChecked:true,sourceChecked:true};
const assignment={id:'CT4-TASK',generation:3,candidate:'sha-pinned-candidate',
 observedRevision:22};
const proof={origin:'TRUSTED_PRIVATE_CYCLE_PRECHECK',
 canonicalReadSha:'a'.repeat(40),canonicalChecked:true,originalInputChecked:true,
 assignmentId:'CT4-TASK',generation:3,candidate:'sha-pinned-candidate',
 canonicalRevision:22,taskVerified:true,holdsVerified:true};
function options(extra={}){
 return {binding:bind,readStatus:'ok',record:canonical,
  recipient,assignment,receipt:{inboxChecked:true},proof,...extra};
}

test('CT-4 CIIFR synthetic matched preflight never dispatches or creates an Owner PASS',()=>{
 const classified=classifyCycleAuthority('ciifr',options());
 assert.equal(classified.status,'PREFLIGHT_MATCHED');
 assert.notEqual(classified.status,'AUTHORIZED');
 const ctx=cycleBoardContextModel(ciifr,{
  pageFetch:{status:'ok',observedAt:OBS}});
 const result=cycleBoardDeltaModel(ciifr,ctx,{
  binding:bind,cycleRead:{status:'ok',record:canonical,proof},
  recipient,assignment,receipt:{inboxChecked:true}});
 assert.equal(result.cycle.status,'PREFLIGHT_MATCHED');
 assert.equal(result.next.advice,'UNKNOWN_STOP');
 assert.equal(JSON.stringify(ciifr),before.ciifr);
});

test('CT-4 CIIFR mismatched generation, head, task and holds fail closed',()=>{
 const cases=[
  {assignment:{...assignment,generation:2}},
  {assignment:{...assignment,candidate:'different'}},
  {proof:{...proof,assignmentId:'OTHER'}},
  {proof:{...proof,canonicalRevision:21}},
  {proof:{...proof,taskVerified:false}},
  {proof:{...proof,holdsVerified:false}},
  {record:{...canonical,active_assignment:null}},
  {proof:null}
 ];
 for(const changed of cases){
  const result=classifyCycleAuthority('ciifr',options(changed));
  assert.notEqual(result.status,'PREFLIGHT_MATCHED');
  assert.notEqual(result.status,'AUTHORIZED');
 }
 assert.equal(classifyCycleAuthority('ciifr',
  options({recipient:{...recipient,chatId8:'00000000'}})).status,'WRONG_RECIPIENT');
 assert.equal(classifyCycleAuthority('ciifr',options({readStatus:'error'})).status,'UNKNOWN');
});

test('CT-4 already-returned native evidence is not another dispatch/return',()=>{
 const returned={...a,dispatch:'RETURNED_RECONCILED',
  native_return_url:'https://github.com/reallakshman19/XML_Compare_Utilities/issues/186',
  cycle_receipt_url:'https://github.com/reallakshman19/Common/issues/10'};
 const record={...canonical,assignments:[returned],active_assignment:{...returned}};
 const result=classifyCycleAuthority('ciifr',options({
  record,receipt:{inboxChecked:true,accepted:true}}));
 assert.equal(result.status,'RETURNED_ACCEPTED');
 const ctx=cycleBoardContextModel(ciifr,{pageFetch:{status:'ok',observedAt:OBS}});
 const delta=cycleBoardDeltaModel(ciifr,ctx,{
  binding:bind,cycleRead:{status:'ok',record,proof},recipient,assignment,
  receipt:{inboxChecked:true,accepted:true}});
 assert.equal(delta.next.advice,'AWAIT_ORACLE_RECONCILIATION');
});

test('CT-4 checked missing routing envelope means repair only, no native re-run',()=>{
 const returned={...a,native_return_url:'https://github.com/reallakshman19/XML_Compare_Utilities/issues/186'};
 const record={...canonical,assignments:[returned],active_assignment:{...returned}};
 const found=classifyCycleAuthority('ciifr',options({
  record,receipt:{inboxChecked:true,found:false}}));
 assert.equal(found.status,'MISSING_ROUTING_RECEIPT');
 const unknown=classifyCycleAuthority('ciifr',options({
  record,receipt:{inboxChecked:false}}));
 assert.equal(unknown.status,'UNKNOWN');
 const ctx=cycleBoardContextModel(ciifr,{pageFetch:{status:'ok',observedAt:OBS}});
 const d=cycleBoardDeltaModel(ciifr,ctx,{binding:bind,
  cycleRead:{status:'ok',record,proof},recipient,assignment,
  receipt:{inboxChecked:true,found:false}});
 assert.equal(d.next.advice,'SCOPED_CORRECTION_BRIEF');
});

test('CT-4 public native-source title redaction keeps opaque secrets off Board',async()=>{
 const privateTitles=[
  'Repair at https://chatgpt.com/c/private',
  'Owner credential ghp_ABCDEFGHIJKLMNOP123456789',
  'chat 123e4567-e89b-42d3-a456-426614174000',
  'contact user@example.com'
 ];
 for(const title of privateTitles){
  const fetcher=async url=>{
   const pull=url.includes('/pulls/');
   const number=pull?232:231;
   return {ok:true,status:200,json:async()=>({
    number,html_url:pull?PR:ISSUE,title,
    head:{sha:SHA},draft:true,state:'open',updated_at:PR_SOURCE_AT,
    body:'SELF_ASSESSED GATE_R0 HOLD'
   })};
  };
  const r=await loadBoardNative('ciifr-node',fetcher,()=>OBS);
  assert.equal(r.status,'ok');
  assert.equal(r.observations.length,2);
  assert.ok(r.observations.every(e=>e.title==='Source title unavailable'));
  assert.doesNotMatch(JSON.stringify(r.observations),/chatgpt\.com\/c\/private|ghp_ABCDEFGHIJKLMNOP|user@example\.com|123e4567-e89b-42d3-a456-426614174000/);
 }
});
test('CT-4 no source replay writes data, receipts, WBS or an extra Board report',()=>{
 const n=context(),d=cycleBoardDeltaModel(node,n);
 cycleBoardWriterModel(node,n,d);
 assert.equal(JSON.stringify(node),before['ciifr-node']);
 assert.equal(JSON.stringify(ciifr),before.ciifr);
 assert.equal(JSON.stringify(grade9),before.g9v35);
});
