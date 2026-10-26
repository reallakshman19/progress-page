import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ciifrRoiModel } from '../roi.js';
import { projectHomeModel } from '../actions.js';

const fixtures = JSON.parse(readFileSync(new URL('../data/ciifr/fixtures.json', import.meta.url), 'utf8'));
const model = () => ciifrRoiModel('ciifr', fixtures);
test('the original 18 sources are partitioned without hiding or changing one', () => {
  const before = JSON.stringify(fixtures);
  const r = model();
  assert.equal(r.rawCount, 18);
  assert.equal(r.inventory.length, 18);
  assert.deepEqual(r.inventory.map(x => x.category), [
    'history','prospective','reference','reference','reference','reference',
    'history','history','governance','governance','governance',
    'prospective','prospective','prospective','prospective','history','prospective','prospective'
  ]);
  assert.equal(r.unclassified.length, 0);
  assert.deepEqual(r.inventory.map(x => x.index), Array.from({length:18},(_,i)=>i));
  assert.equal(JSON.stringify(fixtures), before);
});
test('one E0/E1 and one RIGID priority, with both original link identities', () => {
  const r = model();
  assert.equal(r.high.length,4);
  assert.equal(r.medium.length,4);
  assert.deepEqual(r.high.map(x=>x.id),[
    'effective-job-provenance','source-backed-reader','e0-e1','rigid-weight'
  ]);
  const e=r.high.find(x=>x.id==='e0-e1');
  const w=r.high.find(x=>x.id==='rigid-weight');
  assert.deepEqual(e.sources.filter(x=>x.from.startsWith('highRoi')).map(x=>x.from),['highRoi[11]','highRoi[13]']);
  assert.deepEqual(w.sources.filter(x=>x.from.startsWith('highRoi')).map(x=>x.from),['highRoi[12]','highRoi[14]']);
  assert.ok(e.sources.some(x=>x.item.u?.includes('/issues/167')));
  assert.ok(w.dependency.includes('Writer HOLD'));
});
test('Medium choices are linked to roadmap, pending or observed G1/G2 sources and preserve gate language', () => {
  const r = model();
  assert.deepEqual(r.medium.map(x=>x.id),['g2-topology','g1-renderer','field-ledger-ux','e4-branch-label']);
  for (const x of [...r.high,...r.medium]) {
    assert.ok(x.sources.length, x.id);
    assert.match(x.impact, /avoid|reduce|potential|improve/i);
    assert.match(x.likelihood, /conditional|candidate|blocked|prospective/i);
    assert.match(x.effort, /unmeasured/i);
    assert.match(x.dependency, /\b(?:M\d+|WBS|original|SOURCE|E3)\b/i);
    assert.ok(!/measured savings\s*PASS/i.test(x.title));
  }
  assert.ok(r.medium.find(x=>x.id==='field-ledger-ux').sources.some(x=>x.item.s==='READONLY_ELEMENT_PREVIEW'));
  assert.ok(r.medium.find(x=>x.id==='e4-branch-label').sources.some(x=>x.item.s==='E4_PLANNED'));
});
test('contrary classification: historical CI 6/6 receipt is not current High ROI or engineering PASS', () => {
  const r=model();
  const receipt=r.inventory[15];
  assert.equal(receipt.category,'history');
  assert.equal(receipt.item.s,'CI_SCOPED_PASS');
  assert.ok(![...r.high,...r.medium].some(x=>x.sources.some(s=>s.from==='highRoi[15]')));
});
test('changed source or newly added source fails closed without overwriting audit data', () => {
  const altered=structuredClone(fixtures);
  altered.highRoi[13].t='UNREVIEWED DIFFERENT PRIORITY';
  altered.highRoi.push({t:'Claim of millions saved',s:'MEASURED_PASS'});
  const r=ciifrRoiModel('ciifr',altered);
  assert.deepEqual(r.unclassified.map(x=>x.index),[13,18]);
  assert.ok(!r.high.find(x=>x.id==='e0-e1').sources.some(x=>x.from==='highRoi[13]'));
  assert.ok(!r.high.some(x=>x.sources.some(y=>y.item.s==='MEASURED_PASS')));
});
test('non-CIIFR projects and unmodified Project Home contract remain unaffected', () => {
  assert.equal(ciifrRoiModel('geometry',fixtures),null);
  const p={index:{project:{key:'ciifr'}},fixtures,cards:{}};
  const home=projectHomeModel(p);
  assert.equal(home.roi.high.length,4);
  assert.equal(home.decisions.length,4);
  assert.equal(projectHomeModel({index:{project:{key:'other'}},fixtures,cards:{}}).roi,null);
});

test('WBS-filtered projection retains original identity and excludes the other WBS opportunities', () => {
  const scoped = Object.fromEntries(Object.entries(fixtures).map(([key, list]) =>
    [key, list.filter(item => !item.milestone || ['M12','M13','M14'].includes(item.milestone))
      .map(item => item.milestone ? item : {...item,wholeProject:true})]));
  const r = ciifrRoiModel('ciifr', scoped, fixtures);
  assert.deepEqual(r.inventory.map(x=>x.index), [0,1,2,3,4,5,8,9,10,16,17]);
  assert.equal(r.unclassified.length,0);
  assert.ok(!r.high.some(x=>['e0-e1','rigid-weight','effective-job-provenance'].includes(x.id)));
  assert.deepEqual(r.medium.map(x=>x.id),['g2-topology','g1-renderer']);
});
