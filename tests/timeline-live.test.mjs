import assert from 'node:assert/strict';
import test from 'node:test';
import {parseCycleTimelineComment,cycleTimelineModel,loadCycleTimeline,parseTimelineCardEvent,timelineCardModel,timelineInfoTemplate,timelinePageBrief} from '../timeline-live.js';

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

const action={
 project:'ciifr',eventId:'ciifr-geometry-ir-001',threadId:'ciifr-geometry-ir',
 actionRef:null,actorAlias:'coder-a',peerAlias:'reviewer-a',role:'CODER',
 wbs:'3.1',card:'geo-g1',kind:'ACTION',state:'NEEDS_OWNER',
 title:'Request IR start',details:'Delivered PR for independent review',
 ownerAsk:'Confirm reviewer availability',next:'Reviewer starts scoped review',
 source:NATIVE,smartTags:[
  {type:'WBS',label:'3.1',source:NATIVE},
  {type:'PLAN',label:'Independent review',source:NATIVE},
  {type:'ROADMAP',label:'Geometry G1',source:NATIVE},
  {type:'FIXTURE',label:'A/B/C workbench candidate',source:NATIVE}
 ]};
const comment2=(item,id=101)=>({...comment({},id),
 body:'CYCLE_TIMELINE_CARD v2\n'+F+'json\n'+JSON.stringify(item)+'\n'+F});

test('ACTION card has WBS, Owner request and typed Smart Tags',()=>{
 const record=parseTimelineCardEvent(comment2(action),'ciifr');
 assert.equal(record.kind,'ACTION');
 const m=timelineCardModel([comment2(action)],project);
 assert.equal(m.cards.length,1);
 assert.equal(m.ownerRequests.length,1);
 assert.deepEqual(m.cards[0].smartTags.map(t=>t.type),['WBS','PLAN','ROADMAP','FIXTURE']);
 assert.equal(m.cards[0].scope,'SOURCE_MATCHED');
});
test('IR starting changes prior ACTION into INFO with linked history, not independent review PASS',()=>{
 const info={...action,eventId:'ciifr-geometry-ir-002',actionRef:action.eventId,
 actorAlias:'reviewer-a',peerAlias:'coder-a',role:'REVIEWER_IR',
 kind:'INFO',state:'HANDED_OFF',ownerAsk:'',title:'IR received workbench and started',
 details:'IR has started examination; findings not yet returned.',
 next:'Review source fixtures and report independent findings'};
 const m=timelineCardModel([comment2(action),comment2(info,102)],project);
 assert.equal(m.cards.length,1);
 assert.equal(m.cards[0].kind,'INFO');
 assert.equal(m.cards[0].state,'HANDED_OFF');
 assert.equal(m.ownerRequests.length,0);
 assert.equal(m.events.length,2);
 const brief=timelinePageBrief(m.cards[0]);
 assert.match(brief,/Plan|PLAN/);
 assert.match(brief,/FIXTURE.*candidate/);
 assert.match(brief,/NOT a Page update/);
 const templ=timelineInfoTemplate(action);
 assert.match(templ,/CYCLE_TIMELINE_CARD v2/);
 assert.match(templ,/ciifr-geometry-ir-001/);
});
test('Unreferenced Info cannot falsely close a newer ACTION',()=>{
 const later={...action,eventId:'ciifr-geometry-ir-003',
  state:'OPEN',ownerAsk:'',next:'Request later review'};
 const stray={...action,eventId:'ciifr-geometry-ir-004',kind:'INFO',state:'DONE',
 actionRef:action.eventId,ownerAsk:'',details:'Stale response',next:'None'};
 const m=timelineCardModel([
  comment2(action),comment2(later,102),comment2(stray,103)],project);
 assert.equal(m.cards.some(c=>c.kind==='ACTION'),true);
 assert.equal(m.groups.some(g=>g.wbs==='UNRESOLVED_HANDOFF'),true);
});
test('Invalid Info reply, undocumented tag or broken scope never closes owner action',()=>{
 const stale={...action,eventId:'ciifr-geometry-ir-005',
   kind:'INFO',state:'HANDED_OFF',actionRef:'no-prior-action',
   ownerAsk:'',details:'Not grounded',next:''};
 const wrong={...action,eventId:'ciifr-geometry-ir-006',wbs:'3',kind:'INFO',
   state:'HANDED_OFF',actionRef:action.eventId,ownerAsk:'',details:'wrong WBS',next:''};
 const model=timelineCardModel([comment2(action),comment2(stale,102),comment2(wrong,103)],project);
 assert.equal(model.ownerRequests.length,1);
 assert.equal(model.unresolved,2);
 assert.equal(parseTimelineCardEvent(comment2({...action,smartTags:[{type:'ACCEPTED',label:'Pass',source:NATIVE}]},104),'ciifr'),null);
 assert.equal(parseTimelineCardEvent(comment2({...action,kind:'INFO',state:'OPEN',actionRef:action.eventId},105),'ciifr'),null);
});
