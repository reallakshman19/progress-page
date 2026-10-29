import assert from 'node:assert/strict';
import test from 'node:test';
import {parseCycleTimelineComment,cycleTimelineModel,loadCycleTimeline} from '../timeline-live.js';

const F=String.fromCharCode(96).repeat(3);
const NATIVE='https://github.com/reallakshman19/XML_Compare_Utilities/issues/180';
const event={project:'ciifr',eventId:'ciifr-case-0001',actorAlias:'coder-a',
  peerAlias:'oracle-a',role:'CODER',wbs:'3.1',card:'geo-g1',
  status:'WORKING',ownerAsk:'',next:'Verify original fixture before editing',
  source:NATIVE,fixtureRefs:[]};
const comment=(data,id=1)=>({id,created_at:'2026-10-29T01:00:00Z',
  html_url:'https://github.com/reallakshman19/Common/issues/564#issuecomment-'+id,
  body:'CYCLE_TIMELINE_EVENT v1\n'+F+'json\n'+JSON.stringify(data)+'\n'+F});
const project={index:{project:{key:'ciifr'},milestones:{M12:{wbs:'3'},M13:{wbs:'3.1'}}},
  cards:{'geo-g1':{milestone:'M13'}}};

test('valid operational event never asserts verified identity or acceptance',()=>{
  const e=parseCycleTimelineComment(comment(event),'ciifr');
  assert.equal(e.provenance,'REPORTED_UNVERIFIED');
  assert.equal(cycleTimelineModel([comment(event)],project).groups[0].wbs,'3.1');
});
test('latest update supersedes prior NEEDS_OWNER without deleting source history',()=>{
  const ask={...event,eventId:'ciifr-case-0002',status:'NEEDS_OWNER',ownerAsk:'Choose tested browser'};
  const later={...event,eventId:'ciifr-case-0003',status:'RETURN_POSTED'};
  const first=cycleTimelineModel([comment(ask)],project);
  assert.equal(first.ownerRequests.length,1);
  const second=cycleTimelineModel([comment(ask),comment(later,2)],project);
  assert.equal(second.ownerRequests.length,0);
  assert.equal(second.events.length,2);
  assert.equal(second.latest[0].status,'RETURN_POSTED');
});
test('wrong WBS/card link cannot produce Owner action',()=>{
  const e={...event,status:'NEEDS_OWNER',ownerAsk:'Choose browser',wbs:'3'};
  const m=cycleTimelineModel([comment(e)],project);
  assert.equal(m.groups[0].wbs,'UNRESOLVED_SCOPE');
  assert.equal(m.ownerRequests.length,0);
});
test('malformed, private, role, source or unlisted fields fail closed',()=>{
  for(const candidate of [
    {...event,actorAlias:'12345678-1234-1234-1234-123456789abc'},
    {...event,next:'chatgpt.com/c/12345678-1234-1234-1234-123456789abc'},
    {...event,peerAlias:'https://chatgpt.com/c/private'},
    {...event,role:'OWNER'}, {...event,extra:'PASS'},
    {...event,source:'https://drive.google.com/secret'},
    {...event,status:'NEEDS_OWNER',ownerAsk:''},
    {...event,fixtureRefs:['https://chatgpt.com/c/private']}
  ])assert.equal(parseCycleTimelineComment(comment(candidate),'ciifr'),null);
  assert.equal(cycleTimelineModel(null,project).health,'UNKNOWN');
});
test('same event id does not create duplicate status or Owner requests',()=>{
  const ask={...event,status:'NEEDS_OWNER',ownerAsk:'one action'};
  const res=cycleTimelineModel([comment(ask),comment({...ask,next:'duplicate'},2)],project);
  assert.equal(res.events.length,1);
  assert.equal(res.ignored,1);
  assert.equal(res.ownerRequests.length,1);
  assert.equal(res.health,'PARTIAL');
});
test('bounded API fetch reports errors/truncation instead of a false empty board',async()=>{
  await assert.rejects(loadCycleTimeline('ciifr',async()=>({ok:false,status:403})),/unavailable/);
  await assert.rejects(loadCycleTimeline('ciifr',async()=>({ok:true,json:async()=>Array(100).fill({})})),/pagination/);
  assert.deepEqual(await loadCycleTimeline('ciifr',async()=>({ok:true,json:async()=>[]})),[]);
});
