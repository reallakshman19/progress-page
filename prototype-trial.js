// Optional OWNER trial worksheet for the *native* Property Transfer draft.
// It DOES NOT execute native CII parsing, publish a preview, or attest a checkout.
import {el, link, copyText} from './util.js?v=34';

const REPO='reallakshman19/XML_Compare_Utilities';
export const NATIVE_PR='https://github.com/'+REPO+'/pull/232';
export const NATIVE_ISSUE='https://github.com/'+REPO+'/issues/231';
export const SOURCE_API='https://api.github.com/repos/'+REPO+'/pulls/232';
const SHA=/^[0-9a-f]{40}$/i;
const OUTCOMES=Object.freeze(['NOT_RUN','PASS','FAIL','BLOCKED']);

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
 if(!SHA.test(head||'')||typeof json?.draft!=='boolean'||
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
 if(!SHA.test(head||''))return null;
 return ['git clone https://github.com/'+REPO+'.git property-trial',
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
 const head=candidate?.head&&SHA.test(candidate.head)?candidate.head:'NOT_CHECKED';
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
  const result=OUTCOMES.includes(outcomes[row.id])?outcomes[row.id]:'NOT_RUN';
  lines.push(row.id+' '+row.title+': '+result);
  if(notes[row.id])lines.push('  Observation: '+redact(notes[row.id]));
 }
 lines.push('LIMIT: No native test was run or verified by Progress Page. Browser-local entries are not persisted.',
  'LIMIT: No Page/Cycle mutation, mandatory agent report, IR PASS or Owner product acceptance.',
  'Do not include original CII bytes, private file names, credentials or proprietary input data.');
 return lines.join('\n');
}
const button=(label,action)=>{
 const b=el('button','btn small',label);b.type='button';b.addEventListener('click',action);return b;
};
function instruction(text){return el('p','muted',text);}
export function renderPropertyTrial(root,{historical=false,fetcher=fetch}={}){
 const section=el('section','demo-page');
 section.setAttribute('data-prototype-trial','ciifr-node');
 section.append(el('h3',null,'Property Transfer · prototype trial'),
  instruction('Run the real native candidate in your own isolated local preview, then record what you observed. This is not the Action/Info simulator.'),
  el('p','demo-safety','RUNTIME NOT VERIFIED — PR #232 is a draft. Progress Page cannot execute the native Property engine, verify local build bytes, receive protected originals or grant an engineering PASS.'));
 if(historical)section.append(el('p','demo-safety','HISTORICAL PAGE — use current sources for any new trial; this screen cannot certify a past runtime.'));
 const source=el('div','demo-controls');
 const headLine=el('p','muted','Native PR #232 source: NOT_CHECKED; local runtime: NOT_VERIFIED');
 const state={candidate:null,confirmed:false,outcomes:{},notes:{}};
 const refresh=button('Check native PR head',async()=>{
  refresh.disabled=true;
  headLine.textContent='Reading original GitHub PR #232…';
  try{
   const next=await readNativeCandidate(fetcher);
   if(state.candidate?.head!==next.head){
    state.outcomes={};state.notes={};state.confirmed=false;confirmBox.checked=false;
    for(const x of outcomeControls)x.value='NOT_RUN';
    for(const x of noteControls)x.value='';
   }
   state.candidate=next;
   headLine.textContent='GitHub source '+next.state+' · '+(next.draft?'DRAFT':'not draft')+
     ' · exact head '+next.head+' · local runtime NOT_VERIFIED';
   setup.textContent=trialSetup(next.head);
   launchState();
  }catch{
   state.candidate=null;state.confirmed=false;confirmBox.checked=false;
   headLine.textContent='SOURCE READ FAILED — head UNKNOWN. No candidate qualified.';
   setup.textContent='Recheck original GitHub PR before running any local trial.';
   launchState();
  }finally{refresh.disabled=false;}
 });
 source.append(refresh,link(NATIVE_PR,'Open native PR #232'),link(NATIVE_ISSUE,'Open repair HOLD #231'));
 section.append(source,headLine);
 const details=el('details','project-brief');
 details.open=true;
 details.append(el('summary',null,'Launch the actual candidate locally (manual setup)'));
 details.append(instruction('Check source head, copy these commands and run them in an isolated directory. This starts the native app locally; it does not deploy PR #232.'));
 const setup=el('pre','demo-mono');setup.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;border:1px solid var(--bd);border-radius:8px;';
 setup.textContent='Select “Check native PR head” first. No SHA assumed.';
 const copySetup=button('Copy exact-head local setup',()=>{const x=trialSetup(state.candidate?.head);if(x)copyText(x,copySetup);});
 copySetup.disabled=true;
 details.append(setup,copySetup);
 const urlLabel=el('label',null,'Your locally running native preview URL (localhost only)');
 const urlInput=el('input');urlInput.placeholder='http://127.0.0.1:8080/';urlInput.setAttribute('aria-label','Local native preview URL');
 urlInput.style.cssText='display:block;width:min(100%,520px);margin:8px 0;';
 urlLabel.append(urlInput);
 const confirmLabel=el('label');
 const confirmBox=el('input');confirmBox.type='checkbox';
 confirmBox.setAttribute('aria-label','I checked out this exact source head locally');
 confirmLabel.append(confirmBox,' I personally checked out the displayed exact head; this is my assertion, not verification by Progress Page.');
 const launch=el('a','btn small','Open local native prototype');
 launch.target='_blank';launch.rel='noopener noreferrer';launch.setAttribute('aria-disabled','true');
 launch.style.cssText='display:inline-block;margin-top:10px;opacity:.55;pointer-events:none;';
 const launchHelp=instruction('Launch remains disabled until a source head is observed, a localhost URL is entered and you confirm the checkout.');
 function launchState(){
  state.confirmed=confirmBox.checked&&!!state.candidate;
  const valid=localPreviewUrl(urlInput.value);
  const ready=!!valid&&state.confirmed;
  copySetup.disabled=!state.candidate;
  launch.style.pointerEvents=ready?'auto':'none';launch.style.opacity=ready?'1':'.55';
  launch.setAttribute('aria-disabled',String(!ready));
  if(ready)launch.href=valid;else launch.removeAttribute('href');
  launchHelp.textContent=ready?'Launch is user-attested; actual native runtime and head remain independently UNVERIFIED.':
   'Check the PR head, enter a localhost URL and confirm the exact checkout to enable launch.';
 }
 urlInput.addEventListener('input',launchState);
 confirmBox.addEventListener('change',launchState);
 details.append(urlLabel,confirmLabel,launch,launchHelp);
 section.append(details);
 const cases=el('section');cases.append(el('h4',null,'Real-run observation checklist'),
  instruction('Open the native app above. Enter results only after observing them there. PASS here means your local scenario observation, not a qualified engineering PASS.'));
 const outcomeControls=[],noteControls=[];
 for(const item of PROPERTY_CASES){
  const card=el('article','demo-card');
  card.style.cssText='margin:10px 0;padding:12px;';
  card.append(el('h4',null,item.id+' · '+item.title),instruction('Expected: '+item.expected));
  const labels=el('label',null,'Observed result ');
  const select=el('select');select.setAttribute('aria-label',item.id+' observed result');
  for(const status of OUTCOMES){const opt=el('option',null,status);opt.value=status;select.append(opt);}
  select.addEventListener('change',()=>{state.outcomes[item.id]=select.value;});
  outcomeControls.push(select);labels.append(select);card.append(labels);
  const note=el('textarea');note.rows=2;note.maxLength=300;note.placeholder='Optional brief observation; no private source bytes/paths';
  note.setAttribute('aria-label',item.id+' observation notes');
  note.style.cssText='display:block;width:100%;margin-top:8px;';
  note.addEventListener('input',()=>{state.notes[item.id]=note.value;});
  noteControls.push(note);card.append(note);cases.append(card);
 }
 section.append(cases);
 const actions=el('div','demo-controls');
 const copy=button('Copy local observation report',()=>copyText(trialPacket({
  candidate:state.candidate,localConfirmed:state.confirmed,
  previewUrl:urlInput.value,outcomes:state.outcomes,notes:state.notes
 }),copy));
 const reset=button('Reset local observations',()=>{
  state.outcomes={};state.notes={};
  for(const control of outcomeControls)control.value='NOT_RUN';
  for(const control of noteControls)control.value='';
 });
 actions.append(copy,reset);
 section.append(actions,instruction('Nothing is saved or transmitted by this workspace. Copy your report before leaving; do not treat it as a Page audit, mandatory agent post or independent review.'));
 root.append(section);
}
