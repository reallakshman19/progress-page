import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { agentStartModel, agentStartText } from '../agent-start.js';
import { wbsGroups } from '../progress.js';
import { PRIMARY_TABS } from '../lifecycle.js';

const idx=JSON.parse(readFileSync(new URL('../data/ciifr/index.json',import.meta.url),'utf8'));
const cards=JSON.parse(readFileSync(new URL('../data/ciifr/cards.json',import.meta.url),'utf8'));
const p={index:idx,cards};
const original=JSON.stringify(p);

test('project-wide entry is a chooser, never an arbitrary task list',()=>{
  const m=agentStartModel(p,{revision:'R4'});
  assert.equal(m.mode,'choose');
  assert.equal(m.work.length,0);
  assert.equal(m.sources.length,0);
  assert.ok(m.choices.find(c=>c.key==='wbs:3'));
  assert.ok(m.choices.find(c=>c.key==='wbs:4'));
  assert.ok(m.choices.find(c=>c.key==='wbs:5'));
  assert.match(agentStartText(m),/No specific task or actor selected/);
  assert.doesNotMatch(agentStartText(m),/XMLv1.1: F05 closed/);
  assert.equal(JSON.stringify(p),original);
});
test('selected family is a step chooser, not a first-three backlog or fictitious priority',()=>{
  const family=wbsGroups(idx).find(g=>g.key==='wbs:5');
  const m=agentStartModel(p,{family,revision:'R4'});
  assert.equal(m.mode,'family');
  assert.deepEqual(m.steps.map(s=>s.id),['M8','M9','M10','M11']);
  assert.ok(m.steps.find(s=>s.id==='M8').items>=4);
  assert.ok(m.steps.some(s=>s.capability==='NOT_DEMONSTRATED'));
  assert.equal(m.work.length,0);
  assert.equal(JSON.stringify(p),original);
});
test('a scoped step reveals all six M8 records and honest unassigned actors',()=>{
  const family=wbsGroups(idx).find(g=>g.key==='wbs:5');
  const m=agentStartModel(p,{family,step:'M8',revision:'R4'});
  assert.equal(m.mode,'step');
  assert.equal(m.focused.id,'M8');
  assert.equal(m.work.length,6);
  assert.equal(m.work.find(w=>w.id==='xmlv11-f05').nextActor,'Not recorded / unassigned');
  assert.equal(m.work.find(w=>w.id==='converter-integration').state,'BLOCKED');
  assert.ok(m.sources.some(s=>s.url.endsWith('/pull/157')));
  assert.match(agentStartText(m),/WORK ITEM converter-integration/);
  assert.equal(JSON.stringify(p),original);
});
test('Geometry G1 preserves recorded evidence and an explicitly missing SHA',()=>{
  const family=wbsGroups(idx).find(g=>g.key==='wbs:3');
  const m=agentStartModel(p,{family,step:'M13',revision:'R4'});
  assert.equal(m.focused.id,'M13');
  assert.equal(m.focused.wbs,'3.1');
  assert.equal(m.work.length,1);
  assert.ok(m.sources.some(s=>/issues\/186/.test(s.url)));
  const handoff=agentStartText(m);
  assert.match(handoff,/Exact candidate SHA: NOT_RECORDED/);
  assert.match(handoff,/not an acknowledged assignment/);
  assert.doesNotMatch(handoff,/RELEASED:/);
  assert.equal(JSON.stringify(p),original);
});
test('WBS 5.3 HOLD cannot be elevated to acceptance or transfer',()=>{
  const family=wbsGroups(idx).find(g=>g.key==='wbs:5');
  const m=agentStartModel(p,{family,step:'M11',revision:'R4'});
  assert.equal(m.focused.cap,'NOT_DEMONSTRATED');
  assert.match(agentStartText(m),/NOT_DEMONSTRATED/);
  assert.match(agentStartText(m),/Writer\/TARGET1 permission/);
  assert.equal(JSON.stringify(p),original);
});
test('empty and historical contexts never fabricate tasks or sources',()=>{
  const fake={index:{project:{key:'empty'},milestones:{M1:{name:'Step',order:1}},revisions:[{id:'R1',status:'current'}]},cards:{}};
  const m=agentStartModel(fake,{step:'M1',revision:'R1'});
  assert.equal(m.mode,'choose');
  assert.deepEqual(m.work,[]);assert.deepEqual(m.sources,[]);
  assert.match(agentStartText(m),/verify native evidence/);
  assert.equal(m.revision,'R1');
});
test('Agent Start remains a primary read-only view',()=>{
  assert.ok(PRIMARY_TABS.some(([id,name])=>id==='start'&&name==='Agent Start'));
  assert.equal(JSON.stringify(p),original);
});
