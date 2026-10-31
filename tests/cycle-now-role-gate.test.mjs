// O4 TE2-ROLE — exact acting task, Board hierarchy, current-instruction relay gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleNowRoleSelection,cycleNowRelayDisposition,cycleNowRoleText,
 cycleNowOwnerActionModel,renderContinuationBridge} from '../cycle-board-continuation.js';

const A='https://github.com/reallakshman19/xml229-topology-wp1-preview-20261028/issues/12';
const B='https://github.com/reallakshman19/XML_Compare_Utilities/issues/239';
const O='https://github.com/reallakshman19/xml229-topology-wp1-preview-20261028/issues/1';
const tasks=[
 {id:'oracle-coordination',role:'Oracle',source:O,wbs:'R1'},
 {id:'topo-a',role:'Builder',source:A,wbs:'3.2 / 4.1'},
 {id:'topo-b',role:'Agent',source:B,wbs:'2.1 / 4.1'}
];

test('Oracle+2 Agents: Board 3 source tasks, Oracle chat 1 own coordination task',()=>{
 const board=cycleNowRoleSelection(tasks,{actingRole:'ORACLE',view:'board'});
 const chat=cycleNowRoleSelection(tasks,{actingRole:'ORACLE'});
 assert.equal(board.cards.length,3);
 assert.equal(chat.cards.length,1);
 assert.equal(chat.cards[0].source,O);
 assert.equal(chat.scope,'ACTOR_OWN_TASK');
 const detail=cycleNowRoleSelection(tasks,{actingRole:'ORACLE',ownerRequestedTeam:true});
 assert.equal(detail.cards.length,3);
 assert.equal(detail.scope,'OWNER_REQUESTED_TEAM');
 assert.deepEqual(tasks.map(t=>t.id),['oracle-coordination','topo-a','topo-b'],'read-only');
});

test('Agent/IR cannot inherit another agent task solely from role label',()=>{
 const ag=cycleNowRoleSelection(tasks,{actingRole:'AGENT'});
 assert.equal(ag.scope,'ACTOR_TASK_AMBIGUOUS');
 assert.equal(ag.cards.length,0);
 const scoped=cycleNowRoleSelection(tasks,{actingRole:'AGENT',actorTaskId:'topo-b'});
 assert.equal(scoped.cards.length,1);
 assert.equal(scoped.cards[0].source,B);
 const falseId=cycleNowRoleSelection(tasks,{actingRole:'AGENT',actorTaskId:'oracle-coordination'});
 assert.equal(falseId.cards.length,0);
 const ir=[...tasks,{id:'ir-review',role:'Independent Reviewer',
  source:'https://github.com/reallakshman19/XML_Compare_Utilities/issues/240'}];
 const review=cycleNowRoleSelection(ir,{actingRole:'IR'});
 assert.equal(review.cards.length,1);
 assert.equal(review.cards[0].id,'ir-review');
 assert.equal(cycleNowRoleSelection(tasks,{actingRole:'not verified'}).cards.length,0);
});

test('Two native Agent rows cannot fabricate an Oracle coordination record/card',()=>{
 const rows=tasks.slice(1);
 const oracle=cycleNowRoleSelection(rows,{actingRole:'ORACLE'});
 assert.equal(oracle.scope,'ROLE_OWN_TASK_SOURCE_UNVERIFIED');
 assert.deepEqual(oracle.cards,[]);
 assert.equal(cycleNowRoleSelection(rows,{actingRole:'ORACLE',view:'board'}).cards.length,2);
});

test('POSTED cannot imply DELIVERED, ACK or completed continuation; missing Owner route visible',()=>{
 const assignmentRef='issue239#next-native-gate';
 const posted={assignmentRef,verified:true,ref:B+'#issuecomment-12345'};
 const basic=cycleNowRelayDisposition({assignmentRef,posted});
 assert.equal(basic.status,'AWAITING_RELAY');
 assert.equal(basic.ownerActionRequired,false,'no automatic Owner relay assumption');
 assert.equal(basic.reason,'POSTED_DELIVERY_UNVERIFIED');
 const manual=cycleNowRelayDisposition({assignmentRef,posted,ownerRelayRequired:true});
 assert.equal(manual.status,'AWAITING_RELAY');
 assert.equal(manual.nextActor,'OWNER_ONE_TIME_RELAY');
 assert.equal(manual.ownerActionRequired,true);
 const delivered=cycleNowRelayDisposition({assignmentRef,posted,
  delivered:{assignmentRef,verified:true,ref:'private-channel-receipt'}});
 assert.equal(delivered.status,'AWAITING_RELAY','delivery is not ACK');
 assert.equal(delivered.reason,'DELIVERED_ACK_UNVERIFIED');
});

test('ACK or subsequent return for CURRENT assignment establishes continuation; previous return does not',()=>{
 const assignmentRef='issue12#new-task';
 const old={assignmentRef:'issue12#old-task',verified:true,ref:A+'#issuecomment-111'};
 const stale=cycleNowRelayDisposition({assignmentRef,subsequentReturn:old});
 assert.equal(stale.status,'AWAITING_RELAY');
 const fake={assignmentRef,verified:false,ref:'user-claimed'};
 assert.equal(cycleNowRelayDisposition({assignmentRef,acknowledged:fake}).status,'AWAITING_RELAY');
 assert.deepEqual(cycleNowRelayDisposition({assignmentRef,acknowledged:{
  assignmentRef,verified:true,ref:'recipient-ack'}}).status,'CONTINUED');
 const noSeparateAck=cycleNowRelayDisposition({assignmentRef,subsequentReturn:{
  assignmentRef,verified:true,ref:A+'#issuecomment-222'}});
 assert.equal(noSeparateAck.status,'CONTINUED');
 assert.equal(noSeparateAck.reason,'SOURCE_BACKED_CONTINUATION');
 assert.equal(cycleNowRelayDisposition({assignmentRef,authorityBlocked:true}).status,'BLOCKED');
 assert.equal(cycleNowRelayDisposition({}).status,'BLOCKED');
});

test('Native Cycle now does not import formal CURRENT.json; explicit formal mode checks it',()=>{
 const opts={projectKey:'topofix',actingRole:'ORACLE',coordinationSources:[A,B]};
 const native=cycleNowRoleText(tasks.slice(1),opts);
 assert.match(native,/NATIVE_CONTINUATION/);
 assert.match(native,/ONE five-line Task Evidence v2 card for your OWN existing coordination responsibility/);
 assert.match(native,/PREPARED \/ POSTED \/ DELIVERED/);
 assert.match(native,/AWAITING_RELAY/);
 assert.doesNotMatch(native,/verify main CURRENT\.json/);
 assert.match(native,/Delivery and recipient ACK NOT_VERIFIED/);
 assert.match(native,/issues\/12/);
 assert.match(native,/issues\/239/);
 const formal=cycleNowRoleText(tasks.slice(1),{...opts,transport:'FORMAL_CANONICAL'});
 assert.match(formal,/verify main CURRENT\.json, ACTIVE assignment/);
 assert.doesNotMatch(native,/chatgpt\.com\/c\//);
});

function node(tag){
 return {tag,className:'',children:[],attributes:{},text:'',
  append(...x){this.children.push(...x);},
  set textContent(t){this.text=String(t);this.children=[];},
  get textContent(){return (this.text||'')+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');},
  setAttribute(k,v){this.attributes[k]=String(v);},
  addEventListener(k,cb){this['on'+k]=cb;}
 };
}
function collect(root,pred,out=[]){
 if(root&&typeof root==='object'){if(pred(root))out.push(root);
  for(const c of root.children||[])collect(c,pred,out);}
 return out;
}
test('Existing Board retains agent evidence; Oracle copy control only for explicitly passed role',()=>{
 const original=globalThis.document;
 globalThis.document={createElement:node};
 try{
  const row={key:'topo-a',id:'topo-a',label:'TOPO-A',issue:A,wbs:'3.2 / 4.1',
   next:'Existing Oracle-authorized read-only task',role:'Builder'};
  const root=node('main');
  renderContinuationBridge(root,null,{key:'topo-a',nativeTasks:[row],
   actingRole:'ORACLE',coordinationSources:[A,B]});
  assert.equal(collect(root,x=>x.tag==='article'&&x.className==='task-evidence-v2').length,1);
  assert.equal(collect(root,x=>x.tag==='p'&&x.className==='te-line').length,5);
  const buttons=collect(root,x=>x.tag==='button');
  assert.equal(buttons.filter(x=>x.textContent.includes('Copy Oracle Cycle now')).length,1);
  assert.equal(buttons.filter(x=>x.textContent.includes('Copy Cycle now')).length,1);
  assert.doesNotMatch(root.textContent,/chatgpt\.com\/c\//);
  assert.match(root.textContent,/Oracle Cycle now/);
  const agentOnly=node('main');
  renderContinuationBridge(agentOnly,null,{key:'topo-a',nativeTasks:[row]});
  assert.equal(collect(agentOnly,x=>x.tag==='button')
   .filter(x=>x.textContent.includes('Copy Oracle Cycle now')).length,0);
 }finally{globalThis.document=original;}
});


test('Action to Owner: source-anchored current TOPO next step yields one Agent copy block, never delivered',()=>{
 const row={...tasks[1],key:'topo-a',sourceType:'NATIVE_TASK',
  status:'REVIEW_NATIVE_AUTHORITY',state:'READ_ONLY FIRST'};
 const evidence={sourceStatus:'CURRENT',
  nativeNext:'Run exactly 3 synthetic CLOS checks in scratch',
  nextSourceUrl:A+'#issuecomment-6540556158'};
 const action=cycleNowOwnerActionModel(row,{projectKey:'topo-a',
  actingRole:'ORACLE',evidence});
 assert.equal(action.kind,'CYCLE_NOW_TO_AGENT');
 assert.equal(action.status,'AWAITING_RELAY');
 assert.equal(action.target,'Existing TOPO-A Agent conversation (verify recipient)');
 assert.match(action.text,/Run exactly 3 synthetic CLOS checks in scratch/);
 assert.match(action.text,/issuecomment-6540556158/);
 assert.match(action.text,/No production writes|no production writes/);
 assert.match(action.text,/NOT SENT/);
 assert.equal(action.delivered,false);
 assert.equal(action.acknowledged,false);
 assert.doesNotMatch(action.text,/chatgpt\.com\/c\//);
 assert.doesNotMatch(action.text,/CURRENT\.json/);
});

test('Action to Owner: Agent return, stale Page task, unknown or wrong-issue source cannot dispatch',()=>{
 const row={...tasks[1],key:'topo-a',sourceType:'NATIVE_TASK',
  status:'REVIEW_NATIVE_AUTHORITY'};
 const good={sourceStatus:'CURRENT',nativeNext:'Authorized read-only source check',
  nextSourceUrl:A+'#issuecomment-6540556158'};
 const agent=cycleNowOwnerActionModel(row,{projectKey:'topo-a',actingRole:'AGENT',evidence:good});
 assert.equal(agent.kind,'CYCLE_NOW_TO_ORACLE');
 assert.match(agent.text,/existing Oracle coordination/);
 assert.doesNotMatch(agent.text,/Continue ONLY after/);
 const stale=cycleNowOwnerActionModel({...row,status:'RECONCILE_FIRST'},
  {projectKey:'topo-a',actingRole:'ORACLE',evidence:good});
 assert.equal(stale.kind,'CYCLE_NOW_TO_ORACLE','returned/completed work routes to Oracle');
 for(const bad of [
  {...good,nextSourceUrl:B+'#issuecomment-6540556158'},
  {...good,sourceStatus:'PARTIAL'},
  {...good,nextSourceUrl:'https://evil.example/'},
  {...good,nextSourceUrl:undefined}
 ]){
  const x=cycleNowOwnerActionModel(row,{projectKey:'topo-a',actingRole:'ORACLE',evidence:bad});
  assert.equal(x.kind,'CYCLE_NOW_TO_ORACLE','no untrusted executable Agent handoff');
 }
 const unknown=cycleNowOwnerActionModel(row,{projectKey:'topo-a',actingRole:'UNKNOWN',evidence:good});
 assert.equal(unknown.kind,'NONE');
 assert.equal(unknown.text,null);
 const noTask=cycleNowOwnerActionModel({...row,source:'https://evil.example/'},
  {actingRole:'ORACLE',evidence:good});
 assert.equal(noTask.kind,'NONE');
});

test('Action to Owner is separate from exactly five lines and offers copyable plaintext in existing CT-5',()=>{
 const old=globalThis.document;
 globalThis.document={createElement:node};
 try{
  const row={key:'topo-a',id:'topo-a',label:'TOPO-A',
   issue:A,wbs:'3.2 / 4.1',next:'Review original CLOS evidence',role:'Builder'};
  const root=node('main');
  renderContinuationBridge(root,null,{key:'topo-a',nativeTasks:[row],actingRole:'ORACLE'});
  const te=collect(root,x=>x.tag==='article'&&x.className==='task-evidence-v2');
  const actions=collect(root,x=>x.tag==='section'&&x.className==='ct5-owner-action');
  assert.equal(te.length,1);
  assert.equal(actions.length,1);
  assert.equal(collect(te[0],x=>x.tag==='p'&&x.className==='te-line').length,5);
  const btn=collect(actions[0],x=>x.tag==='button');
  assert.equal(btn.length,1);
  assert.match(btn[0].textContent,/Copy Cycle now to Oracle/);
  assert.match(actions[0].textContent,/NOT SENT/);
  const preview=collect(actions[0],x=>x.tag==='pre'&&x.className==='ct5-owner-copy-block');
  assert.equal(preview.length,1);
  assert.match(preview[0].textContent,/Cycle now — topo-a/);
  assert.match(preview[0].textContent,/issues\/12/);
  const noRole=node('main');
  renderContinuationBridge(noRole,null,{key:'topo-a',nativeTasks:[row]});
  assert.equal(collect(noRole,x=>x.tag==='section'&&x.className==='ct5-owner-action').length,1);
  assert.equal(collect(noRole,x=>x.tag==='pre'&&x.className==='ct5-owner-copy-block').length,0);
 }finally{globalThis.document=old;}
});
