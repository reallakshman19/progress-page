// Live, public-safe Cycle now via Timeline observations; never the curated Page audit.
import { el, link, copyText } from './util.js?v=33';
import { smartBadgesForScope, smartBadgeText, renderSmartBadges } from './smart-badges.js?v=33';

export const CT_SOURCES = Object.freeze({
  ciifr: Object.freeze({ owner:'reallakshman19', repo:'Common', issue:564 })
});
const FENCE=String.fromCharCode(96).repeat(3);
const CT_HEADER=new RegExp('^CYCLE_TIMELINE_EVENT v1\n'+FENCE+'json\n([\\s\\S]+?)\n'+FENCE+'\\s*$');
const CT_ALIAS=/^[a-z][a-z0-9-]{1,31}$/;
const CT_EVENT=/^[a-z0-9][a-z0-9-]{3,79}$/;
const CT_WBS=/^[1-9]\d{0,2}(?:\.[1-9]\d{0,2}){0,3}$/;
const CT_SOURCE=/^https:\/\/github\.com\/[a-z0-9_.-]+\/[a-z0-9_.-]+\/(?:issues\/[1-9]\d*|pull\/[1-9]\d*|commit\/[a-f0-9]{40})(?:#issuecomment-[1-9]\d*)?$/i;
const CT_PRIVATE=/(?:chatgpt\.com\/c\/|chat\.openai\.com\/|claude\.ai\/chat\/|antigravity\.google\.com\/|drive\.google\.com\/|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
const CT_ROLES=new Set(['CODER','ORACLE','REVIEWER_IR']);
const CT_STATUSES=new Set(['WORKING','BLOCKED','NEEDS_OWNER','WAITING','RETURN_POSTED','REVIEWING','NO_ACTION']);
const CT_REQUIRED=['project','eventId','actorAlias','peerAlias','role','wbs','card','status','ownerAsk','next','source','fixtureRefs'];

export function parseCycleTimelineComment(comment, project) {
  if(!comment||typeof comment.body!=='string'||comment.body.length>6000||
     !Number.isInteger(comment.id)||!CT_SOURCE.test(comment.html_url||'')||
     !Number.isFinite(Date.parse(comment.created_at||''))) return null;
  const match=CT_HEADER.exec(comment.body.replace(/\r\n/g,'\n').trim());
  if(!match||CT_PRIVATE.test(comment.body))return null;
  let data;
  try {data=JSON.parse(match[1]);} catch {return null;}
  if(!data||typeof data!=='object'||Array.isArray(data)||
     Object.keys(data).sort().join()!==CT_REQUIRED.slice().sort().join()||
     data.project!==project||!CT_EVENT.test(data.eventId||'')||
     !CT_ALIAS.test(data.actorAlias||'')||
     !(data.peerAlias==='NO_DIRECT_PEER'||CT_ALIAS.test(data.peerAlias||''))||
     !CT_ROLES.has(data.role)||!CT_STATUSES.has(data.status)||
     !(data.wbs==='UNSCOPED'||CT_WBS.test(data.wbs||''))||
     !(data.card==='UNSCOPED'||CT_ALIAS.test(data.card||''))||
     typeof data.ownerAsk!=='string'||data.ownerAsk.length>300||
     typeof data.next!=='string'||!data.next.trim()||data.next.length>350||
     !CT_SOURCE.test(data.source||'')||!Array.isArray(data.fixtureRefs)||
     data.fixtureRefs.length>8||
     !data.fixtureRefs.every(x=>typeof x==='string'&&CT_SOURCE.test(x))||
     (data.status==='NEEDS_OWNER'?!data.ownerAsk.trim():!!data.ownerAsk.trim()))return null;
  return {...data,commentId:comment.id,at:comment.created_at,commentUrl:comment.html_url,
    provenance:'REPORTED_UNVERIFIED'};
}

export async function loadCycleTimeline(project,fetcher=fetch) {
  const src=CT_SOURCES[project];
  if(!src)return [];
  const comments=[];
  for(let page=1;page<=5;page++) {
    const url='https://api.github.com/repos/'+src.owner+'/'+src.repo+
      '/issues/'+src.issue+'/comments?per_page=100&page='+page;
    const response=await fetcher(url,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
    if(!response||!response.ok)throw Error('GitHub intake unavailable: HTTP '+(response?.status||'unknown'));
    const batch=await response.json();
    if(!Array.isArray(batch)||batch.length>100)throw Error('GitHub intake response invalid');
    comments.push(...batch);
    if(batch.length<100)return comments;
  }
  throw Error('GitHub intake pagination exceeds bounded complete scan; UNKNOWN');
}

export function cycleTimelineModel(comments,project) {
  if(!Array.isArray(comments))return {health:'UNKNOWN',events:[],latest:[],
    ownerRequests:[],groups:[],ignored:0};
  const events=[],seen=new Set();
  let ignored=0;
  const milestones=project?.index?.milestones||{},cards=project?.cards||{};
  for(const comment of comments) {
    const event=parseCycleTimelineComment(comment,project?.index?.project?.key);
    if(!event||seen.has(event.eventId)){ignored++;continue;}
    seen.add(event.eventId);
    const card=cards[event.card];
    const wbsExists=Object.values(milestones).some(m=>m.wbs===event.wbs);
    const matches=event.card==='UNSCOPED'||(card&&!card.closed&&
      milestones[card.milestone]?.wbs===event.wbs);
    event.scope=event.wbs==='UNSCOPED'&&event.card==='UNSCOPED'?'UNSCOPED':
      wbsExists&&matches?'SOURCE_MATCHED':'UNRESOLVED_SCOPE';
    events.push(event);
  }
  events.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.commentId-b.commentId);
  const last=new Map();
  for(const e of events)last.set(e.actorAlias+'|'+e.wbs+'|'+e.card,e);
  const latest=[...last.values()].reverse();
  const ownerRequests=latest.filter(e=>e.status==='NEEDS_OWNER'&&e.scope==='SOURCE_MATCHED');
  const groups=new Map();
  for(const e of latest){const w=e.scope==='UNRESOLVED_SCOPE'?'UNRESOLVED_SCOPE':e.wbs;
    if(!groups.has(w))groups.set(w,[]);
    groups.get(w).push(e);
  }
  return {health:ignored?'PARTIAL':'CURRENT',events:events.reverse(),latest,ownerRequests,
    groups:[...groups].map(([wbs,records])=>({wbs,records})),ignored};
}


const CARD_TYPES=new Set(['ACTION','INFO']);
const ACTION_STATES=new Set(['OPEN','IN_PROGRESS','BLOCKED','NEEDS_OWNER','WAITING']);
const INFO_STATES=new Set(['RECORDED','HANDED_OFF','DONE']);
const TAG_TYPES=new Set(['WBS','ROADMAP','PLAN','FIXTURE']);
const CARD_FIELDS=['project','eventId','threadId','actionRef','actorAlias','peerAlias',
  'role','wbs','card','kind','state','title','details','ownerAsk','next','source','smartTags'];
const CARD_HEADER=new RegExp('^CYCLE_TIMELINE_CARD v2\\n'+String.fromCharCode(96).repeat(3)+
  'json\\n([\\s\\S]+?)\\n'+String.fromCharCode(96).repeat(3)+'\\s*$');

export function parseTimelineCardEvent(comment,project) {
  if(!comment||typeof comment.body!=='string'||comment.body.length>6500||
    !Number.isInteger(comment.id)||!CT_SOURCE.test(comment.html_url||'')||
    !Number.isFinite(Date.parse(comment.created_at||''))||CT_PRIVATE.test(comment.body))return null;
  const matched=CARD_HEADER.exec(comment.body.replace(/\r\n/g,'\n').trim());
  if(!matched)return null;
  let e;try{e=JSON.parse(matched[1]);}catch{return null;}
  if(!e||typeof e!=='object'||Array.isArray(e)||
     Object.keys(e).sort().join()!==CARD_FIELDS.slice().sort().join()||
     e.project!==project||!CT_EVENT.test(e.eventId||'')||!CT_EVENT.test(e.threadId||'')||
     !(e.actionRef===null||CT_EVENT.test(e.actionRef||''))||
     !CT_ALIAS.test(e.actorAlias||'')||
     !(e.peerAlias==='NO_DIRECT_PEER'||CT_ALIAS.test(e.peerAlias||''))||
     !CT_ROLES.has(e.role)||!CARD_TYPES.has(e.kind)||
     !(e.wbs==='UNSCOPED'||CT_WBS.test(e.wbs||''))||
     !(e.card==='UNSCOPED'||CT_ALIAS.test(e.card||''))||
     !((e.kind==='ACTION'?ACTION_STATES:INFO_STATES).has(e.state))||
     typeof e.title!=='string'||!e.title.trim()||e.title.length>120||
     typeof e.details!=='string'||e.details.length>850||
     typeof e.ownerAsk!=='string'||e.ownerAsk.length>350||
     typeof e.next!=='string'||e.next.length>450||
     (e.kind==='ACTION'&&(!e.next.trim()||e.actionRef!==null))||
     (e.kind==='INFO'&&e.ownerAsk!=='')||
     (e.state==='NEEDS_OWNER'?!e.ownerAsk.trim():!!e.ownerAsk.trim())||
     !CT_SOURCE.test(e.source||'')||
     !Array.isArray(e.smartTags)||e.smartTags.length>12||
     !e.smartTags.every(t=>t&&typeof t==='object'&&!Array.isArray(t)&&
       Object.keys(t).sort().join()==='label,source,type'&&
       TAG_TYPES.has(t.type)&&typeof t.label==='string'&&t.label.trim()&&
       t.label.length<=70&&CT_SOURCE.test(t.source)))return null;
  return {...e,commentId:comment.id,at:comment.created_at,commentUrl:comment.html_url,
    provenance:'REPORTED_UNVERIFIED'};
}

export function timelineCardModel(comments,project) {
  if(!Array.isArray(comments))return {health:'UNKNOWN',cards:[],ownerRequests:[],groups:[],
    events:[],ignored:0,unresolved:0};
  const events=[],ids=new Set(),milestones=project?.index?.milestones||{},
    pageCards=project?.cards||{};
  let ignored=0,unresolved=0;
  for(const comment of comments){
    let e=parseTimelineCardEvent(comment,project?.index?.project?.key);
    if(!e){
      // Legacy event comments remain visible as reported cards until migrated.
      const v1=parseCycleTimelineComment(comment,project?.index?.project?.key);
      if(v1)e={...v1,kind:['RETURN_POSTED','NO_ACTION'].includes(v1.status)?'INFO':'ACTION',
        state:v1.status,threadId:v1.actorAlias+'-'+v1.wbs.replaceAll('.','-')+'-'+v1.card,
        title:v1.card+' · '+v1.role,details:'Legacy Cycle status report',
        smartTags:[],actionRef:null};
    }
    if(!e||ids.has(e.eventId)){ignored++;continue;}
    ids.add(e.eventId);
    const card=pageCards[e.card];
    const wbsFound=Object.values(milestones).some(m=>m.wbs===e.wbs);
    const matches=e.card==='UNSCOPED'||(card&&!card.closed&&
      milestones[card.milestone]?.wbs===e.wbs);
    e.scope=e.wbs==='UNSCOPED'&&e.card==='UNSCOPED'?'UNSCOPED':
      wbsFound&&matches?'SOURCE_MATCHED':'UNRESOLVED_SCOPE';
    e.badges=e.scope==='SOURCE_MATCHED' ? smartBadgesForScope(project,{cardId:e.card==='UNSCOPED'?null:e.card,
      milestoneId:Object.entries(milestones).find(([,m])=>m.wbs===e.wbs)?.[0]||null}) : [];
    events.push(e);
  }
  events.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.commentId-b.commentId);
  const byId=new Map(),threads=new Map(),extra=[];
  for(const e of events){
    if(e.kind==='INFO'&&e.actionRef){
      const previous=byId.get(e.actionRef), current=threads.get(e.threadId);
      // Closing a stale prior Action must not erase a newer open Action.
      if(!previous||previous.kind!=='ACTION'||!current||
         current.eventId!==e.actionRef||previous.threadId!==e.threadId||
         previous.wbs!==e.wbs||previous.card!==e.card){
        e.scope='UNRESOLVED_HANDOFF';unresolved++;extra.push(e);
        byId.set(e.eventId,e);continue;
      }
    } else if(e.kind==='INFO'&&threads.get(e.threadId)?.kind==='ACTION') {
      // An unsolicited informational comment cannot close an open Action.
      e.scope='UNRESOLVED_HANDOFF';unresolved++;extra.push(e);
      byId.set(e.eventId,e);continue;
    }
    byId.set(e.eventId,e);
    threads.set(e.threadId,e);
  }
  const cards=[...threads.values()].reverse().concat(extra.reverse());
  const ownerRequests=cards.filter(e=>e.kind==='ACTION'&&e.state==='NEEDS_OWNER'&&
    e.scope==='SOURCE_MATCHED');
  const groups=new Map();
  for(const e of cards){
    const scope=e.scope==='SOURCE_MATCHED'?e.wbs:e.scope;
    if(!groups.has(scope))groups.set(scope,[]);
    groups.get(scope).push(e);
  }
  return {health:ignored||unresolved?'PARTIAL':'CURRENT',cards,ownerRequests,
    groups:[...groups].map(([wbs,records])=>({wbs,records})),
    events:events.slice().reverse(),ignored,unresolved};
}

export function timelineInfoTemplate(action) {
  if(!action||action.kind!=='ACTION')return null;
  const next=action.peerAlias==='NO_DIRECT_PEER'?action.actorAlias:action.peerAlias;
  const result={
    project:action.project,eventId:action.threadId+'-info-'+Date.now().toString(36),
    threadId:action.threadId,actionRef:action.eventId,
    actorAlias:next,peerAlias:action.actorAlias,role:'REVIEWER_IR',
    wbs:action.wbs,card:action.card,kind:'INFO',state:'HANDED_OFF',
    title:action.title,details:'Describe exactly what occurred and link the confirming source.',
    ownerAsk:'',next:'Describe the next separately owned action, if any.',
    source:action.source,smartTags:action.smartTags||[]
  };
  const fence=String.fromCharCode(96).repeat(3);
  return 'CYCLE_TIMELINE_CARD v2\n'+fence+'json\n'+JSON.stringify(result,null,2)+'\n'+fence;
}

export function timelinePageBrief(info) {
  if(!info||info.kind!=='INFO')return null;
  const tags=(info.smartTags||[]).map(t=>t.type+': '+t.label+' ('+t.source+')').join('\n');
  return ['Page writer review suggestion — NOT a Page update',
    'Project: '+info.project,'WBS: '+info.wbs,'Card: '+info.card,
    'Thread: '+info.threadId,'Agent claim: '+info.actorAlias+' → '+info.peerAlias,
    'Info: '+info.title,'Details: '+info.details,
    'Next: '+info.next,'Smart Tags:\n'+(tags||'None'),
    'Agent event: '+info.commentUrl,'Original source: '+info.source,
    'Recorded Smart Badge identifiers:\n'+smartBadgeText(info.badges),
    'Check original evidence, scope, custody and fixtures before any pp_propose/pp_batch publication.'
  ].join('\n');
}


// Deterministic read-time INFO · Auto-generated projection. No posting, writes,
// timestamps invented from browser time, or claim that an agent started work.
export function autoGeneratedTimelineCards(project,limit=20) {
  const audit=project?.audit?.events, cards=project?.cards||{},
    milestones=project?.index?.milestones||{};
  if(!Array.isArray(audit))return [];
  const seen=new Set(),output=[];
  // Retain the newest source-backed published observation per card/milestone.
  for(let i=audit.length-1;i>=0&&output.length<limit;i--){
    const e=audit[i];
    if(!e||!CT_SOURCE.test(e.source||'')||typeof e.summary!=='string'||
       !e.summary.trim()||!Number.isFinite(Date.parse(e.at||'')))continue;
    const card=e.card&&cards[e.card],scope=/^milestone:([A-Za-z0-9-]+)$/.exec(e.scope||'');
    const milestoneId=card?.milestone||(scope?scope[1]:null);
    const milestone=milestones[milestoneId]||null;
    // WBS tiles require an exact recorded card/milestone; project-wide
    // audited events are still in the original Timeline, not silently mapped.
    if(!milestone||!milestone.wbs)continue;
    const key=card?'card:'+e.card:'milestone:'+milestoneId;
    if(seen.has(key))continue;
    seen.add(key);
    const tags=[{type:'WBS',label:milestone.wbs,source:e.source}];
    if(e.kind==='PLAN')tags.push({type:'PLAN',label:'Recorded plan change',source:e.source});
    if(e.kind==='FIXTURE')tags.push({type:'FIXTURE',label:'Recorded fixture list: '+(e.list||'unspecified'),source:e.source});
    if(milestone.capSrc&&CT_SOURCE.test(milestone.capSrc)&&milestone.canDo)
      tags.push({type:'ROADMAP',label:milestone.canDo.slice(0,70),source:milestone.capSrc});
    output.push({
      kind:'INFO_AUTO',state:'SOURCE_RECORDED',eventId:e.id,threadId:'page-audit-'+key,
      project:project?.index?.project?.key||'',wbs:milestone.wbs,card:e.card||'UNSCOPED',
      title:card?.label||milestone.label||milestone.name||('Milestone '+milestoneId),
      details:e.summary,actor:e.actor||'Page audit actor not recorded',peerAlias:'Not recorded',
      at:e.at,source:e.source,commentUrl:e.source,smartTags:tags,
      badges:smartBadgesForScope(project,{cardId:card?e.card:null,milestoneId,event:e}),
      provenance:'AUTO_DERIVED_PAGE_AUDIT',auditId:e.id,revision:e.rev||'',
      recordedState:card?.state||null,recordedNext:card?.next?.text||null,
      scope:'PAGE_RECORD_MATCHED'
    });
  }
  return output;
}

export function autoGeneratedPageBrief(info) {
  if(!info||info.kind!=='INFO_AUTO')return null;
  return [
    'INFO · Auto-generated — source-backed Page observation',
    'Project: '+info.project,'WBS: '+info.wbs,'Card: '+info.card,
    'Published Page audit: '+info.auditId+' / '+info.revision,
    'Recorded at: '+info.at,'Recorded actor: '+info.actor,
    'Summary: '+info.details,'Recorded card state: '+(info.recordedState||'not recorded'),
    'Recorded next step: '+(info.recordedNext||'not recorded'),
    'Smart Tags: '+info.smartTags.map(t=>t.type+' '+t.label+' ('+t.source+')').join('; '),
    'Reusable Smart Badge identifiers:\n'+smartBadgeText(info.badges),
    'Original source: '+info.source,
    'Derived for display only. No new audited event or engineering acceptance.'
  ].join('\n');
}

function renderAutoGeneratedInfo(root,project) {
  const items=autoGeneratedTimelineCards(project);
  const panel=el('section','ct-auto-section');
  const header=el('div','ct-auto-head');
  header.append(el('span','chip s','INFO-Auto generated'),
    el('b',null,'WBS evidence snapshots'));
  panel.append(header,el('p','muted',
    'Automatically assembled from already-published Page Timeline events. '+
    'Nothing to repost; not an agent check-in or a fresh acceptance decision.'));
  if(!items.length)panel.append(el('p','empty',
    'No source-backed WBS entries in the published Page audit. This does not mean no agent work.'));
  const details=el('details','ct-auto-disclosure');
  details.open=true;
  details.append(el('summary',null,items.length+' derived cards · latest audit record per WBS card/milestone'));
  const groups=new Map();
  for(const item of items){
    if(!groups.has(item.wbs))groups.set(item.wbs,[]);
    groups.get(item.wbs).push(item);
  }
  for(const [wbs,cards] of groups) {
    const section=el('div','ct-group');
    section.append(el('h4',null,'WBS '+wbs));
    for(const item of cards){
      const box=el('article','ct-card ct-auto');
      const top=el('div','ct-top');
      top.append(el('span','chip s','INFO-Auto generated'),
        el('span','chip','Page '+item.revision),
        el('span','muted',item.auditId+' · '+item.at));
      box.append(top,el('b',null,item.title),el('p','ct-description',item.details),
        el('p','muted','Recorded by '+item.actor+
          (item.recordedState?' · card state: '+item.recordedState:'')+
          ' · agent interaction not established by this record'));
      if(item.recordedNext)box.append(el('p','ct-next',
        'Recorded next step (may be stale): '+item.recordedNext));
      const badges=el('div','ct-tags');
      for(const tag of item.smartTags)badges.append(link(tag.source,
        tag.type+' · '+tag.label,'chip'));
      box.append(badges);
      renderSmartBadges(box,item.badges);
      const footer=el('div','ct-tools');
      footer.append(link(item.source,'Original evidence','btn small'));
      const copy=el('button','btn small','Copy grounding / Page brief');
      copy.type='button';copy.addEventListener('click',()=>copyText(autoGeneratedPageBrief(item),copy));
      footer.append(copy);box.append(footer);
      section.append(box);
    }
    details.append(section);
  }
  panel.append(details);root.append(panel);
}
export function renderCycleTimeline(root,project,state){
  const src=CT_SOURCES[project?.index?.project?.key];
  root.append(el('h3',null,'Cycle now via Timeline'),
    el('p','muted','Action / Info are live agent thread claims; INFO · Auto-generated reads the existing Page audit without agent re-reporting.'));
  if(!src){root.append(el('p','banner','No live intake configured for this project.'));return;}
  root.append(el('p','muted','Action = someone owes a step. Info = a step was recorded or handed off. The old Action stays in the history. '),
    link('https://github.com/'+src.owner+'/'+src.repo+'/issues/'+src.issue,'Open live Timeline intake'));
  renderAutoGeneratedInfo(root,project);
  if(state?.status==='historical'){root.append(el('p','banner','Historical Page revision: current Timeline is separate.'));return;}
  if(state?.status!=='ok'){
    root.append(el('p','banner','Live intake UNKNOWN: '+(state?.error||'no complete GitHub read yet')));return;
  }
  const model=timelineCardModel(state.comments,project);
  const actionCount=model.cards.filter(e=>e.kind==='ACTION').length;
  const infoCount=model.cards.filter(e=>e.kind==='INFO').length;
  root.append(el('p','muted','Observed '+(state.observedAt||'?')+' · '+model.health+
    ' · '+actionCount+' Action · '+infoCount+' Info · '+model.ownerRequests.length+
    ' need Owner · '+model.ignored+' excluded · '+model.unresolved+' unresolved handoffs.'));
  if(model.health==='PARTIAL')root.append(el('p','banner','Some events were invalid, duplicated or have unmatched handoff links.'));
  const owner=el('section','panel');
  owner.append(el('h4',null,'Needs Owner'));
  if(!model.ownerRequests.length)owner.append(el('p','muted','No source-matched outstanding Owner request in this feed.'));
  for(const item of model.ownerRequests){
    const line=el('p');
    line.append(el('b',null,'WBS '+item.wbs+' · '+item.actorAlias),': '+item.ownerAsk+' ',
      link(item.commentUrl,'Action'), ' · ',link(item.source,'source'));
    owner.append(line);
  }
  root.append(owner);
  const controls=el('div','ct-controls');
  controls.append(el('h4',null,'WBS-wise Timeline cards'));
  const list=el('div','ct-list'),counter={mode:'ALL'};
  const show=(mode)=>{
    counter.mode=mode;list.replaceChildren();
    for(const button of controls.querySelectorAll('button'))button.setAttribute('aria-pressed',
      String(button.dataset.mode===mode));
    let visible=0;
    for(const group of model.groups){
      const subset=group.records.filter(e=>mode==='ALL'||e.kind===mode);
      if(!subset.length)continue;
      visible+=subset.length;
      const section=el('section','ct-group');
      const title=group.wbs==='UNRESOLVED_SCOPE'?'Unresolved WBS/card':
        group.wbs==='UNRESOLVED_HANDOFF'?'Unresolved handoff':
        group.wbs==='UNSCOPED'?'Unscoped':'WBS '+group.wbs;
      section.append(el('h4',null,title));
      for(const e of subset)section.append(drawTimelineCard(e,model.events,src));
      list.append(section);
    }
    if(!visible)list.append(el('p','empty','No '+mode.toLowerCase()+' cards observed.'));
  };
  for(const [mode,label] of [['ALL','All'],['ACTION','Action · '+actionCount],['INFO','Info · '+infoCount]]){
    const button=el('button','btn small',label);
    button.type='button';button.dataset.mode=mode;
    button.addEventListener('click',()=>show(mode));controls.append(button);
  }
  root.append(controls,list);show('ALL');
  root.append(el('p','muted','Smart Tags are review suggestions for Roadmap / Plan / WBS / Grounding fixtures. The Page writer checks original sources before an audited Page update. No automatic acceptance or task mutation.'));
}

function drawTimelineCard(e,all,src){
  const box=el('article','ct-card '+(e.kind==='ACTION'?'ct-action':'ct-info'));
  const top=el('div','ct-top');
  top.append(el('span','chip '+(e.kind==='ACTION'?'w':'s'),e.kind),
    el('span','chip',e.state.replaceAll('_',' ')));
  const header=el('div');
  header.append(el('b',null,e.title),el('p','muted',
    e.actorAlias+' ('+e.role+') → '+e.peerAlias+' · '+e.wbs+' · '+e.card));
  box.append(top,header);
  if(e.details)box.append(el('p','ct-description',e.details));
  if(e.ownerAsk)box.append(el('p','ct-owner','Needs Owner: '+e.ownerAsk));
  if(e.next)box.append(el('p','ct-next','Next: '+e.next));
  const tags=el('div','ct-tags');
  for(const tag of e.smartTags||[]){
    const item=link(tag.source,tag.type+' · '+tag.label,'chip');
    tags.append(item);
  }
  if(e.wbs!=='UNSCOPED'&&!(e.smartTags||[]).some(t=>t.type==='WBS'))
    tags.append(el('span','chip','WBS · '+e.wbs));
  if(tags.childNodes.length)box.append(tags);
  renderSmartBadges(box,e.badges);
  const links=el('div','ct-links');
  links.append(link(e.commentUrl,'Timeline event'),' · ',link(e.source,'Source evidence'));
  box.append(links);
  const actions=el('div','ct-tools');
  const copyButton=(label,text)=>{
    const button=el('button','btn small',label);button.type='button';
    button.addEventListener('click',()=>copyText(text,button));actions.append(button);
  };
  if(e.kind==='ACTION')copyButton('Copy → Info handoff template',timelineInfoTemplate(e));
  else copyButton('Copy Page update brief',timelinePageBrief(e));
  actions.append(link('https://github.com/'+src.owner+'/'+src.repo+'/issues/'+src.issue,
    'Post follow-up in GitHub','btn small'));
  box.append(actions);
  const history=all.filter(v=>v.threadId===e.threadId).slice().reverse();
  if(history.length>1){
    const detail=el('details','ct-history');
    detail.append(el('summary',null,'History · '+history.length+' events'));
    for(const h of history){
      const p=el('p','muted',h.kind+' · '+h.state+' · '+h.actorAlias+' · ');
      p.append(link(h.commentUrl,'source event'));detail.append(p);
    }
    box.append(detail);
  }
  box.append(el('p','muted','Reported observation · '+e.scope+' · not a Cycle assignment or Page acceptance'));
  return box;
}
