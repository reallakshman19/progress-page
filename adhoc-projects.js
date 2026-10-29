// Optional Adhoc Projects navigation hub; never an extra Progress Page WBS,
// Cycle assignment, agent report, or source of engineering status.
import { el, link } from './util.js?v=33';

export const ADHOC_ROOT = '#/adhoc';
export const ADHOC_PROJECTS = Object.freeze([
  Object.freeze({key:'progress-page',label:'Progress Page',
    description:'Small, bounded improvements to the reusable Progress Page experience.'})
]);
export const ADHOC_SECTIONS = Object.freeze([
  Object.freeze(['overview','Overview']),
  Object.freeze(['cycle-board','Cycle Board']),
  Object.freeze(['contracts','Contracts']),
  Object.freeze(['delivery','Delivery slices']),
  Object.freeze(['tests','Test Lab'])
]);

const P = 'https://github.com/reallakshman19/progress-page';
const C = 'https://github.com/reallakshman19/Common';
const DOC = C+'/blob/docs/cycle-board-source-bound-contract-20261029/skills/agent-work/progress-page/references/';
const CT_PR = C+'/pull/567';
const LIVE = 'https://reallakshman19.github.io/progress-page/';

export const adhocHref = (project='progress-page',section='overview') =>
  ADHOC_ROOT+'/'+project+'/'+section;

export function parseAdhocRoute(hash) {
  if (!/^#\/adhoc(?:\/|$)/.test(hash||'')) return null;
  const parts=String(hash).slice(2).split('/');
  const project=parts[1]||null, section=parts[2]||'overview';
  const validProject=project===null||ADHOC_PROJECTS.some(p=>p.key===project);
  const validSection=ADHOC_SECTIONS.some(([key])=>key===section);
  return {project,section,valid:validProject&&validSection&&parts.length<=3};
}

function card(title,description,targets=[]) {
  const a=el('article','adhoc-card');
  a.append(el('h3',null,title),el('p','muted',description));
  const foot=el('div','adhoc-links');
  for(const [label,url] of targets)foot.append(link(url,label,'btn small'));
  if(targets.length)a.append(foot);
  return a;
}
function section(root,title,explanation) {
  const wrap=el('section','adhoc-section');
  wrap.append(el('h3',null,title),el('p','muted',explanation));
  root.append(wrap);
  return wrap;
}
function addCards(sectionNode,cards) {
  const grid=el('div','adhoc-grid');
  grid.append(...cards);
  sectionNode.append(grid);
}

export function renderAdhocProjects(root,route,nav) {
  const heading=el('div','adhoc-heading');
  heading.append(el('h2',null,'Adhoc Projects'),
    el('p','muted','A lightweight navigation home for bounded improvements. Authoritative project WBS, Cycle assignments and engineering evidence remain at their original sources.'));
  root.append(heading);
  const projects=el('nav','views adhoc-project-subtabs');
  projects.setAttribute('aria-label','Adhoc Projects');
  for(const p of ADHOC_PROJECTS){
    const on=p.key===route.project;
    const a=nav(adhocHref(p.key),p.label,'view'+(on?' on':''));
    if(on)a.setAttribute('aria-current','page');
    projects.append(a);
  }
  root.append(projects);

  if(!route.valid){
    const error=el('p','banner','Unknown Adhoc Projects path. No different project was selected.');
    error.setAttribute('role','alert');
    root.append(error,nav(ADHOC_ROOT,'Back to Adhoc Projects','btn small'));
    return;
  }
  if(!route.project){
    const wrap=section(root,'Available adhoc workspaces',
      'Select a workspace to see its own nested sections. This hub does not register a new governing WBS or change project status.');
    const projects=el('div','adhoc-grid');
    for(const p of ADHOC_PROJECTS){
      const tile=nav(adhocHref(p.key),'Progress Page','adhoc-tile');
      tile.append(el('span','muted',p.description),el('span','adhoc-tile-next','Open workspace →'));
      projects.append(tile);
    }
    wrap.append(projects);
    return;
  }
  const subs=el('nav','views adhoc-section-subtabs');
  subs.setAttribute('aria-label','Progress Page workspace sections');
  for(const [id,label] of ADHOC_SECTIONS){
    const on=id===route.section;
    const a=nav(adhocHref(route.project,id),label,'view'+(on?' on':''));
    if(on)a.setAttribute('aria-current','page');
    subs.append(a);
  }
  root.append(subs);

  const body=el('div','body adhoc-body');
  const title=el('h2',null,'Progress Page');
  body.append(title,el('p','adhoc-intro','Reusable UI, source-bound continuation and current delivery references. This workspace is documentation and navigation—not a second Page project, live task tracker or approval surface.'));
  if(route.section==='overview'){
    const s=section(body,'Start here',
      'Choose the appropriate source. Existing project tabs still contain the governing AIM, WBS, native evidence and audited history.');
    addCards(s,[
      card('Current Progress Page','Open the published project pages and their original WBS and source references.',[['Open live site',LIVE]]),
      card('Cycle Board pilot','Inspect the existing CIIFR operational Action/Info view. Live event intake is optional and may be empty.',[['Open CIIFR view',LIVE+'#/ciifr/timeline-live']]),
      card('Downstream implementation contracts','Review the source-bound data interface and four bounded implementation slices before changing behavior.',[['Review contract PR',CT_PR]]),
      card('Reference application','UI and published data live in the Progress Page repository. The Common module is its portable copy.',[['View source',P]])
    ]);
  } else if(route.section==='cycle-board'){
    const s=section(body,'Cycle Board — source-bound continuation',
      'One native action supplies reusable evidence. The Board must never grant a new assignment, engineering PASS or Page publication.');
    addCards(s,[
      card('Existing Action / Info Timeline','CIIFR pilot shows reported work, handoff threads and existing audit-derived INFO-Auto. It is not canonical Cycle authority.',[['Open live Timeline',LIVE+'#/ciifr/timeline-live'],['Read source',P+'/blob/main/timeline-live.js']]),
      card('Canonical Cycle','Only an explicitly activated and verified Cycle assignment can authorize standalone continuation; other projects retain their native/OTM routes.',[['Read protocol',C+'/blob/main/oracle-cycles/PROTOCOL.md']]),
      card('Source-bound interface','One immutable source occurrence and truthful UNKNOWN states are reused across Board, Agent Start and Oracle continuity.',[['Read contract',DOC+'CYCLE_BOARD_CONTRACT.md']])
    ]);
  } else if(route.section==='contracts'){
    const s=section(body,'Architecture and contracts',
      'Review-only references; contracts do not create a new WBS, assignment or mandatory agent reporting.');
    addCards(s,[
      card('Core read-model contract','cycle-board.context/v1; source identity, authority gates, delta classifications and Action/Info meaning.',[['Read contract',DOC+'CYCLE_BOARD_CONTRACT.md']]),
      card('Vertical handoff contract','CT-1 through CT-4: inputs, outputs, tests, stopping rules and downstream roles.',[['Read slices',DOC+'CYCLE_BOARD_VERTICAL_SLICES.md']]),
      card('Review and change history','Contract PR in Common. Review its latest state and head before relying on the proposal.',[['Review PR #567',CT_PR]]),
      card('Existing Page data contract','The governing project WBS and append-only audit remain in the original Progress Page records.',[['Read portable data contract',C+'/blob/main/skills/agent-work/progress-page/references/DATA_CONTRACT.md']])
    ]);
  } else if(route.section==='delivery'){
    const s=section(body,'Four bounded vertical delivery slices',
      'These are implementation contracts, not a new project WBS. Their status must be checked in actual downstream native evidence; no completion is implied here.');
    addCards(s,[
      card('CT-1 · Current context','One working URL displays the native evidence, current WBS, optional Cycle and original Page audit; no new agent report.',[['Acceptance and handoff',DOC+'CYCLE_BOARD_VERTICAL_SLICES.md']]),
      card('CT-2 · Changed-only delta','Recheck source changes, wrong recipient, already returned, Page drift and UNKNOWN. No invented Cycle authorization.',[['Acceptance and handoff',DOC+'CYCLE_BOARD_VERTICAL_SLICES.md']]),
      card('CT-3 · Reviewed Page proposal','The Page writer reuses native source identity through existing propose/dry-run tools; no automatic publication.',[['Existing writer rules',P+'/blob/main/README.md']]),
      card('CT-4 · Owner trial and falsification','Independent negative tests plus baseline-vs-pilot active effort for Coder, IR, Oracle, Owner, Page writer and maintenance.',[['Test contract',DOC+'CYCLE_BOARD_VERTICAL_SLICES.md']])
    ]);
  } else if(route.section==='tests'){
    const s=section(body,'Project-specific Test Lab',
      'Existing per-project Test pages use browser-local scenarios. They cannot mutate production state or establish agent acceptance.');
    addCards(s,[
      card('CIIFR Test page','Exercise illustrative Action, Info handoff and audited INFO-Auto using CIIFR context.',[['Open Test page',LIVE+'#/ciifr/test']]),
      card('CIIFR-Node Test page','Inspect the published WBS context. The newer PR232 repair needs an original-source drift check; do not infer a Cycle.',[['Open Test page',LIVE+'#/ciifr-node/test']]),
      card('Grade9v3.5 Test page','Inspect a project configured for OTM coordination; no standalone Cycle inference.',[['Open Test page',LIVE+'#/g9v35/test']]),
      card('Automated test sources','Read the existing viewer and Page contract tests; a green unit test is not a recorded Owner usability trial.',[['View test suite',P+'/tree/main/tests']])
    ]);
  }
  root.append(body,el('p','foot muted','Adhoc workspace: read-only navigation. No independent task ledger, Page audit entry or assignment is created by opening these tabs.'));
}
