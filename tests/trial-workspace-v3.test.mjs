import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {TRIAL3_SCHEMA,TRIAL3_TEMPLATES,TRIAL3_PROPERTY_CASES,
  trial3Profiles,trial3ValidateRegistry} from '../trial-templates.js';
import {trial3Summary,trial3Packet,trial3ReadHead,trial3Loopback,trial3Checkout}
 from '../trial-workspace.js';

const project=(id)=>({
 index:JSON.parse(readFileSync(new URL('../data/'+id+'/index.json',import.meta.url),'utf8')),
 cards:JSON.parse(readFileSync(new URL('../data/'+id+'/cards.json',import.meta.url),'utf8'))
});
const SHA='a'.repeat(40);
test('V3 registry is one versioned, bounded source of project trials',()=>{
 assert.equal(TRIAL3_SCHEMA,'progress-trial-template/v1');
 assert.equal(trial3ValidateRegistry(),true);
 assert.equal(TRIAL3_TEMPLATES.length,4);
 assert.equal(TRIAL3_PROPERTY_CASES.length,5);
 const keys=TRIAL3_TEMPLATES.map(x=>x.project+'/'+x.id);
 assert.equal(new Set(keys).size,keys.length);
 assert.ok(TRIAL3_TEMPLATES.every(x=>x.schema===TRIAL3_SCHEMA));
});
test('real published Page WBS and existing card govern project profile eligibility',()=>{
 const node=trial3Profiles('ciifr-node',project('ciifr-node'));
 const ciifr=trial3Profiles('ciifr',project('ciifr'));
 const g9=trial3Profiles('g9v35',project('g9v35'));
 assert.deepEqual(node.map(x=>x.id),['property-r0']);
 assert.deepEqual(ciifr.map(x=>x.id),['r3-launch-guide','geometry-rca']);
 assert.deepEqual(g9.map(x=>x.id),['qrt-grid']);
 const wrong=project('ciifr-node');wrong.index.milestones.M3.wbs='999';
 assert.deepEqual(trial3Profiles('ciifr-node',wrong),[]);
 const wrongCard=project('ciifr-node');wrongCard.cards['node-r0-code'].milestone='M1';
 assert.deepEqual(trial3Profiles('ciifr-node',wrongCard),[]);
 assert.deepEqual(trial3Profiles('g9v35',project('ciifr')),[]);
 for(const key of ['topofix','doc2table','learned','landing-live','nudge']){
  assert.deepEqual(trial3Profiles(key,project(key)),[],key);
 }
});
test('different trial modes never fabricate a native runner or source attestation',()=>{
 const [node,ciifr,g9]=['ciifr-node','ciifr','g9v35'].map(k=>trial3Profiles(k,project(k))[0]);
 assert.equal(node.launch.kind,'local-web');
 assert.equal(ciifr.launch.kind,'source-review');
 assert.equal(g9.launch.kind,'hosted-review');
 assert.equal(trial3Checkout(ciifr,SHA),null);
 assert.equal(trial3Checkout(g9,SHA),null);
 assert.match(trial3Checkout(node,SHA),new RegExp('git checkout --detach '+SHA));
 assert.equal(trial3Checkout(node,'NOT_CHECKED'),null);
});
test('native PR exact source checks reject malformed, wrong-number and unavailable reads',async()=>{
 const t=trial3Profiles('ciifr-node',project('ciifr-node'))[0];
 const mock=async(url,options)=>{
  assert.equal(url,t.candidate.api);
  assert.equal(options.cache,'no-store');
  return {ok:true,json:async()=>({number:232,state:'open',draft:true,head:{sha:SHA}})};
 };
 assert.equal((await trial3ReadHead(t,mock)).head,SHA);
 await assert.rejects(trial3ReadHead(t,async()=>({ok:false})),/unavailable/);
 await assert.rejects(trial3ReadHead(t,async()=>({ok:true,json:async()=>({number:231,state:'open',draft:true,head:{sha:SHA}})})),/wrong native PR/);
 await assert.rejects(trial3ReadHead(t,async()=>({ok:true,json:async()=>({number:232,state:'open',draft:true,head:{sha:'short'}})})),/unverifiable/);
 await assert.rejects(trial3ReadHead(trial3Profiles('g9v35',project('g9v35'))[0]),/no supported/);
});
test('summaries and reports are scoped to only selected project/template, unknown never zero',()=>{
 const p=trial3Profiles('ciifr',project('ciifr'))[1];
 assert.deepEqual(trial3Summary(p),{PASS:0,FAIL:0,BLOCKED:0,NOT_RUN:2,observed:0,total:2});
 const outcomes={'GEO-01':'PASS','GEO-02':'INVALID'};
 const counted=trial3Summary(p,outcomes);
 assert.deepEqual(counted,{PASS:1,FAIL:0,BLOCKED:0,NOT_RUN:1,observed:1,total:2});
 const report=trial3Packet(p,{outcomes,notes:{'GEO-01':'saw unexpected value',
  'GEO-02':'https://chatgpt.com/c/private'}});
 assert.match(report,/ciifr\/geometry-rca/);
 assert.match(report,/WBS: 3/);
 assert.match(report,/GEO-02 REST and datum configuration: NOT_RUN/);
 assert.match(report,/note withheld/);
 assert.doesNotMatch(report,/chatgpt\.com|PT-01|Owner product acceptance: PASS/);
});
test('Loopback-only local address rejects private query tokens and external origin',()=>{
 assert.equal(trial3Loopback('http://localhost:8080/'),'http://localhost:8080/');
 assert.equal(trial3Loopback('http://127.0.0.1:8080/'),'http://127.0.0.1:8080/');
 for(const value of ['https://localhost:8080/','https://github.com/evil','http://notlocal/',
  'http://127.0.0.1:8080/?token=secret','http://u:secret@localhost:8080/',
  'file:///etc/passwd','javascript:alert(1)','http://localhost:8080/#/run']){
  assert.equal(trial3Loopback(value),null,value);
 }
});
