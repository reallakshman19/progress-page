// Live, public-safe Cycle now via Timeline observations; never the curated Page audit.
import { el, link } from './util.js?v=33';

export const SOURCES = Object.freeze({
  ciifr: Object.freeze({ owner:'reallakshman19', repo:'Common', issue:564 })
});
const FENCE=String.fromCharCode(96).repeat(3);
const HEADER=new RegExp('^CYCLE_TIMELINE_EVENT v1\n'+FENCE+'json\n([\\s\\S]+?)\n'+FENCE+'\\s*$');
const ALIAS=/^[a-z][a-z0-9-]{1,31}$/;
const EVENT=/^[a-z0-9][a-z0-9-]{3,79}$/;
const WBS=/^[1-9]\d{0,2}(?:\.[1-9]\d{0,2}){0,3}$/;
const SOURCE=/^https:\/\/github\.com\/[a-z0-9_.-]+\/[a-z0-9_.-]+\/(?:issues\/[1-9]\d*|pull\/[1-9]\d*|commit\/[a-f0-9]{40})(?:#issuecomment-[1-9]\d*)?$/i;
const PRIVATE=/(?:chatgpt\.com\/c\/|chat\.openai\.com\/|claude\.ai\/chat\/|antigravity\.google\.com\/|drive\.google\.com\/|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
const ROLES=new Set(['CODER','ORACLE','REVIEWER_IR']);
const STATUSES=new Set(['WORKING','BLOCKED','NEEDS_OWNER','WAITING','RETURN_POSTED','REVIEWING','NO_ACTION']);
const REQUIRED=['project','eventId','actorAlias','peerAlias','role','wbs','card','status','ownerAsk','next','source','fixtureRefs'];

export function parseCycleTimelineComment(comment, project) {
  if(!comment||typeof comment.body!=='string'||comment.body.length>6000||
     !Number.isInteger(comment.id)||!SOURCE.test(comment.html_url||'')||
     !Number.isFinite(Date.parse(comment.created_at||''))) return null;
  const match=HEADER.exec(comment.body.replace(/\r\n/g,'\n').trim());
  if(!match||PRIVATE.test(comment.body))return null;
  let data;
  try {data=JSON.parse(match[1]);} catch {return null;}
  if(!data||typeof data!=='object'||Array.isArray(data)||
     Object.keys(data).sort().join()!==REQUIRED.slice().sort().join()||
     data.project!==project||!EVENT.test(data.eventId||'')||
     !ALIAS.test(data.actorAlias||'')||
     !(data.peerAlias==='NO_DIRECT_PEER'||ALIAS.test(data.peerAlias||''))||
     !ROLES.has(data.role)||!STATUSES.has(data.status)||
     !(data.wbs==='UNSCOPED'||WBS.test(data.wbs||''))||
     !(data.card==='UNSCOPED'||ALIAS.test(data.card||''))||
     typeof data.ownerAsk!=='string'||data.ownerAsk.length>300||
     typeof data.next!=='string'||!data.next.trim()||data.next.length>350||
     !SOURCE.test(data.source||'')||!Array.isArray(data.fixtureRefs)||
     data.fixtureRefs.length>8||
     !data.fixtureRefs.every(x=>typeof x==='string'&&SOURCE.test(x))||
     (data.status==='NEEDS_OWNER'?!data.ownerAsk.trim():!!data.ownerAsk.trim()))return null;
  return {...data,commentId:comment.id,at:comment.created_at,commentUrl:comment.html_url,
    provenance:'REPORTED_UNVERIFIED'};
}

export async function loadCycleTimeline(project,fetcher=fetch) {
  const src=SOURCES[project];
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

export function renderCycleTimeline(root,project,state) {
  const src=SOURCES[project?.index?.project?.key];
  root.append(el('h3',null,'Cycle now via Timeline'),
    el('p','muted','Agent-reported activity; NOT canonical Cycle assignment, audited Page update, verified chat identity, fixture delivery or engineering acceptance. Full chat IDs remain private.'));
  if(!src){root.append(el('p','banner','No live intake configured for this project.'));return;}
  root.append(el('p','muted','Public operational intake: '),
    link('https://github.com/'+src.owner+'/'+src.repo+'/issues/'+src.issue,'Open live timeline issue'));
  if(state?.status==='historical'){
    root.append(el('p','banner','Historical Page revision: live current agent claims are intentionally excluded.'));return;
  }
  if(state?.status!=='ok'){
    root.append(el('p','banner','Live status UNKNOWN: GitHub intake was not completely retrieved. '+
      (state?.error||'No successful observation yet.')));return;
  }
  const model=cycleTimelineModel(state.comments,project);
  root.append(el('p','muted','Last source read '+(state.observedAt||'UNKNOWN')+' · '+model.health+
    ' · '+model.events.length+' valid claims · '+model.ignored+' excluded. Reported status is not authenticated.'));
  if(model.health==='PARTIAL')root.append(el('p','banner',
    'Some source comments were invalid or duplicated; excluded, not silently interpreted.'));
  const owner=el('section','panel');
  owner.append(el('h4',null,'Needs Owner · reported'));
  if(!model.ownerRequests.length)owner.append(el('p','muted',
    'No latest source-matched claim asks for Owner action; this does not prove all work is unblocked.'));
  for(const e of model.ownerRequests) {
    const row=el('p');
    row.append(el('b',null,'WBS '+e.wbs+' · '+e.actorAlias+' ('+e.role+')'),
      ': '+e.ownerAsk+' ',link(e.commentUrl,'event'),' · ',link(e.source,'native source'));
    owner.append(row);
  }
  root.append(owner,el('h4',null,'WBS-wise agent reports'));
  if(!model.groups.length)root.append(el('p','empty',
    'No valid public-safe events have been posted. The board does not imply anyone has checked in.'));
  for(const g of model.groups) {
    const box=el('section','panel');
    box.append(el('h4',null,g.wbs==='UNRESOLVED_SCOPE'?'Unresolved WBS/card identity':
      g.wbs==='UNSCOPED'?'Unscoped source reports':'WBS '+g.wbs));
    for(const e of g.records){
      const row=el('div','tl-row'),detail=el('div','tl-m');
      row.append(el('span','chip',e.status.replaceAll('_',' ')));
      detail.append(el('b',null,e.actorAlias+' · '+e.role),
        el('p','muted','Peer '+e.peerAlias+' · card '+e.card+' · '+e.provenance+' · '+e.scope),
        el('p',null,e.next),link(e.commentUrl,'event'),' · ',link(e.source,'source'));
      if(e.fixtureRefs.length)detail.append(el('p','muted',
        e.fixtureRefs.length+' fixture reference candidates; access and bytes NOT VERIFIED'));
      row.append(detail);box.append(row);
    }
    root.append(box);
  }
  root.append(el('p','muted',
    'Oracle reconciliation → canonical Cycle; designated Page writer → audited WBS tiles, source fixtures and My actions. No automatic write or binding.'));
}
