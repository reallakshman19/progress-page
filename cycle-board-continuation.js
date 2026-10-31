// CT-5: source-bound, cross-project continuation handoff.
// Read-only UI; private chat shortcuts come exclusively from existing My links.
// No transport API is connected. Copy/open never means delivered or acknowledged.
import { el, link, copyText } from './util.js?v=34';
import { wbsGroups } from './progress.js?v=34';
import { agentStartModel, agentStartTaskText } from './agent-start.js?v=34';
import { smartBadgesForScope, renderSmartBadges } from './smart-badges.js?v=34';
import {taskEvidenceV2Model,renderTaskEvidenceV2} from './task-evidence-v2.js?v=34';

const CT5_PUBLIC_SOURCE=/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:issues\/[1-9]\d*|pull\/[1-9]\d*|commit\/[a-fA-F0-9]{40})(?:#issuecomment-[1-9]\d*)?$/;
const CT5_CHATGPT=/^https:\/\/chatgpt\.com\/(?:c\/|g\/[^/?#]+\/c\/)[A-Za-z0-9_-]+(?:[/?#].*)?$/;
const CT5_CLAUDE=/^https:\/\/claude\.ai\/chat\/[A-Za-z0-9_-]+(?:[/?#].*)?$/;
const CT5_BROWSER_SITE='https://reallakshman19.github.io/progress-page/';
const ct5KnownChat=u=>typeof u==='string'&&(CT5_CHATGPT.test(u)||CT5_CLAUDE.test(u));
const ct5SafeSource=u=>typeof u==='string'&&CT5_PUBLIC_SOURCE.test(u);
const ct5CurrentRevision=p=>(p?.index?.revisions||[]).find(r=>r.status==='current')?.id||'UNKNOWN';
const ct5Safe=x=>typeof x==='string'&&x.trim()?x.trim():null;
const ct5Ended=x=>/^(?:DONE|VERIFIED|COMPLETE|COMPLETED|CLOSED|RETURNED|FULFILLED)$/i.test(x||'');
// TE2-ROLE: role ownership is a presentation selector, never a role grant.
const ct5RoleKind=x=>{
 const a=typeof x==='string'?x.trim():'';
 if(/^(?:oracle|otm|coordinator)(?:\b|\W|$)/i.test(a))return 'ORACLE';
 if(/^(?:ir|independent reviewer|reviewer)(?:\b|\W|$)/i.test(a))return 'IR';
 if(/^(?:agent|builder|coder|specialist)(?:\b|\W|$)/i.test(a))return 'AGENT';
 return 'UNKNOWN';
};

// The Board exposes every existing task; the actor's chat reports only own work.
// There is deliberately no automatic Oracle card if no source-owned Oracle task exists.
export function cycleNowRoleSelection(rows,{actingRole='UNKNOWN',view='response',ownerRequestedTeam=false,actorTaskId=null}={}){
 const items=Array.isArray(rows)?rows.filter(x=>x&&typeof x==='object'&&x.id):[];
 const role=ct5RoleKind(actingRole);
 if(view==='board')return {scope:'BOARD_ALL_EXISTING',cards:items,role};
 if(role==='UNKNOWN')return {scope:'ACTING_ROLE_NOT_VERIFIED',cards:[],role};
 if(ownerRequestedTeam)return {scope:'OWNER_REQUESTED_TEAM',cards:items,role};
 const candidates=items.filter(x=>ct5RoleKind(x.role)===role&&ct5SafeSource(x.source));
 const cards=actorTaskId?candidates.filter(x=>x.id===actorTaskId):
  candidates.length===1?candidates:[];
 return {scope:cards.length?'ACTOR_OWN_TASK':
   candidates.length>1&&!actorTaskId?'ACTOR_TASK_AMBIGUOUS':'ROLE_OWN_TASK_SOURCE_UNVERIFIED',cards,role};
}

// Every fact must be attached to the *current* assignment; a previous agent
// return or an issue-posted instruction is not proof the newer one was received.
export function cycleNowRelayDisposition({assignmentRef=null,posted=null,delivered=null,
 acknowledged=null,subsequentReturn=null,authorityBlocked=false,ownerRelayRequired=false}={}){
 const exact=x=>!!assignmentRef&&!!x&&x.assignmentRef===assignmentRef&&
  x.verified===true&&typeof x.ref==='string'&&x.ref.length>0;
 if(authorityBlocked||!assignmentRef)return {status:'BLOCKED',
  nextActor:'ORACLE',ownerActionRequired:false,reason:authorityBlocked?'AUTHORITY_BLOCKED':'ASSIGNMENT_UNKNOWN'};
 if(exact(acknowledged)||exact(subsequentReturn))return {status:'CONTINUED',
  nextActor:'ORACLE',ownerActionRequired:false,reason:exact(acknowledged)?'RECIPIENT_ACK':'SOURCE_BACKED_CONTINUATION'};
 // POSTED / DELIVERED without ACK may be real but does not establish
 // recipient acknowledgment. These facts remain separate observations.
 return {status:'AWAITING_RELAY',nextActor:ownerRelayRequired?'OWNER_ONE_TIME_RELAY':'ORACLE',
  ownerActionRequired:!!ownerRelayRequired,
  reason:exact(delivered)?'DELIVERED_ACK_UNVERIFIED':exact(posted)?'POSTED_DELIVERY_UNVERIFIED':'DELIVERY_NOT_VERIFIED'};
}

export function cycleNowRoleText(rows,{projectKey='UNKNOWN',actingRole='UNKNOWN',
 transport='NATIVE_CONTINUATION',coordinationSources=[]}={}){
 const selected=cycleNowRoleSelection(rows,{actingRole});
 const sources=[...(rows||[]).map(r=>r?.source),...coordinationSources]
  .filter(ct5SafeSource).filter((x,i,a)=>a.indexOf(x)===i).slice(0,12);
 const formal=transport==='FORMAL_CANONICAL';
 return [
  'CYCLE NOW — ACTING-ROLE CONTINUATION (copy only; NOT SENT)',
  'Project: '+projectKey+' · Acting role: '+selected.role+' (assignment/identity must be verified)',
  'Mode: '+(formal?'FORMAL_CANONICAL — verify main CURRENT.json, ACTIVE assignment, generation and receipt gates':
   'NATIVE_CONTINUATION — read native issue/authority; do not require an activated formal Cycle'),
  'Read current Cycle Board as context, then latest native sources; Board is not execution authority.',
  'Original native sources: '+(sources.length?sources.join(' ; '):'NOT_VERIFIED'),
  'Board may display all source-backed role-owned task cards.',
  selected.role==='ORACLE'? 
   'Oracle output: ONE five-line Task Evidence v2 card for your OWN existing coordination responsibility, referencing subordinate evidence, NOT two agent cards. Do not invent an Oracle task when native provenance is unavailable.':
   'Actor output: one five-line Task Evidence v2 card for YOUR assigned task only; not a coordinator card.',
  'Current instruction: PREPARED / POSTED / DELIVERED / ACKNOWLEDGED / EVIDENCE_RETURNED / ORACLE_RECONCILED are distinct observations.',
  'Close coordination CONTINUED only on actual current-instruction ACK or source-backed continuation; otherwise AWAITING_RELAY with named relay actor, or BLOCKED on authority.',
  'If only manual Owner relay can reach an existing agent chat, identify one minimum copy-ready Owner handoff; Oracle retains coordination.',
  'No new WBS, task, canonical Cycle, duplicate report, source mutation, engineering PASS or merge.',
  'After the five-line acting-role card, add Action to Owner only for a genuinely needed paste-ready Cycle now to Agent/Oracle or Owner decision; otherwise NONE. Cite other Owner issues or NONE; never a sixth line.',
  'Delivery and recipient ACK NOT_VERIFIED by this copy/open action.'
 ].join('\n');
}


// An audit can *identify* an explicitly linked agent return without proving
// that the intended recipient authored it, acknowledged the task or owns it.
function ct5LinkedReturn(project,id,source){
 const events=project?.audit?.events||[];
 const candidates=events.filter(e=>e.card===id&&
   ['AGENT_RETURN','RETURN','REVIEW_RETURN'].includes(e.kind)&&
   ct5SafeSource(e.source)&&ct5Safe(e.nativeOccurrenceId)&&
   (e.source===source||e.source.includes('#issuecomment-')));
 return candidates.length?candidates.at(-1):null;
}
const pageHref=(key,view='cycle-board')=>CT5_BROWSER_SITE+'#/'+encodeURIComponent(key)+'/'+view;
function ct5PickPrivate(chatLinks,keys){
 // Browsing convenience only: the map is private to the current browser;
 // it is not proof that the URL belongs to the authentic recipient.
 for(const key of keys){
  if(key&&ct5KnownChat(chatLinks?.[key]))return chatLinks[key];
 }
 return null;
}

function ct5PageRows(project,key,chatLinks,observations,scope){
 const idx=project.index||{}, milestones=idx.milestones||{},groups=wbsGroups(idx);
 const chats=idx.chats||{};
 const rows=[];
 for(const [id,c] of Object.entries(project.cards||{})){
  if(c?.closed)continue;
  const m=milestones[c?.milestone],wbs=m?.wbs||null;
  if(!m||!wbs||(Array.isArray(scope)&&!scope.includes(wbs)))continue;
  const family=groups.find(g=>g.steps.some(s=>s.key===c.milestone));
  const packetModel=family?agentStartModel(project,{family,step:c.milestone,
    revision:ct5CurrentRevision(project),cardId:id}):null;
  const chat=chats[c?.who?.chat]||{};
  const id8=ct5Safe(chat.id8)||null;
  const nativeSource=[c.src,...(c.refs||[]).map(r=>r.u)].find(ct5SafeSource)||null;
  const observation=(observations||[]).find(s=>s.source===nativeSource)||null;
  const state=ct5Safe(c.state)||'UNKNOWN';
  const returned=ct5LinkedReturn(project,id,nativeSource);
  const status=ct5Ended(state)||returned?'RECONCILE_FIRST':'REVIEW_NATIVE_AUTHORITY';
  const nextActor=ct5Safe(c.next?.actor)||'UNKNOWN';
  const notAgent=/(?:^|\b)(?:owner|oracle|reviewer_ir|reviewer|ir)(?:\b|$)/i.test(nextActor);
  const instruction=packetModel?agentStartTaskText(packetModel):null;
  rows.push({
   key,id,sourceType:'PUBLISHED_PAGE_CARD',label:c.label||id,wbs,milestoneId:c.milestone,
   role:ct5Safe(c.who?.role)||'UNKNOWN',recipientLabel:ct5Safe(chat.label)||'NOT_RECORDED',
   source:nativeSource,sourceRevision:observation?.revision||null,sourceOccurrence:observation?.occurrenceId||null,
   state,recordedNext:ct5Safe(c.next?.text)||'NOT_RECORDED',nextActor,
   recordedNow:ct5Safe(c.now)||null,
   prRefs:(c.refs||[]).filter(r=>/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(r.u||''))
    .map(r=>({url:r.u,status:'STATUS UNKNOWN'})),
   recipientIdKnown:!!id8,privateUrl:ct5PickPrivate(chatLinks,[id8]),
   status:status==='RECONCILE_FIRST'?'RECONCILE_FIRST':
    !instruction?'TASK_PACKET_UNAVAILABLE':notAgent?'ACTOR_REVIEW_REQUIRED':status,
   delivery:'NOT_VERIFIED',acknowledgment:'NOT_VERIFIED',
   returnState:returned?'PAGE_AUDIT_RETURN_POINTER_ONLY':'NOT_VERIFIED',
   returnUrl:returned?.source||null,
   instructions:instruction,smartBadges:smartBadgesForScope(project,{cardId:id,milestoneId:c.milestone})
  });
 }
 return rows.sort((a,b)=>a.wbs.localeCompare(b.wbs,undefined,{numeric:true})||
   a.id.localeCompare(b.id));
}
function ct5NativeRows(nativeTasks,chatLinks,observations){
 return (nativeTasks||[]).map(t=>{
  const source=ct5SafeSource(t.issue)?t.issue:null;
  const matched=(observations||[]).find(x=>x.source===source)||null;
  const privateUrl=ct5PickPrivate(chatLinks,[t.chatId8,t.key,t.id]);
  const lines=[
   'Cycle now — '+t.key.toUpperCase()+' (existing native task; NOT a canonical Cycle activation)',
   'Native task: '+(source||'NOT_VERIFIED'),
   'Governing WBS: '+(t.wbs||'UNMAPPED'),
   'Task: '+t.label,
   'Source observation revision: '+(matched?.revision||'NOT_VERIFIED'),
   'Source occurrence: '+(matched?.occurrenceId||'NOT_VERIFIED'),
   'Recorded next action: '+(t.next||'NOT_RECORDED'),
   'Read current Board: '+CT5_BROWSER_SITE+'#/adhoc/'+t.key+'/cycle-board',
   'Continue only the existing authorized READ_ONLY task. Read original sources and earlier native return;',
   'do NOT redo completed work, edit engineering models, treat CLOS/unsupported XML as approved, or assert PASS.',
   'Return once to the existing native task; otherwise AWAIT_ORACLE_RECONCILIATION.',
   'Delivery/recipient acknowledgment: NOT_VERIFIED. Copying this instruction does not send it.'
  ];
  return {
   key:t.key,id:t.id||t.key,sourceType:'NATIVE_TASK',label:t.label,wbs:t.wbs||'UNMAPPED',
   milestoneId:null,role:t.role||'Builder',recipientLabel:'NOT_VERIFIED',
   state:'PREPARED / READ_ONLY FIRST',recordedNext:t.next||'NOT_RECORDED',
   nextActor:'Assigned agent / UNKNOWN recipient',
   source,sourceRevision:matched?.revision||null,sourceOccurrence:matched?.occurrenceId||null,
   relatedPRs:t.relatedPRs||[],recipientIdKnown:!!t.chatId8,privateUrl,
   status:matched?'REVIEW_NATIVE_AUTHORITY':'SOURCE_NOT_VERIFIED',
   delivery:'NOT_VERIFIED',acknowledgment:'NOT_VERIFIED',returnState:'NOT_VERIFIED',
   returnUrl:null,instructions:lines.join('\n'),smartBadges:[]
  };
 });
}

export function continuationBridgeModel(project,{key=null,chatLinks={},nativeTasks=null,
  observations=null,wbs=null,historical=false}={}){
 const projectKey=key||project?.index?.project?.key||'UNKNOWN';
 const taskMode=Array.isArray(nativeTasks);
 const notCurrent=historical||!!(project?.status&&project.status!=='active');
 const rows=notCurrent?[]:taskMode?ct5NativeRows(nativeTasks,chatLinks,observations):
   project?.index?.project?.key===projectKey?
     ct5PageRows(project,projectKey,chatLinks,observations,wbs):[];
 return {
  schema:'cycle-board.ct5-continuation/v1',project:projectKey,
  scope:taskMode?'NATIVE_EXISTING_TASKS':'PUBLISHED_PAGE_CARDS',
  state:notCurrent?'HISTORICAL_NO_CONTINUATION':
    !taskMode&&project?.index?.project?.key!==projectKey?'SOURCE_UNKNOWN':
    rows.length?'REVIEW_REQUIRED':'NO_MATCHED_TASKS',
  rows,records:rows.length,
  privateLinksCount:rows.filter(r=>r.privateUrl).length,
  canDispatch:false,canAuthenticate:false,hasVerifiedAck:false,
  publication:'NOT_PUBLISHED_BY_CT5',
  note:'Browser shortcuts are not verified recipients; GitHub issue/PR and Page cards are not delivery, acknowledgment or accepted return evidence.'
 };
}
export function continuationText(row,projectKey){
 if(!row?.instructions)return null;
 const header='CYCLE NOW — changed-only continuation (copy only; NOT SENT)\n'+
   'Project: '+projectKey+' · Task: '+row.id+' · WBS: '+row.wbs+'\n'+
   'Original task/record: '+(row.source||'NOT_VERIFIED')+'\n'+
   'Observed native occurrence: '+(row.sourceOccurrence||'NOT_VERIFIED')+'\n'+
   'This is not a new canonical Oracle Cycle or dispatch. Agent must verify current recipient, role,\n'+
   'source SHA/fixture receipt, prior return, HOLD and active native assignment before any work.\n'+
   'Do not re-run an already returned task. Use one existing native return, never a second Board report.\n'+
   'TE2-ROLE: acting Agent/Reviewer reports only its OWN five-line task card; an Oracle reports its own coordination task, not this agent card.\n'+
   'After five lines, Action to Owner: copy-ready Cycle now to Oracle only for real manual relay, otherwise NONE; include source-linked other issues, not a sixth card line.\n';
 if(row.status==='RECONCILE_FIRST'||row.status==='ACTOR_REVIEW_REQUIRED'){
  return header+'\nSTOP — '+row.status+
    '. Prior return or next-actor role requires Oracle reconciliation first.\n'+
    'Do not re-run, dispatch, edit, merge or publish. AWAIT_ORACLE_RECONCILIATION.\n'+
    'Inspect original task: '+(row.source||'NOT_VERIFIED')+'\n'+
    'Return pointer: '+(row.returnUrl||'NOT_VERIFIED')+'\n'+
    'DELIVERY NOT_VERIFIED; ACKNOWLEDGMENT NOT_VERIFIED; COPY/OPEN IS NOT A SEND OR ACK.';
 }
 return header+'\n'+row.instructions+'\n\nDELIVERY NOT_VERIFIED; ACKNOWLEDGMENT NOT_VERIFIED; '+
   'COPY/OPEN IS NOT A SEND OR ACK.';
}

// TE2 companion: one copy/paste transaction for the Owner, never a sixth card
// line, source mutation, delivery receipt or independent work authorization.
export function cycleNowOwnerActionModel(row,{projectKey='UNKNOWN',evidence=null,
 actingRole='UNKNOWN',transport='NATIVE_CONTINUATION'}={}){
 const result=(kind,reason,text=null,target=null)=>({
  kind,reason,text,target,status:text?'PREPARED_NOT_SENT':'NOT_VERIFIED',
  copied:false,delivered:false,acknowledged:false
 });
 if(!row||!ct5SafeSource(row.source))
  return result('NONE','Original native task NOT_VERIFIED; no safe Owner transaction.');
 const role=ct5RoleKind(actingRole);
 // A Board field saying "Oracle" is not enough to impersonate the real Oracle.
 if(role==='UNKNOWN')return result('NONE',
  'Acting role NOT_VERIFIED; verify current participant before preparing an Owner message.');
 const shortProject=ct5Safe(projectKey)?.replace(/[\r\n]/g,' ').slice(0,50)||'UNKNOWN';
 const board=CT5_BROWSER_SITE+'#/'+(row.sourceType==='NATIVE_TASK'&&/^topo-[ab]$/.test(row.key||'')?
  'adhoc/'+row.key:'')+(row.sourceType==='NATIVE_TASK'&&/^topo-[ab]$/.test(row.key||'')?
  '/cycle-board':'');
 const boardUrl=board.endsWith('#/')?pageHref(shortProject):board;
 const source=row.source;
 const roleName=role==='AGENT'?'Agent':role==='IR'?'Independent reviewer':'Oracle';
 const head=role==='ORACLE'&&row.sourceType==='NATIVE_TASK'?'Oracle coordination':'Existing '+roleName+' task';
 const pending= ['RECONCILE_FIRST','ACTOR_REVIEW_REQUIRED'].includes(row.status);
 const nativeReady=row.sourceType==='NATIVE_TASK'&&!pending&&
  row.status==='REVIEW_NATIVE_AUTHORITY'&&
  evidence?.sourceStatus==='CURRENT'&&ct5Safe(evidence?.nativeNext)&&
  ct5SafeSource(evidence?.nextSourceUrl)&&
  evidence.nextSourceUrl.startsWith(row.source+'#issuecomment-');
 const readOnly='READ_ONLY. Verify current authority and HOLD; no production writes, new PR, merge or engineering acceptance.';
 const shared=['Read the current Cycle Board: '+boardUrl,
  'Original native task: '+source];
 // No candidate from Page NEXT labels or a stale return may be an executable
 // Agent dispatch. A source-anchored next step still requires recipient readback.
 if(role==='ORACLE'&&nativeReady){
  const next=ct5Safe(evidence.nativeNext).replace(/[\r\n]/g,' ').slice(0,220);
  return result('CYCLE_NOW_TO_AGENT','Source-linked next Agent action; delivery/ACK NOT_VERIFIED.',
   ['Cycle now — '+shortProject+' / existing '+row.key.toUpperCase()+' Agent.',
    ...shared,
    'Latest Oracle-reported instruction: '+evidence.nextSourceUrl,
    'Continue ONLY after verifying the current authorized assignment: '+next,
    'Return actual commands, outcomes and witnesses to '+source+'.',
    readOnly,
    'This is an Owner relay; NOT SENT, no ACK assumed.'].join('\n'),
   'Existing '+row.key.toUpperCase()+' Agent conversation (verify recipient)');
 }
 // An agent/IR return or a stale/blocked source requires Oracle reconciliation.
 // The coordinator remains accountable; do not ask the Owner to create a task.
 return result('CYCLE_NOW_TO_ORACLE',role==='ORACLE'?
   'Review authoritative next actor/status before Agent continuation.':
   'Return or review needs Oracle coordination; do not replay work.',
  ['Cycle now — '+shortProject+' / existing Oracle coordination.',
   ...shared,
   'Reconcile the latest native return, current next actor, original instruction and HOLD.',
   'Do not repeat completed tests or turn Page NEXT into Agent dispatch.',
   'Return ONE Oracle-owned five-line Task Evidence v2 card, then identify the next authorized action.',
   'If chat relay/Owner decision is needed, provide its exact source-linked copy-ready Action to Owner.',
   'Original evidence and next return remain at '+source+'.',
   readOnly,
   'Copy/paste only; NOT SENT and recipient ACK NOT_VERIFIED.'].join('\n'),
  'Existing Oracle conversation (verify recipient)');
}

export function renderContinuationBridge(root,project,options={}){
 const m=continuationBridgeModel(project,options);
 const panel=el('section','ct5-continuation');
 panel.setAttribute('aria-label','Agent continuation and acknowledgment bridge');
 panel.append(el('h3',null,'Agent continuation · CT-5'),
   el('p','muted','One existing task, one native return. Copy a changed-only Cycle now instruction and open its privately linked conversation; no delivery/ACK is reported without actual evidence.'));
 const summary=el('div','ct5-summary');
 summary.append(el('strong',null,m.records+' source-scoped task(s) · '+m.privateLinksCount+' local conversation shortcut(s)'),
  el('p','muted','Delivery NOT_VERIFIED · Agent ACK NOT_VERIFIED · return NOT_VERIFIED unless linked to an exact Page audit pointer. No automatic send, assignment, Cycle activation, Page publication or PASS.'));
 panel.append(summary);
 // This is a copy-only Oracle coordination aid for an explicitly selected
 // existing Oracle. It never creates an Oracle task card or claims delivery.
 if(ct5RoleKind(options.actingRole)==='ORACLE'&&m.state==='REVIEW_REQUIRED'){
  const roleControl=el('div','ct5-role-control');
  roleControl.append(el('p','muted','Oracle Cycle now → one OWN coordination card; subordinate task cards remain on the Board. Role/recipient not authenticated by this view.'));
  const roleButton=el('button','btn small','Copy Oracle Cycle now · not sent');
  roleButton.type='button';
  roleButton.addEventListener('click',()=>copyText(cycleNowRoleText(m.rows,{
   projectKey:m.project,actingRole:'ORACLE',transport:options.transport||'NATIVE_CONTINUATION',
   coordinationSources:options.coordinationSources||[]
  }),roleButton));
  roleControl.append(roleButton);panel.append(roleControl);
 }
 if(m.state==='HISTORICAL_NO_CONTINUATION')panel.append(el('p','banner',
  'Historical/archived project: no continuation packet or delivery action is available.'));
 if(m.state==='SOURCE_UNKNOWN')panel.append(el('p','banner',
  'Current project WBS/cards unavailable or mismatched. Do not infer an existing agent assignment.'));
 if(m.state==='NO_MATCHED_TASKS')panel.append(el('p','muted',
  'No scoped existing task was found in the published Page. Choose a specific WBS/Agent Start task or inspect original native issue.'));
 const grouped=new Map();
 for(const row of m.rows){
  if(!grouped.has(row.wbs))grouped.set(row.wbs,[]);
  grouped.get(row.wbs).push(row);
 }
 for(const [wbs,rows] of grouped){
  const group=el('div','ct5-group');
  group.append(el('h4',null,'WBS '+wbs+' · '+rows.length+' recorded task(s)'));
  for(const row of rows){
   const feed=options.evidenceFeeds?.[row.source]||null;
   const evidence=taskEvidenceV2Model(row,{projectKey:m.project,project,feed,
    observations:options.observations||[],pageFetch:options.pageFetch||null});
   renderTaskEvidenceV2(group,evidence);
   // Action to Owner is a separate copy-only transaction, not a 6th TE2 line.
   // The Board remains multi-task; the acting Oracle still reports its own card.
   const ownerAction=cycleNowOwnerActionModel(row,{projectKey:m.project,evidence,
    actingRole:options.actingRole||'UNKNOWN',transport:options.transport||'NATIVE_CONTINUATION'});
   const ownerBox=el('section','ct5-owner-action');
   ownerBox.setAttribute('aria-label','Action to Owner');
   ownerBox.append(el('h5',null,'Action to Owner'),
    el('p','muted','Copy-ready option (not a verified Owner obligation): '+ownerAction.kind+
     ' · '+ownerAction.reason+' · No automatic send/ACK. Other Owner issues: NOT_VERIFIED; see original task.'));
   if(ownerAction.text){
    const ownerBtn=el('button','btn small','Copy '+(
      ownerAction.kind==='CYCLE_NOW_TO_AGENT'?'Cycle now to Agent':'Cycle now to Oracle'
    )+' · NOT SENT');
    ownerBtn.type='button';
    ownerBtn.addEventListener('click',()=>copyText(ownerAction.text,ownerBtn));
    ownerBox.append(ownerBtn);
    const preview=el('details','ct5-owner-copy-preview');
    preview.append(el('summary',null,'View copy/paste message · '+ownerAction.target));
    preview.append(el('pre','ct5-owner-copy-block',ownerAction.text));
    ownerBox.append(preview);
   }
   group.append(ownerBox);
   // A newer source-backed Oracle next action supersedes a stale prepared
   // native packet, but does not confer message delivery or write permission.
   const sourceNext=evidence?.nativeNext&&evidence?.nextSourceUrl?
     'Cycle now — existing native task, no new Cycle or onboarding.\n'+
     'Native source: '+row.source+'\n'+
     'Latest Oracle-reported next action: '+evidence.nativeNext+'\n'+
     'Reconcile original instruction: '+evidence.nextSourceUrl+'\n'+
     'Return to original issue with executed raw receipts; no production writes or engineering PASS.\n'+
     'Delivery and recipient ACK NOT_VERIFIED.':null;
   const copyRow=sourceNext?{...row,instructions:sourceNext}:row;
   const details=el('details','ct5-task');
   const title=el('summary');
   title.append(el('b',null,row.label),' · '+row.state+
     ' · '+row.status);
   details.append(title);
   const info=el('div','ct5-task-body');
   info.append(el('p','muted','Original task '+row.id+
     ' · recorded role: '+row.role+
     ' · recipient: '+row.recipientLabel+' (NOT authenticated)'));
   info.append(el('p','ct-next','Recorded next (may be stale): '+row.recordedNext+
     ' · next actor: '+row.nextActor));
   const statuses=el('p','muted');
   statuses.append('Issue/record: '+(row.source?'LINKED':'NOT_RECORDED')+
     ' · instruction delivery: '+row.delivery+' · ACK: '+row.acknowledgment+
     ' · native return: '+row.returnState);
   info.append(statuses);
   if(row.sourceOccurrence)info.append(el('p','muted',
     'Observed source occurrence: '+row.sourceOccurrence+' · not an acknowledgment.'));
   if(row.smartBadges.length)renderSmartBadges(info,row.smartBadges);
   const actions=el('div','ct5-actions');
   if(row.source)actions.append(link(row.source,'Review original task / check agent return','btn small'));
   if(row.returnUrl)actions.append(link(row.returnUrl,'Inspect return pointer','btn small'));
   const copy=el('button','btn small','Copy Cycle now · not sent');
   copy.type='button';copy.disabled=!row.instructions;
   if(copyRow.instructions)copy.addEventListener('click',()=>copyText(continuationText(copyRow,m.project),copy));
   actions.append(copy);
   if(row.privateUrl)actions.append(link(row.privateUrl,
    row.status==='RECONCILE_FIRST'||row.status==='ACTOR_REVIEW_REQUIRED'?
     'Review existing conversation · do not replay':'Resume Agent · open existing conversation (not sent)','btn small'));
   else actions.append(el('span','muted','Conversation not linked · add recipient under My links (id8 or task key); do not infer delivery.'));
   info.append(actions);
   if(row.status==='RECONCILE_FIRST'||row.status==='ACTOR_REVIEW_REQUIRED')info.append(el('p','banner',
     'Task state/next actor requires Oracle reconciliation; copying the packet does not authorize replay.'));
   details.append(info);group.append(details);
  }
  panel.append(group);
 }
 panel.append(el('p','muted','Bridge status: prepared instructions and source-linked records only. A native GitHub post is not a message delivered into a ChatGPT conversation; a private shortcut is not recipient authentication. The Oracle verifies actual ACK and source-bound return in the original channel before Page reconciliation.'));
 root.append(panel);
 return m;
}
