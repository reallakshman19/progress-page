import assert from 'node:assert/strict';
import test from 'node:test';
import { onboardingModel, COMMON_START_HERE } from '../onboarding.js';
import { onboardingWbsGroup } from '../progress.js';

const LINK = 'https://github.com/example/project/issues/25#issuecomment-12';
const ASSIGN = 'https://github.com/example/project/issues/25#issuecomment-10';
const NEXT_ASSIGN = 'https://github.com/example/project/issues/25#issuecomment-23';
function fixture(status, note='6ad12345', milestone='M12', url=LINK, assignment=ASSIGN, commit=null) {
  return { t: 'recorded check ONB_ASSIGNMENT=' + assignment + (commit ? ' ONB_COMMIT=' + commit : ''),
    s: status, n: note, milestone, u: url };
}
function project() {
  return {
    index: {
      project: { key: 'ciifr' },
      groups: { 'r3-geometry-onboarding': { title: 'Geometry onboarding', order: 1 } },
      chats: { builder: { id8: '6ad12345', label: 'Builder' }, successor: { id8: '6ad99999', label: 'Successor' } },
      revisions: [{ id: 'R3', status: 'current' }],
      milestones: {
        M12: { order: 12, wbs: '3', name: 'Seam', cap: 'NOT_DEMONSTRATED' },
        M13: { order: 13, wbs: '3.1', name: 'Manual/SVG', cap: 'NOT_DEMONSTRATED' },
        M14: { order: 14, wbs: '3.2', name: 'Topology', cap: 'NOT_DEMONSTRATED' },
      }
    },
    cards: { 'geo-g0': { state: 'NOT_STARTED', group: 'r3-geometry-onboarding',
      milestone: 'M12', order: 1, label: 'G0', next: { actor: 'Oracle', text: 'Resolve PR overlap' },
      who: {}, refs: [{ k: 'comment', l: 'Onboarding assignment', u: ASSIGN }] } },
    fixtures: { repository: [], pending: [] }
  };
}
const CODES = ['ONB_SOURCES_CHECKED', 'ONB_ACCESS_VERIFIED', 'ONB_READY'];

test('only projects with a live onboarding group show readiness', () => {
  const p = project();
  assert.equal(onboardingModel(p).stage, 0);
  assert.equal(onboardingModel(p).recipient, null);
  assert.deepEqual(onboardingModel(p).nextTwo.map(x=>x.id), ['M13', 'M14']);
  delete p.index.groups['r3-geometry-onboarding'];
  assert.equal(onboardingModel(p), null);
});

test('existing protocol links and a VERIFIED card never imply source/access readiness', () => {
  const p = project();
  p.cards['geo-g0'].state = 'VERIFIED';
  p.fixtures.pending.push(fixture(CODES[0]));
  assert.equal(onboardingModel(p).stage, 0);
  p.cards['geo-g0'].who.chat = 'builder';
  assert.equal(onboardingModel(p).stage, 1);
  assert.equal(onboardingModel(p).stageLabel, 'Sources checked');
});

test('stages require the complete ordered chain, not one convenient self-claim', () => {
  const p = project(); p.cards['geo-g0'].who.chat='builder';
  p.fixtures.pending.push(fixture(CODES[2]));
  assert.equal(onboardingModel(p).stage, 0);
  p.fixtures.pending.push(fixture(CODES[0]));
  assert.equal(onboardingModel(p).stage, 1);
  p.fixtures.pending.push(fixture(CODES[1]));
  assert.equal(onboardingModel(p).stage, 3);
});

test('wrong participant, wrong milestone and non-GitHub evidence fail closed', () => {
  const p = project(); p.cards['geo-g0'].who.chat='builder';
  p.fixtures.pending.push(fixture(CODES[0], '6ad99999'));
  p.fixtures.pending.push(fixture(CODES[0], '6ad12345', 'M15'));
  p.fixtures.pending.push(fixture(CODES[0], '6ad12345', 'M12', 'https://example.com/fake'));
  assert.equal(onboardingModel(p).stage, 0);
});

test('successor cannot inherit predecessor source/access assertions', () => {
  const p = project(); p.cards['geo-g0'].who.chat='builder';
  CODES.forEach(code => p.fixtures.pending.push(fixture(code)));
  assert.equal(onboardingModel(p).stage, 3);
  p.cards['geo-g0'].who.chat='successor';
  assert.equal(onboardingModel(p).stage, 0);
  assert.equal(onboardingModel(p).recipient, '6ad99999');
});

test('closed onboarding card does not grant readiness', () => {
  const p=project();
  p.cards['geo-g0'].state = 'NOT_APPLICABLE';
  assert.equal(onboardingModel(p), null);
});

test('prefers pinned Contribution/Handoff and Continuity over moving main links', () => {
  const p=project();
  p.fixtures.repository = [
    {t:'main',u:'https://github.com/reallakshman19/Common/blob/main/skills/agent-work/CONTRIBUTION_HANDOFF.md'},
    {t:'pinned',u:'https://github.com/reallakshman19/Common/blob/a9491531/skills/agent-work/CONTRIBUTION_HANDOFF.md'},
    {t:'continuity',u:'https://github.com/reallakshman19/Common/blob/a9491531/skills/agent-work/oracle-continuity/PROTOCOL.md'}
  ];
  const m=onboardingModel(p);
  assert.equal(m.protocols.length,2);
  assert.equal(m.protocols[0].t,'pinned');
});

test('one Common Start Here navigation link is public guidance, not readiness evidence', () => {
  assert.equal(COMMON_START_HERE, 'https://github.com/reallakshman19/Common/blob/main/skills/agent-work/START_HERE.md');
  const p = project();
  assert.equal(onboardingModel(p).stage, 0);
  assert.equal(onboardingModel(p).protocols.length, 0);
});

test('a new assignment for the SAME participant invalidates older sourced readiness', () => {
  const p = project(); p.cards['geo-g0'].who.chat = 'builder';
  CODES.forEach(code => p.fixtures.pending.push(fixture(code)));
  assert.equal(onboardingModel(p).stage, 3);
  p.cards['geo-g0'].refs.push({ k: 'comment', l: 'Onboarding assignment', u: NEXT_ASSIGN });
  assert.equal(onboardingModel(p).stage, 0, 'old assignment evidence must not count after reassignment');
  CODES.forEach(code => p.fixtures.pending.push(fixture(code, '6ad12345', 'M12', LINK, NEXT_ASSIGN)));
  assert.equal(onboardingModel(p).stage, 3);
});

test('candidate commit changes invalidate all prior readiness even with same participant and assignment', () => {
  const p = project(); p.cards['geo-g0'].who.chat = 'builder';
  const sha1 = '1111111111111111111111111111111111111111';
  const sha2 = '2222222222222222222222222222222222222222';
  p.index.milestones.M12.commit = sha1;
  CODES.forEach(code => p.fixtures.pending.push(fixture(code, '6ad12345', 'M12', LINK, ASSIGN, sha1)));
  assert.equal(onboardingModel(p).stage, 3);
  p.index.milestones.M12.commit = sha2;
  assert.equal(onboardingModel(p).stage, 0, 'different candidate never inherits old checks');
  p.fixtures.pending.push(fixture(CODES[0], '6ad12345', 'M12', LINK, ASSIGN, sha2));
  assert.equal(onboardingModel(p).stage, 1);
});

test('missing assignment reference cannot promote a previously assigned recipient', () => {
  const p = project(); p.cards['geo-g0'].who.chat = 'builder';
  CODES.forEach(code => p.fixtures.pending.push(fixture(code)));
  p.cards['geo-g0'].refs = [];
  assert.equal(onboardingModel(p).stage, 0);
});

test('same URL text embedded as a substring does not count as binding token', () => {
  const p = project(); p.cards['geo-g0'].who.chat = 'builder';
  const bad = fixture(CODES[0]); bad.t = 'not-an-onboarding-proof:' + 'ONB_ASSIGNMENT=' + ASSIGN;
  p.fixtures.pending = [bad];
  assert.equal(onboardingModel(p).stage, 0);
});

function fakeOnboardingDom() {
  const make = tag => ({
    tag, className:'', dataset:{}, children:[], events:{}, open:false,
    get childNodes() { return this.children; },
    set textContent(v) { this._text=String(v); this.children=[]; },
    get textContent() { return (this._text || '') + this.children.map(c=>typeof c==='string'?c:c.textContent||'').join(''); },
    append(...children) { this.children.push(...children); },
    setAttribute(key,value) { (this.attributes ||= {})[key]=String(value); },
    addEventListener(type,callback) { this.events[type]=callback; },
  });
  const old=globalThis.document;
  globalThis.document={createElement:make,createDocumentFragment:()=>make('fragment')};
  return { make, restore:()=>{ globalThis.document=old; } };
}
function walkNodes(root,predicate,found=[]) {
  if (root && typeof root === 'object') {
    if (predicate(root)) found.push(root);
    (root.children||[]).forEach(child=>walkNodes(child,predicate,found));
  }
  return found;
}
test('G0 is one closed-by-default WBS 3.0 disclosure with original task and readiness evidence', () => {
  const fake=fakeOnboardingDom();
  try {
    const p=project();
    p.index.groups['r3-geometry-onboarding'].title='Geometry: onboarding and integration seam';
    const model=onboardingModel(p);
    const card={...model.card,id:model.cardId};
    const ctx={wbsScope:'ciifr@R4',chats:{},links:{},rules:{}};
    const disclosure=onboardingWbsGroup(p,model.group,[card],ctx,model);
    assert.equal(disclosure.tag,'details');
    assert.equal(disclosure.open,false,'initial view is collapsed');
    assert.match(disclosure.children[0].textContent,/3\.0 · Onboarding and integration seam/);
    assert.match(disclosure.children[0].textContent,/Not assigned/);
    assert.equal(disclosure.dataset.onboarding,'M12');
    assert.equal(walkNodes(disclosure,n=>n.tag==='article'&&n.dataset.card==='geo-g0').length,1);
    assert.equal(walkNodes(disclosure,n=>n.className==='onb-now').length,0,
      'WBS card is not duplicated by a second task summary');
    assert.equal(walkNodes(disclosure,n=>n.className?.includes('onb-panel')).length,1);
  } finally { fake.restore(); }
});
test('expansion survives same-revision refresh and never leaks from R4 into frozen R3', () => {
  const fake=fakeOnboardingDom();
  try {
    const p=project(), m=onboardingModel(p), group=m.group, context=rev=>({wbsScope:'ciifr@'+rev});
    const first=onboardingWbsGroup(p,group,[],context('R4'),m);
    assert.equal(first.open,false);
    first.open=true;first.events.toggle();
    assert.equal(onboardingWbsGroup(p,group,[],context('R4'),m).open,true);
    assert.equal(onboardingWbsGroup(p,group,[],context('R3'),m).open,false);
    first.open=false;first.events.toggle();
    assert.equal(onboardingWbsGroup(p,group,[],context('R4'),m).open,false);
  } finally { fake.restore(); }
});


test('explicit onboarding task identity cannot silently choose another card',()=>{
  const p=project();
  p.cards['geo-g1']={...p.cards['geo-g0'],label:'G1',order:2};
  assert.equal(onboardingModel(p,{cardId:'geo-g1'}).cardId,'geo-g1');
  assert.equal(onboardingModel(p,{cardId:'wrong-card'}),null);
  assert.equal(onboardingModel(p,{cardId:'geo-g0'}).cardId,'geo-g0');
});

