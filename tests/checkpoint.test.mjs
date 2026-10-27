import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { checkpointModel, cycleSource, cycleSummary } from '../checkpoint.js';
import { wbsGroups } from '../progress.js';

const ciifr=JSON.parse(readFileSync(new URL('../data/ciifr/index.json',import.meta.url),'utf8'));
const cards=JSON.parse(readFileSync(new URL('../data/ciifr/cards.json',import.meta.url),'utf8'));
const doc=JSON.parse(readFileSync(new URL('../data/doc2table/index.json',import.meta.url),'utf8'));
test('project checkpoints are read-only and never infer Owner acceptance or a next assignment',()=>{
  const p={index:ciifr,cards};
  const prev=JSON.stringify(p);
  const a=checkpointModel(p,{pageFetch:{status:'ok',observedAt:'2026-10-27T18:00:00Z'}});
  assert.equal(a.revision,'R4');assert.equal(a.cycle.status,'UNMAPPED');
  assert.ok(a.last?.id);
  assert.ok(a.last.state);
  assert.equal(a.aimSource,ciifr.project.aimSrc);
  assert.equal(a.pageFetch.status,'ok');
  assert.equal(JSON.stringify(p),prev);
});
test('every WBS family has scoped evidence without arbitrary task selection',()=>{
  const p={index:doc,cards:{}};
  for(const g of wbsGroups(doc)){
    const m=checkpointModel(p,{family:g});
    assert.equal(m.purpose,g.description);
    assert.equal(m.scope,g.label);
    assert.equal(m.last,null);
    assert.equal(m.cycle.status,'OUT_OF_SCOPE');
  }
});
const bound={pageProject:'ciifr',project:'ciifr',scope:'wbs:3',
  url:'https://raw.githubusercontent.com/reallakshman19/Common/main/oracle-cycles/ciifr/CURRENT.json'};
const cycle={schema:'oracle-cycle-current/v1',project:'ciifr',mode:'standalone',activation:'ACTIVE',
 revision:18,progress_projection:{repository:'reallakshman19/progress-page',project_key:'ciifr',publication_status:'PROGRESS_UPDATE_PENDING'},
 next:{recipient_role:'owner',recipient_chat_id8:null,status:'AWAIT_OWNER_TRIAL',instruction:'Browser trial',evidence_ref:'https://github.com/example/r/issues/1'}};
test('Cycle binding and identity are explicit; mapped WBS never broadens to another',()=>{
  assert.ok(cycleSource(bound,'ciifr'));
  assert.equal(cycleSource(bound,'doc2table'),null);
  assert.equal(cycleSource({...bound,url:bound.url.replace('/main/','/feature/')},'ciifr'),null);
  assert.equal(cycleSummary({...cycle,project:'p25b'},bound,'ciifr').status,'INVALID');
  assert.equal(cycleSummary({...cycle,activation:'INACTIVE'},bound,'ciifr').status,'INACTIVE');
  assert.equal(cycleSummary(cycle,bound,'ciifr').actor,'owner');
  const p={index:ciifr,cards};
  const g=wbsGroups(ciifr).find(x=>x.key==='wbs:3');
  assert.equal(checkpointModel(p,{family:g,cycle,binding:bound}).cycle.status,'OBSERVED');
  const other=wbsGroups(ciifr).find(x=>x.key==='wbs:4');
  assert.equal(checkpointModel(p,{family:other,cycle,binding:bound}).cycle.status,'OUT_OF_SCOPE');
  assert.equal(checkpointModel(p,{family:g,cycle,binding:bound,historical:true}).cycle.status,'OUT_OF_SCOPE');
  assert.equal(checkpointModel(p,{family:g,cycle,binding:bound,cycleCheck:{status:'error'}}).cycle.status,'OUT_OF_SCOPE');
});
test('source retrieval failure is not a PASS; old native observations remain distinct from Page fetch',()=>{
  const p={index:doc,cards:{x:{milestone:'M1',label:'Native result',state:'VERIFIED',updatedAt:'2026-10-20T00:00:00Z',src:'OWNER_PRIVATE_REF:o'}}};
  const m=checkpointModel(p,{pageFetch:{status:'error',observedAt:'2026-10-27T09:00:00Z'}});
  assert.equal(m.last.state,'VERIFIED'); assert.equal(m.last.source,null);
  assert.equal(m.pageFetch.status,'error');assert.equal(m.cycle.status,'UNMAPPED');
  assert.equal(m.last.sourceLimit,'Not a public GitHub source');
});

test('latest audited Page changes are scope-specific and suppress repeated identical rows without writes',()=>{
  const p={index:doc,cards:{a:{milestone:'M1'},b:{milestone:'M2'}},
    audit:{events:[
      {id:'1',at:'2026-10-27T10:00:00Z',card:'a',kind:'UPDATE',summary:'Source inspected',source:'https://github.com/example/r/issues/1'},
      {id:'2',at:'2026-10-27T10:01:00Z',card:'a',kind:'UPDATE',summary:'Source inspected',source:'https://github.com/example/r/issues/1'},
      {id:'3',at:'2026-10-27T10:02:00Z',card:'b',kind:'UPDATE',summary:'Other WBS',source:'https://github.com/example/r/issues/2'}
    ]}};
  const before=JSON.stringify(p);
  const family=wbsGroups(doc).find(g=>g.key==='wbs:1');
  const m=checkpointModel(p,{family});
  assert.equal(m.changes.length,1);
  assert.equal(m.changes[0].id,'2');
  assert.equal(checkpointModel(p).changes.length,2);
  assert.equal(JSON.stringify(p),before);
});
