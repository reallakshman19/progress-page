// Optional Adhoc Projects navigation hub; never an extra Progress Page WBS,
// Cycle assignment, agent report, or source of engineering status.
import { el, link } from './util.js?v=33';

export const ADHOC_ROOT = '#/adhoc';
export const ADHOC_PROJECTS = Object.freeze([
  Object.freeze({key:'progress-page',label:'Progress Page',
    description:'Small, bounded improvements to the reusable Progress Page experience.'}),
  Object.freeze({key:'xml-ps-mapping',label:'XML-PS Mapping',
    description:'Source-linked PS Mapping candidate reviews, identity rules and engineering evidence; no duplicate project WBS.'})
]);
export const ADHOC_SECTIONS = Object.freeze([
  Object.freeze(['overview','Overview']),
  Object.freeze(['cycle-board','Cycle Board']),
  Object.freeze(['contracts','Contracts']),
  Object.freeze(['delivery','Delivery slices']),
  Object.freeze(['tests','Test Lab'])
]);
export const XML_PS_MAPPING_SECTIONS = Object.freeze([
  Object.freeze(['overview','Overview']),
  Object.freeze(['candidate-matrix','Candidate Matrix']),
  Object.freeze(['matching-rules','Matching rules']),
  Object.freeze(['evidence','Evidence'])
]);
export const sectionsForAdhocProject = project =>
  project==='xml-ps-mapping' ? XML_PS_MAPPING_SECTIONS : ADHOC_SECTIONS;

const P = 'https://github.com/reallakshman19/progress-page';
const C = 'https://github.com/reallakshman19/Common';
const DOC = C+'/blob/91a5d65c49cc7ec513d21d12df2c9bf5c28b146b/skills/agent-work/progress-page/references/';
const CT_PR = C+'/pull/567';
const LIVE = 'https://reallakshman19.github.io/progress-page/';
const XML_PS_REPO = 'https://github.com/reallakshman19/XML_Compare_Utilities';
const XML_PS_LIVE = 'https://reallakshman19.github.io/XML_Compare_Utilities/';
const XML_PS_MATRIX = XML_PS_LIVE+'ps-mapping-candidate-matrix-validation.html';

export const adhocHref = (project='progress-page',section='overview') =>
  ADHOC_ROOT+'/'+project+'/'+section;

export function parseAdhocRoute(hash) {
  if (!/^#\/adhoc(?:\/|$)/.test(hash||'')) return null;
  const parts=String(hash).slice(2).split('/');
  const project=parts[1]||null, section=parts[2]||'overview';
  const validProject=project===null||ADHOC_PROJECTS.some(p=>p.key===project);
  const validSection=sectionsForAdhocProject(project).some(([key])=>key===section);
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

// Navigation-only projection of existing XML Compare Utilities sources.
// No local state, independent WBS, engineering verdict or mutable Page record.
function renderXmlPsMapping(root,selectedSection) {
  const body=el('div','body adhoc-body');
  body.append(el('h2',null,'XML-PS Mapping'),
    el('p','adhoc-intro','Reference links for the PS Mapping utility, candidate evidence and two-pass identity review. The XML Compare Utilities repository owns the engineering logic and tests; this workspace does not establish engineering acceptance or its own WBS.'));
  if(selectedSection==='overview') {
    const s=section(body,'Open the existing PS Mapping workflow',
      'Start from the actual tool and the source-derived review. A line-mismatch candidate is not a confirmed node match or proof that hardware is missing.');
    addCards(s,[
      card('XML Compare Utilities','Launch the live application; use the PS Mapping utility to evaluate actual input tables.',[['Open application',XML_PS_LIVE]]),
      card('Two-case Candidate Matrix','Inspect the published PS-131.1 / Node 4190 and SL-211.2 / Node 720 review cases. These are fixtures, not a complete production export.',[['Open Candidate Matrix',XML_PS_MATRIX]]),
      card('Engineering source and tests','The resolver, fixture cases and published app source remain in XML Compare Utilities.',[['View repository',XML_PS_REPO],['Read fixture tests',XML_PS_REPO+'/blob/main/tests/ps-mapping-two-pass-line-mismatch.test.mjs']])
    ]);
  } else if(selectedSection==='candidate-matrix') {
    const s=section(body,'Candidate Matrix — validated examples',
      'The separate matrix is computed by the PS Mapping resolver using source-derived fixtures. It supports case filters and CSV export; it is not the full production candidate dataset.');
    addCards(s,[
      card('PS-131.1 · Node 4190','PIPE STOP TYPE-602 is classified as LINE STOP; the reference and model line families differ. The correct output holds identity for review instead of proposing another support.',[['Review row in matrix',XML_PS_MATRIX],['Read regression',XML_PS_REPO+'/blob/main/tests/ps-mapping-two-pass-line-mismatch.test.mjs']]),
      card('SL-211.2 · Node 720','Existing REST and LINE STOP model components have conflicting line family identity. The 25 mm LINE STOP gap still requires separate verification.',[['Review row in matrix',XML_PS_MATRIX]]),
      card('Production candidate export','For other nodes, run the PS Mapping utility against the current original reference and model tables. This page does not import a historical CSV or certify unseen cases.',[['Open utility',XML_PS_LIVE]])
    ]);
  } else if(selectedSection==='matching-rules') {
    const s=section(body,'Two-pass line identity — review boundary',
      'The governing resolver requires source-backed identity before a component contributes to confirmed node restraint coverage.');
    addCards(s,[
      card('Pass 1 · qualified mapping','Support Base + Line Family + DN + Reference Node. A valid, unique match can proceed to restraint presence and independent gap compliance checks.',[['Read merged change',XML_PS_REPO+'/pull/225']]),
      card('Pass 2 · Ambiguous — Line Mismatch','Support Base + DN + Reference Node with different line families. This is a review-only candidate: no automatic mapping and no automatic .Xn hardware replacement while identity is unresolved.',[['Read regression cases',XML_PS_REPO+'/blob/main/tests/ps-mapping-two-pass-line-mismatch.test.mjs']]),
      card('Separate evidence categories','Physical restraint evidence, qualified node coverage and gap/clearance compliance are distinct. Unknown line identity is not equivalent to missing hardware.',[['Inspect Candidate Matrix',XML_PS_MATRIX]])
    ]);
  } else if(selectedSection==='evidence') {
    const s=section(body,'Native engineering evidence',
      'Use source files and actual PRs for traceability. This navigation hub neither records engineering PASS nor changes the owning repository.');
    addCards(s,[
      card('PS Mapping resolver','Inspect the original application source that produces candidate identities and node-level diagnostics.',[['Core resolver',XML_PS_REPO+'/blob/main/tabs/ps-mapping-utility/ps-mapping-engine-diagnostics.js'],['Canonical assessment',XML_PS_REPO+'/blob/main/tabs/ps-mapping-utility/ps-mapping-engine-diagnostics-v25.js']]),
      card('Two-pass identity implementation','Merged engineering change introducing review-only fallback and missing-support proposal suppression.',[['PR #225',XML_PS_REPO+'/pull/225']]),
      card('Published Candidate Matrix','Merged page and browser regression for the two example cases, with links to their current source.',[['PR #233',XML_PS_REPO+'/pull/233'],['Open published matrix',XML_PS_MATRIX]]),
      card('Oracle onboarding reference','The Common start guide defines role boundaries, original-source grounding and owner acceptance requirements.',[['Read START_HERE',C+'/blob/main/skills/agent-work/START_HERE.md']])
    ]);
  }
  root.append(body,el('p','foot muted','Adhoc XML-PS Mapping is a read-only source navigator. The governing engineering WBS, acceptance decisions and native evidence stay with their owning project.'));
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
      const tile=nav(adhocHref(p.key),p.label,'adhoc-tile');
      tile.append(el('span','muted',p.description),el('span','adhoc-tile-next','Open workspace →'));
      projects.append(tile);
    }
    wrap.append(projects);
    return;
  }
  const subs=el('nav','views adhoc-section-subtabs');
  subs.setAttribute('aria-label',route.project==='xml-ps-mapping'
    ? 'XML-PS Mapping workspace sections' : 'Progress Page workspace sections');
  for(const [id,label] of sectionsForAdhocProject(route.project)){
    const on=id===route.section;
    const a=nav(adhocHref(route.project,id),label,'view'+(on?' on':''));
    if(on)a.setAttribute('aria-current','page');
    subs.append(a);
  }
  root.append(subs);
  if(route.project==='xml-ps-mapping') {
    renderXmlPsMapping(root,route.section);
    return;
  }

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
