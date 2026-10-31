// Frozen Task Evidence v2: five lines, explicit authority, no second ledger.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {continuationBridgeModel,renderContinuationBridge} from '../cycle-board-continuation.js';
import {taskEvidenceV2Model,taskEvidenceV2Text,renderTaskEvidenceV2,
 loadTaskEvidenceNative} from '../task-evidence-v2.js';

const A='https://github.com/reallakshman19/xml229-topology-wp1-preview-20261028/issues/12';
const B='https://github.com/reallakshman19/XML_Compare_Utilities/issues/239';
const PR10='https://github.com/reallakshman19/xml229-topology-wp1-preview-20261028/pull/10';
const row=(key,issue,wbs)=>({key,id:key,sourceType:'NATIVE_TASK',
 source:issue,wbs,label:'Existing bounded task',state:'READ_ONLY FIRST',
 sourceRevision:'2026-10-31T09:00:00Z',sourceOccurrence:'native:observed',
 recordedNext:'Prior instruction (possibly stale)',nextActor:'Agent',
 returnUrl:null,role:'Builder'});
const reply=(issue,id,body)=>({id,url:issue+'#issuecomment-'+id,
 author:'reallakshman19',body,createdAt:'2026-10-31T08:00:00Z'});
const commentsA=[
 reply(A,1,'## TOPO-A — Cycle now / read-only evidence return\nProposed matrix; original NOT_RUN.'),
 reply(A,2,'Accepted as READ_ONLY_SOURCE_TRACE; https://github.com/x/y/issues/12#issuecomment-1\nONE NEXT: execute a 3-case closure falsifier matrix. Engineering HOLD.'),
 reply(A,3,'### Oracle-only original-source read-through\n41 branches / 1,654 source Node records; 240.6 mm. Original source seen locally, not an agent receipt.')
];
const commentsB=[
 reply(B,8,'## TOPO-B · Cycle-now bounded read-only evidence return\nContract proposal, no code changes.'),
 reply(B,9,'Accepted as READ_ONLY_FORMAT_CONTRACT; see #issuecomment-8\nONE NEXT: Appendix A A1–A5 read-only qualification with positive/negative runtime.'),
 reply(B,10,'### Oracle-only format/source reconciliation\n56 source elements each; GLRD 521 PIPINGELEMENT; UNKNOWN_PROFILE.')
];
const feed=(issue,comments)=>({issue,comments,status:'ok',observedAt:'2026-10-31T09:30:00Z',
 prs:issue===A?[{url:PR10,status:'DRAFT'}]:[]});

test('TOPO-A source-linked return is exactly five lines; 1/1 accepted scope, 0/3 NOT_RUN not engineering PASS',()=>{
 const r=row('topo-a',A,'3.2/4.1');
 const m=taskEvidenceV2Model(r,{projectKey:'topo-a',feed:feed(A,commentsA),
  observations:[{source:A,revision:r.sourceRevision}]});
 assert.equal(m.lines.length,5);
 assert.equal(m.sourceStatus,'CURRENT');
 const t=taskEvidenceV2Text(m);
 assert.match(t,/1\/1 read-only deliverable returned/);
 assert.match(t,/0\/3 executed falsifiers returned/);
 assert.match(t,/Tests: UNKNOWN \(0\/3 source-backed test returns\)/);
 assert.match(t,/Oracle-reported READ_ONLY_SOURCE_TRACE/);
 assert.match(t,/41 branches \/ 1,654 nodes, 240\.6 mm/);
 assert.match(t,/Engineering HOLD/);
 assert.match(t,/PR: #10 DRAFT/);
 assert.match(t,/Read-only;|READ_ONLY;/);
 assert.doesNotMatch(t,/INDEPENDENT PASS|ENGINEERING PASS|acknowledged/i);
 assert.equal(m.canAuthorize,false);
});

test('TOPO-B retains UNKNOWN runtime totals, Appendix A separate from accepted read-only contract',()=>{
 const r=row('topo-b',B,'2.1 → 4.1');
 const m=taskEvidenceV2Model(r,{projectKey:'topo-b',feed:feed(B,commentsB),
  observations:[{source:B,revision:r.sourceRevision}]});
 const t=taskEvidenceV2Text(m);
 assert.match(t,/1\/1 read-only deliverable returned/);
 assert.match(t,/Runtime checks: TOTAL UNKNOWN; Appendix A: 0\/5 returned/);
 assert.match(t,/56 each; GLRD: 521/);
 assert.match(t,/Read-only format-admission contract returned/);
 assert.match(t,/NO production changes authorized|no production changes authorized/);
 assert.doesNotMatch(t,/Tests: PASS/);
});

test('Wrong issue, forged acceptance, missing source and later return cannot manufacture progress',()=>{
 const r=row('topo-a',A,'3.2/4.1');
 const fake=feed(B,commentsA);
 let m=taskEvidenceV2Model(r,{projectKey:'topo-a',feed:fake});
 assert.match(taskEvidenceV2Text(m),/TOTAL UNKNOWN/);
 assert.equal(m.sourceStatus,'PARTIAL'); // Only the earlier native revision is known.
 const spoof=[reply(A,1,'## TOPO-A — Cycle now / read-only evidence return'),
  reply(A,2,'Accepted as READ_ONLY_SOURCE_TRACE for #issuecomment-999 and 3-case closure falsifier')];
 m=taskEvidenceV2Model(r,{projectKey:'topo-a',feed:feed(A,spoof)});
 assert.doesNotMatch(taskEvidenceV2Text(m),/1\/1 read-only deliverable returned/);
 m=taskEvidenceV2Model(r,{projectKey:'topo-a',feed:{issue:A,status:'unknown'}});
 assert.equal(m.sourceStatus,'PARTIAL'); // Recorded native revision exists but no successful comments read.
 assert.match(taskEvidenceV2Text(m),/Tests: UNKNOWN/);
 const more=[...commentsA,reply(A,4,'Independent synthetic test results claimed; inspect raw commands')];
 m=taskEvidenceV2Model(r,{projectKey:'topo-a',feed:feed(A,more)});
 assert.doesNotMatch(taskEvidenceV2Text(m),/0\/3 executed falsifiers returned/);
 assert.match(taskEvidenceV2Text(m),/RECONCILE NEW RETURN/);
});

test('Native intake checks exact issue and PR identities; failed or paginated fetch fails closed',async()=>{
 const api='https://api.github.com/repos/reallakshman19/xml229-topology-wp1-preview-20261028/';
 const fetcher=async url=>{
  if(url===api+'issues/12/comments?per_page=100')return {ok:true,json:async()=>[
   {id:1,html_url:A+'#issuecomment-1',user:{login:'tester'},body:'return'}]};
  if(url===api+'pulls/10')return {ok:true,json:async()=>({
    number:10,html_url:PR10,draft:true,state:'open',head:{sha:'a'.repeat(40)}})};
  throw Error('unexpected URL');
 };
 const f=await loadTaskEvidenceNative(A,{fetcher,prs:[PR10],clock:()=> '2026-10-31T09:31:00Z'});
 assert.equal(f.status,'ok');
 assert.equal(f.comments.length,1);
 assert.equal(f.prs[0].status,'DRAFT');
 const missing=await loadTaskEvidenceNative(A,{fetcher:async()=>({ok:false,status:403})});
 assert.equal(missing.status,'unknown');
 assert.equal(missing.comments.length,0);
 const spoof=await loadTaskEvidenceNative(A,{fetcher:async()=>({ok:true,json:async()=>[
  {id:1,html_url:B+'#issuecomment-1',user:{login:'test'},body:'fake'}]})});
 assert.equal(spoof.status,'unknown');
 assert.equal(spoof.reason,'COMMENT_IDENTITY_MISMATCH');
});

function node(tag){
 return {tag,className:'',children:[],attributes:{},text:'',
  append(...x){this.children.push(...x);},
  set textContent(s){this.text=String(s);this.children=[];},
  get textContent(){return (this.text||'')+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');},
  setAttribute(k,v){this.attributes[k]=String(v);},
  addEventListener(k,cb){this['on'+k]=cb;}
 };
}
function collect(root,pred,out=[]){
 if(root&&typeof root==='object'){if(pred(root))out.push(root);
  for(const x of root.children||[])collect(x,pred,out);}
 return out;
}
test('Cross-project CT-5 renders exactly five evidence lines per existing task and no private link leakage',()=>{
 const old=globalThis.document;
 globalThis.document={createElement:node};
 try{
  for(const key of ['ciifr','ciifr-node','g9v35','topofix','doc2table']){
   const src=name=>JSON.parse(readFileSync(new URL('../data/'+key+'/'+name+'.json',import.meta.url),'utf8'));
   const p={index:src('index'),cards:src('cards'),audit:src('audit'),fixtures:src('fixtures')};
   const before=JSON.stringify(p),root=node('main');
   const ct=continuationBridgeModel(p,{key});
   renderContinuationBridge(root,p,{key,pageFetch:{status:'ok',observedAt:'2026-10-31T09:30:00Z'}});
   const cards=collect(root,x=>x.tag==='article'&&x.className==='task-evidence-v2');
   assert.equal(cards.length,ct.rows.length,key);
   assert.ok(cards.every(c=>collect(c,x=>x.tag==='p'&&x.className==='te-line').length===5));
   assert.equal(JSON.stringify(p),before,'no Page source modifications');
   assert.doesNotMatch(root.textContent,/chatgpt\.com\/c\//);
  }
  const root=node('main');
  renderTaskEvidenceV2(root,taskEvidenceV2Model(row('topo-a',A,'3.2/4.1'),
   {projectKey:'topo-a',feed:feed(A,commentsA)}));
  assert.equal(collect(root,x=>x.tag==='p'&&x.className==='te-line').length,5);
 }finally{globalThis.document=old;}
});
