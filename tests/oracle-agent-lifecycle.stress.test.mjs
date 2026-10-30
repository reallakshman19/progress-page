// Deterministic adversarial stress: projection, concept-map integrity and
// stale-context non-promotion. Fixtures are synthetic; remote links are NOT authenticated.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluate} from './oracle-agent-stress-probe.mjs';
const graph=JSON.parse(readFileSync(new URL('fixtures/oracle-agent-concept-map.json',import.meta.url),'utf8'));
const SRC='https://github.com/acme/demo/issues/1#issuecomment-100';
const ASSIGN='https://github.com/acme/demo/issues/1#issuecomment-200';
const NEXT='https://github.com/acme/demo/issues/1#issuecomment-201';
const PIN='a'.repeat(40);
const codes=['ONB_SOURCES_CHECKED','ONB_ACCESS_VERIFIED','ONB_READY'];
const milestone='M5', id8='aaaa1111';
function fixture(code,who=id8,assignment=ASSIGN,commit=PIN){
 return {s:code,n:who,milestone,u:SRC,
  t:'source observation ONB_ASSIGNMENT='+assignment+' ONB_COMMIT='+commit};
}
function p(){
 const repo=graph.nodes.find(x=>x.id==='concept-note').proof;
 const arch=graph.nodes.find(x=>x.id==='concept-map').proof;
 return {index:{project:{key:'demo',aim:'Synthetic lifecycle stress only',aimSrc:SRC},
  revisions:[{id:'R1',status:'current'}],
  groups:{'agent-onboarding':{title:'Agent onboarding',order:1},
    oracle:{title:'Oracle coordination',order:2}},
  chats:{one:{id8, label:'Agent One'},two:{id8:'bbbb2222',label:'Agent Two'}},
  milestones:{M5:{order:5,wbs:'2',name:'Native source trial',commit:PIN,cap:'NOT_DEMONSTRATED',capSrc:SRC}}},
  cards:{onb1:{group:'agent-onboarding',milestone,state:'IN_PROGRESS',label:'Agent onboarding',
     who:{chat:'one',role:'Builder'},next:{actor:'Oracle',text:'Check sources'},
     refs:[{k:'comment',l:'Onboarding assignment',u:ASSIGN}],src:SRC},
   oracle1:{group:'oracle',milestone,state:'IN_PROGRESS',label:'Oracle continuity handover',
     who:{role:'Oracle'},next:{actor:'Owner',text:'Write exclusion UNKNOWN'},src:SRC}},
  audit:{events:[{kind:'BASELINE',card:'oracle1',summary:'Oracle continuity pending',source:SRC,rev:'R1'}]},
  fixtures:{repository:[{t:'CONCEPT_NOTE test protocol',s:'CONCEPT_NOTE',u:repo},
    {t:'ARCHITECTURE_CONCEPT concept map test',s:'ARCHITECTURE_CONCEPT',u:arch}],
    issues:[],inputs:[{t:'AGENT_INPUT private bytes unverified',s:'RELAY_REGISTERED',u:arch}],
    pending:[]},actions:{}};
}
function topology(g){
 const nodes=new Map(g.nodes.map(n=>[n.id,n]));
 if(nodes.size!==g.nodes.length)throw Error('duplicate node');
 for(const n of g.nodes){
   if(!/^https:\/\/github\.com\//.test(n.proof))throw Error('missing source '+n.id);
   if(!g.sourceRoot.includes('/blob/'))throw Error('unpinned source root');
   if(n.id!=='owner-aim'&&!n.proof.startsWith(g.sourceRoot))throw Error('non-pinned source '+n.id);
 }
 const edge=new Map(g.nodes.map(n=>[n.id,[]]));
 for(const [a,b] of g.edges){
  if(!nodes.has(a)||!nodes.has(b)||a===b)throw Error('dangling/cyclic self edge');
  edge.get(a).push(b);
 }
 const visited=new Set(),working=new Set();
 const walk=k=>{if(working.has(k))throw Error('concept map cycle');
  if(visited.has(k))return;working.add(k);
  for(const v of edge.get(k))walk(v);
  working.delete(k);visited.add(k);
 };
 walk('owner-aim');
 if(visited.size!==nodes.size)throw Error('unreachable source/fixture');
 return visited.size;
}
test('Stress map has exact source-pinned, connected acyclic concept→source→handoff→Page edges',()=>{
 assert.equal(graph.classification,'SYNTHETIC_TEST_GRAPH_NOT_OWNER_AUTHORITY');
 assert.equal(topology(graph),8);
 for(const mutation of [
  g=>g.edges.push(['page-projection','owner-aim']),
  g=>g.edges.push(['concept-map','not-exist']),
  g=>g.nodes.find(x=>x.id==='concept-map').proof='https://example.com/draft',
  g=>g.edges=g.edges.filter(([a,b])=>!(a==='agent-onboarding'&&b==='relay-custody'))
 ]){
  const changed=structuredClone(graph);mutation(changed);
  // Last graph mutation still reaches relay via native-sources: make it orphaned instead.
  if(changed.edges.length<graph.edges.length)changed.edges=changed.edges.filter(([a,b])=>b!=='relay-custody');
  assert.throws(()=>topology(changed));
 }
});
test('64 seeded onboarding races/reassignments/changed heads never inherit stale readiness',()=>{
 for(let i=0;i<64;i++){
  const project=p(),seed=(i*1103515245+12345)>>>0;
  const old=[...codes.map(c=>fixture(c))],newAssignment=(seed&1)?NEXT:ASSIGN;
  project.fixtures.pending=old;
  if(seed&2)project.cards.onb1.who.chat='two';
  if(seed&4)project.cards.onb1.refs.push({k:'comment',l:'Onboarding assignment',u:NEXT});
  if(seed&8)project.index.milestones.M5.commit='b'.repeat(40);
  if(seed&16)project.fixtures.pending.pop();
  if(seed&32)project.fixtures.pending.push(fixture('ONB_READY','bbbb2222',NEXT));
  const snapshot=JSON.stringify(project);
  const m=evaluate(project);
  const expected=(seed&2||seed&4||seed&8)?0:(seed&16)?2:3;
  assert.equal(m.onboardingStage,expected,'seed='+i);
  assert.equal(m.oracleCards.length,1);
  assert.ok(m.oracleCards.includes('oracle1'));
  assert.equal(m.selectedTask,'onb1');
  assert.equal(m.agentMode,'step');
  assert.match(m.packet,/not an acknowledged assignment/);
  assert.match(m.packet,/NOT_DEMONSTRATED/);
  assert.equal(m.conceptCount,1);
  assert.equal(m.architectureCount,1);
  assert.equal(m.relay.length,1);
  assert.equal(JSON.stringify(project),snapshot,'projections cannot mutate data');
 }
});
test('Oracle handover never emerges from coder G0 or a simulated verified card',()=>{
 const project=p();delete project.cards.oracle1;
 const base=evaluate(project);
 assert.deepEqual(base.oracleCards,[]);
 project.cards.onb1.state='VERIFIED';
 project.fixtures.pending.push(...codes.map(c=>fixture(c)));
 assert.deepEqual(evaluate(project).oracleCards,[]);
 assert.equal(evaluate(project).onboardingStage,3);
});
test('no source/architecture/relay and wrong WBS never silently hydrate',()=>{
 const project=p();
 project.fixtures.repository=[];project.fixtures.inputs=[];
 project.cards.onb1.milestone='M404';
 const m=evaluate(project);
 assert.equal(m.conceptCount,0);
 assert.equal(m.architectureCount,0);
 assert.equal(m.relay.length,0);
 assert.equal(m.onboardingStage,0);
 assert.equal(m.selectedTask,null);
 assert.equal(m.agentMode,'step'); // other work may still exist at original M5
});
