// Read-only Adhoc TOPO-A/TOPO-B Cycle Board. The original GitHub issue,
// governing WBS, Common relay and Page PR own evidence/authority.
import { el, link } from './util.js?v=34';
import { loadBoardNative, BOARD_NATIVE_SOURCES } from './cycle-board-context.js?v=34';
import { classifyNativeDelta } from './cycle-board-delta.js?v=34';

const C='https://github.com/reallakshman19/Common';
const T='https://github.com/reallakshman19/xml229-topology-wp1-preview-20261028';
const X='https://github.com/reallakshman19/XML_Compare_Utilities';
const P='https://github.com/reallakshman19/progress-page';
const pin='/blob/417bf6a954c5a6de72237537e94b05b285191350/';
const WBS=T+'/issues/3', RELAY=C+'/pull/572', PAGE=P+'/pull/95';

export const TOPO_ADHOC_INFO=Object.freeze({
 'topo-a':Object.freeze({
   key:'topo-a',label:'TOPO-A · Assisted Connection Repair',
   issue:T+'/issues/12',issueNumber:12,wbs:'3.2 / 4.1',
   wbsNote:'Existing TopoFix WBS R1: manual review and evidence-qualified connections',
   objective:'Make intended connection vs declared closure discoverable and auditable without automatic unsafe repair.',
   case:'Node 6880 / Node 6450 · 240.6 mm apart · 114.3 mm OD · declared CLOS. Connection intent remains UNVERIFIED.',
   next:'Read-only explanation of the CLOS suppression path and source/overlap report on issue #12.',
   boundary:'Never remove CLOS or bridge 240.6 mm by distance alone. ≤25 mm is the automatic threshold; any larger repair needs evidence and authority.',
   ownership:'PSI116 connection review, source port graph, manual second pass and Manual Fix Queue; no shared format-adapter edits.',
   sources:Object.freeze([
    Object.freeze({label:'Native task and actual 6880/6450 witnesses',url:T+'/issues/12',detail:'Original private XML is not copied to the Page. Receiver byte access NOT_RUN.'}),
    Object.freeze({label:'Governing TopoFix WBS R1',url:WBS,detail:'WBS 3.2/4.1 is already governed here.'}),
    Object.freeze({label:'Manual Fix Queue draft',url:T+'/pull/11',detail:'Check ownership before changing queue/replay.'}),
    Object.freeze({label:'Preview repair draft',url:T+'/pull/10',detail:'Do not infer integrated release or current head from a historical pin.'})
   ]),
   tests:Object.freeze([
    'Source CLOS around 6880↔6450 still appears in discovery/review, not an automatic repair.',
    'Two legitimately closed unrelated systems at similar distance remain separate.',
    'Stale generation, wrong branch, incompatible OD, missing direction, unknown design intent and duplicate pair fail closed.'
   ])
 }),
 'topo-b':Object.freeze({
   key:'topo-b',label:'TOPO-B · Universal XML Topology Adapter',
   issue:X+'/issues/239',issueNumber:239,wbs:'2.1 → 4.1',
   wbsNote:'Existing TopoFix WBS R1. Universal format extension is PROPOSED, not published acceptance.',
   objective:'Reuse the InputXML workspace and CIIFR adapters for a source-traceable, read-only multi-format topology graph.',
   case:'F05/R4: 56 elements each; GLRD: 521 elements. Unsupported XML must report UNSUPPORTED_INPUT, not zero-findings PASS.',
   next:'Source-grounded format matrix, F05 element→graph trace, reusable seam and active-writer overlap report on issue #239.',
   boundary:'Never construct a CII writer, change Weight/Final, coerce unsupported profiles or fabricate geometry from missing coordinate seeds.',
   ownership:'InputXML format routing and normalized read-only evidence adapters; no PSI116 connection-review writes.',
   sources:Object.freeze([
    Object.freeze({label:'Native task and source expectations',url:X+'/issues/239',detail:'Original XML files are private. Access and digest receipt NOT_RUN.'}),
    Object.freeze({label:'Pinned InputXML Workspace',url:X+pin+'tabs/inputxml-workspace/inputxml-workspace-tab.js',detail:'Existing clean→5C→InputXML conversion and diagnostics.'}),
    Object.freeze({label:'Pinned F05/R4 profile parser',url:X+pin+'prototypes/ciifr-map/xml-profiles.js',detail:'Native-mm source fields and coordinates are authority boundaries.'}),
    Object.freeze({label:'Pinned graph builder',url:X+pin+'workbench3d/adapters/canonical-graph-builder.js',detail:'Read-only topology evidence, not physical engineering sign-off.'}),
    Object.freeze({label:'Governing WBS R1',url:WBS,detail:'No competing CIIFR or TopoFix WBS.'})
   ]),
   tests:Object.freeze([
    'F05/R4 56 elements → expected 56 graph edges / 57 node witnesses on supported fixture, without physical-certification claim.',
    'GLRD 521 elements must pass separate profile/coordinate/field validation; do not equate elements and nodes.',
    'Unsupported root/units, malicious DTD, missing coordinate seed, altered digest and wrong namespace must fail closed.'
   ])
 })
});

export const TOPO_GOVERNANCE=Object.freeze({
  wbs:WBS,relay:RELAY,page:PAGE,
  start:C+'/blob/999dd8d1516af6a65a840d9f3f489b5f0115d261/skills/agent-work/START_HERE.md',
  relayProtocol:C+'/blob/999dd8d1516af6a65a840d9f3f489b5f0115d261/skills/agent-work/ARTIFACT_RELAY.md'
});
const coverage=n=>n?.status==='ok'?'COMPLETE':n?.status==='partial'?'PARTIAL':'UNKNOWN';
const sourceUrl=s=>'https://github.com/'+s.repo+'/'+(s.kind==='pull'?'pull':'issues')+'/'+s.number;

export function topoAdhocBoardModel(key,native,previous=null){
 const info=TOPO_ADHOC_INFO[key];
 if(!info)throw Error('Unknown Adhoc board: '+key);
 const expected=BOARD_NATIVE_SOURCES[key]||[],allowed=new Set(expected.map(sourceUrl));
 const sources=(native?.observations||[]).filter(e=>allowed.has(e.source)).map(e=>({
   ...e,scope:'NATIVE_ONLY',wbs:null,technicalPass:'NOT_ESTABLISHED'
 })).sort((a,b)=>a.source.localeCompare(b.source));
 const complete=coverage(native)==='COMPLETE'&&sources.length===expected.length&&
   new Set(sources.map(e=>e.source)).size===expected.length;
 const current={project:key,native:{coverage:complete?'COMPLETE':
   coverage(native)==='PARTIAL'?'PARTIAL':'UNKNOWN'},sources};
 const delta=classifyNativeDelta(previous,current);
 const advice=current.native.coverage!=='COMPLETE'?'UNKNOWN_STOP':
   !previous?'REVIEW_NATIVE_TASK':delta.status==='CHANGED'?'REVIEW_CHANGED_SOURCES':'NO_NEW_EVIDENCE';
 return {
  schema:'cycle-board.adhoc-context/v1',project:key,
  native:{status:native?.status||'unknown',coverage:current.native.coverage,
   observedAt:native?.observedAt||null,failures:native?.failures||[]},
  sources,delta,comparable:current,task:sources.find(e=>e.source===info.issue)||null,
  cycle:{status:'NOT_VERIFIED',authority:'NOT_ESTABLISHED'},
  assignment:{recipient:'UNBOUND',acknowledgement:'NOT_VERIFIED',writeLease:'NOT_VERIFIED'},
  publication:{status:'NOT_RECONCILED',source:PAGE},
  relay:{status:'RECEIPT_NOT_VERIFIED',source:RELAY},
  next:{advice,reason:current.native.coverage!=='COMPLETE'?
   'Some configured originals are inaccessible or invalid. Preserve HOLD; never infer an empty workflow.':
   !previous?'First successful native read. Verify current source, recipient, holds and owner intent before any action.':
   delta.status==='CHANGED'?'A source revision changed: Oracle must inspect the actual changed issue or PR.':
   'No change in configured native source occurrences. This is not completion or permission to act.'}
 };
}
function fact(root,label,value){
 const f=el('div','cb-fact');f.append(el('span','muted',label),el('strong',null,String(value)));root.append(f);
}
function detail(root,name,value){
 const p=el('p','muted');p.append(el('b',null,name+': '),String(value));root.append(p);
}
function draw(root,model){
 root.textContent='';
 const facts=el('div','cb-facts');
 fact(facts,'Native coverage',model.native.coverage);
 fact(facts,'Canonical Cycle',model.cycle.status+' / '+model.cycle.authority);
 fact(facts,'Agent recipient',model.assignment.recipient+' / '+model.assignment.acknowledgement);
 fact(facts,'Page publication',model.publication.status);
 root.append(facts);
 detail(root,'Native observed at',model.native.observedAt||'UNKNOWN');
 detail(root,'Delta since last complete comparable read',model.delta.status);
 if(model.native.failures.length){
  const warning=el('section','banner topo-board-warning');
  warning.append(el('b',null,'Native source failures · no healthy empty state'));
  model.native.failures.forEach(f=>detail(warning,f.source,f.error));
  root.append(warning);
 }
 const sources=el('section','topo-board-sources');
 sources.append(el('h4',null,'Source occurrences · not independent qualifications'));
 if(!model.sources.length)sources.append(el('p','muted','Original source observation UNKNOWN; not evidence that work is absent.'));
 for(const s of model.sources){
  const c=el('article','adhoc-card');
  c.append(el('h4',null,s.label+' · '+s.state));
  detail(c,'Immutable occurrence',s.occurrenceId);
  detail(c,'Source revision',s.revision);
  detail(c,'Original updated at',s.sourceAt||'UNKNOWN');
  detail(c,'Qualification',s.qualification+'; technical PASS NOT_ESTABLISHED');
  c.append(link(s.source,'Open original native source'));
  sources.append(c);
 }
 root.append(sources);
 const next=el('section','topo-board-next');
 next.append(el('h4',null,'One Oracle review cue · '+model.next.advice),
  el('p',null,model.next.reason),el('p','muted',
  'A Board cannot authenticate private files, a recipient, exclusive writer, Cycle receipt, technical PASS or Owner approval.'));
 root.append(next);
 const refs=el('p','muted','Separate Page / Common references: ');
 refs.append(link(model.publication.source,'Page PR #95'),' · ',link(model.relay.source,'Relay PR #572'));
 root.append(refs);
}

// On-demand current read + explicit recheck; no polling, storage, source mutation
// or dispatch. Previous comparison is retained only within this mounted viewer.
export function renderTopoAdhocBoard(root,key,{fetcher,clock}={}){
 if(!TOPO_ADHOC_INFO[key])throw Error('Unknown Adhoc Cycle Board');
 const box=el('section','topo-cycle-board');
 box.setAttribute('aria-label','TOPO source-bound Cycle Board');
 box.append(el('h3',null,'Cycle Board · source-backed review'),
  el('p','muted','Read-only. Never creates Page WBS, new assignment, protected write, Cycle activation or engineering acceptance.'));
 const button=el('button','btn small','Recheck native sources');button.type='button';
 const result=el('section','topo-board-results');
 result.append(el('p','muted','Source observation pending · authority NOT_ESTABLISHED.'));
 box.append(button,result);root.append(box);
 let prior=null,busy=false;
 const run=async()=>{
  if(busy)return;busy=true;button.disabled=true;
  result.textContent='';result.append(el('p','muted','Checking configured original GitHub sources…'));
  try{
   const observation=await loadBoardNative(key,fetcher||fetch,clock||(()=>new Date().toISOString()));
   const model=topoAdhocBoardModel(key,observation,prior);
   draw(result,model);
   if(model.native.coverage==='COMPLETE')prior=model.comparable;
  }catch(error){
   result.textContent='';
   result.append(el('p','banner','Native observation UNKNOWN: '+
    String(error?.message||error).slice(0,140)+'. No authority established.'));
  }finally{busy=false;button.disabled=false;}
 };
 button.addEventListener('click',()=>{void run();});
 void run();
 return box;
}
