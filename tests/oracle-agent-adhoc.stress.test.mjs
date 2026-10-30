// Adhoc stress is a navigation authority boundary, not another project WBS.
// Original links are pointers, not proof of an engineering review or byte custody.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adhocHref,parseAdhocRoute,ADHOC_PROJECTS,sectionsForAdhocProject,
  renderAdhocProjects} from '../adhoc-projects.js';
const LIVE='https://reallakshman19.github.io/progress-page/';
const XML='https://github.com/reallakshman19/XML_Compare_Utilities';
const projectData=JSON.parse(readFileSync(new URL('../data/projects.json',import.meta.url),'utf8'));
const baseline=JSON.stringify(projectData);

function dom(tag){
 return {tag,className:'',children:[],attributes:{},href:'',
  set textContent(v){this.text=String(v);this.children=[];},
  get textContent(){return (this.text||'')+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');},
  append(...items){this.children.push(...items);},
  setAttribute(k,v){this.attributes[k]=v;}
 };
}
function all(node,pred,found=[]){
 if(node&&typeof node==='object'){
  if(pred(node))found.push(node);
  for(const child of node.children||[])all(child,pred,found);
 }
 return found;
}
function view(hash){
 const old=globalThis.document;globalThis.document={createElement:dom};
 try{
  const root=dom('main');
  const nav=(href,label,cls)=>{const x=dom('a');x.href=href;x.className=cls;x.textContent=label;return x;};
  renderAdhocProjects(root,parseAdhocRoute(hash),nav);
  return root;
 }finally{globalThis.document=old;}
}
const links=root=>all(root,n=>n.tag==='a').map(x=>x.href);
const active=root=>all(root,n=>n.tag==='a'&&n.attributes['aria-current']==='page');

test('Adhoc source graph contains one hub and ALL three independent nested workspaces',()=>{
 assert.deepEqual(ADHOC_PROJECTS.map(x=>x.key),
  ['progress-page','xml-ps-mapping','xml-compare']);
 const hub=view('#/adhoc');
 const paths=links(hub);
 assert.deepEqual(ADHOC_PROJECTS.map(x=>adhocHref(x.key)).filter(x=>paths.includes(x)),
  ADHOC_PROJECTS.map(x=>adhocHref(x.key)));
 for(const item of ADHOC_PROJECTS){
  const sections=sectionsForAdhocProject(item.key);
  assert.ok(sections.length>=4);
  for(const [section] of sections){
   const route=adhocHref(item.key,section),parsed=parseAdhocRoute(route);
   assert.equal(parsed.valid,true,route);
   const out=view(route);
   assert.equal(all(out,n=>n.tag==='nav'&&n.attributes['aria-label']==='Adhoc Projects').length,1);
   const tab=all(out,n=>n.tag==='nav'&&n.attributes['aria-label']===item.label+' workspace sections');
   assert.equal(tab.length,1,route);
   assert.deepEqual(tab[0].children.map(x=>x.href),
    sections.map(([id])=>adhocHref(item.key,id)));
   assert.equal(active(out).length,2,route);
   assert.ok(active(out).some(x=>x.href===route));
   assert.ok(active(out).some(x=>x.href===adhocHref(item.key,'overview')));
   assert.equal(all(out,n=>n.className==='body adhoc-body').length,1,route);
   assert.equal(all(out,n=>n.attributes?.role==='alert').length,0);
   assert.match(out.textContent,/read.only|source|review|original|WBS/i,route);
  }
 }
 assert.equal(JSON.stringify(projectData),baseline,'view never mutates Page projects');
});

test('Adhoc lifecycle retains source navigation but never promotes original authority',()=>{
 const board=view('#/adhoc/progress-page/cycle-board');
 assert.ok(links(board).includes('#/ciifr-node/cycle-board'));
 assert.match(board.textContent,/must never grant a new assignment/i);
 assert.match(board.textContent,/Page publication/i);
 assert.doesNotMatch(board.textContent,/independently accepted for release/i);
 const tests=view('#/adhoc/progress-page/tests');
 for(const p of ['ciifr','ciifr-node','g9v35']){
  assert.ok(links(tests).includes(LIVE+'#/'+p+'/test'),'missing source trial '+p);
 }
 assert.match(tests.textContent,/cannot mutate production state/i);
 const mapping=view('#/adhoc/xml-ps-mapping/candidate-matrix');
 assert.ok(links(mapping).some(u=>u.includes('ps-mapping-candidate-matrix-validation.html')));
 assert.match(mapping.textContent,/not the full production candidate dataset/i);
 const rules=view('#/adhoc/xml-ps-mapping/matching-rules');
 assert.match(rules.textContent,/Ambiguous — Line Mismatch/);
 assert.match(rules.textContent,/no automatic mapping/i);
 const xml=view('#/adhoc/xml-compare/validation');
 assert.ok(links(xml).some(u=>u.startsWith(XML)));
 assert.match(xml.textContent,/not physical engineering sign.off|not.*sign.off|fixture is not/i);
 for(const item of ADHOC_PROJECTS){
  const rendered=view(adhocHref(item.key));
  assert.doesNotMatch(rendered.textContent,
   /Owner accepted: PASS|Cycle assignment AUTHORIZED|Published new WBS/i);
 }
 assert.equal(JSON.stringify(projectData),baseline);
});

test('256 deterministic invalid Adhoc routes fail visibly, without falling back to another project',()=>{
 const ids=ADHOC_PROJECTS.map(x=>x.key);
 for(let i=0;i<256;i++){
  const pick=ids[i%3];
  const bad=[
   '#/adhoc/'+pick+'/unknown',
   '#/adhoc/'+pick+'/'+sectionsForAdhocProject(pick)[0][0]+'/extra',
   '#/adhoc/nonexistent/overview',
   '#/adhoc/xml-ps-mapping/cycle-board',
   '#/adhoc/xml-compare/tests',
   '#/adhoc/progress-page/validation',
   '#/adhocx/'+pick,
   '#/ciifr-node/cycle-board'
  ][(i*37+17)%8];
  const parsed=parseAdhocRoute(bad);
  if(parsed===null){
   assert.ok(!bad.startsWith('#/adhoc/'));
   continue;
  }
  assert.equal(parsed.valid,false,'invalid route accepted '+bad);
  const root=view(bad);
  assert.equal(all(root,n=>n.attributes?.role==='alert').length,1,bad);
  assert.match(root.textContent,/Unknown Adhoc Projects path/);
  assert.equal(all(root,n=>n.className==='body adhoc-body').length,0,bad);
  assert.equal(all(root,n=>n.tag==='nav'&&n.attributes['aria-label']?.endsWith('workspace sections')).length,0);
 }
 assert.equal(JSON.stringify(projectData),baseline);
});

test('Adhoc cannot become registered WBS, change fixtures, or become private-byte receipt',()=>{
 const projects=projectData.projects.map(p=>p.key);
 assert.equal(projects.some(k=>k==='adhoc'||k==='progress-page'||k==='xml-ps-mapping'),false);
 const source=readFileSync(new URL('../adhoc-projects.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/from ['"]\.\/tools\/pp_cli|from ['"]\.\/cycle-board-writer/);
 assert.doesNotMatch(source,/BYTES_VERIFIED\s*=\s*true|independent.*PASS\s*=\s*true/i);
 for(const item of ADHOC_PROJECTS){
  const root=view(adhocHref(item.key,'overview'));
  const linked=links(root);
  assert.ok(linked.every(x=>x.startsWith('#/')||x.startsWith('https://')),'unsafe Adhoc link');
  assert.ok(linked.every(x=>!x.includes('/c/')&&!x.includes('/chat/')),'private chat link');
 }
 assert.equal(JSON.stringify(projectData),baseline);
});
