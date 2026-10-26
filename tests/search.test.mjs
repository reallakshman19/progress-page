import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSearchIndex, searchProgress } from '../search.js';

const projects=[{key:'a',label:'Geometry'},{key:'b',label:'Element'}];
const make=(key,wbs,pr,issue)=>({
  index:{project:{key,title:key,aim:'Review matching source evidence'},
    revisions:[{id:'R1',status:'superseded'},{id:'R2',status:'current'}],
    milestones:{ M1:{name:'Geometry topology and SVG',wbs}}},
  cards:{coder:{label:'Correspondence table',milestone:'M1',state:'SUBMITTED',
    now:'Exact head reviewer pending',refs:[{u:'https://github.com/example/source/pull/'+pr}]}},
  actions:{owner:{title:'Choose preview scope',milestone:'M1',status:'open',lead:'Review options',
    links:[{u:'https://github.com/example/source/issues/'+issue}]}},
  fixtures:{repository:[{t:'Exact source',u:'https://github.com/example/source/pull/'+pr,milestone:'M1'}]},
  audit:{events:[{id:key.toUpperCase()+'-R-0001',kind:'STATE',summary:'Original engine test',actor:'Reviewer',
    rev:'R1',card:'coder',source:'https://github.com/example/source/issues/'+issue}]}
});
const data={a:make('a','3.1','185','170'),b:make('b','4.1','186','171')};
const index=buildSearchIndex(projects,data);
test('global search matches exact PR identities without cross-project number contamination',()=>{
  const found=searchProgress(index,'PR #185');
  assert.ok(found.length>=2);
  assert.ok(found.every(x=>x.projectKey==='a'));
  assert.ok(found.some(x=>x.type==='Agent'));
  assert.equal(searchProgress(index,'PR #9999').length,0);
});
test('issue number and shorthand #number are source-backed',()=>{
  const issue=searchProgress(index,'issue 170');
  assert.ok(issue.length>0);
  assert.ok(issue.every(x=>x.projectKey==='a'));
  assert.ok(searchProgress(index,'#185').some(x=>x.type==='Agent'));
});
test('WBS 3 and 3.1 match only their owned work; free text searches descriptions',()=>{
  assert.ok(searchProgress(index,'WBS 3.1').length>0);
  assert.ok(searchProgress(index,'WBS 3.1').every(x=>x.projectKey==='a' && x.wbs==='3.1'));
  assert.ok(searchProgress(index,'WBS 4').every(x=>x.projectKey==='b'));
  assert.ok(searchProgress(index,'topology').some(x=>x.type==='WBS'));
  assert.ok(searchProgress(index,'correspondence table').some(x=>x.type==='Agent'));
});
test('deep links preserve project, WBS and historical revision rather than leaking current R2',()=>{
  const card=searchProgress(index,'PR 185').find(x=>x.type==='Agent');
  assert.equal(card.url,'#/a/progress/current/wbs%3A3/M1');
  const event=searchProgress(index,'issue 170').find(x=>x.type==='Timeline');
  assert.equal(event.revision,'R1');
  assert.match(event.url,/^#\/a\/timeline\/R1/);
});
test('missing WBS is not assigned to another milestone and no private links are constructed',()=>{
  const clone=structuredClone(data);
  clone.a.fixtures.pending=[{t:'Unscoped evidence',u:'OWNER_PRIVATE_REF:private'}];
  const next=buildSearchIndex(projects,clone);
  const hit=searchProgress(next,'unscoped evidence')[0];
  assert.equal(hit.wbs,'');
  assert.equal(hit.source,'');
  assert.equal(hit.url,'#/a/fixtures');
});
