import assert from 'node:assert/strict';
import test from 'node:test';
import { projectHomeModel, relayInputRecords, projectRoadmapGroups, renderProjectHome } from '../actions.js';
import { HOME_VIEWS, HOME_SUBTABS, CONTINUITY_VIEWS, CONTINUITY_SUBTABS, PRIMARY_TABS, primaryTabActive } from '../lifecycle.js';

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

const realRelay = { t:'WBS 2 input: source ZIP receipt', s:'RELAY_REGISTERED', u:'https://github.com/reallakshman19/Common/blob/123456/relay/AGENT_WORK/demo/H1/receipt.md', n:'Receiver bytes NOT_RUN' };
test('Oracle handoff appears from existing inputs without suggesting byte receipt or acceptance', () => {
  const p=project();
  p.fixtures.inputs.push(realRelay);
  assert.deepEqual(projectHomeModel(p).relayInputs,[realRelay]);
  assert.deepEqual(relayInputRecords(p.fixtures),[realRelay]);
});
test('Directory-only links and unlabelled private content do not masquerade as a delivered task handoff', () => {
  const p=project();
  p.fixtures.repository.push({t:'Relay directory only',u:'https://github.com/reallakshman19/Common/tree/main/relay/AGENT_WORK'});
  assert.deepEqual(projectHomeModel(p).relayInputs,[]);
  const protectedRef={t:'WBS 2 private input sanitized custody reference',s:'PRIVATE_CUSTODY',n:'Download NOT_RUN'};
  p.fixtures.inputs.push(protectedRef);
  assert.deepEqual(relayInputRecords(p.fixtures),[protectedRef]);
});
test('Published Common task-specific artifact register is discoverable without new fixture schema', () => {
  const fx={inputs:[{t:'Current workpack',u:'https://github.com/reallakshman19/Common/blob/abc/relay/WORKPACK-1/ARTIFACT_REGISTER.md',s:'PUBLISHED'}]};
  assert.equal(relayInputRecords(fx).length,1);
});

test('roadmap groups preserve exact records, order and immutable fixture identities', () => {
  const records = [
    {s:'NEXT',t:'Owner scope'}, {s:'G1_PLANNED',t:'Geometry G1'},
    {s:'E1_PLANNED',t:'Element E1'}, {s:'WBS3_EXECUTION_CHAIN',t:'G3 path'},
    {s:'E0_E1',t:'Source precondition'}, {s:'VNEXT_ACCEPTANCE',t:'Later release'}];
  const original = JSON.stringify(records);
  const grouped = projectRoadmapGroups(records);
  assert.deepEqual(grouped.map(g=>g.entries.map(x=>x.t)),
    [['Geometry G1','G3 path'],['Element E1','Source precondition'],['Owner scope','Later release']]);
  assert.equal(JSON.stringify(records),original);
  assert.equal(new Set(grouped.flatMap(g=>g.entries)).size,records.length);
});

// Minimal DOM fixture: validates default disclosure and in-section filtering without browser privileges.
function fakeElement(tag) {
  return {
    tag, children: [], hidden: false, events: {}, _text: '',
    set textContent(value) { this._text = String(value); this.children = []; },
    get textContent() { return this._text + this.children.map(n => typeof n === 'string' ? n : n.textContent).join(''); },
    append(...nodes) { this.children.push(...nodes); },
    setAttribute(key,value) { (this.attrs ||= {})[key] = value; },
    addEventListener(event,fn) { this.events[event]=fn; },
    querySelectorAll(name) {
      const found=[];
      const visit = n => { if (!n || typeof n !== 'object') return;
        if (n.tag === name) found.push(n); (n.children||[]).forEach(visit); };
      this.children.forEach(visit); return found;
    },
  };
}
function all(root, predicate) {
  const out=[]; const visit=n=>{if(!n||typeof n!=='object')return;
    if(predicate(n))out.push(n); (n.children||[]).forEach(visit);};
  visit(root);return out;
}
test('Home overview never expands the roadmap, and Sources collapses large searchable lists', () => {
  const prior=globalThis.document;
  globalThis.document={createElement:fakeElement};
  try {
    const p=project();
    p.index.project.key='demo';
    p.fixtures.repository.push(...Array.from({length:14},(_,i)=>({t:'Fixture '+i,s:'SOURCE'})));
    const overview=fakeElement('main');
    renderProjectHome(overview,p,'home');
    assert.equal(all(overview,n=>n.tag==='a'&&n.className==='home-tile').length,6);
    assert.equal(all(overview,n=>n.tag==='details').length,1,'only the short concept disclosure appears');
    const roadmap=fakeElement('main');
    renderProjectHome(roadmap,p,'home-roadmap');
    assert.ok(all(roadmap,n=>n.tag==='details').length>=2);
    assert.ok(all(roadmap,n=>n.tag==='details').every(n=>!n.open));
    const sources=fakeElement('main');
    renderProjectHome(sources,p,'home-sources');
    const input=all(sources,n=>n.tag==='input').find(n=>n.className==='home-filter');
    assert.ok(input,'large source section has a search control');
    input.value='Fixture 13';
    input.events.input();
    const list=all(sources,n=>n.tag==='details').find(n=>n.textContent.includes('Original sources'));
    const entries=list.querySelectorAll('li');
    assert.equal(entries.filter(n=>!n.hidden).length,1);
    assert.match(entries.find(n=>!n.hidden).textContent,/Fixture 13/);
  } finally {globalThis.document=prior;}
});

test('primary navigation prioritizes Project Home, WBS and a continuity central with stable native routes', () => {
  const primary = PRIMARY_TABS.map(([route]) => route);
  const home = HOME_SUBTABS.map(([route]) => route);
  const continuity = CONTINUITY_SUBTABS.map(([route]) => route);
  assert.deepEqual(primary, ['home', 'progress', 'continuity']);
  assert.deepEqual(home, ['home','home-roadmap','home-sources','actions','timeline','cycle-board','test']);
  assert.deepEqual(continuity, ['continuity','start','oracle-continuity','home-risks','fixtures']);
  assert.deepEqual(HOME_VIEWS, home);
  assert.deepEqual(CONTINUITY_VIEWS, continuity);
  assert.equal(new Set([...home,...continuity]).size,home.length+continuity.length);
  for (const v of home) {
    assert.equal(primaryTabActive('home',v),true);
    assert.equal(primaryTabActive('continuity',v),false);
  }
  for (const v of continuity) {
    assert.equal(primaryTabActive('continuity',v),true,'legacy route '+v);
    assert.equal(primaryTabActive('home',v),false);
  }
  assert.equal(primaryTabActive('progress','progress'),true);
  assert.equal(primaryTabActive('progress','start'),false);
  assert.equal(primaryTabActive('continuity','progress'),false);
  assert.equal(primaryTabActive('actions','actions'),false);
});
