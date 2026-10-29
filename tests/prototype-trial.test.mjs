import assert from 'node:assert/strict';
import test from 'node:test';
import {PROPERTY_CASES,SOURCE_API,nativeCandidate,readNativeCandidate,
  localPreviewUrl,trialSetup,trialPacket} from '../prototype-trial.js';

const HEAD='d3fbd4041ef4434b4cf5b3c22459f06167be2729';
const fixture={head:{sha:HEAD},state:'open',draft:true};

test('Property Transfer trial is scoped to actual native PR and five concrete R2 scenarios',()=>{
 assert.equal(SOURCE_API,'https://api.github.com/repos/reallakshman19/XML_Compare_Utilities/pulls/232');
 assert.equal(PROPERTY_CASES.length,5);
 assert.deepEqual(PROPERTY_CASES.map(c=>c.id),['PT-01','PT-02','PT-03','PT-04','PT-05']);
 assert.ok(PROPERTY_CASES.find(c=>c.id==='PT-03').expected.includes('old applied output'));
 assert.ok(PROPERTY_CASES.every(c=>!/Owner PASS|authoriz/i.test(c.expected)));
});

test('candidate reads pinned exact source head and does not treat PR shape as runtime approval',async()=>{
 const x=await readNativeCandidate(async(url,options)=>{
  assert.equal(url,SOURCE_API);
  assert.equal(options.cache,'no-store');
  return{ok:true,json:async()=>fixture};
 });
 assert.equal(x.head,HEAD);
 assert.equal(x.draft,true);
 assert.equal(x.state,'open');
 assert.equal(x.source,'https://github.com/reallakshman19/XML_Compare_Utilities/pull/232');
 assert.match(trialSetup(x.head),new RegExp('git checkout --detach '+HEAD));
});

test('missing source, malformed SHA or failed API read do not produce a pinned setup',async()=>{
 for(const value of [null,{}, {head:{sha:'a'.repeat(12)},draft:true,state:'open'},
   {head:{sha:HEAD},draft:'true',state:'open'}]){
  assert.throws(()=>nativeCandidate(value),/source response/);
 }
 assert.equal(trialSetup('a'.repeat(9)),null);
 await assert.rejects(readNativeCandidate(async()=>({ok:false})),/unavailable/);
 assert.equal(trialPacket({}).includes('Observed GitHub source head: NOT_CHECKED'),true);
});

test('only explicitly entered loopback HTTP locations can launch an unverified local preview',()=>{
 for(const v of ['http://127.0.0.1:8080/','http://localhost:8080/']){
  assert.equal(localPreviewUrl(v),v);
 }
 for(const v of ['https://example.com/','http://evil.invalid/','javascript:alert(1)',
  'http://127.0.0.1:8080/?token=1','http://127.0.0.1:8080/#/test',
  'http://u:p@localhost:8080/','https://localhost:8080/','file:///tmp/index.html']){
  assert.equal(localPreviewUrl(v),null,v);
 }
});

test('local result is self-reported, NOT_RUN by default, and cannot certify engineering acceptance',()=>{
 const report=trialPacket({candidate:nativeCandidate(fixture),
  previewUrl:'http://localhost:8080/',
  localConfirmed:true,outcomes:{'PT-01':'PASS','PT-02':'FAIL','PT-03':'BOGUS'}});
 assert.match(report,/User attests local checkout of this head: YES \(not independently verified\)/);
 assert.match(report,/PT-01 Two independent Property paths: PASS/);
 assert.match(report,/PT-02 Normal \/ Nodal state isolation: FAIL/);
 assert.match(report,/PT-03 Stale CSV export revoked: NOT_RUN/);
 assert.doesNotMatch(report,/http:\/\/localhost:8080\//);
 assert.match(report,/NOT ENGINEERING OR OWNER ACCEPTANCE/);
});

test('sanitize private notes from a copied local report',()=>{
 const report=trialPacket({notes:{
  'PT-01':'test https://chatgpt.com/c/private',
  'PT-02':'see /home/user/PRIVATE.cii',
  'PT-03':'Local test only, output disabled while loading.'
 }});
 assert.doesNotMatch(report,/chatgpt\.com|PRIVATE\.cii/);
 assert.match(report,/note withheld: potentially private content/);
 assert.match(report,/output disabled while loading/);
});
