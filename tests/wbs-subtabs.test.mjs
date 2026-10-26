import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { wbsGroups, wbsFamily, wbsPick } from '../progress.js';

const milestones = {
  M8: {order:1,name:'XML roundtrip'},
  M9: {order:2,name:'XML v2'},
  M12: {order:12,wbs:'3',name:'Geometry intake'},
  M13: {order:13,wbs:'3.1',name:'Viewer'},
  M14: {order:14,wbs:'3.2',name:'Topology'},
  M17: {order:30,wbs:'4',name:'Element architecture'},
  M18: {order:31,wbs:'4.1',name:'Field map'},
  M1: {order:60,name:'Historical repair'},
};

test('WBS families contain only their numbered children and preserve milestone IDs', () => {
  const input = {milestones};
  const before = JSON.stringify(input);
  const groups = wbsGroups(input);
  assert.deepEqual(groups.map(g=>g.key),['wbs:3','wbs:4','other']);
  assert.deepEqual(groups.map(g=>g.steps.map(s=>s.key)),[
    ['M12','M13','M14'],['M17','M18'],['M8','M9','M1']]);
  assert.deepEqual(groups[0].steps.map(s=>s.short),['3.0','3.1','3.2']);
  assert.deepEqual(groups[1].steps.map(s=>s.short),['4.0','4.1']);
  assert.deepEqual(groups[2].steps.map(s=>s.short),['M8','M9','M1']);
  assert.equal(JSON.stringify(input),before,'source WBS values and evidence unchanged');
  assert.equal(groups.flatMap(g=>g.steps).length,Object.keys(milestones).length);
});

test('a real 3.0 step does not collide with a parent 3 record', () => {
  const index={milestones:{a:{wbs:'3',order:1,name:'Root'}, b:{wbs:'3.0',order:2,name:'Intake'}, c:{wbs:'3.1',order:3,name:'Build'}}};
  assert.deepEqual(wbsGroups(index)[0].steps.map(x=>x.short),['3 · Overview','3.0','3.1']);
});

test('new projects can contain WBS 1, 2, 3 and nested 3.1', () => {
  const index={milestones:{a:{wbs:'1',name:'First'},b:{wbs:'2',name:'Second'},c:{wbs:'3',name:'Third'},d:{wbs:'3.1',name:'Part'}}};
  assert.deepEqual(wbsGroups(index).map(x=>x.label),['WBS 1','WBS 2','WBS 3']);
  assert.deepEqual(wbsGroups(index)[2].steps.map(x=>x.short),['3.0','3.1']);
});

test('project without numbered WBS retains its legacy milestone interface', () => {
  assert.deepEqual(wbsGroups({milestones:{M1:{name:'One'},M2:{name:'Two'}}}),[]);
  assert.deepEqual(wbsGroups({milestones:{}}),[]);
});

test('family and step choices remain independent between projects, and can be cleared', () => {
  wbsFamily('demo-a','wbs:3'); wbsPick('demo-a','M13');
  wbsFamily('demo-b','other'); wbsPick('demo-b','M8');
  assert.equal(wbsFamily('demo-a'),'wbs:3');
  assert.equal(wbsPick('demo-a'),'M13');
  assert.equal(wbsFamily('demo-b'),'other');
  wbsFamily('demo-a',null);wbsPick('demo-a',null);
  assert.equal(wbsFamily('demo-a'),null);assert.equal(wbsPick('demo-a'),null);
  assert.equal(wbsPick('demo-b'),'M8');
});

test('published CIIFR R4 gives Geometry 3.x, Element 4.x and accessible legacy milestones', () => {
  const ciifr=JSON.parse(readFileSync(new URL('../data/ciifr/index.json', import.meta.url),'utf8'));
  const groups=wbsGroups(ciifr);
  assert.deepEqual(groups.map(g=>g.key),['wbs:3','wbs:4','other']);
  assert.equal(groups[0].label,'WBS 3','Geometry stays unchanged');
  assert.equal(groups[1].label,'WBS4- CIIFR-Element');
  assert.equal(wbsGroups({project:{key:'unrelated'},milestones:ciifr.milestones})[1].label,'WBS 4');
  assert.deepEqual(groups[0].steps.map(s=>s.key),['M12','M13','M14','M15','M16']);
  assert.deepEqual(groups[1].steps.map(s=>s.key),['M17','M18','M19','M20','M21','M22','M23']);
  assert.equal(groups.reduce((n,g)=>n+g.steps.length,0),Object.keys(ciifr.milestones).length);
  assert.deepEqual(groups[0].steps.map(s=>s.short),['3.0','3.1','3.2','3.3','3.4']);
});
