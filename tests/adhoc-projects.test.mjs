import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { adhocHref, parseAdhocRoute, ADHOC_PROJECTS, ADHOC_SECTIONS,
  renderAdhocProjects, XML_COMPARE_SECTIONS } from '../adhoc-projects.js';

function fakeEl(tag) {
  const node={tag,className:'',children:[],attributes:{},href:'',
    set textContent(text){this.text=String(text);this.children=[];},
    get textContent(){return (this.text||'')+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');},
    append(...children){this.children.push(...children);},
    setAttribute(k,v){this.attributes[k]=v;}
  };
  return node;
}
function find(node,predicate,out=[]) {
  if(node&&typeof node==='object'){
    if(predicate(node))out.push(node);
    for(const child of node.children||[])find(child,predicate,out);
  }
  return out;
}
function withDom(fn) {
  const old=globalThis.document;globalThis.document={createElement:fakeEl};
  try{return fn();}finally{globalThis.document=old;}
}
function render(hash) {
  return withDom(()=>{
    const root=fakeEl('main');
    const nav=(href,title,cls)=>{
      const a=fakeEl('a');a.href=href;a.className=cls;a.textContent=title;
      return a;
    };
    renderAdhocProjects(root,parseAdhocRoute(hash),nav);
    return root;
  });
}
test('Adhoc Projects and Progress Page have stable nested hash routes',()=>{
  assert.equal(parseAdhocRoute('#/ciifr/progress'),null);
  assert.equal(parseAdhocRoute('#/adhocx'),null);
  assert.deepEqual(parseAdhocRoute('#/adhoc'),{project:null,section:'overview',valid:true});
  assert.deepEqual(parseAdhocRoute('#/adhoc/progress-page'),
    {project:'progress-page',section:'overview',valid:true});
  assert.deepEqual(parseAdhocRoute('#/adhoc/progress-page/delivery'),
    {project:'progress-page',section:'delivery',valid:true});
  assert.equal(parseAdhocRoute('#/adhoc/missing').valid,false);
  assert.equal(parseAdhocRoute('#/adhoc/progress-page/unknown').valid,false);
  assert.equal(parseAdhocRoute('#/adhoc/progress-page/tests/extra').valid,false);
  assert.equal(adhocHref(), '#/adhoc/progress-page/overview');
  assert.deepEqual(ADHOC_PROJECTS.map(x=>x.label),['Progress Page','XML-Compare']);
  assert.deepEqual(ADHOC_SECTIONS.map(x=>x[0]),
    ['overview','cycle-board','contracts','delivery','tests']);
  assert.deepEqual(parseAdhocRoute('#/adhoc/xml-compare'),
    {project:'xml-compare',section:'overview',valid:true});
  assert.deepEqual(parseAdhocRoute('#/adhoc/xml-compare/validation'),
    {project:'xml-compare',section:'validation',valid:true});
  assert.equal(parseAdhocRoute('#/adhoc/xml-compare/unknown').valid,false);
  assert.equal(parseAdhocRoute('#/adhoc/xml-compare/tests').valid,false,
    'Progress Page Test Lab must not leak into XML-Compare');
  assert.equal(adhocHref('xml-compare'), '#/adhoc/xml-compare/overview');
  assert.deepEqual(XML_COMPARE_SECTIONS.map(x=>x[0]),
    ['overview','sources','validation','delivery']);
});
test('Hub exposes Progress Page second-level tab and links to third-level sections',()=>{
  const hub=render('#/adhoc');
  assert.match(hub.textContent,/Adhoc Projects/);
  const links=find(hub,n=>n.tag==='a').map(n=>n.href);
  assert.ok(links.includes('#/adhoc/progress-page/overview'));
  const pp=render('#/adhoc/progress-page/contracts');
  const tabs=find(pp,n=>n.tag==='nav'&&n.attributes['aria-label']==='Progress Page workspace sections');
  assert.equal(tabs.length,1);
  const children=tabs[0].children;
  assert.deepEqual(children.map(n=>n.href),ADHOC_SECTIONS.map(([id])=>adhocHref('progress-page',id)));
  const on=children.find(n=>n.attributes['aria-current']==='page');
  assert.equal(on.href,'#/adhoc/progress-page/contracts');
  assert.match(pp.textContent,/source identity/i);
  assert.match(pp.textContent,/Review PR #567/);
});
test('XML-Compare has its own project tab, source sections and exact hash links',()=>{
  const hub=render('#/adhoc');
  assert.match(hub.textContent,/XML-Compare/);
  const hubLinks=find(hub,n=>n.tag==='a').map(n=>n.href);
  assert.ok(hubLinks.includes('#/adhoc/progress-page/overview'));
  assert.ok(hubLinks.includes('#/adhoc/xml-compare/overview'));
  const xml=render('#/adhoc/xml-compare/validation');
  const projects=find(xml,n=>n.tag==='nav'&&n.attributes['aria-label']==='Adhoc Projects');
  assert.deepEqual(projects[0].children.map(n=>n.textContent),['Progress Page','XML-Compare']);
  assert.equal(projects[0].children.find(n=>n.attributes['aria-current']==='page').href,
    '#/adhoc/xml-compare/overview');
  const tabs=find(xml,n=>n.tag==='nav'&&n.attributes['aria-label']==='XML-Compare workspace sections');
  assert.equal(tabs.length,1);
  assert.deepEqual(tabs[0].children.map(n=>n.href),
    XML_COMPARE_SECTIONS.map(([id])=>adhocHref('xml-compare',id)));
  assert.equal(tabs[0].children.find(n=>n.attributes['aria-current']==='page').href,
    '#/adhoc/xml-compare/validation');
  assert.match(xml.textContent,/wrong-line negative controls/);
  assert.doesNotMatch(xml.textContent,/Four bounded vertical delivery slices/);
});
test('XML-Compare source links are truthful, read-only and never invent a WBS',()=>{
  const overview=render('#/adhoc/xml-compare/overview');
  assert.match(overview.textContent,/read-only/i);
  const links=find(overview,n=>n.tag==='a').map(n=>n.href);
  assert.ok(links.includes('https://github.com/reallakshman19/XML_Compare_Utilities'));
  assert.ok(links.includes('https://github.com/reallakshman19/XML_Compare_Utilities/blob/main/docs/ps-mapping-candidate-matrix-validation.html'));
  for(const section of ['sources','validation','delivery']){
    const v=render('#/adhoc/xml-compare/'+section);
    assert.match(v.textContent,/No independent WBS/i);
    assert.ok(find(v,n=>n.attributes?.role==='alert').length===0);
  }
  const invalid=render('#/adhoc/xml-compare/tests');
  assert.equal(find(invalid,n=>n.attributes?.role==='alert').length,1,
    'unsupported XML section must fail closed');
});
test('Delivery and Test Lab are navigable, honest and read-only',()=>{
  const delivery=render('#/adhoc/progress-page/delivery');
  for(const id of ['CT-1','CT-2','CT-3','CT-4'])assert.match(delivery.textContent,new RegExp(id));
  assert.match(delivery.textContent,/not a new project WBS/i);
  const tests=render('#/adhoc/progress-page/tests');
  const links=find(tests,n=>n.tag==='a').map(n=>n.href);
  assert.ok(links.includes('https://reallakshman19.github.io/progress-page/#/ciifr/test'));
  assert.ok(links.includes('https://reallakshman19.github.io/progress-page/#/ciifr-node/test'));
  assert.ok(links.includes('https://reallakshman19.github.io/progress-page/#/g9v35/test'));
  assert.match(tests.textContent,/cannot mutate production state/i);
});
test('Unknown adhoc routes fail visibly rather than showing another project',()=>{
  const root=render('#/adhoc/not-recorded/overview');
  assert.match(root.textContent,/Unknown Adhoc Projects path/);
  assert.equal(find(root,n=>n.attributes?.role==='alert').length,1);
  assert.doesNotMatch(root.textContent,/Current Progress Page/);
});
test('Adhoc UI does not create another WBS or change project JSON',()=>{
  const before=JSON.parse(readFileSync(new URL('../data/projects.json',import.meta.url),'utf8'));
  assert.equal(before.projects.some(x=>x.key==='adhoc'||x.key==='progress-page'),false);
  const module=readFileSync(new URL('../adhoc-projects.js',import.meta.url),'utf8');
  assert.doesNotMatch(module,/pp_batch\.py|CYCLE_TIMELINE_CARD v2.*post\(/);
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.match(app,/parseAdhocRoute\(hash\)/);
  assert.match(app,/renderAdhocProjects\(root,adhocRoute,navLink\)/);
});
