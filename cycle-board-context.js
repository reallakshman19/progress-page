// CT-1 read-only Cycle Board context. No task dispatch, acceptance, or Page mutation.
export const BOARD_SCHEMA='cycle-board.context/v1';
const CB_GH=/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/(issues|pull)\/([1-9]\d*)$/;
const CB_ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
// Explicit pilot sources are task references, not a standalone Cycle mapping.
// CT-2 must classify differences; CT-1 only displays observed source facts.
export const BOARD_SOURCES=Object.freeze({
  'ciifr-node':Object.freeze({wbs:'2',card:'node-r0-code',sources:Object.freeze([
    'https://github.com/reallakshman19/XML_Compare_Utilities/issues/231',
    'https://github.com/reallakshman19/XML_Compare_Utilities/pull/232'
  ])})
});
export const hasBoardNativeSources=key=>Object.hasOwn(BOARD_SOURCES,key);
export function sourceOccurrence(item){
  const m=CB_GH.exec(item?.url||'');
  if(!m)return null;
  const repo=m[1]+'/'+m[2],number=Number(m[4]);
  if(m[3]==='pull'&&/^[a-f0-9]{40}$/i.test(item.headSha||''))
    return 'github:'+repo+':pr-head:'+number+':'+item.headSha.toLowerCase();
  if(m[3]==='issues'&&CB_ISO.test(item.sourceAt||''))
    return 'github:'+repo+':issue-version:'+number+':'+item.sourceAt;
  return null; // No made-up immutable occurrence for failed/partial source reads.
}
export function collectBoardNative(key,records,observedAt){
  const configured=BOARD_SOURCES[key];
  if(!configured)return {status:'NOT_CONFIGURED',observedAt:null,sources:[],errors:[]};
  const sources=[],errors=[];
  for(const [i,url] of configured.sources.entries()){
    const r=records?.[i];
    if(!r||r.error||r.url!==url){errors.push({url,reason:r?.error||'NOT_OBSERVED'});continue;}
    const item={url,kind:r.kind,headSha:r.headSha||null,sourceAt:r.sourceAt||null,
      observedAt,immutableEventId:null,claim:'REPORTED_UNVERIFIED',evidenceStatus:'SOURCE_LINKED',
      state:r.state||'UNKNOWN',draft:r.draft===true,merged:r.merged===true,
      title:String(r.title||'').slice(0,150)};
    item.occurrenceId=sourceOccurrence(item);
    if(!item.occurrenceId){errors.push({url,reason:'MISSING_EXACT_OCCURRENCE'});continue;}
    sources.push(item);
  }
  return {status:errors.length?(sources.length?'PARTIAL':'UNKNOWN'):'COMPLETE',
    observedAt:sources.length?observedAt:null,sources,errors};
}
export async function loadBoardNative(key,fetcher=fetch,clock=()=>new Date().toISOString()){
  const config=BOARD_SOURCES[key];
  if(!config)return collectBoardNative(key,[],null);
  const records=await Promise.all(config.sources.map(async url=>{
    const m=CB_GH.exec(url);
    if(!m)return {url,error:'INVALID_SOURCE'};
    const api='https://api.github.com/repos/'+m[1]+'/'+m[2]+'/'+(m[3]==='pull'?'pulls':'issues')+'/'+m[4];
    try{
      const res=await fetcher(api,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
      if(!res?.ok)throw Error('HTTP '+(res?.status||'UNKNOWN'));
      const j=await res.json();
      const pr=m[3]==='pull';
      return {url,kind:pr?'PR_HEAD':'ISSUE_VERSION',headSha:pr?j?.head?.sha:null,
        sourceAt:j?.updated_at||null,state:j?.state||'UNKNOWN',draft:pr?j?.draft:false,
        merged:pr?j?.merged:false,title:j?.title||''};
    }catch(e){return {url,error:String(e?.message||e)};}
  }));
  return collectBoardNative(key,records,clock());
}
export function buildBoardContext(project,{native=null,pageObservedAt=null,cycle=null}={}){
  const index=project?.index||{},key=index.project?.key||'',config=BOARD_SOURCES[key]||null;
  const milestones=index.milestones||{},cards=project?.cards||{},events=project?.audit?.events||[];
  const selected=config?Object.entries(milestones).find(([,m])=>m.wbs===config.wbs):null;
  const milestoneId=selected?.[0]||null,card=config?.card&&cards[config.card]||null;
  const mapping=selected&&card?.milestone===milestoneId?'SOURCE_MATCHED':'UNMAPPED';
  const rev=(index.revisions||[]).find(r=>r.status==='current')?.id||null;
  const pageEvents=events.filter(e=>config&&(e?.card===config.card||e?.scope==='milestone:'+milestoneId))
    .filter(e=>/^https:\/\/github\.com\//.test(e.source||'')).slice(-6).map(e=>({
      auditId:e.id,source:e.source,kind:e.kind,at:e.at,summary:e.summary,
      occurrenceId:'page-audit:'+key+':'+e.id
    }));
  const validNative=native||{status:'NOT_CHECKED',sources:[],errors:[],observedAt:null};
  const binding=cycle?.binding==='SCOPED'?'SCOPED':'UNMAPPED';
  const badges=mapping==='SOURCE_MATCHED'?[
    key+'/AIM/project',key+'/WBS/'+config.wbs
  ]:[];
  return {schema:BOARD_SCHEMA,project:key,observedAt:validNative.observedAt||null,
    coverage:validNative.status==='COMPLETE'?'COMPLETE':validNative.status==='PARTIAL'?'PARTIAL':'UNKNOWN',
    scope:{wbs:config?.wbs||null,pageCard:config?.card||null,mapping,pageRevision:rev,
      milestone:milestoneId,aim:index.project?.aim||null,aimSrc:index.project?.aimSrc||null},
    cycle:{binding,activation:binding==='SCOPED'?(cycle.activation||'UNKNOWN'):'UNKNOWN',
      canonicalRevision:binding==='SCOPED'?(cycle.canonicalRevision||null):null,
      assignmentId:null,generation:null,recipientRole:null,candidate:null,
      authority:'NOT_ESTABLISHED'},
    page:{observedAt:pageObservedAt,events:pageEvents,recordedNext:card?.next?.text||null,
      recordedSource:card?.src||null,recordedState:card?.state||null},
    sources:validNative.sources||[],readErrors:validNative.errors||[],
    delta:{native:'UNKNOWN',page:'UNKNOWN',receipt:'NOT_APPLICABLE',conflicts:[]},
    next:{advice:'UNKNOWN_STOP',responsibleRole:null,sourceOccurrenceIds:[]},
    publication:{status:'NOT_CHECKED',auditEventIds:pageEvents.map(e=>e.auditId)},
    badgeIds:badges};
}
