import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildBoardContext,collectBoardNative} from '../cycle-board-context.js';
import {classifyBoardDelta} from '../cycle-board-delta.js';
import {previewBoardReconciliation,boardWriterBrief} from '../cycle-board-reconciliation.js';
const dir=new URL('../data/ciifr-node/',import.meta.url);
const p=Object.fromEntries(['index','cards','audit'].map(f=>[f,JSON.parse(readFileSync(new URL(f+'.json',dir),'utf8'))]));
const url='https://github.com/reallakshman19/XML_Compare_Utilities/pull/232';
const sha='7f5dc773ac7bb08544d086be734e4337295088a0',at='2026-10-29T09:00:00Z';
function context(){
 const native=collectBoardNative('ciifr-node',[
  {url:'https://github.com/reallakshman19/XML_Compare_Utilities/issues/231',
   kind:'ISSUE_VERSION',sourceAt:'2026-10-28T20:31:10Z'},
  {url,kind:'PR_HEAD',headSha:sha,sourceAt:'2026-10-28T20:35:10Z',draft:true}
 ],at);
 return classifyBoardDelta(buildBoardContext(p,{native,pageObservedAt:at}));
}
test('stale CIIFR-Node PR226 to PR232 produces one stable review-only proposal',()=>{
 const input=context(),a=previewBoardReconciliation(input),b=previewBoardReconciliation(input);
 assert.equal(a.status,'PROGRESS_UPDATE_PENDING');
 assert.equal(a.reviewRequired,true);assert.equal(a.dataWritten,false);
 assert.equal(a.publicationAuthority,'NOT_GRANTED');assert.equal(a.source,url);
 assert.equal(a.sourceHead,sha);
 assert.deepEqual(a,b);assert.equal(a.scope.wbs,'2');assert.equal(a.scope.card,'node-r0-code');
 assert.equal(a.priorPageSource,'https://github.com/reallakshman19/XML_Compare_Utilities/pull/226');
 assert.equal(a.sourceOccurrenceId,input.sources.find(s=>s.url===url).occurrenceId);
 assert.ok(a.pageAuditIds.length>0);
 assert.match(a.writerCommand,/pp_cli.py propose/);
 assert.match(a.writerCommand,/--expected-head 7f5dc77/);
 assert.match(a.dryRunCommand,/pp_batch.py.+--data data/);
 assert.doesNotMatch(a.writerCommand+a.dryRunCommand,/--apply/);
 assert.equal(JSON.stringify(p.audit.events).includes(url),false,'original Page audit stays unchanged');
});
test('no native/PAGE observation cannot produce actionable proposal',()=>{
 const input=context();
 for(const variant of [
  {...input,coverage:'UNKNOWN'},
  {...input,observedAt:null},
  {...input,page:{...input.page,observedAt:null}},
  {...input,sources:[]}
 ])assert.notEqual(previewBoardReconciliation(variant).status,'PROGRESS_UPDATE_PENDING');
});
test('wrong scope, no drift, wrong-recipient and closed workflow stop writer action',()=>{
 const input=context();
 const variants=[
  {...input,scope:{...input.scope,wbs:'3'}},
  {...input,scope:{...input.scope,mapping:'UNMAPPED'}},
  {...input,delta:{...input.delta,page:'CURRENT'}},
  {...input,next:{...input.next,advice:'NO_ACTION'}},
  {...input,next:{...input.next,advice:'AWAIT_ORACLE_RECONCILIATION'}}
 ];
 for(const x of variants){
  const result=previewBoardReconciliation(x);
  assert.equal(result.writerCommand,null);
 }
});
test('bad or mismatched PR head, stale read and duplicate source records fail closed',()=>{
 const x=context(),original=x.sources.find(s=>s.url===url);
 const cases=[
  {...original,headSha:'f'.repeat(40)},
  {...original,headSha:'abc'},
  {...original,observedAt:'2020-01-01T00:00:00Z'},
  {...original,occurrenceId:'github:other/repo:pr-head:232:'+sha},
  {...original,url:'https://chatgpt.com/c/private'}
 ];
 for(const source of cases){
  const r=previewBoardReconciliation({...x,sources:[x.sources[0],source]});
  assert.equal(r.writerCommand,null);
 }
 assert.equal(previewBoardReconciliation({...x,sources:[...x.sources,original]}).status,'REVIEW_REQUIRED');
});
test('source URL audit alone needs manual identity review, never auto already reconciled',()=>{
 const x=context();
 const withExisting={...x,page:{...x.page,events:[...x.page.events,
  {auditId:'CB-OLD',source:url,kind:'UPDATE'}]}};
 const r=previewBoardReconciliation(withExisting);
 assert.equal(r.status,'REVIEW_REQUIRED');
 assert.equal(r.reason,'POSSIBLE_DUPLICATE_OR_AMBIGUOUS_AUDIT');
 assert.equal(r.writerCommand,null);
 assert.deepEqual(r.existingSourceAuditIds,['CB-OLD']);
});
test('only exact source occurrence, WBS and card can be already reconciled',()=>{
 const x=context(),occ=x.sources.find(s=>s.url===url).occurrenceId;
 const exact={auditId:'CB-001',source:url,nativeOccurrenceId:occ,wbs:'2',card:'node-r0-code'};
 const yes=previewBoardReconciliation({...x,page:{...x.page,events:[...x.page.events,exact]}});
 assert.equal(yes.status,'ALREADY_RECONCILED');assert.equal(yes.writerCommand,null);
 const wrong={...exact,wbs:'3'};
 const no=previewBoardReconciliation({...x,page:{...x.page,events:[...x.page.events,wrong]}});
 assert.equal(no.status,'REVIEW_REQUIRED');
});
test('Grade9 OTM and unknown project have no invented WBS, writer or Cycle',()=>{
 const g=classifyBoardDelta(buildBoardContext({
  index:{project:{key:'g9v35'}},cards:{},audit:{events:[]}}));
 assert.equal(previewBoardReconciliation(g).status,'NOT_CONFIGURED');
 assert.equal(previewBoardReconciliation(g).writerCommand,null);
});
test('writer brief preserves source identity, audit trace and explicit no-apply instructions',()=>{
 const a=previewBoardReconciliation(context()),brief=boardWriterBrief(a);
 assert.match(brief,/CT-3/);assert.match(brief,/WBS 2/);
 assert.match(brief,/PR head: 7f5dc773/);
 assert.match(brief,/review-only|REVIEW-ONLY/i);
 assert.match(brief,/No Page data has been written/);
 assert.match(brief,/No automatic --apply/);
 assert.doesNotMatch(brief,/chatgpt\.com\/c\//);
});
