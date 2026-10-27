import assert from 'node:assert/strict';
import test from 'node:test';
import { oracleContinuityModel, renderOracleContinuity } from '../oracle-continuity.js';

function project() {
  return {
    index:{project:{key:'ciifr'},revisions:[{id:'R4',status:'current'}],
      groups:{geom:{title:'Geometry onboarding'},oracle:{title:'Oracle coordination'}},
      milestones:{M12:{wbs:'3',name:'Geometry G0'},M7:{name:'Oracle control'}}},
    cards:{
      'geo-g0':{group:'geom',milestone:'M12',label:'G0 · Onboarding and ownership',
        who:{role:'Builder'},state:'SUBMITTED',src:'https://github.com/example/pull/181'},
      'oracle-onboarding':{group:'oracle',milestone:'M7',label:'Oracle · onboarding and continuity',
        who:{role:'Oracle'},state:'IN_PROGRESS',now:'Control transfer not established',
        next:{actor:'Owner',text:'Verify write exclusion'},src:'https://github.com/example/pull/511'},
    },
    audit:{events:[{card:'oracle-onboarding',kind:'BASELINE',summary:'Oracle onboarding started',
      source:'https://github.com/example/issues/18',rev:'R4'}]}
  };
}
test('Oracle continuity excludes coding G0, tracks source-bound handover records only',()=>{
  const m=oracleContinuityModel(project());
  assert.deepEqual(m.cards.map(c=>c.id),['oracle-onboarding']);
  assert.equal(m.events.length,1);
  assert.equal(m.revision,'R4');
});
test('a coding-only onboarding card cannot create an Oracle handover',()=>{
  const p=project();delete p.cards['oracle-onboarding'];
  assert.equal(oracleContinuityModel(p).cards.length,0);
});
function element(tag){return {tag,className:'',children:[],open:false,
  get textContent(){return (this._text||'')+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');},
  set textContent(v){this._text=String(v);this.children=[];},
  append(...x){this.children.push(...x);},setAttribute(n,v){(this.attr||={})[n]=v;},
  addEventListener(){}};}
function walk(node,out=[]){if(node&&typeof node==='object'){out.push(node);(node.children||[]).forEach(x=>walk(x,out));}return out;}
test('Oracle continuity does not invent CIIFR 3.0 WBS or auto-authorize',()=>{
  const old=globalThis.document;
  globalThis.document={createElement:element};
  try {
    const root=element('main');renderOracleContinuity(root,project());
    const nodes=walk(root);
    const handovers=nodes.filter(n=>n.tag==='details'&&n.className==='home-detail oracle-handover');
    assert.equal(handovers.length,1);
    assert.equal(handovers[0].open,false);
    assert.match(handovers[0].textContent,/Whole-project continuity/);
    assert.doesNotMatch(handovers[0].textContent,/3\.0 · Onboarding and integration seam/);
    assert.match(root.textContent,/control epoch and write-exclusion proof: UNKNOWN/);
    assert.match(handovers[0].textContent,/Control transfer not established/);
    assert.doesNotMatch(handovers[0].textContent,/G0 · Onboarding/);
    assert.match(root.textContent,/not coder onboarding/i);
  } finally {globalThis.document=old;}
});
