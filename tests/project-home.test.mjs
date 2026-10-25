import assert from 'node:assert/strict';
import test from 'node:test';
import { projectHomeModel } from '../actions.js';

const source = { t: 'Project concept note: Owner use and source model', u: 'https://github.com/example/repo/blob/abc/docs/concept.md', s: 'CONCEPT_NOTE' };
const architecture = { t: 'Method C engineering contract and topology', u: 'https://github.com/example/repo/blob/abc/docs/architecture.md', s: 'ARCHITECTURE_CONCEPT' };
function project() {
  return {
    index: { project: { aim: 'Use original inputs without byte changes', aimSrc: 'https://github.com/example/repo/issues/1' },
      milestones: { M2: {order:2, wbs:'2',name:'Export'},M1:{order:1,wbs:'1',name:'Preview'} } },
    cards: { a:{label:'Preview build',milestone:'M1',state:'IN_PROGRESS',next:{text:'Run primary file',actor:'Builder'}},
             b:{label:'Old work',milestone:'M2',state:'NOT_APPLICABLE'} },
    fixtures: { repository:[source,architecture], intent:[{t:'Owner amendment',s:'OWNER_DIRECT'}],
      roadmap:[{t:'Read-only preview then export',s:'NEXT'}],
      inputs:[{t:'Original fixture SHA',s:'VERIFIED'}],
      knownIssues:[{t:'Stale result',s:'BLOCKED'}],pending:[{t:'Await owner',s:'PENDING'}] }
  };
}
test('Home uses existing source-backed records and full ordered roadmap without inventing acceptance', () => {
  const m=projectHomeModel(project());
  assert.equal(m.aim,'Use original inputs without byte changes');
  assert.deepEqual(m.concepts,[source]);
  assert.deepEqual(m.architecture,[architecture]);
  assert.deepEqual(m.roadmap.map(x=>x.t),['Read-only preview then export']);
  assert.deepEqual(m.milestones.map(x=>x.id),['M1','M2']);
  assert.deepEqual(m.currentTasks.map(x=>x.id),['a']);
  assert.equal(m.blockers.length,2);
});
test('missing concept and architecture remain absent, not implied by a roadmap or a VERIFIED task', () => {
  const p=project();
  p.fixtures.repository=[];
  p.cards.a.state='VERIFIED';
  const m=projectHomeModel(p);
  assert.equal(m.concepts.length,0);
  assert.equal(m.architecture.length,0);
  assert.equal(m.currentTasks.length,0);
  assert.equal(m.roadmap.length,1);
});
test('Home does not alter underlying fixtures or promote status', () => {
  const p=project();
  const old=JSON.stringify(p);
  projectHomeModel(p);
  assert.equal(JSON.stringify(p),old);
});
