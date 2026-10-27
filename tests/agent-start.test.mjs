import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { agentStartModel, agentStartText, agentStartTaskText, agentStartHref } from '../agent-start.js';
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
  assert.equal(m.choices.find(c=>c.key==='other').count,7,'legacy history must remain accessible');
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
test('Agent Start stays source-backed in Continuity Central, without becoming a new assignment',()=>{
  assert.ok(!PRIMARY_TABS.some(([id])=>id==='start'));
  assert.ok(PRIMARY_TABS.some(([id])=>id==='continuity'));
  assert.equal(JSON.stringify(p),original);
});
test('Doc to Table workstream chooser carries existing seven recorded descriptions',()=>{
  const doc=JSON.parse(readFileSync(new URL('../data/doc2table/index.json',import.meta.url),'utf8'));
  const model=agentStartModel({index:doc,cards:{}});
  assert.equal(model.choices.length,7);
  for(const g of model.choices){
    const originalMilestone=Object.values(doc.milestones).find(m=>m.wbs===g.key.slice(4));
    assert.equal(g.title,originalMilestone.name);
    assert.equal(g.description,originalMilestone.full);
    assert.ok(g.description.length>20);
  }
});


test('same-milestone task IDs have distinct URLs, packets and visible failed resolution',()=>{
  const family=wbsGroups(idx).find(g=>g.key==='wbs:4');
  const broad=agentStartModel(p,{family,step:'M18',revision:'R4'});
  assert.ok(broad.work.length>1);
  const first=agentStartModel(p,{family,step:'M18',revision:'R4',cardId:broad.work[0].id});
  const second=agentStartModel(p,{family,step:'M18',revision:'R4',cardId:broad.work[1].id});
  assert.notEqual(first.selected.id,second.selected.id);
  assert.notEqual(agentStartTaskText(first),agentStartTaskText(second));
  assert.ok(agentStartTaskText(first).includes('Task ID: '+first.selected.id));
  assert.ok(!agentStartTaskText(first).includes('WORK ITEM '+second.selected.id));
  assert.match(agentStartTaskText(first),/not an acknowledged assignment/);
  assert.match(agentStartTaskText(first),/NOT_RECORDED/);
  assert.equal(first.work.length,broad.work.length,'related evidence is not hidden');
  const missing=agentStartModel(p,{family,step:'M18',revision:'R4',cardId:'not-in-this-milestone'});
  assert.equal(missing.selectionError,true);
  assert.equal(missing.selected,null);
  assert.equal(agentStartTaskText(missing),null);
  assert.equal(JSON.stringify(p),original);
});
test('exact card URLs are stable and backward compatible',()=>{
  assert.equal(agentStartHref('ciifr','R4','wbs:4','M18','card/1'),
    '#/ciifr/start/R4/wbs%3A4/M18/card%2F1');
  assert.equal(agentStartHref('ciifr','R4','wbs:4','M18'),
    '#/ciifr/start/R4/wbs%3A4/M18');
});

test('exact task routes reject unknown projects and malformed identities without fallback',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const routeSource=app.slice(app.indexOf('function route()'),app.indexOf('// An older revision'));
  const state={projects:[{key:'ciifr'}],data:{ciifr:p}};
  const resolve=hash=>runInNewContext(routeSource+'\nroute();',{
    hash,state,VIEWS:['start','progress'],isActive:()=>true
  });
  const prefix='#/ciifr/start/R4/wbs%3A4/M18/';
  for(const hash of ['#/typo-project/start/R4/wbs%3A4/M18/wbs4-e1',
    '#/__proto__/start/R4/wbs%3A4/M18/wbs4-e1',prefix+'%ZZ',prefix+'wbs4-e1/extra',prefix]) {
    const route=resolve(hash);
    assert.equal(route.key,null,hash);
    assert.match(route.routeError,/No (?:project or )?task was substituted/);
  }
  const valid=resolve(prefix+'wbs4-e1');
  assert.equal(valid.key,'ciifr');assert.equal(valid.cardId,'wbs4-e1');assert.equal(valid.routeError,null);
  const legacy=resolve('#/ciifr/start/R4/wbs%3A4/M18');
  assert.equal(legacy.key,'ciifr');assert.equal(legacy.routeError,false);
});

test('selected task retains known recipient ID alongside its display label',()=>{
  const fixture=structuredClone(p);
  fixture.index.chats.test={label:'Reviewer',id8:'12345678'};
  fixture.cards['wbs4-e1'].who={role:'reviewer',chat:'test'};
  const family=wbsGroups(fixture.index).find(g=>g.key==='wbs:4');
  const m=agentStartModel(fixture,{family,step:'M18',revision:'R4',cardId:'wbs4-e1'});
  assert.equal(m.selected.recipient,'Reviewer · 12345678');
  assert.match(agentStartTaskText(m),/Recorded task recipient: Reviewer · 12345678/);
});

test('a verified task packet retains its parent milestone qualification limits and source',()=>{
  const fixture=structuredClone(p);
  Object.assign(fixture.index.milestones.M18,{cap:'NOT_DEMONSTRATED',
    canDo:'Read-only synthetic checks only; Writer remains HOLD.',
    capSrc:'https://github.com/owner/repo/issues/99#issuecomment-123'});
  fixture.cards['wbs4-e1'].state='VERIFIED';
  const family=wbsGroups(fixture.index).find(g=>g.key==='wbs:4');
  const text=agentStartTaskText(agentStartModel(fixture,{family,step:'M18',revision:'R4',cardId:'wbs4-e1'}));
  assert.match(text,/Recorded milestone capability: NOT_DEMONSTRATED/);
  assert.match(text,/Writer remains HOLD/);
  assert.ok(text.includes(fixture.index.milestones.M18.capSrc));
  assert.ok(!text.includes('Task ID: wbs4-e1-specialist'));
});

