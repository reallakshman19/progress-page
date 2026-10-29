import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BOARD_SCHEMA,sourceOccurrence,collectBoardNative,loadBoardNative,buildBoardContext} from '../cycle-board-context.js';
const dir=new URL('../data/ciifr-node/',import.meta.url);
const project=Object.fromEntries(['index','cards','audit'].map(f=>[f,JSON.parse(readFileSync(new URL(f+'.json',dir),'utf8'))]));
const issue='https://github.com/reallakshman19/XML_Compare_Utilities/issues/231';
const pull='https://github.com/reallakshman19/XML_Compare_Utilities/pull/232';
const head='7f5dc773ac7bb08544d086be734e4337295088a0';
const at='2026-10-29T08:00:00Z';
test('CIIFR-Node Board works from Page history with no Cycle or live intake',()=>{
 const c=buildBoardContext(project);
 assert.equal(c.schema,BOARD_SCHEMA);assert.equal(c.scope.wbs,'2');
 assert.equal(c.scope.pageCard,'node-r0-code');assert.equal(c.scope.pageRevision,'R1');
 assert.equal(c.cycle.binding,'UNMAPPED');assert.equal(c.coverage,'UNKNOWN');
 assert.equal(c.next.advice,'UNKNOWN_STOP');assert.ok(c.page.events.length>0);
 assert.deepEqual(c.badgeIds.slice(0,2),['ciifr-node/AIM/project','ciifr-node/WBS/2']);
});
test('exact native occurrence IDs stable and source versions distinguish head changes',()=>{
 const records=[{url:issue,kind:'ISSUE_VERSION',sourceAt:'2026-10-28T20:31:10Z'},
 {url:pull,kind:'PR_HEAD',headSha:head,sourceAt:at,draft:true}];
 const first=collectBoardNative('ciifr-node',records,at);
 const second=collectBoardNative('ciifr-node',records,at);
 assert.equal(first.status,'COMPLETE');assert.deepEqual(first.sources,second.sources);
 assert.match(first.sources[1].occurrenceId,/pr-head:232:7f5dc77/);
 assert.notEqual(sourceOccurrence({...records[1],headSha:'a'.repeat(40)}),first.sources[1].occurrenceId);
 const ctx=buildBoardContext(project,{native:first,pageObservedAt:at});
 assert.equal(ctx.sources.length,2);assert.equal(ctx.cycle.binding,'UNMAPPED');
 assert.equal(ctx.page.recordedSource,'https://github.com/reallakshman19/XML_Compare_Utilities/pull/226');
 assert.equal(ctx.sources[1].url,pull);
 assert.equal(ctx.delta.page,'UNKNOWN','CT-1 must not falsely qualify stale Page');
});
test('missing or malformed source becomes UNKNOWN or PARTIAL, never healthy',()=>{
 const r=collectBoardNative('ciifr-node',[
  {url:issue,kind:'ISSUE_VERSION',sourceAt:'2026-10-28T20:31:10Z'},
  {url:pull,error:'HTTP 403'}],at);
 assert.equal(r.status,'PARTIAL');assert.equal(r.errors.length,1);
 assert.equal(collectBoardNative('ciifr-node',[],at).status,'UNKNOWN');
 assert.equal(sourceOccurrence({url:pull}),null);
});
test('live source fetch propagates failures without inventing observation time',async()=>{
 const fetcher=async url=>url.includes('/issues/231')
  ?{ok:true,json:async()=>({updated_at:'2026-10-28T20:31:10Z',title:'P1 repair',state:'open'})}
  :{ok:false,status:403};
 const r=await loadBoardNative('ciifr-node',fetcher,()=>at);
 assert.equal(r.status,'PARTIAL');assert.equal(r.sources.length,1);
 assert.equal(r.sources[0].observedAt,at);
 assert.match(r.errors[0].reason,/HTTP 403/);
});
test('unconfigured project does not manufacture a Cycle or chosen task',()=>{
 const g={index:{project:{key:'g9v35',aim:'Grade9'},milestones:{}},cards:{},audit:{events:[]}};
 const c=buildBoardContext(g);
 assert.equal(c.scope.mapping,'UNMAPPED');assert.equal(c.scope.wbs,null);
 assert.equal(c.cycle.binding,'UNMAPPED');assert.equal(c.coverage,'UNKNOWN');
});
