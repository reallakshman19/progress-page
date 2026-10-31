// Task Evidence v2 — frozen five-line, read-only Owner projection.
// Never infer acceptance, execution, delivery, source authentication or permission
// from a Board card, a GitHub URL, a copied prompt, or unstructured prose.
import {el,link} from './util.js?v=34';

const SITE='https://reallakshman19.github.io/progress-page/#/';
const ISSUE=/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/([1-9]\d*)$/;
const PR=/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/([1-9]\d*)$/;
const COMMENT=/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/([1-9]\d*)#issuecomment-([1-9]\d*)$/;
const safe=x=>typeof x==='string'?x.replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').trim().slice(0,240):'';
const part=text=>({text:String(text)});
const href=(text,url)=>({text,url});
const isSafeLink=u=>ISSUE.test(u||'')||PR.test(u||'')||COMMENT.test(u||'')||
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(u||'')||
  /^https:\/\/reallakshman19\.github\.io\/progress-page\/#\/[a-z0-9-]+\/cycle-board$/.test(u||'')||
  /^https:\/\/reallakshman19\.github\.io\/progress-page\/#\/adhoc\/topo-[ab]\/cycle-board$/.test(u||'');
const titlePart=(label,url)=>isSafeLink(url)?href(label,url):part(label);
const line=(name,...pieces)=>({name,parts:pieces});
const commentUrl=(issue,id)=>issue+'#issuecomment-'+id;
const currentIssueComment=(c,issue)=>{
 const url=c?.url||c?.html_url||'';
 const m=COMMENT.exec(url);
 return !!m&&url.startsWith(issue+'#issuecomment-')&&Number(m[4])===Number(c?.id)&&
  typeof c?.body==='string'&&typeof c?.author==='string';
};
const reportedReturn=(c,key)=>key==='topo-a'?
 /TOPO-A\s*[—-]\s*Cycle now\s*\/\s*read-only evidence return/i.test(c.body):
 key==='topo-b'?
 /TOPO-B\b.{0,70}Cycle-now bounded read-only evidence return/i.test(c.body):false;
const acceptedKind=key=>key==='topo-a'?'READ_ONLY_SOURCE_TRACE':
 key==='topo-b'?'READ_ONLY_FORMAT_CONTRACT':null;

function nativeClaim(row,feed){
 const empty={returnComment:null,acceptance:null,sourceComment:null,
  readOnly:'TOTAL UNKNOWN',current:'TOTAL UNKNOWN',work:'No verified native evidence summary',
  next:null,tests:'UNKNOWN',status:'UNKNOWN'};
 if(!feed||!['ok','partial'].includes(feed.status)||feed.issue!==row.source)return empty;
 const comments=(feed.comments||[]).filter(c=>currentIssueComment(c,row.source));
 const key=row.key,kind=acceptedKind(key);
 const returns=comments.filter(c=>reportedReturn(c,key));
 const returned=returns.at(-1)||null;
 const accepts=kind&&returned?comments.filter(c=>
  c.body.includes('Accepted as '+kind)&&
  c.body.includes('#issuecomment-'+returned.id)&&
  comments.indexOf(c)>comments.indexOf(returned)):[];
 const acceptance=accepts.at(-1)||null;
 const sourceComments=comments.filter(c=>
  /Oracle-only (?:original-source read-through|format\/source reconciliation)/i.test(c.body));
 const sourceComment=sourceComments.at(-1)||null;
 let current='TOTAL UNKNOWN',tests='UNKNOWN',next=null,work='';
 if(key==='topo-a'){
  const assigned=acceptance&&/3-case closure falsifier/i.test(acceptance.body);
  const after=acceptance?comments.slice(comments.indexOf(acceptance)+1):[];
  const newCandidate=after.some(c=>!sourceComments.includes(c)&&
   !/Oracle Cycle now|Oracle-only/i.test(c.body));
  current=assigned&&!newCandidate?'0/3 executed falsifiers returned':
    assigned?'RECONCILE NEW RETURN / 3 assigned':'TOTAL UNKNOWN';
  tests=assigned&&!newCandidate?'NOT_RUN / 3 assigned (no execution return)':'UNKNOWN';
  next=assigned?'Run 3 synthetic closure falsifiers in isolated scratch':null;
  work=returned?'Read-only CLOS matrix returned':'Read-only matrix not observed';
  if(sourceComment&&/41 branches\s*\/\s*1,654/i.test(sourceComment.body)&&
   /240\.6 mm/i.test(sourceComment.body))work+='; Oracle-reported source: 41 branches / 1,654 nodes, 240.6 mm';
 }else if(key==='topo-b'){
  const assigned=acceptance&&/Appendix A A1.A5/i.test(acceptance.body);
  current=assigned?'Runtime checks: TOTAL UNKNOWN; Appendix A: 0/5 returned':'TOTAL UNKNOWN';
  tests='UNKNOWN (native runtime result not observed)';
  next=assigned?'Run public F05/R4 strict-reader positive and negative checks plus Appendix A A1–A5':null;
  work=returned?'Read-only format-admission contract returned':'Format contract not observed';
  if(sourceComment&&/521 PIPINGELEMENT/i.test(sourceComment.body)&&
    /56 source elements/i.test(sourceComment.body))work+='; Oracle-reported F05/R4: 56 each; GLRD: 521';
 }
 return {
  returnComment:returned,acceptance,sourceComment,
  readOnly:returned&&acceptance?'1/1 read-only deliverable returned; Oracle acceptance reported':
   returned?'1 native read-only return; acceptance UNKNOWN':'0 native read-only returns observed; total UNKNOWN',
  current,work,tests,next,
  status:feed.status
 };
}

// Reads only the original issue comments + exact explicitly related PRs.
// Unlike Page data this can observe recent native returns; no new report/schema.
export async function loadTaskEvidenceNative(issue,{prs=[],fetcher=fetch,clock=()=>new Date().toISOString()}={}){
 const m=ISSUE.exec(issue||'');
 if(!m)return {status:'unknown',issue:null,comments:[],prs:[],reason:'INVALID_ISSUE'};
 const base='https://api.github.com/repos/'+m[1]+'/'+m[2];
 const expected=base+'/issues/'+m[3]+'/comments?per_page=100';
 try{
  const response=await fetcher(expected,{cache:'no-store'});
  if(!response?.ok)throw Error('HTTP '+(response?.status||'UNKNOWN'));
  const raw=await response.json();
  if(!Array.isArray(raw))throw Error('COMMENT_RESPONSE_NOT_ARRAY');
  const comments=raw.map(c=>({
   id:c?.id,url:c?.html_url,author:c?.user?.login,body:c?.body,
   createdAt:c?.created_at,updatedAt:c?.updated_at
  }));
  if(comments.some(c=>!currentIssueComment(c,issue)))
   throw Error('COMMENT_IDENTITY_MISMATCH');
  const prRecords=await Promise.all(prs.map(async u=>{
   const p=PR.exec(u||'');if(!p)return {url:u,status:'UNKNOWN'};
   try{
    const prResponse=await fetcher('https://api.github.com/repos/'+p[1]+'/'+p[2]+'/pulls/'+p[3],
     {cache:'no-store'});
    if(!prResponse.ok)throw Error('PR_READ_FAIL');
    const data=await prResponse.json();
    if(data?.number!==Number(p[3])||data?.html_url!==u||!/^[a-f0-9]{40}$/i.test(data?.head?.sha||''))
     throw Error('PR_IDENTITY_MISMATCH');
    return {url:u,status:data.merged_at?'MERGED':data.state==='open'&&data.draft?'DRAFT':
      data.state==='open'?'OPEN':data.state==='closed'?'CLOSED':'UNKNOWN',
     revision:data.head.sha};
   }catch(error){return {url:u,status:'UNKNOWN',reason:safe(String(error))};}
  }));
  return {issue,comments,prs:prRecords,observedAt:clock(),
   status:raw.length>=100||prRecords.some(p=>p.status==='UNKNOWN')?'partial':'ok',
   reason:raw.length>=100?'COMMENT_PAGINATION_UNVERIFIED':null};
 }catch(error){
  return {issue,comments:[],prs:[],status:'unknown',observedAt:null,
   reason:safe(String(error?.message||error))};
 }
}

export function taskEvidenceV2Model(row,{projectKey=row?.key||'UNKNOWN',
 project=null,feed=null,observations=[],pageFetch=null}={}){
 if(!row)return null;
 const native=row.sourceType==='NATIVE_TASK';
 const claim=nativeClaim(row,feed);
 const match=ISSUE.exec(row.source||'')||PR.exec(row.source||'');
 const repo=match?match[1]+'/'+match[2]:'REPOSITORY UNKNOWN';
 const repoUrl=match?'https://github.com/'+repo:null;
 const pageUrl=native&&/^topo-[ab]$/.test(row.key||'')?SITE+'adhoc/'+row.key+'/cycle-board':
  SITE+encodeURIComponent(projectKey)+'/cycle-board';
 const related=(native?feed?.prs:row.prRefs||[])||[];
 const prs=related.filter(p=>p?.url&&PR.test(p.url)).slice(0,4);
 const prText=prs.length?prs.map(p=>'#'+PR.exec(p.url)[3]+' '+(p.status||'STATUS UNKNOWN')).join(' / '):
  'NONE VERIFIED';
 const sourceRevision=observations.find(o=>o.source===row.source)?.revision||row.sourceRevision;
 const sourceOK=!!sourceRevision;
 const pageOK=native||pageFetch?.status==='ok';
 const current=native&&feed?.status==='ok'&&sourceOK?'CURRENT':
   (sourceOK||pageOK||feed?.status==='partial')?'PARTIAL':'UNKNOWN';
 const last=native&&claim.acceptance?claim.acceptance.createdAt||'UNKNOWN':'NOT_VERIFIED';
 const observed=native?feed?.observedAt||'NOT_VERIFIED':pageFetch?.observedAt||'NOT_VERIFIED';
 const state=safe(row.state||'UNKNOWN');
 const progress=native?claim.readOnly+' · Current task: '+claim.current:
  'Completed/agreed: TOTAL UNKNOWN · Card state: '+state+' · Current task: TOTAL UNKNOWN';
 const authority=native&&claim.acceptance?'Oracle-reported '+acceptedKind(row.key)+' (technical acceptance NOT VERIFIED)':
  'Acceptance: NOT_VERIFIED';
 const work=native?claim.work:safe(row.work||row.recordedNow||'Recorded task; measurable work not authenticated');
 const tests=native?claim.tests:'UNKNOWN (no authenticated test totals)';
 const returnUrl=native?claim.returnComment?.url:row.returnUrl;
 const reviewUrl=native?claim.acceptance?.url:null;
 const reportedReturn=native&&claim.returnComment?'1 native return claim':'0 native return claims observed';
 const hold=native?'Engineering HOLD':/\bHOLD\b/i.test((row.recordedNow||'')+' '+state)?
  'Recorded HOLD; authority unverified':'Engineering authority UNKNOWN';
 const actor=native?'AGENT':/^(?:Agent|Builder|Oracle|Owner|IR|Reviewer)(?:\b|$)/i.test(row.nextActor||'')?
  safe(row.nextActor).split(/[\/,+]/)[0]:'ACTOR UNKNOWN';
 const nextAction=native?claim.next||'Verify authoritative native next task before execution':
  safe(row.recordedNext||'Verify existing native assignment before execution');
 const perm=native?'READ_ONLY; no production changes authorized':
  'Check original task and active authority; Board does not grant permission';
 const lines=[
  line('1. TASK',titlePart(repo,repoUrl),part(' · WBS '+(row.wbs||'UNKNOWN')+' · '),
   titlePart(match&&ISSUE.test(row.source)?'Issue #'+match[3]:'Native task',row.source),
   part(' · PR: '+(prs.length?'':'NONE VERIFIED')),
   ...prs.flatMap((p,i)=>[...(i?[part(' / ')]:[]),titlePart('#'+PR.exec(p.url)[3]+' '+(p.status||'STATUS UNKNOWN'),p.url)]),
   part(' · '),titlePart('Progress Page',pageUrl)),
  line('2. PROGRESS',part(progress+' · '+authority)),
  line('3. WORK & PROOF',part(work+' · '),
   ...(returnUrl&&isSafeLink(returnUrl)?[href('Agent evidence',returnUrl),part(' · ')]:[]),
   ...(claim.sourceComment?.url&&isSafeLink(claim.sourceComment.url)?
    [href('Oracle source observation',claim.sourceComment.url),part(' · ')]:[]),
   part('Tests: '+tests)),
  line('4. BLOCKERS & RELAY',part(reportedReturn+' · '),
   ...(returnUrl&&isSafeLink(returnUrl)?[href('Native return',returnUrl),part(' · ')]:[]),
   ...(reviewUrl&&isSafeLink(reviewUrl)?[href('Oracle review (reported)',reviewUrl),part(' · ')]:[]),
   part('Review: '+(reviewUrl?'Oracle-reported; independent review HOLD':'NOT_VERIFIED')+
    ' · '+hold+(native&&feed?.status!=='ok'?' · source coverage '+(feed?.status||'UNKNOWN'):'') )),
  line('5. NEXT → '+actor,part(nextAction+' → '),
   titlePart('Return to original task',row.source),
   part(' · '+perm))
 ];
 return {schema:'task-evidence.v2/read-only',title:(native?row.key.toUpperCase():projectKey)+' / '+safe(row.label||row.id||'TASK'),
  lastReconciled:last,observedAt:observed,sourceStatus:current,lines,
  nativeReturn:reportedReturn,acceptance:authority,canAuthorize:false,
  sourceRevision:sourceRevision||null,readOnly:true,
  nativeNext:native?claim.next:null,nextSourceUrl:reviewUrl||null};
}

export function taskEvidenceV2Text(model){
 if(!model)return '';
 return 'TASK EVIDENCE v2 · '+model.title+'\n'+
  'Last reconciled: '+model.lastReconciled+' · Source status: '+model.sourceStatus+
  ' · Source observed: '+model.observedAt+'\n'+
  model.lines.map(l=>l.name+': '+l.parts.map(p=>p.text).join('')).join('\n');
}
export function renderTaskEvidenceV2(root,model){
 if(!model)return null;
 const box=el('article','task-evidence-v2');
 box.setAttribute('aria-label','Task Evidence v2 · '+model.title);
 box.append(el('h5',null,'TASK EVIDENCE v2 · '+model.title),
  el('p','muted te-meta','Last reconciled: '+model.lastReconciled+
  ' · Source status: '+model.sourceStatus+' · Source observed: '+model.observedAt));
 if(model.lines.length!==5)throw Error('Task Evidence v2 requires exactly five information lines');
 for(const item of model.lines){
  const p=el('p','te-line');
  p.append(el('b',null,item.name+': '));
  for(const piece of item.parts){
   if(piece.url&&isSafeLink(piece.url))p.append(link(piece.url,piece.text));
   else p.append(piece.text);
  }
  box.append(p);
 }
 root.append(box);
 return box;
}
