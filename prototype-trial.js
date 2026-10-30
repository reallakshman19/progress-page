// Optional OWNER trial worksheet for the *native* Property Transfer draft.
// It DOES NOT execute native CII parsing, publish a preview, or attest a checkout.
import {el, link, copyText} from './util.js?v=34';

const TRIAL_NATIVE_REPO='reallakshman19/XML_Compare_Utilities';
export const NATIVE_PR='https://github.com/'+TRIAL_NATIVE_REPO+'/pull/232';
export const NATIVE_ISSUE='https://github.com/'+TRIAL_NATIVE_REPO+'/issues/231';
export const SOURCE_API='https://api.github.com/repos/'+TRIAL_NATIVE_REPO+'/pulls/232';
const TRIAL_SHA40=/^[0-9a-f]{40}$/i;
const TRIAL_OUTCOMES=Object.freeze(['NOT_RUN','PASS','FAIL','BLOCKED']);

export const PROPERTY_CASES=Object.freeze([
 Object.freeze({id:'PT-01',title:'Two independent Property paths',
  expected:'With a V14 public test input, Node → Element → Data and Node → Data show independently scoped, oriented and attributed physical evidence; no TARGET write or output export.'}),
 Object.freeze({id:'PT-02',title:'Normal / Nodal state isolation',
  expected:'Visit Property Transfer, change its local selection and return. An unchanged Normal/Nodal plan, approval and validation state must remain intact.'}),
 Object.freeze({id:'PT-03',title:'Stale CSV export revoked',
  expected:'Choose a different owning CSV while read is pending, then clear. An old applied output must not be exportable until a fresh import and approval.'}),
 Object.freeze({id:'PT-04',title:'Invalid endpoints and pointers fail closed',
  expected:'Negative endpoints and impossible typed pointers must be rejected; unsupported zero endpoints must remain explicit HOLD, not falsely ready.'}),
 Object.freeze({id:'PT-05',title:'Unknown residue stays visible',
  expected:'Dormant restraint residue and unqualified auxiliary/semantic content must appear UNKNOWN with physical evidence; source bytes stay unchanged.'})
]);

export function nativeCandidate(json){
 const head=json?.head?.sha;
 if(!TRIAL_SHA40.test(head||'')||typeof json?.draft!=='boolean'||
   !['open','closed'].includes(json?.state)){
   throw new Error('PR source response lacks verified-shape head/state');
 }
 return {head:head.toLowerCase(),draft:json.draft,state:json.state,
   source:NATIVE_PR};
}
export async function readNativeCandidate(fetcher=fetch){
 const response=await fetcher(SOURCE_API,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
 if(!response?.ok)throw new Error('Native GitHub source unavailable; test head is UNKNOWN');
 return nativeCandidate(await response.json());
}
export function localPreviewUrl(value){
 try{
  const url=new URL(String(value).trim());
  return url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)
    &&!url.username&&!url.password&&!url.search&&!url.hash
    ?url.href:null;
 }catch{return null;}
}
export function trialSetup(head){
 if(!TRIAL_SHA40.test(head||''))return null;
 return ['git clone https://github.com/'+TRIAL_NATIVE_REPO+'.git property-trial',
  'cd property-trial',
  'git fetch origin '+head,
  'git checkout --detach '+head,
  'python -m http.server 8080'].join('\n');
}
function redact(s){
 const text=String(s||'').slice(0,300).trim();
 return /https?:\/\/|(?:gh[pousr]_|github_pat_|sk-)[A-Za-z0-9_-]+|@|(?:[A-Z]:\\|\/Users\/|\/home\/)/i.test(text)
   ?'[note withheld: potentially private content]':text;
}
export function trialPacket({candidate,localConfirmed=false,previewUrl=null,
                            outcomes={},notes={}}={}){
 const head=candidate?.head&&TRIAL_SHA40.test(candidate.head)?candidate.head:'NOT_CHECKED';
 const lines=[
  'CIIFR-NODE PROPERTY TRANSFER — OWNER LOCAL TRIAL OBSERVATIONS',
  'Evidence status: SELF_REPORTED, NOT ENGINEERING OR OWNER ACCEPTANCE',
  'Project: ciifr-node · WBS 2 / 2.1',
  'Native source: '+NATIVE_PR,
  'Task: '+NATIVE_ISSUE,
  'Observed GitHub source head: '+head,
  'Source PR: '+(candidate?.state||'NOT_CHECKED')+' / '+(candidate?.draft?'draft':'unverified draft state'),
  'User attests local checkout of this head: '+(localConfirmed?'YES (not independently verified)':'NOT_CONFIRMED'),
  'Local URL provided: '+(localPreviewUrl(previewUrl)?'YES; address not included':'NO / INVALID'),
 ];
 for(const row of PROPERTY_CASES){
  const result=TRIAL_OUTCOMES.includes(outcomes[row.id])?outcomes[row.id]:'NOT_RUN';
  lines.push(row.id+' '+row.title+': '+result);
  if(notes[row.id])lines.push('  Observation: '+redact(notes[row.id]));
 }
 lines.push('LIMIT: No native test was run or verified by Progress Page. Browser-local entries are not persisted.',
  'LIMIT: No Page/Cycle mutation, mandatory agent report, IR PASS or Owner product acceptance.',
  'Do not include original CII bytes, private file names, credentials or proprietary input data.');
 return lines.join('\n');
}
const trialButton=(label,action)=>{
 const b=el('button','btn small',label);b.type='button';b.addEventListener('click',action);return b;
};
function trialInstruction(text){return el('p','muted',text);}
// Counts reflect only explicit locally entered outcomes, not execution evidence.
export function trialSummary(outcomes={}){
 const counts={PASS:0,FAIL:0,BLOCKED:0,NOT_RUN:0};
 for(const item of PROPERTY_CASES){
  const result=TRIAL_OUTCOMES.includes(outcomes?.[item.id])?outcomes[item.id]:'NOT_RUN';
  counts[result]++;
 }
 return {...counts,observed:PROPERTY_CASES.length-counts.NOT_RUN,total:PROPERTY_CASES.length};
}

export function renderPropertyTrial(root,{historical=false,fetcher=fetch}={}){
 const section=el('section','demo-page trial-lab');
 section.setAttribute('data-prototype-trial','ciifr-node');
 const state={candidate:null,confirmed:false,outcomes:{},notes:{}};
 const resultInputs=[],noteInputs=[],rowStatuses=[],rowCards=[];
 const header=el('div','trial-header');
 const title=el('div');
 title.append(el('p','trial-eyebrow','CIIFR-Node · WBS 2 / 2.1'),
  el('h3',null,'Property Transfer · prototype trial'),
  trialInstruction('Test the actual native candidate in a separate local browser tab. Results here are personal observations, not engineering acceptance.'));
 const sessionReset=trialButton('Reset session',()=>resetSession());
 sessionReset.classList.add('trial-reset');
 header.append(title,sessionReset);
 section.append(header);
 section.append(el('p','demo-safety','RUNTIME NOT VERIFIED — native PR #232 is still a draft candidate. Progress Page cannot execute its CII parser, check your local build, receive protected original files or establish independent engineering PASS.'));
 if(historical)section.append(el('p','demo-safety','HISTORICAL PAGE — this worksheet reads current native sources; do not claim historic runtime qualification.'));
 const status=el('div','trial-status');
 const sourceBadge=el('span','trial-status-item','Source · NOT CHECKED');
 const runtimeBadge=el('span','trial-status-item','Runtime · NOT VERIFIED');
 const acceptanceBadge=el('span','trial-status-item','Acceptance · HOLD');
 const sessionBadge=el('span','trial-status-item','Session · NOT RUN');
 status.append(sourceBadge,runtimeBadge,acceptanceBadge,sessionBadge);
 section.append(status);

 const prepare=el('section','trial-panel');
 prepare.append(el('h4',null,'1. Prepare candidate'));
 const prepareRow=el('div','trial-row trial-row-wrap');
 const refresh=trialButton('Check latest PR head',async()=>{
  refresh.disabled=true;
  headLine.textContent='Reading original GitHub PR #232…';
  try{
   const next=await readNativeCandidate(fetcher);
   if(state.candidate?.head!==next.head)resetObservations();
   state.candidate=next;
   headLine.textContent='Native PR #232 · '+next.state+' / '+(next.draft?'draft':'not draft')+
    ' · exact head '+next.head;
   setup.textContent=trialSetup(next.head);
  }catch{
   state.candidate=null;
   resetObservations();
   confirmBox.checked=false;
   headLine.textContent='SOURCE READ FAILED — exact head UNKNOWN. Do not infer a tested candidate.';
   setup.textContent='Source unavailable. Check original PR #232 before using local setup.';
  }finally{
   refresh.disabled=false;
   updateLaunch();
   updateStatus();
  }
 });
 prepareRow.append(el('span','trial-hint','Native PR #232'),
  refresh,link(NATIVE_PR,'Open original PR'));
 const headLine=el('p','trial-source-line','Native PR #232 source: NOT_CHECKED · no exact head observed');
 headLine.setAttribute('aria-live','polite');
 prepare.append(prepareRow,headLine);
 const setupDetails=el('details','trial-setup');
 setupDetails.append(el('summary',null,'Exact-head local setup commands'));
 const setup=el('pre','demo-mono trial-command');
 setup.textContent='Check the native PR head to generate version-pinned commands.';
 const copySetup=trialButton('Copy setup commands',()=>{
  const command=trialSetup(state.candidate?.head);
  if(command)copyText(command,copySetup);
 });
 copySetup.disabled=true;
 setupDetails.append(trialInstruction('Run these commands in an isolated directory on a machine with Git, Python and the native browser-compatible source. The Progress Page does not run them.'),setup,copySetup);
 prepare.append(setupDetails);
 section.append(prepare);

 const open=el('section','trial-panel');
 open.append(el('h4',null,'2. Open the real prototype'));
 const urlLabel=el('label','trial-field-label','Local preview address (localhost only)');
 const urlInput=el('input','trial-url');
 urlInput.placeholder='http://127.0.0.1:8080/';
 urlInput.setAttribute('aria-label','Local native preview URL');
 urlLabel.append(urlInput);
 const confirmLabel=el('label','trial-confirm');
 const confirmBox=el('input');confirmBox.type='checkbox';
 confirmBox.setAttribute('aria-label','I checked out this exact source head locally');
 confirmLabel.append(confirmBox,' I personally checked out this exact PR head locally (self-attested, not independently verified).');
 const launchRow=el('div','trial-row trial-row-wrap');
 const launch=el('a','btn small trial-launch','Open prototype');
 launch.target='_blank';launch.rel='noopener noreferrer';launch.setAttribute('aria-disabled','true');
 const launchHelp=trialInstruction('Launch disabled until a current source head, loopback URL and your checkout confirmation are provided.');
 launchRow.append(launch);
 const openInfo=trialInstruction('The native application opens in a separate tab. Local build/host provenance is never verified here.');
 function updateLaunch(){
  state.confirmed=confirmBox.checked&&!!state.candidate;
  const valid=localPreviewUrl(urlInput.value);
  const ready=!!valid&&state.confirmed;
  copySetup.disabled=!state.candidate;
  launch.setAttribute('aria-disabled',String(!ready));
  if(ready)launch.href=valid;else launch.removeAttribute('href');
  launchHelp.textContent=ready
   ?'Local launch enabled by your assertion only. Native runtime and exact checkout are NOT independently verified.'
   :'Launch disabled until an exact source head, localhost address and checkout confirmation are present.';
  updateStatus();
 }
 urlInput.addEventListener('input',updateLaunch);
 confirmBox.addEventListener('change',updateLaunch);
 open.append(urlLabel,confirmLabel,launchRow,launchHelp,openInfo);
 section.append(open);

 const scenarioSection=el('section','trial-panel');
 const scenariosTop=el('div','trial-row trial-between');
 const scenarioTitle=el('h4',null,'3. Test scenarios');
 const progress=el('span','trial-progress','0 / 5 OBSERVED');
 progress.setAttribute('aria-live','polite');
 scenariosTop.append(scenarioTitle,progress);
 scenarioSection.append(scenariosTop,
  trialInstruction('Choose Inspect on each row to see expected behavior, enter an observed outcome and add optional non-private notes.'));
 const scenarioList=el('div','trial-scenarios');
 for(const item of PROPERTY_CASES){
  const card=el('article','trial-case');
  const top=el('div','trial-case-top');
  const id=el('span','trial-case-id',item.id);
  const name=el('strong','trial-case-name',item.title);
  const stateLabel=el('span','trial-case-status','NOT RUN');
  const inspect=el('details','trial-inspect');
  inspect.append(el('summary',null,'Inspect'));
  const inner=el('div','trial-inspect-body');
  inner.append(el('p','trial-expected','EXPECTED BEHAVIOR'),
   trialInstruction(item.expected));
  const labels=el('label','trial-field-label','Observed result ');
  const select=el('select');
  select.setAttribute('aria-label',item.id+' observed result');
  for(const result of TRIAL_OUTCOMES){
   const option=el('option',null,result.replace('_',' '));option.value=result;select.append(option);
  }
  select.addEventListener('change',()=>{
   state.outcomes[item.id]=select.value;
   updateSummary();
  });
  labels.append(select);inner.append(labels);
  const note=el('textarea','trial-notes');note.rows=2;note.maxLength=300;
  note.placeholder='What did you observe? Do not include private inputs or file paths.';
  note.setAttribute('aria-label',item.id+' observation notes');
  note.addEventListener('input',()=>{state.notes[item.id]=note.value;});
  inner.append(note);
  inspect.append(inner);
  top.append(id,name,stateLabel,inspect);
  card.append(top);
  scenarioList.append(card);
  resultInputs.push(select);noteInputs.push(note);rowStatuses.push(stateLabel);rowCards.push(card);
 }
 scenarioSection.append(scenarioList);
 section.append(scenarioSection);

 const results=el('section','trial-panel');
 results.append(el('h4',null,'4. Review results'));
 const counts=el('div','trial-counts');
 const labels=Object.freeze([['PASS','Passed'],['FAIL','Failed'],['BLOCKED','Blocked'],['NOT_RUN','Not run']]);
 const counters={};
 for(const [key,label] of labels){
  const item=el('div','trial-counter');
  const value=el('strong',null,'0');value.setAttribute('data-trial-count',key);
  item.append(value,el('span',null,label));counts.append(item);counters[key]=value;
 }
 results.append(counts,trialInstruction('A locally selected PASS is self-reported. These numbers cannot certify engineering, independent reviewer or Owner product acceptance.'));
 const actions=el('div','trial-row trial-row-wrap');
 const copy=trialButton('Copy trial report',()=>copyText(trialPacket({
  candidate:state.candidate,localConfirmed:state.confirmed,
  previewUrl:urlInput.value,outcomes:state.outcomes,notes:state.notes
 }),copy));
 const reset=trialButton('Reset observations',resetObservations);
 actions.append(copy,reset);
 results.append(actions,trialInstruction('Nothing is saved or transmitted automatically. Copy your report before leaving this route; no mandatory Board report is created.'));
 section.append(results);

 const related=el('section','trial-related');
 related.append(el('h4',null,'Related tools'));
 const relatedLinks=el('div','trial-row trial-row-wrap');
 const board=el('a','btn small','Cycle Board');
 board.href='#/ciifr-node/cycle-board';
 const original=link(NATIVE_ISSUE,'Original task');
 const demo=trialButton('Workflow demo',()=>{
  const workflow=root.querySelector('#ciifr-node-workflow-demo');
  if(workflow){
   workflow.open=true;
   if(typeof workflow.scrollIntoView==='function')workflow.scrollIntoView({block:'start',behavior:'smooth'});
  }
 });
 relatedLinks.append(board,original,demo);related.append(relatedLinks);
 section.append(related);

 function updateStatus(){
  sourceBadge.textContent='Source · '+(state.candidate?'HEAD CHECKED':'NOT CHECKED');
  runtimeBadge.textContent='Runtime · NOT VERIFIED';
  acceptanceBadge.textContent='Acceptance · HOLD';
  sessionBadge.textContent='Session · '+(trialSummary(state.outcomes).observed?'OBSERVATIONS':'NOT RUN');
 }
 function updateSummary(){
  const summary=trialSummary(state.outcomes);
  progress.textContent=summary.observed+' / '+summary.total+' OBSERVED';
  for(const [key] of labels)counters[key].textContent=String(summary[key]);
  PROPERTY_CASES.forEach((item,i)=>{
   const current=TRIAL_OUTCOMES.includes(state.outcomes[item.id])?state.outcomes[item.id]:'NOT_RUN';
   rowStatuses[i].textContent=current.replace('_',' ');
   rowCards[i].setAttribute('data-result',current);
  });
  updateStatus();
 }
 function resetObservations(){
  state.outcomes={};state.notes={};
  resultInputs.forEach(x=>{x.value='NOT_RUN';});
  noteInputs.forEach(x=>{x.value='';});
  updateSummary();
 }
 function resetSession(){
  state.candidate=null;
  confirmBox.checked=false;urlInput.value='';
  headLine.textContent='Native PR #232 source: NOT_CHECKED · no exact head observed';
  setup.textContent='Check the native PR head to generate version-pinned commands.';
  resetObservations();updateLaunch();
 }
 updateSummary();
 updateLaunch();
 root.append(section);
}
