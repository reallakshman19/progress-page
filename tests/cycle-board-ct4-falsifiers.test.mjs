// CT-4: new adversarial fixtures for the single PR #70 candidate.
// Author-side falsification tests; not an independent IR or an Owner trial.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cycleBoardContextModel} from '../cycle-board-context.js';
import {classifyPageCoverage,classifyCycleAuthority,cycleBoardDeltaModel}
  from '../cycle-board-delta.js';
import {cycleBoardWriterModel} from '../cycle-board-writer.js';

const root=new URL('../data/ciifr-node/',import.meta.url);
const node=Object.fromEntries(['index','cards','audit'].map(f=>
  [f,JSON.parse(readFileSync(new URL(f+'.json',root),'utf8'))]));
const source='https://github.com/reallakshman19/XML_Compare_Utilities/pull/232';
const sha='7f5dc773ac7bb08544d086be734e4337295088a0';
const changed='a'.repeat(40);
const sourceAt='2026-10-29T08:00:00Z';
function entry(revision=sha){
 return {
  kind:'PULL',number:232,revision,
  occurrenceId:'github:reallakshman19/XML_Compare_Utilities:pull-head:232:'+revision,
  source,sourceAt,observedAt:'2026-10-29T09:00:00Z',
  milestone:'M3',state:'DRAFT',qualification:'SELF_ASSESSED',
  reportedHold:true,technicalPass:'NOT_ESTABLISHED'
 };
}
function ctx(p=node,observations=[entry()]){
 return cycleBoardContextModel(p,{
  native:{status:'ok',observations,observedAt:'2026-10-29T09:00:00Z',failures:[]},
  pageFetch:{status:'ok',observedAt:'2026-10-29T09:01:00Z'}
 });
}
function audited(e,overrides={}){
 return {id:'CT4-E1',kind:'EVIDENCE',source:e.source,
  scope:'milestone:M3',card:'node-r0-code',wbs:'2',
  nativeOccurrenceId:e.occurrenceId,nativeRevision:e.revision,
  at:'2026-10-29T09:00:00Z',summary:'Published evidence',
  ...overrides};
}
function stage(audits){
 const p=structuredClone(node);
 p.audit.events.push(...audits);
 p.cards['node-r0-code'].src=source;
 return p;
}
test('CT-4 F1: same mutable PR URL + full SHA in free text cannot be CURRENT',()=>{
 const e=entry(),p=stage([{
  id:'CT4-OLD',kind:'EVIDENCE',scope:'milestone:M3',
  source,card:'node-r0-code',wbs:'2',
  at:'2026-10-29T09:00:00Z',
  summary:'Reviewed PR head '+sha+'; prior candidate only'
 }]);
 const model=ctx(p,[e]);
 assert.equal(classifyPageCoverage(p,model).status,'UNKNOWN');
 const result=cycleBoardDeltaModel(p,model);
 assert.equal(result.publication.status,'UNKNOWN');
 assert.notEqual(result.next.advice,'CONTINUE_AUTHORIZED');
 const writer=cycleBoardWriterModel(p,model,result);
 assert.equal(writer.status,'REVIEW_REQUIRED');
 assert.equal(writer.items[0].status,'ALREADY_RECORDED');
 assert.equal(writer.items[0].command,null);
});
test('CT-4 F1: older PR head, wrong WBS/card or identity refuses publication CURRENT',()=>{
 const e=entry(),base=audited(e);
 const variants=[
  {...base,nativeOccurrenceId:'github:reallakshman19/XML_Compare_Utilities:pull-head:232:'+changed},
  {...base,nativeRevision:changed},
  {...base,wbs:'2.1'},
  {...base,card:'node-r0-ir'},
  {...base,scope:'milestone:M4'},
  {...base,kind:''}
 ];
 for(const [i,a] of variants.entries()){
  const p=stage([{...a,id:'CT4-BAD-'+i}]);
  assert.notEqual(classifyPageCoverage(p,ctx(p)).status,'CURRENT',
    'spoofed correlation '+i+' must not be accepted');
 }
});
test('CT-4 F1 positive: exact scoped published occurrence means Page CURRENT only',()=>{
 const e=entry(),p=stage([audited(e)]);
 const context=ctx(p,[e]),d=cycleBoardDeltaModel(p,context);
 assert.equal(classifyPageCoverage(p,context).status,'CURRENT');
 assert.equal(d.publication.status,'CURRENT');
 assert.equal(d.cycle.status,'UNMAPPED');
 assert.equal(d.next.advice,'UNKNOWN_STOP',
  'Page publication is not engineering PASS or active Cycle authority');
 assert.equal(d.holds,true,'native GATE_R0 HOLD remains');
 assert.equal(context.sources[0].technicalPass,'NOT_ESTABLISHED');
});
test('CT-4 F2: authenticated matching Cycle with unresolved Page cannot continue',()=>{
 const p=structuredClone(node);
 p.index.project.key='ciifr';
 const c=ctx(p,[entry()]);c.project='ciifr';
 const binding={pageProject:'ciifr',project:'ciifr',scope:'wbs:3',
  url:'https://raw.githubusercontent.com/reallakshman19/Common/main/oracle-cycles/ciifr/CURRENT.json'};
 const a={id:'A',generation:2,recipient_role:'coder',
  recipient_chat_id8:'1234abcd',candidate:'pin',dispatch:'ASSIGNED'};
 const rec={schema:'oracle-cycle-current/v1',mode:'standalone',project:'ciifr',
  activation:'ACTIVE',revision:7,progress_projection:{project_key:'ciifr'},
  next:{recipient_role:'coder'},assignments:[a],active_assignment:a};
 const recipient={role:'coder',chatId8:'1234abcd',verified:true,
  taskChecked:true,holdsChecked:true,sourceChecked:true};
 const assignment={id:'A',generation:2,candidate:'pin',observedRevision:7};
 const opts={binding,cycleRead:{status:'ok',record:rec},recipient,assignment,
  receipt:{inboxChecked:true}};
 assert.equal(classifyCycleAuthority('ciifr',{
  binding,record:rec,readStatus:'ok',recipient,assignment,receipt:opts.receipt
 }).status,'AUTHORIZED');
 const current=ctx(p,[{...entry(),reportedHold:false,sourceAt:'2026-10-27T00:00:00Z'}]);
 const unchanged=cycleBoardDeltaModel(p,current,{previous:current,...opts});
 assert.equal(unchanged.publication.status,'UNKNOWN');
 assert.equal(unchanged.next.advice,'UNKNOWN_STOP');
 const old=structuredClone(current);old.sources[0].revision=changed;
 old.sources[0].occurrenceId=old.sources[0].occurrenceId.replace(sha,changed);
 const moved=cycleBoardDeltaModel(p,current,{previous:old,...opts});
 assert.equal(moved.native.status,'CHANGED');
 assert.notEqual(moved.next.advice,'CONTINUE_AUTHORIZED');
});
test('CT-4 F3: Grade9 OTM and unbound CIIFR-Node remain native only',()=>{
 const pg=JSON.parse(readFileSync(new URL('../data/g9v35/index.json',import.meta.url),'utf8'));
 const g=cycleBoardContextModel({index:pg,cards:{},audit:{events:[]}});
 const r=cycleBoardDeltaModel({index:pg,cards:{},audit:{events:[]}},g);
 assert.equal(r.cycle.status,'UNMAPPED');
 assert.equal(r.next.advice,'UNKNOWN_STOP');
 const n=cycleBoardDeltaModel(node,ctx(node,[entry()]));
 assert.equal(n.cycle.status,'UNMAPPED');
 assert.equal(n.holds,true);
 assert.equal(n.next.advice,'REVIEW_PAGE_DRIFT');
});
test('CT-4 invariants: no Page/canonical data modified by pure classifiers',()=>{
 const before=JSON.stringify(node);
 const c=ctx(),d=cycleBoardDeltaModel(node,c);
 cycleBoardWriterModel(node,c,d);
 assert.equal(JSON.stringify(node),before);
});
