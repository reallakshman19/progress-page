// Task Evidence v2 — frozen five-line, read-only Owner projection.
// Never infer acceptance, execution, delivery, source authentication or permission
// from a Board card, a GitHub URL, a copied prompt, or unstructured prose.
import {el,link} from './util.js?v=34';

const TE2_SITE='https://reallakshman19.github.io/progress-page/#/';
const TE2_ISSUE=/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/([1-9]\d*)$/;
const TE2_PR=/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/([1-9]\d*)$/;
const TE2_COMMENT=/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/([1-9]\d*)#issuecomment-([1-9]\d*)$/;
const te2Safe=x=>typeof x==='string'?x.replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').trim().slice(0,240):'';
const te2Part=text=>({text:String(text)});
const te2Href=(text,url)=>({text,url});
const te2SafeLink=u=>TE2_ISSUE.test(u||'')||TE2_PR.test(u||'')||TE2_COMMENT.test(u||'')||
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(u||'')||
  /^https:\/\/reallakshman19\.github\.io\/progress-page\/#\/[a-z0-9-]+\/cycle-board$/.test(u||'')||
  /^https:\/\/reallakshman19\.github\.io\/progress-page\/#\/adhoc\/topo-[ab]\/cycle-board$/.test(u||'');
const te2TitlePart=(label,url)=>te2SafeLink(url)?te2Href(label,url):te2Part(label);
const te2Line=(name,...pieces)=>({name,parts:pieces});
const te2CommentUrl=(issue,id)=>issue+'#issuecomment-'+id;
const te2CurrentIssueComment=(c,issue)=>{
 const url=c?.url||c?.html_url||'';
 const m=TE2_COMMENT.exec(url);
 return !!m&&url.startsWith(issue+'#issuecomment-')&&Number(m[4])===Number(c?.id)&&
  typeof c?.body==='string'&&typeof c?.author==='string';
};
const te2ReportedReturn=(c,key)=>key==='topo-a'?
 /TOPO-A\s*[—-]\s*Cycle now\s*\/\s*read-only evidence return/i.test(c.body):
 key==='topo-b'?
 /TOPO-B\b.{0,70}Cycle-now bounded read-only evidence return/i.test(c.body):false;
const te2AcceptedKind=key=>key==='topo-a'?'READ_ONLY_SOURCE_TRACE':
 key==='topo-b'?'READ_ONLY_FORMAT_CONTRACT':null;

function te2NativeClaim(row,feed){
 const empty={returnComment:null,acceptance:null,sourceComment:null,
  readOnly:'TOTAL UNKNOWN',current:'TOTAL UNKNOWN',work:'No verified native evidence summary',
  next:null,tests:'UNKNOWN',status:'UNKNOWN'};
 if(!feed||!['ok','partial'].includes(feed.status)||feed.issue!==row.source)return empty;
 const comments=(feed.comments||[]).filter(c=>te2CurrentIssueComment(c,row.source));
 const key=row.key,kind=te2AcceptedKind(key);
 const returns=comments.filter(c=>te2ReportedReturn(c,key));
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
  tests=assigned&&!newCandidate?'UNKNOWN (0/3 source-backed test returns)':'UNKNOWN';
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
 const m=TE2_ISSUE.exec(issue||'');
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
  if(comments.some(c=>!te2CurrentIssueComment(c,issue)))
   throw Error('COMMENT_IDENTITY_MISMATCH');
  const prRecords=await Promise.all(prs.map(async u=>{
   const p=TE2_PR.exec(u||'');if(!p)return {url:u,status:'UNKNOWN'};
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
   }catch(error){return {url:u,status:'UNKNOWN',reason:te2Safe(String(error))};}
  }));
  return {issue,comments,prs:prRecords,observedAt:clock(),
   status:raw.length>=100||prRecords.some(p=>p.status==='UNKNOWN')?'partial':'ok',
   reason:raw.length>=100?'COMMENT_PAGINATION_UNVERIFIED':null};
 }catch(error){
  return {issue,comments:[],prs:[],status:'unknown',observedAt:null,
   reason:te2Safe(String(error?.message||error))};
 }
}

export function taskEvidenceV2Model(row,{projectKey=row?.key||'UNKNOWN',
 project=null,feed=null,observations=[],pageFetch=null}={}){
 if(!row)return null;
 const native=row.sourceType==='NATIVE_TASK';
 const claim=te2NativeClaim(row,feed);
 const match=TE2_ISSUE.exec(row.source||'')||TE2_COMMENT.exec(row.source||'')||TE2_PR.exec(row.source||'');
 const repo=match?match[1]+'/'+match[2]:'REPOSITORY UNKNOWN';
 const repoUrl=match?'https://github.com/'+repo:null;
 const pageUrl=native&&/^topo-[ab]$/.test(row.key||'')?TE2_SITE+'adhoc/'+row.key+'/cycle-board':
  TE2_SITE+encodeURIComponent(projectKey)+'/cycle-board';
 const related=(native?feed?.prs:row.prRefs||[])||[];
 const prs=related.filter(p=>p?.url&&TE2_PR.test(p.url)).slice(0,4);
  const sourceRevision=observations.find(o=>o.source===row.source)?.revision||row.sourceRevision;
 const sourceOK=!!sourceRevision;
 const pageOK=native||pageFetch?.status==='ok';
 const current=native&&feed?.status==='ok'&&sourceOK?'CURRENT':
   (sourceOK||pageOK||feed?.status==='partial')?'PARTIAL':'UNKNOWN';
 const last=native&&claim.acceptance?'ORACLE_REPORTED '+(claim.acceptance.createdAt||'TIME_UNKNOWN'):'NOT_VERIFIED';
 const observed=native?feed?.observedAt||'NOT_VERIFIED':pageFetch?.observedAt||'NOT_VERIFIED';
 const state=te2Safe(row.state||'UNKNOWN');
 const progress=native?claim.readOnly+' · Current task: '+claim.current:
  'Completed/agreed: TOTAL UNKNOWN · Card state: '+state+' · Current task: TOTAL UNKNOWN';
 const authority=native&&claim.acceptance?'Oracle-reported '+te2AcceptedKind(row.key)+' (technical acceptance NOT VERIFIED)':
  'Acceptance: NOT_VERIFIED';
 const work=native?claim.work:te2Safe(row.work||row.recordedNow||'Recorded task; measurable work not authenticated');
 const tests=native?claim.tests:'UNKNOWN (no authenticated test totals)';
 const returnUrl=native?claim.returnComment?.url:row.returnUrl;
 const reviewUrl=native?claim.acceptance?.url:null;
 const nativeReturnStatus=native?(claim.returnComment?'1 native return claim':
  feed?.status==='ok'?'0 native returns observed':'Native return UNKNOWN (source unread)'):
  row.returnUrl?'Page audit return pointer only; acceptance UNKNOWN':'Native return NOT_VERIFIED';
 const hold=native?'Engineering HOLD':/\bHOLD\b/i.test((row.recordedNow||'')+' '+state)?
  'Recorded HOLD; authority unverified':'Engineering authority UNKNOWN';
 const actor=native?'AGENT':/^(?:Agent|Builder|Oracle|Owner|IR|Reviewer)(?:\b|$)/i.test(row.nextActor||'')?
  te2Safe(row.nextActor).split(/[\/,+]/)[0]:'ACTOR UNKNOWN';
 const nextAction=native?claim.next||'Verify authoritative native next task before execution':
  te2Safe(row.recordedNext||'Verify existing native assignment before execution');
 const perm=native?'READ_ONLY; no production changes authorized':
  'Check original task and active authority; Board does not grant permission';
 const lines=[
  te2Line('1. TASK',te2TitlePart(repo,repoUrl),te2Part(' · WBS '+(row.wbs||'UNKNOWN')+' · '),
   te2TitlePart(match&&(TE2_ISSUE.test(row.source)||TE2_COMMENT.test(row.source))?'Issue #'+match[3]:'Native task',row.source),
   te2Part(' · PR: '+(prs.length?'':'NONE VERIFIED')),
   ...prs.flatMap((p,i)=>[...(i?[te2Part(' / ')]:[]),te2TitlePart('#'+TE2_PR.exec(p.url)[3]+' '+(p.status||'STATUS UNKNOWN'),p.url)]),
   te2Part(' · '),te2TitlePart('Progress Page',pageUrl)),
  te2Line('2. PROGRESS',te2Part(progress+' · '+authority)),
  te2Line('3. WORK & PROOF',te2Part(work+' · '),
   ...(returnUrl&&te2SafeLink(returnUrl)?[te2Href('Agent evidence',returnUrl),te2Part(' · ')]:[]),
   ...(claim.sourceComment?.url&&te2SafeLink(claim.sourceComment.url)?
    [te2Href('Oracle source observation',claim.sourceComment.url),te2Part(' · ')]:[]),
   te2Part('Tests: '+tests)),
  te2Line('4. BLOCKERS & RELAY',te2Part(nativeReturnStatus+' · '),
   ...(returnUrl&&te2SafeLink(returnUrl)?[te2Href('Native return',returnUrl),te2Part(' · ')]:[]),
   ...(reviewUrl&&te2SafeLink(reviewUrl)?[te2Href('Oracle review (reported)',reviewUrl),te2Part(' · ')]:[]),
   te2Part('Review: '+(reviewUrl?'Oracle-reported; independent review HOLD':'NOT_VERIFIED')+
    ' · '+hold+(native&&feed?.status!=='ok'?' · source coverage '+(feed?.status||'UNKNOWN'):'') )),
  te2Line('5. NEXT → '+actor,te2Part(nextAction+' → '),
   te2TitlePart('Return to original task',row.source),
   te2Part(' · '+perm))
 ];
 const who=/\bUnassigned\b/i.test(row.role||'')?'Unassigned':
   /\bOracle\b/i.test(row.role||'')?'Oracle':
   /\b(?:IR|Reviewer)\b/i.test(row.role||'')?'Reviewer':
   /\b(?:Builder|Agent|Coder|Specialist)\b/i.test(row.role||'')?'Agent':'Role UNKNOWN';
 return {schema:'task-evidence.v2/read-only',title:(native?row.key.toUpperCase():projectKey)+' / '+who+' / '+te2Safe(row.label||row.id||'TASK'),
  lastReconciled:last,observedAt:observed,sourceStatus:current,lines,
  nativeReturn:nativeReturnStatus,acceptance:authority,canAuthorize:false,
  sourceRevision:sourceRevision||null,readOnly:true,
  nativeNext:native?claim.next:null,nextSourceUrl:reviewUrl||null};
}

export function taskEvidenceV2Text(model){
 if(!model)return '';
 return 'TASK EVIDENCE v2 · '+model.title+'\n'+
  'Last reconciled: '+model.lastReconciled+' · Source status: '+model.sourceStatus+'\n'+
  model.lines.map(l=>l.name+': '+l.parts.map(p=>p.text).join('')).join('\n');
}
export function renderTaskEvidenceV2(root,model){
 if(!model)return null;
 const box=el('article','task-evidence-v2');
 box.setAttribute('aria-label','Task Evidence v2 · '+model.title);
 box.append(el('h5',null,'TASK EVIDENCE v2 · '+model.title),
  el('p','muted te-meta','Last reconciled: '+model.lastReconciled+
  ' · Source status: '+model.sourceStatus));
 if(model.lines.length!==5)throw Error('Task Evidence v2 requires exactly five information lines');
 for(const item of model.lines){
  const p=el('p','te-line');
  p.append(el('b',null,item.name+': '));
  for(const piece of item.parts){
   if(piece.url&&te2SafeLink(piece.url))p.append(link(piece.url,piece.text));
   else p.append(piece.text);
  }
  box.append(p);
 }
 root.append(box);
 return box;
}
