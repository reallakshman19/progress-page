// CT-1: read-only source-bound Cycle Board context. No Cycle dispatch, Page write,
// automatic IR PASS, or new agent posting requirement. GitHub public sources ONLY.
import { el, link } from './util.js?v=34';
import { smartBadgesForScope, renderSmartBadges } from './smart-badges.js?v=34';

// Explicit native-source pilot, not inferred from a Page key, mode, or PR title.
// Adding a locator enables observation, NOT an Oracle Cycle or WBS publication.
export const BOARD_NATIVE_SOURCES=Object.freeze({
  'ciifr-node':Object.freeze([
    Object.freeze({repo:'reallakshman19/XML_Compare_Utilities',kind:'pull',number:232,milestone:'M3',label:'Repair candidate · PR #232'}),
    Object.freeze({repo:'reallakshman19/XML_Compare_Utilities',kind:'issue',number:231,milestone:'M3',label:'Native repair task · issue #231'})
  ])
});
const API='https://api.github.com/repos/';
const SOURCE_RE=/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:issues|pull)\/\d+$/;
const SHA_RE=/^[0-9a-f]{40}$/;
// Native titles are untrusted and public display is unnecessary for identity.
// Fail closed on URLs, long opaque credentials, emails or private chat IDs;
// render a neutral label instead of trying to redact only a substring.
const sensitive=/https?:\/\/|chatgpt\.com|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{15,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:token|password|secret|authorization)\s*[:=]/i;
const safeTitle=x=>typeof x==='string'&&x.length<=180&&!sensitive.test(x)?
  x.replace(/[\r\n\t]/g,' ').trim()||'Source title unavailable':'Source title unavailable';

export const boardSourceConfigured=key=>Object.hasOwn(BOARD_NATIVE_SOURCES,key);

export async function loadBoardNative(key,fetcher=fetch,clock=()=>new Date().toISOString()){
  const configured=BOARD_NATIVE_SOURCES[key];
  if(!configured)return {status:'not_configured',observedAt:null,observations:[],failures:[]};
  const observations=[],failures=[];
  await Promise.all(configured.map(async (src)=>{
    const api=API+src.repo+'/'+(src.kind==='pull'?'pulls':'issues')+'/'+src.number;
    const url='https://github.com/'+src.repo+'/'+(src.kind==='pull'?'pull':'issues')+'/'+src.number;
    try{
      const response=await fetcher(api,{cache:'no-store'});
      if(!response?.ok)throw Error('HTTP '+(response?.status||'UNKNOWN'));
      const body=await response.json();
      if(body?.number!==src.number||body?.html_url!==url)throw Error('Source identity mismatch');
      const at=clock();
      if(!Number.isFinite(Date.parse(at)))throw Error('Invalid observation clock');
      let occurrenceId,version,state,qualification;
      if(src.kind==='pull'){
        if(!SHA_RE.test(body.head?.sha||''))throw Error('Exact PR head unavailable');
        version=body.head.sha;
        occurrenceId='github:'+src.repo+':pull-head:'+src.number+':'+version;
        state=body.merged_at?'MERGED':body.draft?'DRAFT':body.state==='open'?'OPEN':'CLOSED';
        qualification=/\bSELF_ASSESSED\b/i.test(body.body||'')?'SELF_ASSESSED':'NATIVE_OBSERVED';
      }else{
        if(!Number.isFinite(Date.parse(body.updated_at||'')))throw Error('Issue revision unavailable');
        version=body.updated_at;
        occurrenceId='github:'+src.repo+':issue-revision:'+src.number+':'+version;
        state=body.state==='open'?'OPEN':body.state==='closed'?'CLOSED':'UNKNOWN';
        qualification=/\bSELF_ASSESSED\b/i.test(body.body||'')?'SELF_ASSESSED':'NATIVE_OBSERVED';
      }
      observations.push({occurrenceId,kind:src.kind.toUpperCase(),number:src.number,
        milestone:src.milestone,label:src.label,title:safeTitle(body.title),
        source:url,revision:version,sourceAt:body.updated_at||null,observedAt:at,
        state,qualification,reportedHold:/\bGATE_R0\s+HOLD\b/i.test(body.body||''),
        technicalPass:'NOT_ESTABLISHED',authority:'NOT_ESTABLISHED'});
    }catch(e){failures.push({source:url,error:String(e.message||e).slice(0,140)});}
  }));
  observations.sort((a,b)=>a.number-b.number);
  return {status:failures.length?(observations.length?'partial':'unknown'):'ok',
    observedAt:observations.length?observations.map(o=>o.observedAt).sort().at(-1):null,
    observations,failures};
}

// Browser-friendly projection of Page + observed native facts. No authority
// upgrade: published Page, reported native claims and Cycle are separate axes.
export function cycleBoardContextModel(project,{native=null,autoCards=[],cycleStatus='UNMAPPED',
  pageFetch=null,historical=false}={}){
  const idx=project?.index||{},key=idx.project?.key||'UNKNOWN',milestones=idx.milestones||{};
  const cards=project?.cards||{},audit=(project?.audit?.events||[]);
  const n=historical?{status:'historical',observedAt:null,observations:[],failures:[]}:
    native||{status:boardSourceConfigured(key)?'loading':'not_configured',observedAt:null,observations:[],failures:[]};
  const currentRevision=(idx.revisions||[]).find(r=>r.status==='current')?.id||'UNKNOWN';
  const current=Object.entries(cards).filter(([,c])=>!c.closed).sort((a,b)=>
    (Date.parse(b[1].updatedAt||'')||0)-(Date.parse(a[1].updatedAt||'')||0))[0]||null;
  const latestPage=audit.slice().reverse().find(e=>typeof e.summary==='string'&&e.summary&&
    SOURCE_RE.test(e.source||''))||null;
  const sources=(n.observations||[]).map(e=>{
    const milestone=milestones[e.milestone]||null;
    const mapped=!!milestone?.wbs;
    const badges=mapped?smartBadgesForScope(project,{milestoneId:e.milestone}):[];
    return {...e,wbs:mapped?milestone.wbs:null,
      scope:mapped?'SOURCE_MATCHED':'UNMAPPED',badges};
  });
  const coverage=n.status==='ok'?'COMPLETE':n.status==='partial'?'PARTIAL':'UNKNOWN';
  return {schema:'cycle-board.context/v1',project:key,revision:currentRevision,
    aim:idx.project?.aim||'UNKNOWN',aimSrc:idx.project?.aimSrc||null,
    page:{status:pageFetch?.status||'UNKNOWN',observedAt:pageFetch?.observedAt||null,
      latestId:latestPage?.id||null,latestAt:latestPage?.at||null,
      latestSource:latestPage?.source||null,latestSummary:latestPage?.summary||null},
    cycle:{status:historical?'HISTORICAL':cycleStatus||'UNMAPPED',authority:'NOT_ESTABLISHED'},
    native:{status:n.status,coverage,observedAt:n.observedAt,failures:n.failures||[]},
    sources,autoCount:autoCards.length,current:current?{cardId:current[0],
      label:current[1].label||current[0],state:current[1].state||'UNKNOWN',
      wbs:milestones[current[1].milestone]?.wbs||null,
      recordedNext:current[1].next?.text||null,
      recordedActor:current[1].next?.actor||'UNKNOWN',
      source:SOURCE_RE.test(current[1].src||'')?current[1].src:null,
      badges:smartBadgesForScope(project,{cardId:current[0],continuity:true})}:null};
}

export function renderCycleBoardContext(root,model) {
  const section=el('section','cb-context');
  section.append(el('h4',null,'Source-bound current context'),
    el('p','muted','Read-only Page and native-source observations. No new agent report, Cycle authorization, independent review PASS or Page publication.'));
  const facts=el('div','cb-facts');
  for(const [name,value] of [
    ['Project',model.project],['Published WBS revision',model.revision],
    ['Native coverage',model.native.coverage],
    ['Native observed',model.native.observedAt||'UNKNOWN'],
    ['Canonical Cycle',model.cycle.status+' · authority NOT ESTABLISHED'],
    ['Published Page fetch',model.page.status+' · '+(model.page.observedAt||'UNKNOWN')]
  ]){
    const fact=el('div','cb-fact');
    fact.append(el('span','muted',name),el('strong',null,String(value)));
    facts.append(fact);
  }
  section.append(facts);
  if(model.current){
    const p=el('section','cb-current');
    p.append(el('h4',null,'Recorded Page work item · not a live assignment'),
      el('b',null,model.current.label+' · '+(model.current.wbs?'WBS '+model.current.wbs:'WBS UNMAPPED')),
      el('p','muted','Published card state: '+model.current.state));
    if(model.current.recordedNext)p.append(el('p',null,'Recorded next (may be stale): '+model.current.recordedNext+
      ' · actor '+model.current.recordedActor));
    if(model.current.source)p.append(link(model.current.source,'Original Page card evidence','btn small'));
    renderSmartBadges(p,model.current.badges);
    section.append(p);
  }else section.append(el('p','muted','No recorded current Page card. Not proof of no work.'));
  if(model.sources.length){
    const native=el('section','cb-native');
    native.append(el('h4',null,'Explicit native evidence · independently unverified'));
    for(const s of model.sources){
      const card=el('article','cb-source');
      card.append(el('b',null,s.label+' · '+s.state),
        el('p',null,s.title),
        el('p','muted','WBS '+(s.wbs||'UNMAPPED')+' · '+s.qualification+
          ' · technical PASS NOT ESTABLISHED'+(s.reportedHold?' · source reports GATE_R0 HOLD':'')));
      card.append(el('p','muted','Source revision: '+s.revision+
        ' · updated: '+(s.sourceAt||'UNKNOWN')+' · observed: '+s.observedAt));
      card.append(link(s.source,'Open original native evidence','btn small'));
      renderSmartBadges(card,s.badges);
      native.append(card);
    }
    section.append(native);
  }
  if(model.native.status==='not_configured')
    section.append(el('p','banner','No extra native-source intake configured. Published Page information remains available; this does not imply agents are idle.'));
  else if(model.native.status==='loading')
    section.append(el('p','banner','Native evidence observation pending; Page audit remains independently available.'));
  else if(model.native.status==='historical')
    section.append(el('p','banner','Historical Page snapshot; no current native status or Cycle is blended into this revision.'));
  if(model.native.failures?.length||model.native.status==='unknown'||model.native.status==='partial'){
    const warn=el('div','banner');
    warn.append('Native-source coverage '+model.native.coverage+'. Unknown sources: ');
    for(const f of model.native.failures||[])warn.append(el('p',null,f.source+' · '+f.error));
    section.append(warn);
  }
  const pub=el('p','muted','Previously published Page-audit INFO-Auto snapshots: '+model.autoCount+
    '. These are reused evidence, not new engineering achievements.');
  section.append(pub);
  if(model.page.latestSource){
    const p=el('p','muted');
    p.append('Latest source-backed Page audit '+(model.page.latestId||'UNKNOWN')+' · ',
      link(model.page.latestSource,'original source'));
    section.append(p);
  }
  root.append(section);
}
