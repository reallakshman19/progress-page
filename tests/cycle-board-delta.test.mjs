import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildBoardContext,collectBoardNative} from '../cycle-board-context.js';
import {compareBoardNative,compareBoardPage,qualifyBoardCycle,classifyBoardDelta} from '../cycle-board-delta.js';
const dir=new URL('../data/ciifr-node/',import.meta.url);
const project=Object.fromEntries(['index','cards','audit'].map(f=>[f,JSON.parse(readFileSync(new URL(f+'.json',dir),'utf8'))]));
const issue='https://github.com/reallakshman19/XML_Compare_Utilities/issues/231';
const pr='https://github.com/reallakshman19/XML_Compare_Utilities/pull/232';
const at='2026-10-29T08:00:00Z',head='7f5dc773ac7bb08544d086be734e4337295088a0';
const inputs=[{url:issue,kind:'ISSUE_VERSION',sourceAt:'2026-10-28T20:31:10Z'},
 {url:pr,kind:'PR_HEAD',headSha:head,sourceAt:'2026-10-28T20:30:05Z',draft:true}];
const mk=(records=inputs)=>buildBoardContext(project,{native:collectBoardNative('ciifr-node',records,at),pageObservedAt:at});
test('CIIFR-Node PR226→issue231/PR232 is stale Page, not activated Cycle',()=>{
 const r=classifyBoardDelta(mk());
 assert.equal(r.delta.page,'STALE_PAGE');
 assert.equal(r.next.advice,'REVIEW_PAGE_DRIFT');
 assert.equal(r.next.responsibleRole,'PAGE_WRITER');
 assert.equal(r.delta.cycle,'UNMAPPED');assert.equal(r.delta.receipt,'NOT_APPLICABLE');
 assert.equal(r.delta.native,'UNKNOWN','first read has no comparable baseline');
 assert.equal(r.scope.wbs,'2');assert.equal(r.publication.status,'NOT_CHECKED');
 assert.equal(r.sources[1].occurrenceId,mk().sources[1].occurrenceId);
});
test('repeat successfully observed same sources is unchanged, changed SHA is changed',()=>{
 const old=mk();const current=mk();
 assert.equal(compareBoardNative(current,old).status,'UNCHANGED');
 const moved=mk([inputs[0],{...inputs[1],headSha:'a'.repeat(40)}]);
 assert.equal(compareBoardNative(moved,old).status,'CHANGED');
 assert.equal(classifyBoardDelta(moved,{prior:old}).delta.native,'CHANGED');
});
test('missing baseline, missing input, unequal source scope all yield UNKNOWN',()=>{
 const ctx=mk();
 assert.equal(compareBoardNative(ctx).cause,'BASELINE_REQUIRED');
 const partial=mk([{...inputs[0]},{url:pr,error:'HTTP 403'}]);
 assert.equal(partial.coverage,'PARTIAL');
 assert.equal(compareBoardNative(partial,ctx).status,'UNKNOWN');
 assert.equal(compareBoardPage(partial).status,'UNKNOWN');
 assert.equal(classifyBoardDelta(partial,{prior:ctx}).next.advice,'UNKNOWN_STOP');
 const scope={...ctx,sources:[ctx.sources[0]]};
 assert.equal(compareBoardNative(scope,ctx).status,'UNKNOWN');
});
test('a page-card link without its audit cannot be called reconciled',()=>{
 const ctx=mk(),altered={...ctx,page:{...ctx.page,recordedSource:pr,events:ctx.page.events}};
 assert.equal(compareBoardPage(altered).status,'CONFLICT');
 const published={...altered,page:{...altered.page,events:[...altered.page.events,{source:pr}]}};
 assert.equal(compareBoardPage(published).status,'CURRENT');
});
test('incorrect WBS/card mapping and failed Page read fail closed',()=>{
 const ctx=mk();
 assert.equal(compareBoardPage({...ctx,scope:{...ctx.scope,mapping:'UNMAPPED'}}).status,'UNMAPPED');
 assert.equal(compareBoardPage({...ctx,page:{...ctx.page,observedAt:null}}).status,'UNKNOWN');
});
test('Grade9v3.5 OTM has no fabricated standalone Cycle or WBS',()=>{
 const g=buildBoardContext({index:{project:{key:'g9v35'}},cards:{},audit:{events:[]}});
 const r=classifyBoardDelta(g);
 assert.equal(r.delta.cycle,'UNMAPPED');assert.equal(r.next.advice,'UNKNOWN_STOP');
});
const canonical={schema:'oracle-cycle-current/v1',mode:'standalone',project:'demo',
 activation:'ACTIVE',progress_projection:{project_key:'ciifr-node'},
 active_assignment:{id:'TASK-1',generation:2,recipient_role:'coder',recipient_chat_id8:'abcdef12'}};
const bound=()=>({...mk(),cycle:{binding:'SCOPED',authority:'NOT_ESTABLISHED'}});
const trusted={origin:'TRUSTED_INTEGRATION',canonicalRead:{sha:'b'.repeat(40)},canonical,
 binding:{project:'demo',pageProject:'ciifr-node',scope:'wbs:2'},
 candidateChecked:true,holdsChecked:true,receiptInboxChecked:true,
 caller:{source:'TRUSTED_PRIVATE_BINDING',verified:true,role:'coder',chatId8:'abcdef12'},
 originalInputChecked:true,currentCandidateChecked:true};
test('public browser without independent recipient proof cannot authorize',()=>{
 const r=classifyBoardDelta(bound());
 assert.equal(r.delta.cycle,'UNKNOWN');assert.equal(r.next.advice,'REVIEW_PAGE_DRIFT');
 assert.equal(qualifyBoardCycle(bound(),{...trusted,caller:null}).status,'UNKNOWN');
});
test('wrong authenticated recipient returns NO_ACTION even with stale Page',()=>{
 const r=classifyBoardDelta(bound(),{cycleProof:{...trusted,caller:{...trusted.caller,chatId8:'00000000'}}});
 assert.equal(r.delta.cycle,'WRONG_RECIPIENT');assert.equal(r.next.advice,'NO_ACTION');
});
test('already-returned assignment must not rerun or duplicate native receipt',()=>{
 const proof={...trusted,returnEvidence:{assignmentId:'TASK-1',generation:2,nativeReturned:true,receiptAccepted:true}};
 const r=classifyBoardDelta(bound(),{cycleProof:proof});
 assert.equal(r.delta.receipt,'RETURNED_ACCEPTED');
 assert.equal(r.next.advice,'AWAIT_ORACLE_RECONCILIATION');
});
test('missing Cycle routing envelope is not missing native engineering result',()=>{
 const proof={...trusted,returnEvidence:{assignmentId:'TASK-1',generation:2,nativeReturned:true,receiptAccepted:false}};
 const r=classifyBoardDelta(bound(),{cycleProof:proof});
 assert.equal(r.delta.receipt,'MISSING_ROUTING_RECEIPT');
 assert.equal(r.next.advice,'SCOPED_CORRECTION_BRIEF');
});
test('unqualified original/candidate and inactive Cycle prohibit continuation',()=>{
 assert.equal(qualifyBoardCycle(bound(),{...trusted,originalInputChecked:false}).status,'UNKNOWN');
 assert.equal(qualifyBoardCycle(bound(),{...trusted,canonical:{...canonical,activation:'INACTIVE'}}).status,'INACTIVE');
 assert.equal(qualifyBoardCycle(bound(),{...trusted,canonical:{...canonical,progress_projection:{project_key:'other'}}}).status,'STALE_ASSIGNMENT');
});
test('fully qualified synthetic trusted integration can advise, never dispatch',()=>{
 const ctx=bound();
 const r=classifyBoardDelta(ctx,{cycleProof:trusted});
 assert.equal(r.delta.cycle,'AUTHORIZED');assert.equal(r.next.advice,'REVIEW_PAGE_DRIFT',
   'Page drift is reviewed before continuing, even with a matched recipient');
 const current={...ctx,page:{...ctx.page,recordedSource:pr,events:[...ctx.page.events,{source:pr}]}};
 const rc=classifyBoardDelta(current,{cycleProof:trusted});
 assert.equal(rc.next.advice,'CONTINUE_AUTHORIZED');
 assert.equal(rc.publication.status,'NOT_CHECKED');
});
test('historical Page never yields current-source or assignment advice',()=>{
 const r=classifyBoardDelta(bound(),{cycleProof:trusted,historical:true});
 assert.equal(r.delta.page,'UNKNOWN');assert.equal(r.next.advice,'UNKNOWN_STOP');
});
