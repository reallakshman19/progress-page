import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { adhocHref, parseAdhocRoute, ADHOC_PROJECTS, ADHOC_SECTIONS,
  XML_PS_MAPPING_SECTIONS, XML_COMPARE_SECTIONS, TOPO_ADHOC_SECTIONS,
  sectionsForAdhocProject, renderAdhocProjects } from '../adhoc-projects.js';

function fakeEl(tag) {
  const node={tag,className:'',children:[],attributes:{},href:'',
    set textContent(text){this.text=String(text);this.children=[];},
    get textContent(){return (this.text||'')+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');},
    append(...children){this.children.push(...children);},
    setAttribute(k,v){this.attributes[k]=v;},
    addEventListener(k,fn){this['on'+k]=fn;}
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
function render(hash, options={}) {
  return withDom(()=>{
    const root=fakeEl('main');
    const nav=(href,title,cls)=>{
      const a=fakeEl('a');a.href=href;a.className=cls;a.textContent=title;
      return a;
    };
    renderAdhocProjects(root,parseAdhocRoute(hash),nav,options);
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
  assert.deepEqual(ADHOC_PROJECTS.map(x=>x.label),['Progress Page','XML-PS Mapping','XML-Compare','TOPO-A','TOPO-B']);
  assert.deepEqual(parseAdhocRoute('#/adhoc/xml-ps-mapping'),
    {project:'xml-ps-mapping',section:'overview',valid:true});
  assert.deepEqual(parseAdhocRoute('#/adhoc/xml-ps-mapping/candidate-matrix'),
    {project:'xml-ps-mapping',section:'candidate-matrix',valid:true});
  assert.equal(parseAdhocRoute('#/adhoc/xml-ps-mapping/cycle-board').valid,false);
  assert.equal(parseAdhocRoute('#/adhoc/progress-page/candidate-matrix').valid,false);
  assert.deepEqual(sectionsForAdhocProject('xml-ps-mapping'),XML_PS_MAPPING_SECTIONS);
  assert.deepEqual(XML_PS_MAPPING_SECTIONS.map(([key])=>key),
    ['overview','candidate-matrix','matching-rules','evidence']);
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
  assert.ok(links.includes('#/adhoc/xml-ps-mapping/overview'));
  assert.ok(links.includes('#/adhoc/xml-compare/overview'));
  assert.match(hub.textContent,/XML-PS Mapping/);
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

test('XML-PS Mapping Adhoc tab has distinct sections and direct evidence, not another WBS',()=>{
  const page=render('#/adhoc/xml-ps-mapping/candidate-matrix');
  const mainNav=find(page,n=>n.tag==='nav'&&n.attributes['aria-label']==='Adhoc Projects');
  assert.equal(mainNav.length,1);
  assert.deepEqual(mainNav[0].children.map(n=>n.href),
    ['#/adhoc/progress-page/overview','#/adhoc/xml-ps-mapping/overview','#/adhoc/xml-compare/overview','#/adhoc/topo-a/overview','#/adhoc/topo-b/overview']);
  const current=mainNav[0].children.filter(n=>n.attributes['aria-current']==='page');
  assert.equal(current.length,1);
  assert.equal(current[0].textContent,'XML-PS Mapping');
  const tabs=find(page,n=>n.tag==='nav'
    && n.attributes['aria-label']==='XML-PS Mapping workspace sections');
  assert.equal(tabs.length,1);
  assert.deepEqual(tabs[0].children.map(n=>n.href),
    XML_PS_MAPPING_SECTIONS.map(([id])=>adhocHref('xml-ps-mapping',id)));
  const currentSection=tabs[0].children.filter(n=>n.attributes['aria-current']==='page');
  assert.equal(currentSection[0].href,'#/adhoc/xml-ps-mapping/candidate-matrix');
  const links=find(page,n=>n.tag==='a').map(n=>n.href);
  assert.ok(links.includes('https://reallakshman19.github.io/XML_Compare_Utilities/ps-mapping-candidate-matrix-validation.html'));
  assert.match(page.textContent,/PS-131\.1/);
  assert.match(page.textContent,/SL-211\.2/);
  assert.match(page.textContent,/not the full production candidate dataset/i);
});

test('XML-PS Mapping matching rules preserve line mismatch as review, not qualified coverage',()=>{
  const rules=render('#/adhoc/xml-ps-mapping/matching-rules');
  assert.match(rules.textContent,/Pass 1/);
  assert.match(rules.textContent,/Pass 2/);
  assert.match(rules.textContent,/Ambiguous — Line Mismatch/);
  assert.match(rules.textContent,/no automatic mapping/i);
  const links=find(rules,n=>n.tag==='a').map(n=>n.href);
  assert.ok(links.includes('https://github.com/reallakshman19/XML_Compare_Utilities/pull/225'));
  const evidence=render('#/adhoc/xml-ps-mapping/evidence');
  assert.match(evidence.textContent,/PR #233/);
  assert.match(evidence.textContent,/read-only source navigator/i);
  assert.doesNotMatch(evidence.textContent,/engineering PASS achieved/i);
});

test('XML-PS Mapping route rejects wrong or extra sections without selecting Progress Page',()=>{
  for(const hash of ['#/adhoc/xml-ps-mapping/contracts',
    '#/adhoc/xml-ps-mapping/matching-rules/extra','#/adhoc/xml-ps-mappings/overview']){
    const root=render(hash);
    assert.equal(find(root,n=>n.attributes?.role==='alert').length,1);
    assert.match(root.textContent,/Unknown Adhoc Projects path/);
    assert.doesNotMatch(root.textContent,/Current Progress Page/);
  }
});

test('XML-Compare has its own project tab, source sections and exact hash links',()=>{
  const hub=render('#/adhoc');
  assert.match(hub.textContent,/XML-Compare/);
  const hubLinks=find(hub,n=>n.tag==='a').map(n=>n.href);
  assert.ok(hubLinks.includes('#/adhoc/progress-page/overview'));
  assert.ok(hubLinks.includes('#/adhoc/xml-compare/overview'));
  const xml=render('#/adhoc/xml-compare/validation');
  const projects=find(xml,n=>n.tag==='nav'&&n.attributes['aria-label']==='Adhoc Projects');
  assert.deepEqual(projects[0].children.map(n=>n.textContent),['Progress Page','XML-PS Mapping','XML-Compare','TOPO-A','TOPO-B']);
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
test('Adhoc UI does not create another WBS or change project JSON',()=>{
  const before=JSON.parse(readFileSync(new URL('../data/projects.json',import.meta.url),'utf8'));
  assert.equal(before.projects.some(x=>x.key==='adhoc'||x.key==='progress-page'),false);
  const module=readFileSync(new URL('../adhoc-projects.js',import.meta.url),'utf8');
  assert.doesNotMatch(module,/pp_batch\.py|CYCLE_TIMELINE_CARD v2.*post\(/);
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.match(app,/parseAdhocRoute\(hash\)/);
  assert.match(app,/renderAdhocProjects\(root,adhocRoute,navLink,\{topofixProject:state\.data\.topofix\|\|null,pageFetch:state\.pageFetch\}\)/);
});


test('Two new Adhoc spaces use native tasks, distinct Cycle Boards and the existing TopoFix WBS',()=>{
  assert.deepEqual(TOPO_ADHOC_SECTIONS.map(([id])=>id),
    ['overview','cycle-board','sources','continuity','tests']);
  for(const [key,id] of [['topo-a',12],['topo-b',239]]){
    const link='#/adhoc/'+key;
    assert.equal(parseAdhocRoute(link+'/cycle-board').valid,true);
    assert.equal(parseAdhocRoute(link+'/sources').valid,true);
    assert.equal(parseAdhocRoute(link+'/continuity').valid,true);
    const page=render(link+'/overview');
    assert.match(page.textContent,/governing WBS/i);
    assert.match(page.textContent,/No|not.*assign|read-only/i);
    const hrefs=find(page,n=>n.tag==='a').map(n=>n.href);
    assert.ok(hrefs.includes(link+'/cycle-board'));
    assert.ok(hrefs.some(u=>u.includes('/issues/'+id)));
    const sources=render(link+'/sources');
    const sourceLinks=find(sources,n=>n.tag==='a').map(n=>n.href);
    assert.ok(sourceLinks.includes('https://github.com/reallakshman19/xml229-topology-wp1-preview-20261028/issues/3'));
    assert.ok(sourceLinks.includes('https://github.com/reallakshman19/Common/pull/572'));
    assert.ok(sourceLinks.includes('https://github.com/reallakshman19/progress-page/pull/95'));
    assert.match(sources.textContent,/Concept map and source-lineage/i);
    const cont=render(link+'/continuity');
    assert.match(cont.textContent,/NOT_VERIFIED/);
    assert.match(cont.textContent,/PREPARED/);
    const cases=render(link+'/tests');
    assert.match(cases.textContent,/UNKNOWN/);
    assert.equal(parseAdhocRoute(link+'/unselected').valid,false);
  }
  assert.equal(parseAdhocRoute('#/adhoc/topo-a/cycle-board/extra').valid,false);
  assert.equal(parseAdhocRoute('#/adhoc/topo-b/candidate-matrix').valid,false);
});
