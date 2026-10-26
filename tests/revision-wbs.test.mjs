import assert from 'node:assert/strict';
import test from 'node:test';
import { wbsGroups, wbsRevisionScope, wbsFamily, wbsPick, wbsRoute } from '../progress.js';
import { projectHead } from '../lifecycle.js';

const r3 = { key:'ciifr', label:'CIIFR', status:'active',
  index: { project: { key:'ciifr',title:'CIIFR',aim:'R3 original Geometry-only owner aim',subtitle:'R3 geometry review only' },
    revisions:[{id:'R1',status:'superseded',commit:'abc111',at:'2026-10-22T02:00:00Z'},
      {id:'R2',status:'superseded',commit:'abc222',at:'2026-10-22T16:00:00Z'},
      {id:'R3',status:'current',at:'2026-10-24T04:00:00Z'}],
    milestones:{ M1:{order:1,name:'History'}, M12:{order:12,wbs:'3',name:'Geometry'}, M13:{order:13,wbs:'3.1',name:'Viewer'} }
  }
};
const r4 = { key:'ciifr', label:'CIIFR',status:'active',
  index: {project:{key:'ciifr',title:'CIIFR',aim:'R4 ELEMENTS and RIGID new owner aim',subtitle:'R4 Element engineering'},
    revisions:[...r3.index.revisions.slice(0,2),{id:'R3',status:'superseded',commit:'abc333',at:'2026-10-24T04:00:00Z'},
      {id:'R4',status:'current',at:'2026-10-25T05:00:00Z'}],
    milestones:{...r3.index.milestones,M17:{order:17,wbs:'4',name:'Element'},M18:{order:18,wbs:'4.1',name:'Pointer map'}}
  }
};

test('R3 does not inherit R4 WBS family, owner aim or source milestones', () => {
  assert.deepEqual(wbsGroups(r3.index).map(g=>g.key),['wbs:3','other']);
  assert.deepEqual(wbsGroups(r4.index).map(g=>g.key),['wbs:3','wbs:4','other']);
  assert.ok(!wbsGroups(r3.index).flatMap(g=>g.steps).some(s=>s.key==='M17'));
});

test('historical WBS picks never cross into current or another historical revision', () => {
  const s3=wbsRevisionScope('ciifr','R3'),s4=wbsRevisionScope('ciifr','R4'),s2=wbsRevisionScope('ciifr','R2');
  wbsFamily(s4,'wbs:4');wbsPick(s4,'M18');
  assert.equal(wbsFamily(s3),null);
  wbsFamily(s3,'wbs:3');wbsPick(s3,'M13');
  assert.equal(wbsPick(s4),'M18');assert.equal(wbsPick(s3),'M13');
  assert.equal(wbsPick(s2),null);
});

test('nested URLs persist revision, family and child; current route remains compatible', () => {
  const hash=wbsRoute('ciifr','progress','R3','wbs:3','M13');
  assert.equal(hash,'#/ciifr/progress/R3/wbs%3A3/M13');
  const segments=hash.split('/').slice(1).map(decodeURIComponent);
  assert.deepEqual(segments,['ciifr','progress','R3','wbs:3','M13']);
  assert.equal(wbsRoute('ciifr','progress',null),'#/ciifr/progress');
  assert.equal(wbsRoute('ciifr','progress','R3'),'#/ciifr/progress/R3');
});

function fakeEl(tag) {
  return {
    tag, children:[], className:'', title:'',
    _text:'', set textContent(v){this._text=String(v);this.children=[];},
    get textContent(){return this._text+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');},
    append(...items){this.children.push(...items);},
    addEventListener(){},setAttribute(){},
  };
}
function find(n,predicate,out=[]) {
  if(n&&typeof n==='object') { if(predicate(n))out.push(n);(n.children||[]).forEach(c=>find(c,predicate,out)); }
  return out;
}
test('historical header shows source snapshot, but revision navigation lists all current R1–R4 choices', () => {
  const old=globalThis.document;globalThis.document={createElement:fakeEl};
  try {
    const c={key:'ciifr',view:'progress',rev:'R3',revisionListProject:r4,
      nav:(href,label,cls)=>{let a=fakeEl('a');a.href=href;a.className=cls;a.append(label);return a;},
      addRevision(){},statusLine:()=>fakeEl('p'),snapshotNotice:fakeEl('p')};
    const header=projectHead(r3,c);
    assert.match(header.textContent,/R3 original Geometry-only owner aim/);
    assert.doesNotMatch(header.textContent,/R4 ELEMENTS/);
    const links=find(header,x=>x.tag==='a').map(x=>x.href).filter(Boolean);
    assert.ok(links.includes('#/ciifr/progress/R3'));
    assert.ok(links.includes('#/ciifr/progress'),'current R4 stays reachable');
    assert.ok(links.includes('#/ciifr/progress/R1'));
  } finally {globalThis.document=old;}
});
