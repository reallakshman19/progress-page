// CT-5 across the original five active project families and TOPO Adhoc.
// Source-aware cold/return/recipient falsifiers; no live service or writing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {continuationBridgeModel,continuationText,renderContinuationBridge} from '../cycle-board-continuation.js';

const ROOT=new URL('../data/',import.meta.url);
const keys=['ciifr','ciifr-node','g9v35','topofix','doc2table'];
const get=(key,file)=>JSON.parse(readFileSync(new URL(key+'/'+file+'.json',ROOT),'utf8'));
const page=k=>({index:get(k,'index'),cards:get(k,'cards'),
  fixtures:get(k,'fixtures'),audit:get(k,'audit')});
const snapshot=keys.map(k=>[k,
 readFileSync(new URL(k+'/cards.json',ROOT),'utf8'),
 readFileSync(new URL(k+'/audit.json',ROOT),'utf8')]);

test('CT-5 derives existing tasks across five unrelated projects, without creating another WBS/assignment/return',()=>{
 for(const key of keys){
  const original=page(key),initial=JSON.stringify(original);
  const model=continuationBridgeModel(original,{key});
  assert.equal(model.schema,'cycle-board.ct5-continuation/v1');
  assert.equal(model.project,key);
  assert.equal(model.scope,'PUBLISHED_PAGE_CARDS');
  assert.ok(model.records>0,'expected real scoped Page tasks '+key);
  assert.equal(model.canDispatch,false);
  assert.equal(model.canAuthenticate,false);
  assert.equal(model.hasVerifiedAck,false);
  assert.ok(model.rows.every(r=>original.index.milestones[r.milestoneId]?.wbs===r.wbs));
  assert.ok(model.rows.every(r=>r.delivery==='NOT_VERIFIED'&&r.acknowledgment==='NOT_VERIFIED'));
  assert.ok(model.rows.every(r=>r.returnState!=='ACKNOWLEDGED'));
  assert.ok(model.rows.every(r=>r.sourceType==='PUBLISHED_PAGE_CARD'));
  assert.ok(model.rows.every(r=>r.recordedNext&&r.smartBadges.length));
  assert.ok(model.rows.some(r=>r.instructions?.includes('AGENT TASK PACKET')),
    'must actually reuse Agent Start packet '+key);
  assert.equal(JSON.stringify(original),initial,'read-only source object mutated in '+key);
 }
 for(const [key,c,a] of snapshot){
  assert.equal(readFileSync(new URL(key+'/cards.json',ROOT),'utf8'),c);
  assert.equal(readFileSync(new URL(key+'/audit.json',ROOT),'utf8'),a);
 }
});

test('Original WBS scope is exact; a fake project or bad milestone never hydrates an adjacent project',()=>{
 const original=page('ciifr');
 const all=continuationBridgeModel(original,{key:'ciifr'});
 const scoped=continuationBridgeModel(original,{key:'ciifr',wbs:['3.1']});
 assert.ok(scoped.records>0&&scoped.records<all.records);
 assert.ok(scoped.rows.every(x=>x.wbs==='3.1'));
 assert.equal(continuationBridgeModel(original,{key:'ciifr-node'}).state,'SOURCE_UNKNOWN');
 assert.equal(continuationBridgeModel(original,{key:'ciifr-node'}).records,0);
 const tampered=structuredClone(original);
 tampered.cards.bad={label:'Injected',milestone:'NOT_IN_WBS',who:{chat:'unknown'}};
 assert.equal(continuationBridgeModel(tampered,{key:'ciifr'}).records,all.records);
});

test('Private My links match only the recorded recipient key and approved private conversation domains',()=>{
 const p=page('doc2table');
 const m=continuationBridgeModel(p,{key:'doc2table'});
 const id=m.rows.find(x=>x.recipientIdKnown)?.id;
 assert.ok(id);
 const chat=Object.values(p.index.chats).find(x=>x.id8&&m.rows.some(r=>r.id===id));
 const theCard=p.cards[id];
 const id8=p.index.chats[theCard.who.chat].id8;
 const privateLink='https://chatgpt.com/c/private-example-1234';
 const model=continuationBridgeModel(p,{key:'doc2table',chatLinks:{
  [id8]:privateLink,'topo-a':'https://chatgpt.com/c/unrelated',
  [id]: 'https://evil.example/redirect','unknown':'https://claude.ai/chat/x'
 }});
 const target=model.rows.find(x=>x.id===id);
 assert.equal(target.privateUrl,privateLink);
 assert.equal(model.privateLinksCount>=1,true);
 assert.equal(target.delivery,'NOT_VERIFIED');
 assert.equal(target.acknowledgment,'NOT_VERIFIED');
 const packet=continuationText(target,'doc2table');
 assert.ok(packet.includes('COPY/OPEN IS NOT A SEND OR ACK'));
 assert.ok(!packet.includes(privateLink),'private conversation address must not be copied into public task packet');
 assert.ok(!packet.includes('evil.example'));
 const alternate=continuationBridgeModel(p,{key:'doc2table',chatLinks:{[id8]:'https://github.com/org/repo'}});
 assert.equal(alternate.rows.find(x=>x.id===id).privateUrl,null);
});

test('A recorded DONE card stops replay and an Owner next actor requires review, not a new assignment',()=>{
 const p=page('ciifr'),copy=structuredClone(p);
 const id=Object.keys(copy.cards).find(k=>copy.index.milestones?.[copy.cards[k]?.milestone]?.wbs);
 copy.cards[id].state='DONE';
 let m=continuationBridgeModel(copy,{key:'ciifr'}).rows.find(x=>x.id===id);
 assert.equal(m.status,'RECONCILE_FIRST');
 assert.match(continuationText(m,'ciifr'),/Do not re-run/);
 assert.doesNotMatch(continuationText(m,'ciifr'),/AGENT TASK PACKET/,'finished work must yield reconciliation-only guidance');
 copy.cards[id].state='IN_PROGRESS';
 copy.cards[id].next={actor:'Owner',text:'Approve protected write'};
 m=continuationBridgeModel(copy,{key:'ciifr'}).rows.find(x=>x.id===id);
 assert.equal(m.status,'ACTOR_REVIEW_REQUIRED');
 assert.equal(m.acknowledgment,'NOT_VERIFIED');
 assert.doesNotMatch(continuationText(m,'ciifr'),/AGENT TASK PACKET/,'Owner-directed step cannot be an agent execution packet');
});

test('Claimed AGENT_RETURN alone never establishes recipient delivery/ACK, even with source-bound audit pointer',()=>{
 const p=page('topofix');
 const id=Object.keys(p.cards).find(k=>p.cards[k].src?.startsWith('https://github.com/')&&
   p.index.milestones?.[p.cards[k]?.milestone]?.wbs);
 const before=continuationBridgeModel(p,{key:'topofix'}).rows.find(x=>x.id===id);
 assert.equal(before.returnState,'NOT_VERIFIED');
 const bad=structuredClone(p);
 bad.audit.events.push({card:id,kind:'AGENT_RETURN',source:before.source,nativeOccurrenceId:null});
 let actual=continuationBridgeModel(bad,{key:'topofix'}).rows.find(x=>x.id===id);
 assert.equal(actual.returnState,'NOT_VERIFIED');
 bad.audit.events.at(-1).nativeOccurrenceId='github:valid-seeming-source';
 actual=continuationBridgeModel(bad,{key:'topofix'}).rows.find(x=>x.id===id);
 assert.equal(actual.returnState,'PAGE_AUDIT_RETURN_POINTER_ONLY');
 assert.equal(actual.status,'RECONCILE_FIRST','source pointer must block duplicate task replay');
 assert.doesNotMatch(continuationText(actual,'topofix'),/AGENT TASK PACKET/);
 assert.equal(actual.acknowledgment,'NOT_VERIFIED');
 assert.equal(actual.delivery,'NOT_VERIFIED');
 assert.equal(actual.status!=='ACKNOWLEDGED',true);
});

test('TOPO-A/B retain native tasks, next actions and exact observed head without inventing an activated Cycle',()=>{
 const nativeTasks=[
 {key:'topo-a',label:'TOPO-A',issue:'https://github.com/reallakshman19/xml229-topology-wp1-preview-20261028/issues/12',wbs:'3.2/4.1',next:'CLOS decision matrix'},
 {key:'topo-b',label:'TOPO-B',issue:'https://github.com/reallakshman19/XML_Compare_Utilities/issues/239',wbs:'2.1/4.1',next:'Read-only format-admission contract'}
 ];
 const obs=[{source:nativeTasks[0].issue,revision:'2026-10-31T04:00:00Z',
  occurrenceId:'github:reallakshman19/topo:issue-revision:12:2026-10-31T04:00:00Z'}];
 const model=continuationBridgeModel(null,{key:'topofix',nativeTasks,
  observations:obs,chatLinks:{'topo-a':'https://chatgpt.com/c/old-agent'}});
 assert.equal(model.rows.length,2);
 assert.equal(model.rows[0].status,'REVIEW_NATIVE_AUTHORITY');
 assert.equal(model.rows[1].status,'SOURCE_NOT_VERIFIED');
 assert.equal(model.rows[0].sourceOccurrence,obs[0].occurrenceId);
 assert.equal(model.rows[1].sourceOccurrence,null);
 assert.ok(model.rows.every(r=>r.acknowledgment==='NOT_VERIFIED'));
 assert.match(model.rows[0].instructions,/CLOS decision matrix/);
 assert.match(model.rows[1].instructions,/format-admission contract/);
 assert.match(model.rows[0].instructions,/#\/adhoc\/topo-a\/cycle-board/);
 assert.doesNotMatch(model.rows[0].instructions,/#\/adhoc%2Ftopo-a/);
 assert.equal(model.rows[0].privateUrl,'https://chatgpt.com/c/old-agent');
 assert.ok(!continuationText(model.rows[0],'topofix').includes('old-agent'));
 const wrong=continuationBridgeModel(null,{key:'topofix',
  nativeTasks:[{...nativeTasks[0],issue:'http://malicious.example'}]});
 assert.equal(wrong.rows[0].source,null);
 assert.equal(wrong.rows[0].status,'SOURCE_NOT_VERIFIED');
});

test('Historical Cycle Board never copies or opens a continuation; empty source remains UNKNOWN',()=>{
 const p=page('g9v35');
 const hist=continuationBridgeModel(p,{key:'g9v35',historical:true});
 assert.equal(hist.state,'HISTORICAL_NO_CONTINUATION');
 assert.equal(hist.records,0);
 const empty=continuationBridgeModel(null,{key:'topofix'});
 assert.equal(empty.state,'SOURCE_UNKNOWN');
 assert.equal(empty.rows.length,0);
});

function node(tag) {
 return {tag,className:'',children:[],attributes:{},text:'',
  append(...x){this.children.push(...x);},
  set textContent(s){this.text=String(s);this.children=[];},
  get textContent(){return (this.text||'')+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');},
  setAttribute(k,v){this.attributes[k]=String(v);},
  addEventListener(k,cb){this['on'+k]=cb;}
 };
}
function collect(root,predicate,found=[]){
 if(root&&typeof root==='object'){
  if(predicate(root))found.push(root);
  for(const child of root.children||[])collect(child,predicate,found);
 }
 return found;
}
test('UI exposes copy-only, source link, private chat shortcut, no faux Send/ACK controls',()=>{
 const old=globalThis.document;globalThis.document={createElement:node};
 try{
  const p=page('doc2table'),r=node('main'),model=continuationBridgeModel(p,{key:'doc2table'});
  const one=model.rows.find(x=>x.recipientIdKnown);
  const id8=p.index.chats[p.cards[one.id].who.chat].id8;
  const link='https://chatgpt.com/c/private-room';
  renderContinuationBridge(r,p,{key:'doc2table',chatLinks:{[id8]:link}});
  assert.match(r.textContent,/delivery: NOT_VERIFIED|instruction delivery: NOT_VERIFIED/);
  assert.match(r.textContent,/Copy Cycle now · not sent/);
  assert.match(r.textContent,/ACK: NOT_VERIFIED/);
  assert.ok(collect(r,x=>x.tag==='a'&&x.href===link).length===1);
  assert.equal(collect(r,x=>x.tag==='button'&&/send/i.test(x.textContent)).length,0);
  assert.ok(collect(r,x=>x.tag==='details'&&x.className==='ct5-task').length===model.records);
  assert.ok(collect(r,x=>x.tag==='button'&&/Copy Cycle now/.test(x.textContent)).length===model.records);
 }finally{globalThis.document=old;}
});
