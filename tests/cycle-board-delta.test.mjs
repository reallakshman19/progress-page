import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { cycleBoardContextModel } from '../cycle-board-context.js';
import { classifyNativeDelta,classifyPageCoverage,classifyCycleAuthority,
  cycleBoardDeltaModel,renderCycleBoardDelta } from '../cycle-board-delta.js';

const page={
  index:JSON.parse(readFileSync(new URL('../data/ciifr-node/index.json',import.meta.url),'utf8')),
  cards:JSON.parse(readFileSync(new URL('../data/ciifr-node/cards.json',import.meta.url),'utf8')),
  audit:JSON.parse(readFileSync(new URL('../data/ciifr-node/audit.json',import.meta.url),'utf8'))
};
const original=JSON.stringify(page);
const PR='https://github.com/reallakshman19/XML_Compare_Utilities/pull/232';
const ISSUE='https://github.com/reallakshman19/XML_Compare_Utilities/issues/231';
const sha='7f5dc773ac7bb08544d086be734e4337295088a0';
const entry=(kind,number,revision,source,sourceAt)=>({
  occurrenceId:'github:reallakshman19/XML_Compare_Utilities:'+kind+':'+number+':'+revision,
  revision,source,sourceAt,observedAt:'2026-10-29T09:00:00Z',
  milestone:'M3',wbs:'2',scope:'SOURCE_MATCHED',state:'DRAFT',
  kind:'PULL',number,qualification:'SELF_ASSESSED',reportedHold:true,
  technicalPass:'NOT_ESTABLISHED'
});
const source=(current=true)=>({
  status:'ok',observedAt:current?'2026-10-29T09:02:00Z':'2026-10-29T09:00:00Z',
  observations:[],failures:[]
});
const mockContext=(nativeStatus='ok')=>cycleBoardContextModel(page,{
  native:{...source(),status:nativeStatus,
    observations:[{
      ...entry('pull-head',232,sha,PR,'2026-10-29T01:00:00Z'),
      label:'Repair candidate · PR #232'
    },{
      ...entry('issue-revision',231,'2026-10-28T20:31:10Z',ISSUE,'2026-10-28T20:31:10Z'),
      label:'Native repair task · issue #231',kind:'ISSUE'
    }]},
  cycleStatus:'UNMAPPED',pageFetch:{status:'ok',observedAt:'2026-10-29T09:00:00Z'}
});
// Canonical Cycle positive/negative tests must use the SAME actual project
// as the explicit binding. Cross-project bindings rightly fail UNMAPPED.
const ciifrPage=structuredClone(page);
ciifrPage.index.project.key='ciifr';
const ciifrContext=()=>({...mockContext(),project:'ciifr'});
const BIND={pageProject:'ciifr',project:'ciifr',scope:'wbs:3',
 url:'https://raw.githubusercontent.com/reallakshman19/Common/main/oracle-cycles/ciifr/CURRENT.json'};
const assignment={id:'A-1',generation:2,recipient_role:'coder',
 recipient_chat_id8:'1234abcd',candidate:'a'.repeat(40),dispatch:'ASSIGNED'};
const canonical={schema:'oracle-cycle-current/v1',mode:'standalone',project:'ciifr',
 activation:'ACTIVE',revision:10,progress_projection:{project_key:'ciifr'},
 next:{recipient_role:'coder'},assignments:[assignment],
 active_assignment:{...assignment}};
const match={role:'coder',chatId8:'1234abcd',verified:true,
 taskChecked:true,holdsChecked:true,sourceChecked:true};
const exact={id:'A-1',generation:2,candidate:'a'.repeat(40),observedRevision:10};
const proof={origin:'TRUSTED_PRIVATE_CYCLE_PRECHECK',canonicalReadSha:'b'.repeat(40),
 canonicalChecked:true,originalInputChecked:true,
 assignmentId:exact.id,generation:exact.generation,candidate:exact.candidate,
 canonicalRevision:10,taskVerified:true,holdsVerified:true};

test('CT-2 CIIFR-Node: newer PR232/issue231 creates REVIEW_PAGE_DRIFT, no Cycle',()=>{
 const ctx=mockContext();
 const delta=cycleBoardDeltaModel(page,ctx);
 assert.equal(delta.schema,'cycle-board.delta/v1');
 assert.equal(delta.native.status,'UNKNOWN','no prior verified source cannot be unchanged');
 assert.equal(delta.publication.status,'STALE_PAGE');
 assert.ok(delta.publication.sources.some(e=>e.source===PR&&e.wbs==='2'));
 assert.equal(delta.cycle.status,'UNMAPPED');
 assert.equal(delta.next.advice,'REVIEW_PAGE_DRIFT');
 assert.equal(delta.holds,true);
 assert.equal(JSON.stringify(page),original);
});
test('CT-2 two complete observations reuse identity and distinguish unchanged/changed',()=>{
 const current=mockContext();
 const previous=structuredClone(current);
 previous.native.observedAt='2026-10-29T09:00:00Z';
 assert.equal(classifyNativeDelta(previous,current).status,'UNCHANGED');
 const changed=structuredClone(current);
 changed.sources[0].revision='a'.repeat(40);
 changed.sources[0].occurrenceId='github:reallakshman19/XML_Compare_Utilities:pull-head:232:'+'a'.repeat(40);
 assert.equal(classifyNativeDelta(previous,changed).status,'CHANGED');
 const incomplete=structuredClone(current);incomplete.native.coverage='PARTIAL';
 assert.equal(classifyNativeDelta(previous,incomplete).status,'UNKNOWN');
 assert.equal(classifyNativeDelta(null,current).status,'UNKNOWN');
});
test('CT-2 WBS missing, Page fetch unavailable, old native and URL-only equality never become CURRENT',()=>{
 const ctx=mockContext();
 assert.equal(classifyPageCoverage(page,{...ctx,page:{status:'error'}}).status,'UNKNOWN');
 assert.equal(classifyPageCoverage(page,{...ctx,native:{coverage:'PARTIAL'}}).status,'UNKNOWN');
 const noScope=structuredClone(ctx);noScope.sources[0].milestone='INVALID';
 assert.equal(classifyPageCoverage(page,noScope).status,'UNMAPPED');
 const old=structuredClone(ctx);old.sources.forEach(e=>e.sourceAt='2026-10-27T01:00:00Z');
 assert.equal(classifyPageCoverage(page,old).status,'UNKNOWN');
 const sameUrl=structuredClone(ctx);sameUrl.sources[0].source=page.cards['node-r0-code'].src;
 assert.notEqual(classifyPageCoverage(page,sameUrl).status,'CURRENT',
   'same mutable PR URL cannot certify the new head is audited');
});
test('CT-2 exact scoped audited revision can be CURRENT without technical PASS',()=>{
 const published=structuredClone(page);
 const ctx=mockContext();
 const candidate=ctx.sources[0];
 const matching=ctx.sources[1];
 published.audit.events.push(
   {id:'PUBLISHED-HEAD-1',kind:'UPDATE',scope:'milestone:M3',card:'node-r0-code',
    wbs:'2',nativeOccurrenceId:candidate.occurrenceId,
    source:candidate.source,at:'2026-10-29T09:00:00Z',
    summary:'Reviewed Page evidence for original PR head '+candidate.revision},
   {id:'PUBLISHED-ISSUE-1',kind:'UPDATE',scope:'milestone:M3',card:'node-r0-code',
    wbs:'2',nativeOccurrenceId:matching.occurrenceId,
    source:matching.source,at:'2026-10-29T09:00:00Z',
    summary:'Reviewed Page evidence for original issue revision '+matching.revision}
 );
 const result=classifyPageCoverage(published,ctx);
 assert.equal(result.status,'CURRENT');
 assert.match(result.reason,/NOT engineering PASS/);
 assert.equal(JSON.stringify(page),original,'authoritative source fixture unmodified');
});
test('CT-4 mutable URL and summary text do not establish exact current Page occurrence',()=>{
 const pg=structuredClone(page),ctx=mockContext();
 for(const source of ctx.sources)pg.audit.events.push({
   id:'AUDIT-URL-'+source.number,kind:'UPDATE',scope:'milestone:M3',
   card:'node-r0-code',wbs:'2',source:source.source,
   summary:'Reviewed PR revision '+source.revision,at:'2026-10-29T09:00:00Z'
 });
 assert.notEqual(classifyPageCoverage(pg,ctx).status,'CURRENT');
 pg.audit.events.forEach((event)=>{
   if(String(event.id).startsWith('AUDIT-URL-'))event.nativeOccurrenceId='outdated-occurrence';
 });
 assert.notEqual(classifyPageCoverage(pg,ctx).status,'CURRENT');
 const corrected=structuredClone(pg);
 for(const event of corrected.audit.events){
   if(!String(event.id).startsWith('AUDIT-URL-'))continue;
   const source=ctx.sources.find(s=>s.source===event.source);
   event.nativeOccurrenceId=source.occurrenceId;
 }
 assert.equal(classifyPageCoverage(corrected,ctx).status,'CURRENT',
   'exact native occurrence + WBS/card correlation only; never engineering PASS');
 corrected.audit.events.find(e=>e.id==='AUDIT-URL-232').wbs='3';
 assert.notEqual(classifyPageCoverage(corrected,ctx).status,'CURRENT',
   'wrong WBS never qualifies as published current head');
});
test('CT-2 wrong recipient and inactive Cycle never dispatch',()=>{
 const actual={binding:BIND,record:canonical,readStatus:'ok',
  recipient:{...match,role:'reviewer'},assignment:exact,receipt:{inboxChecked:true},proof};
 assert.equal(classifyCycleAuthority('ciifr',actual).status,'WRONG_RECIPIENT');
 assert.equal(classifyCycleAuthority('ciifr',{...actual,record:{...canonical,activation:'INACTIVE'}}).status,'INACTIVE');
 assert.equal(classifyCycleAuthority('ciifr',{...actual,readStatus:'error'}).status,'UNKNOWN');
 assert.equal(classifyCycleAuthority('ciifr',{...actual,record:{...canonical,project:'other'}}).status,'UNKNOWN');
 const wrong=cycleBoardDeltaModel(ciifrPage,ciifrContext(),{binding:BIND,
  cycleRead:{status:'ok',record:canonical,proof},recipient:{...match,role:'reviewer'},
  assignment:exact,receipt:{inboxChecked:true},proof});
 assert.equal(wrong.next.advice,'NO_ACTION');
 assert.equal(classifyCycleAuthority('ciifr',{...actual,binding:null}).status,'UNMAPPED');
});
test('CT-2 already-returned, receipt missing and already-accepted never repeat engineering work',()=>{
 const returned={...assignment,dispatch:'RETURNED_RECONCILED',
   native_return_url:'https://github.com/acme/native/issues/1#issuecomment-22',
   cycle_receipt_url:'https://github.com/acme/common/issues/2#issuecomment-44'};
 const record={...canonical,assignments:[returned],active_assignment:{...returned}};
 const options={binding:BIND,record,readStatus:'ok',
   recipient:match,assignment:exact,receipt:{inboxChecked:true,accepted:true},proof};
 assert.equal(classifyCycleAuthority('ciifr',options).status,'RETURNED_ACCEPTED');
 const already=cycleBoardDeltaModel(ciifrPage,ciifrContext(),{binding:BIND,
   cycleRead:{status:'ok',record,proof},recipient:match,assignment:exact,
   receipt:{inboxChecked:true,accepted:true},proof});
 assert.equal(already.next.advice,'AWAIT_ORACLE_RECONCILIATION');
 const missing={...returned,cycle_receipt_url:undefined};
 const checked={...options,record:{...record,assignments:[missing]},
   receipt:{inboxChecked:true,found:false}};
 assert.equal(classifyCycleAuthority('ciifr',checked).status,'MISSING_ROUTING_RECEIPT');
 assert.equal(classifyCycleAuthority('ciifr',{...checked,receipt:{inboxChecked:false}}).status,'UNKNOWN');
});
test('CT-2 stale candidate, generation, recipient ID and historical-only assignment fail closed',()=>{
 const options={binding:BIND,record:canonical,readStatus:'ok',
   recipient:match,assignment:exact,receipt:{inboxChecked:true},proof};
 assert.equal(classifyCycleAuthority('ciifr',{...options,assignment:{...exact,candidate:'wrong'}}).status,'STALE_ASSIGNMENT');
 assert.equal(classifyCycleAuthority('ciifr',{...options,assignment:{...exact,generation:1}}).status,'STALE_ASSIGNMENT');
 assert.equal(classifyCycleAuthority('ciifr',{...options,recipient:{...match,chatId8:'wrong'}}).status,'WRONG_RECIPIENT');
 assert.equal(classifyCycleAuthority('ciifr',{...options,record:{...canonical,active_assignment:null}}).status,'UNKNOWN');
 assert.equal(classifyCycleAuthority('ciifr',{...options,assignment:{...exact,observedRevision:9}}).status,'STALE_ASSIGNMENT');
});
test('CT-4 private Cycle proof mismatches fail closed, browser flags never authorize',()=>{
 const args={binding:BIND,record:canonical,readStatus:'ok',
   recipient:match,assignment:exact,receipt:{inboxChecked:true},proof};
 assert.equal(classifyCycleAuthority('ciifr',{...args,proof:null}).status,'UNKNOWN');
 assert.equal(classifyCycleAuthority('ciifr',{...args,proof:{...proof,assignmentId:'other'}}).status,'STALE_ASSIGNMENT');
 assert.equal(classifyCycleAuthority('ciifr',{...args,proof:{...proof,generation:3}}).status,'STALE_ASSIGNMENT');
 assert.equal(classifyCycleAuthority('ciifr',{...args,proof:{...proof,candidate:'b'.repeat(40)}}).status,'STALE_ASSIGNMENT');
 assert.equal(classifyCycleAuthority('ciifr',{...args,proof:{...proof,canonicalRevision:11}}).status,'STALE_ASSIGNMENT');
 assert.equal(classifyCycleAuthority('ciifr',{...args,proof:{...proof,taskVerified:false}}).status,'STALE_ASSIGNMENT');
 assert.equal(classifyCycleAuthority('ciifr',{...args,proof:{...proof,holdsVerified:false}}).status,'STALE_ASSIGNMENT');
 const valid=classifyCycleAuthority('ciifr',args);
 assert.equal(valid.status,'PREFLIGHT_MATCHED');
 assert.equal(cycleBoardDeltaModel(ciifrPage,ciifrContext(),{
   binding:BIND,cycleRead:{status:'ok',record:canonical,proof},
   recipient:match,assignment:exact,receipt:{inboxChecked:true}
 }).next.advice,'REVIEW_PAGE_DRIFT');
});
test('CT-2 synthetic full active private preflight is a conditional advisory, never an automatic action',()=>{
 const ctx=ciifrContext();
 const baseline=structuredClone(ctx);
 const out=cycleBoardDeltaModel(ciifrPage,ctx,{previous:baseline,binding:BIND,
   cycleRead:{status:'ok',record:canonical,proof},recipient:match,
   assignment:exact,receipt:{inboxChecked:true},proof});
 assert.equal(out.cycle.status,'PREFLIGHT_MATCHED');
 assert.equal(out.native.status,'UNCHANGED');
 assert.equal(out.next.advice,'REVIEW_PAGE_DRIFT',
   'Page reconciliation has higher priority than any hypothetical active worker continuation');
 const noHold=structuredClone(ctx);noHold.sources.forEach(e=>{e.reportedHold=false;e.sourceAt='2026-10-27T01:00:00Z';});
 const normal=cycleBoardDeltaModel(ciifrPage,noHold,{previous:noHold,binding:BIND,
   cycleRead:{status:'ok',record:canonical,proof},recipient:match,assignment:exact,
   receipt:{inboxChecked:true},proof});
 assert.equal(normal.next.advice,'UNKNOWN_STOP',
   'even matching synthetic proof cannot authenticate or authorize a browser');
 assert.equal(cycleBoardDeltaModel(ciifrPage,noHold,{previous:noHold,binding:BIND,
   cycleRead:{status:'ok',record:canonical}}).next.advice,'UNKNOWN_STOP');
});
function fakeEl(tag){
 return {tag,className:'',children:[],text:'',attributes:{},
  set textContent(s){this.text=String(s);this.children=[];},
  get textContent(){return this.text+this.children.map(n=>typeof n==='string'?n:n.textContent).join('');},
  append(...x){this.children.push(...x);},
  setAttribute(k,v){this.attributes[k]=v;},
  addEventListener(name,handler){this['on'+name]=handler;},disabled:false};
}
test('CT-2 UI renders source-linked drift, UNKNOWN baseline and a real explicit recheck action',()=>{
 const old=globalThis.document;globalThis.document={createElement:fakeEl};
 try{
  const root=fakeEl('main');let checks=0;
  const model=cycleBoardDeltaModel(page,mockContext());
  renderCycleBoardDelta(root,model,{onRecheck:()=>checks++});
  assert.match(root.textContent,/REVIEW_PAGE_DRIFT/);
  assert.match(root.textContent,/STALE_PAGE/);
  assert.match(root.textContent,/UNKNOWN/);
  const find=(n)=>[n,...(n.children||[]).flatMap(find)];
  const button=find(root).find(n=>n.tag==='button');
  assert.equal(button.textContent,'Recheck native evidence');
  button.onclick();assert.equal(checks,1);
  const pending=fakeEl('main');
  renderCycleBoardDelta(pending,model,{onRecheck:()=>checks++,checking:true});
  const disabled=find(pending).find(n=>n.tag==='button');
  assert.equal(disabled.disabled,true);
  disabled.onclick();assert.equal(checks,1,'already checking must not issue another read');
 }finally{globalThis.document=old;}
});
