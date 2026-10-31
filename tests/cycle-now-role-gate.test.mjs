// O4 TE2-ROLE — exact acting task, Board hierarchy, current-instruction relay gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleNowRoleSelection,cycleNowRelayDisposition,cycleNowRoleText,
 cycleNowOwnerActionModel,decideNextAction,cycleNowBoardDecision,
 renderContinuationBridge} from '../cycle-board-continuation.js';

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
  assert.equal(buttons.filter(x=>x.textContent==='Copy Cycle now · not sent').length,1);
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
  actingRole:'ORACLE',evidence,ownerRelayRequired:true});
 assert.equal(action.kind,'CYCLE_NOW_TO_AGENT');
 assert.equal(action.status,'PREPARED_NOT_SENT','copying never proves a coordination obligation');
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
 const agent=cycleNowOwnerActionModel(row,{projectKey:'topo-a',actingRole:'AGENT',
  evidence:good,ownerRelayRequired:true});
 assert.equal(agent.kind,'CYCLE_NOW_TO_ORACLE');
 assert.match(agent.text,/existing Oracle coordination/);
 assert.doesNotMatch(agent.text,/Continue ONLY after/);
 const stale=cycleNowOwnerActionModel({...row,status:'RECONCILE_FIRST'},
  {projectKey:'topo-a',actingRole:'ORACLE',evidence:good});
 assert.equal(stale.kind,'NONE','acting Oracle performs completed-return review in the same cycle');
 for(const bad of [
  {...good,nextSourceUrl:B+'#issuecomment-6540556158'},
  {...good,sourceStatus:'PARTIAL'},
  {...good,nextSourceUrl:'https://evil.example/'},
  {...good,nextSourceUrl:undefined}
 ]){
  const x=cycleNowOwnerActionModel(row,{projectKey:'topo-a',actingRole:'ORACLE',evidence:bad});
  assert.equal(x.kind,'NONE','no untrusted executable Agent handoff or needless Oracle self-relay');
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
  assert.equal(btn.length,0,'no real Owner dependency means no inert copy instruction');
  assert.match(actions[0].textContent,/NONE/);
  const preview=collect(actions[0],x=>x.tag==='pre'&&x.className==='ct5-owner-copy-block');
  assert.equal(preview.length,0);
  const fast=collect(root,x=>x.tag==='section'&&x.className==='ct5-fastlane-decision');
  assert.equal(fast.length,1,'existing CT-5 shows one next-action decision aid');
  assert.match(fast[0].textContent,/ORACLE_QUALIFY_SCOPE/);
  const noRole=node('main');
  renderContinuationBridge(noRole,null,{key:'topo-a',nativeTasks:[row]});
  assert.equal(collect(noRole,x=>x.tag==='section'&&x.className==='ct5-owner-action').length,1);
  assert.equal(collect(noRole,x=>x.tag==='pre'&&x.className==='ct5-owner-copy-block').length,0);
 }finally{globalThis.document=old;}
});


// Fast Lane F2: all facts below are *synthetic*, not new TOPO-A/B authorization.
// The Board can recommend; it never authenticates source, dispatches or grants PASS.
const pinned='a'.repeat(40);
const baseFast=()=>{
 const envelope={sourceIssue:A,taskId:'TOPO-A-12',recipientId:'agent-a',
  sourceSha:pinned,permission:'READ_ONLY',
  authorityRef:A+'#issuecomment-333',permittedStepIds:['trace','lookup','sidecar']};
 const step={id:'lookup',taskId:'TOPO-A-12',recipientId:'agent-a',
  sourceSha:pinned,permission:'READ_ONLY'};
 return {sourceIssue:A,taskId:'TOPO-A-12',recipientId:'agent-a',
  sourceSha:pinned,authorityVerified:true,envelopeSourceVerified:true,
  sourceStatus:'CURRENT',boardObserved:true,executionEnvelope:envelope,nextStep:step,
  sourceChanged:false,authorityChanged:false,materialScopeChanged:false,
  criticalFalsifierFailed:false,latestReturnNeedsReconciliation:false,
  scopeCompleted:false,ownerOnlyDecisionRequired:false,independentReviewRequired:false,
  stopConditionsVerified:true,stopTriggered:false,envelopeExhausted:false};
};

test('F2-01: completed authorized substep may continue the next exact read-only envelope step',()=>{
 const d=decideNextAction(baseFast());
 assert.equal(d.action,'CONTINUE_EXISTING_SCOPE');
 assert.equal(d.nextActor,'AGENT');
 assert.equal(d.withinAuthorizedEnvelope,true);
 assert.equal(d.canDispatch,false,'pure UI recommendation does not send');
 assert.equal(d.canAuthorizeWrite,false);
});

test('F2-02: completed assignment never dispatches another Agent microtest',()=>{
 const d=decideNextAction({...baseFast(),scopeCompleted:true,scopeCompletionVerified:true});
 assert.equal(d.action,'DECIDE_NEXT_ASSIGNMENT');
 assert.equal(d.nextActor,'ORACLE');
 assert.equal(d.canDispatch,false);
 const unreviewed=decideNextAction({...baseFast(),scopeCompleted:true});
 assert.equal(unreviewed.action,'ORACLE_RECONCILE');
});

test('F2-03: new source-bound Agent return routes to Oracle rather than back to Agent',()=>{
 const d=decideNextAction({...baseFast(),latestReturnNeedsReconciliation:true});
 assert.equal(d.action,'ORACLE_RECONCILE');
 const feed={issue:A,status:'ok',comments:[
  {url:A+'#issuecomment-100',body:'Prior Oracle next instruction'},
  {url:A+'#issuecomment-101',body:'Actual Agent return'},
  {url:A+'#issuecomment-102',body:'New Oracle decision'}
 ]};
 const row={source:A,sourceType:'NATIVE_TASK',key:'topo-a',
  status:'REVIEW_NATIVE_AUTHORITY'};
 const evidence={sourceStatus:'CURRENT',nativeNext:'OLD NEXT: synthetic tests',
  nextSourceUrl:A+'#issuecomment-100'};
 const latest=cycleNowBoardDecision(row,evidence,feed,{boardObserved:true});
 assert.equal(latest.action,'ORACLE_RECONCILE');
 assert.equal(latest.newNativeCommentsObserved,true);
 const action=cycleNowOwnerActionModel(row,{projectKey:'topo-a',
  actingRole:'ORACLE',evidence,decision:latest,ownerRelayRequired:true});
 assert.equal(action.kind,'NONE','new native delta invalidates stale Agent continuation');
});

test('F2-04: unverified writer custody blocks production write, not exact authorized read-only step',()=>{
 const w=decideNextAction({...baseFast(),
  nextStep:{...baseFast().nextStep,permission:'PRODUCT_WRITE'},
  writerCustodyVerified:false});
 assert.equal(w.action,'HOLD_AFFECTED_SCOPE');
 assert.equal(w.reason,'WRITER_CUSTODY_UNVERIFIED');
 const ro=decideNextAction({...baseFast(),writerCustodyVerified:false});
 assert.equal(ro.action,'CONTINUE_EXISTING_SCOPE');
 assert.equal(ro.canAuthorizeWrite,false);
});

test('F2-05: changed SHA/authority stops affected scope; forged envelope mismatch cannot continue',()=>{
 for(const change of [{sourceChanged:true},{authorityChanged:true},
  {materialScopeChanged:true}]){
  assert.equal(decideNextAction({...baseFast(),...change}).action,
   'REQUALIFY_AFFECTED_SCOPE');
 }
 const b=baseFast();
 assert.equal(decideNextAction({...b,sourceSha:'b'.repeat(40)}).action,
  'ORACLE_QUALIFY_SCOPE');
 assert.equal(decideNextAction({...b,recipientId:'some-other-agent'}).action,
  'ORACLE_QUALIFY_SCOPE');
 assert.equal(decideNextAction({...b,executionEnvelope:{
  ...b.executionEnvelope,authorityRef:B+'#issuecomment-333'}}).action,
  'ORACLE_QUALIFY_SCOPE');
 assert.equal(decideNextAction({...b,executionEnvelope:{
  ...b.executionEnvelope,permittedStepIds:['trace']}}).action,
  'ORACLE_QUALIFY_SCOPE');
});

test('F2-06: critical falsifier HOLD is scoped; separate read-only eligibility needs real separate source',()=>{
 const fail=decideNextAction({...baseFast(),criticalFalsifierFailed:true});
 assert.equal(fail.action,'HOLD_AFFECTED_SCOPE');
 assert.equal(fail.unrelatedReadOnlyEligible,false);
 const separate=decideNextAction({...baseFast(),criticalFalsifierFailed:true,
  unrelatedReadOnlyAuthorized:true,unrelatedReadOnlyIssue:B,
  unrelatedTaskId:'TOPO-B-239',
  unrelatedAuthorityRef:B+'#issuecomment-789'});
 assert.equal(separate.action,'HOLD_AFFECTED_SCOPE');
 assert.equal(separate.unrelatedReadOnlyEligible,true,'separate source evidence is required');
 assert.equal(decideNextAction({...baseFast(),criticalFalsifierFailed:true,
  unrelatedReadOnlyAuthorized:true,unrelatedReadOnlyIssue:B}).unrelatedReadOnlyEligible,false);
});

test('F2-07: Board inaccessible continues from independently verified native envelope',()=>{
 const d=decideNextAction({...baseFast(),boardObserved:false});
 assert.equal(d.action,'CONTINUE_EXISTING_SCOPE');
 assert.equal(d.boardStatus,'NOT_OBSERVED');
 assert.equal(d.canDispatch,false);
 assert.equal(decideNextAction({sourceIssue:A,boardObserved:false}).action,
  'ORACLE_QUALIFY_SCOPE','Board unobserved cannot manufacture native authority');
});

test('F2-08: CT-5 copy/open never proves delivery or recipient ACK',()=>{
 const current='TOPO-A-12#lookup';
 const posted={assignmentRef:current,verified:true,ref:A+'#issuecomment-333'};
 const d=cycleNowRelayDisposition({assignmentRef:current,posted});
 assert.equal(d.status,'AWAITING_RELAY');
 assert.equal(d.ownerActionRequired,false);
 const other={assignmentRef:'other',verified:true,ref:'recipient-ack'};
 assert.equal(cycleNowRelayDisposition({assignmentRef:current,posted,
  acknowledged:other}).status,'AWAITING_RELAY');
});

test('F2-09: independent review cannot be replaced by agent self-score or product PASS',()=>{
 const d=decideNextAction({...baseFast(),independentReviewRequired:true});
 assert.equal(d.action,'ORACLE_QUALIFY_REVIEW');
 assert.equal(d.nextActor,'ORACLE');
 assert.equal(d.canAuthorizeWrite,false);
 assert.equal(d.canGrantAuthority,false);
});

test('F2-10: no verified Owner dependency means Action to Owner NONE with no inert copy',()=>{
 const row={source:A,sourceType:'NATIVE_TASK',key:'topo-a',
  status:'REVIEW_NATIVE_AUTHORITY'};
 const evidence={nativeNext:'Old check',nextSourceUrl:A+'#issuecomment-333',
  sourceStatus:'CURRENT'};
 const noAction=cycleNowOwnerActionModel(row,{actingRole:'ORACLE',
  evidence,decision:decideNextAction({...baseFast(),latestReturnNeedsReconciliation:true})});
 assert.equal(noAction.kind,'NONE');
 assert.equal(noAction.text,null);
 const review=cycleNowOwnerActionModel(row,{actingRole:'ORACLE',
  evidence,ownerRelayRequired:true,decision:{action:'ORACLE_RECONCILE'}});
 assert.equal(review.kind,'NONE','Oracle does not ask Owner to ping Oracle again');
});

test('F2-11: exact Owner-only decision must have matching native source',()=>{
 const row={source:A,sourceType:'NATIVE_TASK',key:'topo-a',
  status:'RECONCILE_FIRST'};
 const decision=decideNextAction({...baseFast(),
  ownerOnlyDecisionRequired:true,ownerDecisionSourceVerified:true,
  ownerDecisionSource:A+'#issuecomment-333'});
 assert.equal(decision.action,'OWNER_DECISION');
 assert.equal(decision.ownerActionRequired,true);
 const legit=cycleNowOwnerActionModel(row,{actingRole:'ORACLE',decision,
  ownerDecision:{required:true,verified:true,source:A+'#issuecomment-333',
   question:'Who holds exclusive P0 writer custody?'}});
 assert.equal(legit.kind,'OWNER_DECISION');
 assert.match(legit.text,/exclusive P0 writer custody/);
 assert.equal(legit.status,'PREPARED_NOT_SENT');
 const spoof=cycleNowOwnerActionModel(row,{actingRole:'ORACLE',decision,
  ownerDecision:{required:true,verified:true,source:B+'#issuecomment-333',
   question:'Approve merge'}});
 assert.equal(spoof.kind,'NONE');
 assert.equal(decideNextAction({...baseFast(),ownerOnlyDecisionRequired:true,
  ownerDecisionSourceVerified:true,ownerDecisionSource:B+'#issuecomment-333'}).action,
  'ORACLE_QUALIFY_SCOPE');
});

test('F2-12: no material delta means no substantive native status report',()=>{
 const f={...baseFast(),nextStep:null,noMaterialDelta:true,noMaterialDeltaVerified:true};
 const d=decideNextAction(f);
 assert.equal(d.action,'NO_MATERIAL_DELTA');
 assert.equal(d.ownerActionRequired,false);
 assert.equal(d.canDispatch,false);
 const noSource=decideNextAction({...f,authorityVerified:false});
 assert.equal(noSource.action,'ORACLE_QUALIFY_SCOPE');
});


test('F2-13: unknown STOP/contradiction status is NOT permission to keep executing',()=>{
 for(const key of ['sourceChanged','authorityChanged','materialScopeChanged',
  'criticalFalsifierFailed','latestReturnNeedsReconciliation','scopeCompleted',
  'ownerOnlyDecisionRequired','independentReviewRequired',
  'stopConditionsVerified','stopTriggered','envelopeExhausted']){
  const f=baseFast();delete f[key];
  assert.notEqual(decideNextAction(f).action,'CONTINUE_EXISTING_SCOPE',
   key+' missing must fail closed');
 }
 const noDelta={...baseFast(),nextStep:null,noMaterialDelta:true};
 assert.notEqual(decideNextAction(noDelta).action,'NO_MATERIAL_DELTA',
  'missing source-verified no-delta receipt cannot suppress native reporting');
});
