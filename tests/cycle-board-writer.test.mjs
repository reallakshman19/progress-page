import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { cycleBoardContextModel } from '../cycle-board-context.js';
import { cycleBoardDeltaModel } from '../cycle-board-delta.js';
import { cycleBoardWriterModel,renderCycleBoardWriter } from '../cycle-board-writer.js';

const page={
 index:JSON.parse(readFileSync(new URL('../data/ciifr-node/index.json',import.meta.url),'utf8')),
 cards:JSON.parse(readFileSync(new URL('../data/ciifr-node/cards.json',import.meta.url),'utf8')),
 audit:JSON.parse(readFileSync(new URL('../data/ciifr-node/audit.json',import.meta.url),'utf8'))
};
const nativeUrl='https://github.com/reallakshman19/XML_Compare_Utilities/pull/232',
 issueUrl='https://github.com/reallakshman19/XML_Compare_Utilities/issues/231';
const sha='7f5dc773ac7bb08544d086be734e4337295088a0';
const saved=JSON.stringify(page);
const pr=(url=nativeUrl,revision=sha)=>({
 occurrenceId:'github:reallakshman19/XML_Compare_Utilities:pull-head:232:'+revision,
 revision,source:url,kind:'PULL',milestone:'M3',label:'Repair candidate',
 state:'DRAFT',reportedHold:true,qualification:'SELF_ASSESSED',
 sourceAt:'2026-10-29T08:00:00Z',observedAt:'2026-10-29T09:00:00Z',
 technicalPass:'NOT_ESTABLISHED'
});
const issue={
 occurrenceId:'github:reallakshman19/XML_Compare_Utilities:issue-revision:231:2026-10-29T07:00:00Z',
 revision:'2026-10-29T07:00:00Z',source:issueUrl,kind:'ISSUE',milestone:'M3',
 label:'Native repair task',sourceAt:'2026-10-29T07:00:00Z',observedAt:'2026-10-29T09:00:00Z',
 technicalPass:'NOT_ESTABLISHED'
};
function sourceModel(pg=page,observations=[pr(),issue],status='ok'){
 const ctx=cycleBoardContextModel(pg,{
  native:{status,observedAt:'2026-10-29T09:00:00Z',observations,failures:[]},
  cycleStatus:'UNMAPPED',pageFetch:{status:'ok',observedAt:'2026-10-29T09:00:00Z'}});
 return {ctx,delta:cycleBoardDeltaModel(pg,ctx)};
}
test('CT-3 real CIIFR-Node WBS2 sources prepare writer candidates, with no Page changes',()=>{
 const {ctx,delta}=sourceModel();
 const model=cycleBoardWriterModel(page,ctx,delta);
 assert.equal(delta.publication.status,'STALE_PAGE');
 assert.equal(model.schema,'cycle-board.writer-preview/v1');
 assert.equal(model.status,'REVIEW_PENDING');
 assert.equal(model.project,'ciifr-node');
 assert.equal(model.pendingCount,2);
 const candidate=model.items.find(i=>i.source===nativeUrl);
 assert.equal(candidate.status,'PROPOSAL_CANDIDATE');
 assert.equal(candidate.cardId,'node-r0-code');
 assert.equal(candidate.wbs,'2');
 assert.equal(candidate.occurrenceId,ctx.sources.find(x=>x.source===nativeUrl).occurrenceId);
 assert.equal(candidate.publication,'NOT_PUBLISHED_BY_BOARD');
 assert.equal(candidate.technicalPass,'NOT_ESTABLISHED');
 assert.deepEqual(candidate.command,[
  'python tools/pp_cli.py propose --project ciifr-node --source '+nativeUrl+
  ' --actor "REPLACE_WITH_AUTHORIZED_PAGE_WRITER" --card node-r0-code --expected-head '+sha+
  ' --output reviewed-proposal.json',
  'python tools/pp_batch.py reviewed-proposal.json --data data',
  'python tools/pp_cli.py check'
 ]);
 const issueCandidate=model.items.find(x=>x.source===issueUrl);
 assert.equal(issueCandidate.status,'PROPOSAL_CANDIDATE');
 assert.equal(issueCandidate.command[0].includes('--expected-head'),false);
 assert.equal(JSON.stringify(page),saved,'Page WBS, cards and audit must remain untouched');
});
test('CT-3 cannot treat already-audited mutable URL as a fresh achievement or exact-head reconciliation',()=>{
 const pg=structuredClone(page);
 pg.audit.events.push({id:'CIIFR-NODE-R-0030',seq:30,source:nativeUrl,card:'node-r0-code',
  at:'2026-10-28T18:00:00Z',summary:'Prior PR head observed; no current SHA proof'});
 const {ctx,delta}=sourceModel(pg,[pr()]);
 const model=cycleBoardWriterModel(pg,ctx,delta);
 assert.equal(model.items[0].status,'ALREADY_RECORDED');
 assert.deepEqual(model.items[0].auditIds,['CIIFR-NODE-R-0030']);
 assert.equal(model.items[0].command,null);
 assert.equal(model.status,'REVIEW_REQUIRED','source URL is not proof of revised head publication');
 assert.equal(model.recordedCount,1);
 const exact=structuredClone(pg);
 Object.assign(exact.audit.events[exact.audit.events.length-1],{
   summary:'Reviewed exact head '+sha,
   kind:'EVIDENCE',scope:'milestone:M3',wbs:'2',card:'node-r0-code',
   nativeOccurrenceId:ctx.sources[0].occurrenceId,nativeRevision:sha
 });
 const current=sourceModel(exact,[pr()]);
 const reconciled=cycleBoardWriterModel(exact,current.ctx,current.delta);
 assert.equal(current.delta.publication.status,'CURRENT');
 assert.equal(reconciled.status,'ALREADY_RECONCILED');
 assert.equal(reconciled.pendingCount,0);
 assert.equal(JSON.stringify(page),saved);
});
test('CT-3 wrong WBS, duplicate Page card source and ambiguous owner require review',()=>{
 const unmapped=sourceModel(page,[{...pr(),milestone:'M99'}]);
 const a=cycleBoardWriterModel(page,unmapped.ctx,unmapped.delta);
 assert.equal(a.items[0].status,'UNMAPPED');assert.equal(a.items[0].command,null);
 const duplicate=sourceModel(page,[pr(page.cards['node-r0-code'].src)]);
 const b=cycleBoardWriterModel(page,duplicate.ctx,duplicate.delta);
 assert.equal(b.items[0].status,'UNKNOWN','source URL and identity must agree');
 const pg=structuredClone(page);pg.cards['second-wbs2-candidate']={
  ...pg.cards['node-r0-code'],src:'https://github.com/example/native/issues/99',refs:[]};
 const amb=sourceModel(pg,[pr()]);
 const c=cycleBoardWriterModel(pg,amb.ctx,amb.delta);
 assert.equal(c.items[0].status,'CARD_SELECTION_REQUIRED');
 assert.deepEqual(c.items[0].options,['node-r0-code','second-wbs2-candidate']);
 assert.equal(c.items[0].command,null);
});
test('CT-3 UNKNOWN source coverage, old revision, historical Page and project mismatch cannot propose',()=>{
 const partial=sourceModel(page,[pr()],'partial');
 assert.equal(cycleBoardWriterModel(page,partial.ctx,partial.delta).status,'UNKNOWN');
 const h=sourceModel();
 assert.equal(cycleBoardWriterModel(page,h.ctx,h.delta,{historical:true}).status,'HISTORICAL');
 assert.equal(cycleBoardWriterModel(page,{...h.ctx,project:'other'},h.delta).status,'UNKNOWN');
 const invalid=sourceModel(page,[{...pr(),revision:'short',occurrenceId:'github:repo:pull:232:short'}]);
 assert.equal(cycleBoardWriterModel(page,invalid.ctx,invalid.delta).items[0].status,'UNKNOWN');
 const old=sourceModel(page,[{...pr(),sourceAt:'2026-10-27T12:00:00Z'}]);
 assert.notEqual(cycleBoardWriterModel(page,old.ctx,old.delta).items[0].status,'PROPOSAL_CANDIDATE');
});
function fakeEl(tag){
 return {tag,className:'',children:[],text:'',attributes:{},style:{},
  set textContent(x){this.text=String(x);this.children=[];},
  get textContent(){return this.text+this.children.map(x=>typeof x==='string'?x:x.textContent).join('');},
  append(...x){this.children.push(...x);},
  setAttribute(k,v){this.attributes[k]=v;},
  addEventListener(type,fn){this['on'+type]=fn;},};
}
test('CT-3 Board preview visibly names dry-run and permits only user-initiated copy',()=>{
 const before=globalThis.document;globalThis.document={createElement:fakeEl};
 try{
  const {ctx,delta}=sourceModel(),model=cycleBoardWriterModel(page,ctx,delta);
  const root=fakeEl('main');
  renderCycleBoardWriter(root,model);
  assert.match(root.textContent,/Reviewed Page reconciliation/);
  assert.match(root.textContent,/REVIEW_PENDING/);
  assert.match(root.textContent,/technical PASS NOT_ESTABLISHED/);
  assert.match(root.textContent,/NOT_PUBLISHED_BY_BOARD/);
  assert.match(root.textContent,/pp_batch.py reviewed-proposal.json --data data/);
  assert.doesNotMatch(root.textContent,/--apply/);
  const elements=(n)=>[n,...(n.children||[]).flatMap(elements)];
  assert.equal(elements(root).filter(x=>x.tag==='button').length,2);
  assert.equal(JSON.stringify(page),saved);
 }finally{globalThis.document=before;}
});
