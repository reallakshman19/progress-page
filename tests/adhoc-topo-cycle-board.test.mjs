// Adversarial TOPO-A/B Adhoc Cycle Board tests on real read models and mock
// public GitHub responses. Never mutates production data or calls native APIs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { loadBoardNative, boardSourceConfigured, BOARD_NATIVE_SOURCES } from '../cycle-board-context.js';
import { topoAdhocBoardModel, renderTopoAdhocBoard, TOPO_ADHOC_INFO } from '../topo-adhoc-board.js';

const SNAP=readFileSync(new URL('../data/projects.json',import.meta.url),'utf8');
const CLOCK='2026-10-31T05:00:00Z',AT='2026-10-31T04:00:00Z';
const SHA='a'.repeat(40),NEW_SHA='b'.repeat(40);
const config=BOARD_NATIVE_SOURCES;
function mock({head=SHA,issueAt=AT,fail='',wrong='',privateTitle=false}={}) {
 const calls=[];
 const fetcher=async(url)=>{
  calls.push(url);
  const m=/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/(issues|pulls)\/([0-9]+)$/.exec(url);
  assert.ok(m,'unexpected endpoint '+url);
  const [,repo,kind,raw]=m,num=Number(raw);
  if(fail===url||fail==='number:'+num)return {ok:false,status:403};
  const original='https://github.com/'+repo+'/'+(kind==='pulls'?'pull':'issues')+'/'+num;
  return {ok:true,status:200,json:async()=>({
   number:wrong===url?num+1:num,html_url:original,
   title:privateTitle?'secret token:ABCD123 owner@example.com':'Native original read-only source',
   body:'PREPARED READ_ONLY FIRST; original engineering acceptance HOLD',
   draft:kind==='pulls',state:'open',merged_at:null,
   head:kind==='pulls'?{sha:head}:undefined,
   updated_at:kind==='issues'&&
     ((repo.includes('xml229-topology')&&num===12)||(repo.includes('XML_Compare_Utilities')&&num===239))
      ?issueAt:AT
  })};
 };
 return {fetcher,calls};
}
async function observe(key,opts={}) {
 const m=mock(opts);
 return {native:await loadBoardNative(key,m.fetcher,()=>CLOCK),calls:m.calls};
}
test('Both Adhoc Cycle Boards bind two distinct original tasks plus one existing WBS and relay/Page proposals',()=>{
 assert.equal(boardSourceConfigured('topo-a'),true);
 assert.equal(boardSourceConfigured('topo-b'),true);
 assert.equal(TOPO_ADHOC_INFO['topo-a'].issueNumber,12);
 assert.equal(TOPO_ADHOC_INFO['topo-b'].issueNumber,239);
 for(const key of ['topo-a','topo-b']){
  assert.equal(config[key].length,4);
  assert.equal(new Set(config[key].map(x=>x.repo+'/'+x.kind+'/'+x.number)).size,4);
  assert.ok(config[key].some(x=>x.number===3&&x.repo.includes('topology-wp1-preview')));
  assert.ok(config[key].some(x=>x.number===572&&x.repo==='reallakshman19/Common'));
  assert.ok(config[key].some(x=>x.number===95&&x.repo==='reallakshman19/progress-page'));
  assert.ok(config[key].every(x=>x.milestone===null),'No Adhoc Page WBS may be inferred');
 }
 assert.equal(TOPO_ADHOC_INFO['topo-a'].issue.includes('/issues/239'),false);
 assert.equal(readFileSync(new URL('../data/projects.json',import.meta.url),'utf8'),SNAP);
});
test('Each Adhoc workspace exposes its own source-grounded concept specification as a read-only fixture',()=>{
 const paths={
  'topo-a':'TOPO_A_ASSISTED_CONNECTION_CONCEPT_SPEC_R1.md',
  'topo-b':'TOPO_B_UNIVERSAL_XML_TOPOLOGY_CONCEPT_SPEC_R1.md'
 };
 for(const key of ['topo-a','topo-b']){
  const info=TOPO_ADHOC_INFO[key];
  const filename=paths[key];
  const spec=readFileSync(new URL('../docs/'+filename,import.meta.url),'utf8');
  assert.equal(info.concept,'https://github.com/reallakshman19/progress-page/blob/main/docs/'+filename);
  assert.equal(info.sources[0].url,info.concept);
  assert.match(info.sources[0].label,/Concept note/);
  assert.match(spec,/Governing|Governed by/);
  assert.match(spec,/HOLD|NOT_RUN/);
  assert.match(spec,/Cycle Board/);
  assert.ok(spec.length>8000,'Detailed fixture is a substantive source-grounding specification');
 }
 const a=readFileSync(new URL('../docs/'+paths['topo-a'],import.meta.url),'utf8');
 const b=readFileSync(new URL('../docs/'+paths['topo-b'],import.meta.url),'utf8');
 assert.match(a,/6880/);assert.match(a,/6450/);assert.match(a,/240\.6 mm/);
 assert.match(a,/Source Review Queue/);assert.match(a,/Executable Approved Fix Queue/);
 assert.match(b,/InputXML Workspace/);assert.match(b,/RichInputXMLv2\.1/);assert.match(b,/521 elements/);
 assert.doesNotMatch(a+b,/private original XML contents:|recipient-verified private bytes: yes/i);
 assert.equal(readFileSync(new URL('../data/projects.json',import.meta.url),'utf8'),SNAP,'No duplicate Page project');
});
test('First complete read: exact source occurrence, UNKNOWN prior delta, no Cycle dispatch or Page publication',async()=>{
 for(const key of ['topo-a','topo-b']){
  const {native,calls}=await observe(key);
  assert.equal(native.status,'ok');
  assert.equal(calls.length,4);
  const m=topoAdhocBoardModel(key,native);
  assert.equal(m.schema,'cycle-board.adhoc-context/v1');
  assert.equal(m.project,key);
  assert.equal(m.native.coverage,'COMPLETE');
  assert.equal(m.native.observedAt,CLOCK);
  assert.equal(m.delta.status,'UNKNOWN','First read lacks verified comparison');
  assert.equal(m.next.advice,'REVIEW_NATIVE_TASK');
  assert.equal(m.cycle.authority,'NOT_ESTABLISHED');
  assert.equal(m.cycle.status,'NOT_VERIFIED');
  assert.equal(m.assignment.recipient,'UNBOUND');
  assert.equal(m.assignment.acknowledgement,'NOT_VERIFIED');
  assert.equal(m.publication.status,'NOT_RECONCILED');
  assert.equal(m.relay.status,'RECEIPT_NOT_VERIFIED');
  assert.equal(m.task.source,TOPO_ADHOC_INFO[key].issue);
  assert.ok(m.sources.every(s=>s.technicalPass==='NOT_ESTABLISHED'&&s.wbs===null));
  assert.ok(m.sources.every(s=>s.occurrenceId.includes(s.revision)));
 }
});
test('Repeated identical read is UNCHANGED even with a newer observation clock; a changed PR head is CHANGED',async()=>{
 const {native}=await observe('topo-a');
 const previous=topoAdhocBoardModel('topo-a',native).comparable;
 const same=await observe('topo-a');
 const unchanged=topoAdhocBoardModel('topo-a',same.native,previous);
 assert.equal(unchanged.delta.status,'UNCHANGED');
 assert.equal(unchanged.next.advice,'NO_NEW_EVIDENCE');
 const changed=await observe('topo-a',{head:NEW_SHA});
 const result=topoAdhocBoardModel('topo-a',changed.native,previous);
 assert.equal(result.delta.status,'CHANGED');
 assert.equal(result.next.advice,'REVIEW_CHANGED_SOURCES');
 assert.equal(result.cycle.authority,'NOT_ESTABLISHED');
 assert.equal(result.publication.status,'NOT_RECONCILED');
 const priorPage=unchanged.sources.find(s=>s.source.endsWith('/pull/95'));
 const revisedPage=result.sources.find(s=>s.source.endsWith('/pull/95'));
 assert.notEqual(priorPage.occurrenceId,revisedPage.occurrenceId);
 assert.equal(priorPage.source,revisedPage.source,'Mutable URL cannot become immutable source ID');
});
test('TOPO-B changed native issue revision is CHANGED but never technical PASS or an activated worker',async()=>{
 const a=await observe('topo-b');
 const old=topoAdhocBoardModel('topo-b',a.native).comparable;
 const b=await observe('topo-b',{issueAt:'2026-10-31T04:50:00Z'});
 const m=topoAdhocBoardModel('topo-b',b.native,old);
 assert.equal(m.delta.status,'CHANGED');
 assert.notEqual(m.task.revision,AT);
 assert.equal(m.assignment.writeLease,'NOT_VERIFIED');
 assert.equal(m.cycle.authority,'NOT_ESTABLISHED');
});
test('403, wrong issue identity or missing original prevents healthy empty / source-complete claims',async()=>{
 const first=await observe('topo-a');
 const old=topoAdhocBoardModel('topo-a',first.native).comparable;
 for(const opts of [{fail:'number:12'},{fail:'number:572'}]){
  const r=await observe('topo-a',opts);
  const m=topoAdhocBoardModel('topo-a',r.native,old);
  assert.equal(m.native.coverage,'PARTIAL');
  assert.equal(m.delta.status,'UNKNOWN');
  assert.equal(m.next.advice,'UNKNOWN_STOP');
  assert.ok(m.native.failures.length>=1);
  assert.equal(m.cycle.authority,'NOT_ESTABLISHED');
 }
 const fetcher=async()=>({ok:false,status:429});
 const n=await loadBoardNative('topo-b',fetcher,()=>CLOCK);
 const m=topoAdhocBoardModel('topo-b',n,old);
 assert.equal(n.status,'unknown');
 assert.equal(m.native.coverage,'UNKNOWN');
 assert.equal(m.sources.length,0);
 assert.equal(m.next.advice,'UNKNOWN_STOP');
 const originalMock=mock();
 const firstUrl='https://api.github.com/repos/reallakshman19/XML_Compare_Utilities/issues/239';
 const wrong=mock({wrong:firstUrl});
 const nw=await loadBoardNative('topo-b',wrong.fetcher,()=>CLOCK);
 assert.equal(topoAdhocBoardModel('topo-b',nw).native.coverage,'PARTIAL');
});
test('Untrusted issue title and private body cannot promote authority or leak to public Board model',async()=>{
 const x=await observe('topo-b',{privateTitle:true});
 const m=topoAdhocBoardModel('topo-b',x.native);
 assert.ok(m.sources.every(s=>!s.title.includes('owner@example.com')));
 assert.equal(m.cycle.authority,'NOT_ESTABLISHED');
 assert.doesNotMatch(JSON.stringify(m),/owner@example\.com|token:ABCD123/);
});
function node(tag){
 return {tag,className:'',children:[],attributes:{},href:'',
  set textContent(v){this.text=String(v);this.children=[];},
  get textContent(){return (this.text||'')+this.children.map(x=>typeof x==='string'?x:x.textContent).join('');},
  append(...x){this.children.push(...x);},
  setAttribute(k,v){this.attributes[k]=v;},
  addEventListener(k,fn){this['on'+k]=fn;}
 };
}
test('Both interactive Adhoc Boards display read-only source IDs and recheck changed originals only by click',async()=>{
 const old=globalThis.document;globalThis.document={createElement:node};
 try{
  for(const key of ['topo-a','topo-b']){
   const root=node('main'),fetcher=mock().fetcher;
   renderTopoAdhocBoard(root,key,{fetcher,clock:()=>CLOCK});
   await new Promise(setImmediate);
   assert.match(root.textContent,/COMPLETE/);
   assert.match(root.textContent,/NOT_ESTABLISHED/);
   assert.match(root.textContent,/NOT_RECONCILED/);
   assert.match(root.textContent,/REVIEW_NATIVE_TASK/);
   assert.match(root.textContent,/Immutable occurrence/);
   const button=root.children[0].children.find(x=>x.tag==='button');
   assert.equal(button.textContent,'Recheck native sources');
   button.onclick();
   await new Promise(setImmediate);
   assert.match(root.textContent,/UNCHANGED/);
   assert.match(root.textContent,/NO_NEW_EVIDENCE/);
  }
 }finally{globalThis.document=old;}
 assert.equal(readFileSync(new URL('../data/projects.json',import.meta.url),'utf8'),SNAP);
});
