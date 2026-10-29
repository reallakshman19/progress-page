import assert from 'node:assert/strict';
import test from 'node:test';
import {testPageModel,testPagePacket} from '../test-page.js';
import {HOME_VIEWS,HOME_SUBTABS} from '../lifecycle.js';
const SRC='https://github.com/acme/product/issues/180';
const project={index:{project:{key:'ciifr',aim:'Observe original bytes',aimSrc:SRC},
  milestones:{M13:{wbs:'3.1',name:'Geometry G1',capSrc:SRC}}},
  cards:{g1:{label:'G1 source',milestone:'M13',src:SRC,state:'IN_PROGRESS'}},
  audit:{events:[{id:'C-R-001',card:'g1',kind:'UPDATE',summary:'Evidence linked; no PASS',
    at:'2026-10-29T01:00:00Z',source:SRC,actor:'Page writer',rev:'R4'}]}};
test('Test page is a per-project route, not an independently reported Timeline',()=>{
 assert.ok(HOME_VIEWS.includes('test'));
 assert.ok(HOME_SUBTABS.find(x=>x[0]==='test'));
 const before=JSON.stringify(project);
 const a=testPageModel(project,{mode:'ACTION',cardId:'g1',needsOwner:true});
 assert.equal(a.key,'ciifr');
 assert.equal(a.wbs,'3.1');
 assert.equal(a.stage,'NEEDS_OWNER');
 assert.equal(a.isDemo,true);
 assert.ok(a.badges.some(b=>b.id==='ciifr/WBS/3.1'));
 assert.equal(JSON.stringify(project),before);
});
test('Reviewer Info handoff is synthetic and cannot assert review PASS or emit a live event',()=>{
 const m=testPageModel(project,{mode:'INFO',cardId:'g1',needsOwner:true});
 assert.equal(m.mode,'INFO');
 assert.equal(m.stage,'HANDED_OFF');
 assert.equal(m.needsOwner,false);
 assert.match(m.description,/review remains open/i);
 const packet=testPagePacket(m);
 assert.match(packet,/DEMONSTRATION ONLY/);
 assert.match(packet,/ciifr\/AIM\/project/);
 assert.doesNotMatch(packet,/CYCLE_TIMELINE_CARD v2/);
});
test('INFO-Auto only projects existing published audit; no event created',()=>{
 const before=JSON.stringify(project);
 const m=testPageModel(project,{mode:'INFO_AUTO',cardId:'g1'});
 assert.equal(m.isDemo,false);
 assert.equal(m.first.auditId,'C-R-001');
 assert.equal(m.stage,'SOURCE_RECORDED');
 assert.match(testPagePacket(m),/C-R-001/);
 assert.equal(JSON.stringify(project),before);
});
test('Projects without a WBS or audited source still have an honest demo page',()=>{
 const m=testPageModel({index:{project:{key:'learning'}},cards:{}},{mode:'INFO_AUTO'});
 assert.equal(m.wbs,'UNSCOPED');
 assert.equal(m.first,null);
 assert.equal(m.canCopy,false);
 assert.match(m.description,/No source-backed/);
 const action=testPageModel({index:{project:{key:'learning'}},cards:{}},{mode:'ACTION'});
 assert.match(testPagePacket(action),/UNSCOPED/);
});
test('Closed cards cannot become synthetic current production work',()=>{
 const p=JSON.parse(JSON.stringify(project));
 p.cards.g1.closed=true;
 const m=testPageModel(p,{cardId:'g1'});
 assert.equal(m.selected,null);
 assert.equal(m.wbs,'UNSCOPED');
});
