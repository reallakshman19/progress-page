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

test('Agent Start is an independent primary tab without mutating source',()=>{
  assert.ok(PRIMARY_TABS.some(([id,title])=>id==='start'&&title==='Agent Start'));
  assert.equal(JSON.stringify(p),original);
});
test('WBS 3.1 scope preserves milestone/candidate identity and boundary',()=>{
  const family=wbsGroups(idx).find(g=>g.key==='wbs:3');
  const m=agentStartModel(p,{family,step:'M13',revision:'R4'});
  assert.equal(m.focused.id,'M13');
  assert.equal(m.focused.wbs,'3.1');
  assert.ok(m.sources.some(x=>/issues\/186/.test(x.url)), 'recorded native review source remains accessible');
  const brief=agentStartText(m);
  assert.match(brief,/BOUNDARY/);
  assert.match(brief,/Exact candidate SHA: NOT_RECORDED/,'no SHA may be invented from a PR number or abbreviated note');
  assert.match(brief,/not an acknowledged assignment/);
  assert.doesNotMatch(brief,/RELEASED:/);
  assert.equal(JSON.stringify(p),original);
});
test('WBS 5 maps M11 HOLD correctly, never implying authorized transfer',()=>{
  const family=wbsGroups(idx).find(g=>g.key==='wbs:5');
  const m=agentStartModel(p,{family,step:'M11',revision:'R4'});
  assert.equal(m.focused.cap,'NOT_DEMONSTRATED');
  assert.match(agentStartText(m),/NOT_DEMONSTRATED/);
  assert.match(agentStartText(m),/Exact candidate SHA: NOT_RECORDED/);
  assert.match(agentStartText(m),/Writer\/TARGET1 permission/);
  assert.equal(JSON.stringify(p),original);
});
test('empty and historical scopes are read-only and do not fabricate tasks or evidence',()=>{
  const m=agentStartModel({index:{project:{key:'empty'},milestones:{M1:{name:'Step',order:1}},revisions:[{id:'R1',status:'current'}]},cards:{}},{step:'M1',revision:'R1'});
  assert.equal(m.revision,'R1');assert.deepEqual(m.work,[]);assert.deepEqual(m.sources,[]);
  assert.match(agentStartText(m),/verify original GitHub records/);
});
test('family limits task cards to that family, preserves other groups',()=>{
  const family=wbsGroups(idx).find(g=>g.key==='wbs:5');
  const m=agentStartModel(p,{family,revision:'R4'});
  assert.ok(m.work.every(w=>['M8','M9','M10','M11'].includes(w.milestoneId)));
  assert.equal(JSON.stringify(p),original);
});
