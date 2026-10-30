// Shared V3 trial console. A configured trial is an observation form, NOT a
// runner, publication receipt, authority source or a new status ledger.
import {el,link,copyText} from './util.js?v=34';
import {trial3Profiles,trial3ValidateRegistry} from './trial-templates.js?v=34';

const TRIAL3_OUTCOMES=Object.freeze(['NOT_RUN','PASS','FAIL','BLOCKED']);
const TRIAL3_SHA40=/^[0-9a-f]{40}$/i;
const TRIAL3_NOTES_PRIVATE=/(?:https?:\/\/|(?:gh[pousr]_|github_pat_|sk-)[a-z0-9_-]+|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:[a-z]:\\|\/Users\/|\/home\/)|(?:password|token|secret)\s*[:=])/i;
const TRIAL3_URL=/^https:\/\/(?:github\.com|reallakshman19\.github\.io)\//;

export function trial3Summary(template,outcomes={}){
 const counts={PASS:0,FAIL:0,BLOCKED:0,NOT_RUN:0};
 for(const c of template?.cases||[]){
  const status=TRIAL3_OUTCOMES.includes(outcomes?.[c.id])?outcomes[c.id]:'NOT_RUN';
  counts[status]++;
 }
 return {...counts,observed:(template?.cases.length||0)-counts.NOT_RUN,total:template?.cases.length||0};
}
function trial3Note(value){
 const s=String(value||'').slice(0,300).trim();
 return TRIAL3_NOTES_PRIVATE.test(s)?'[note withheld: potentially private content]':s;
}
export function trial3Packet(template,{head=null,confirmed=false,outcomes={},notes={}}={}){
 if(!template||!Array.isArray(template.cases))throw Error('reviewed trial template required');
 const sourceHead=head&&TRIAL3_SHA40.test(head)?head:'NOT_CHECKED';
 const lines=['PROGRESS PAGE V3 — LOCAL TRIAL OBSERVATIONS ONLY',
   'SELF_REPORTED; NOT ENGINEERING, OWNER OR INDEPENDENT REVIEW ACCEPTANCE',
   'Template: '+template.schema+' / '+template.project+'/'+template.id,
   'Trial: '+template.title,'WBS: '+template.scope.wbs,
   'Card: '+(template.scope.card||'NOT_SPECIFIED'),
   'Source: '+template.candidate.url,
   'Source revision/head observed: '+sourceHead,
   'Launch method: '+template.launch.kind,
   'Local checkout self-attestation: '+(confirmed?'YES (not independently verified)':'NOT_CONFIRMED')];
 for(const row of template.cases){
  const status=TRIAL3_OUTCOMES.includes(outcomes?.[row.id])?outcomes[row.id]:'NOT_RUN';
  lines.push(row.id+' '+row.title+': '+status);
  if(notes?.[row.id])lines.push('  Local observation: '+trial3Note(notes[row.id]));
 }
 const counts=trial3Summary(template,outcomes);
 lines.push('Observed: '+counts.observed+'/'+counts.total,
  'No runtime attestation or automatic Page/Cycle write; local session is not persisted.',
  'Do not include private original data, credentials or local paths.');
 return lines.join('\n');
}
export function trial3Loopback(value){
 try{
  const u=new URL(String(value||'').trim());
  return u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&
   !u.username&&!u.password&&!u.search&&!u.hash?u.href:null;
 }catch{return null;}
}
export function trial3Checkout(template,head){
 if(template?.launch.kind!=='local-web'||!TRIAL3_SHA40.test(head||'')||
    !/^[\w.-]+\/[\w.-]+$/.test(template.launch.repo||''))return null;
 return ['git clone https://github.com/'+template.launch.repo+'.git trial-worktree',
  'cd trial-worktree','git fetch origin '+head,
  'git checkout --detach '+head,'python -m http.server 8080'].join('\n');
}
export async function trial3ReadHead(template,fetcher=fetch){
 if(template?.candidate.kind!=='github-pr'||!template.candidate.api)throw Error('no supported exact-head source');
 const response=await fetcher(template.candidate.api,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
 if(!response?.ok)throw Error('source unavailable');
 const source=await response.json();
 const sha=source?.head?.sha;
 if(!TRIAL3_SHA40.test(sha||'')||typeof source?.draft!=='boolean'||
   !['open','closed'].includes(source?.state))throw Error('source identity unverifiable');
 // PR number is checked where supplied; never trust a mismatched original.
 const expected=Number(template.candidate.api.split('/').pop());
 if(source.number!==undefined&&source.number!==expected)throw Error('wrong native PR returned');
 return {head:sha.toLowerCase(),draft:source.draft,state:source.state};
}
const trial3Button=(label,action)=>{
 const b=el('button','btn small',label);b.type='button';b.addEventListener('click',action);return b;
};
const trial3Info=text=>el('p','muted',text);
export function renderTrialWorkspace(root,{projectKey,project,historical=false,fetcher=fetch}={}){
 trial3ValidateRegistry();
 const key=projectKey||project?.index?.project?.key||'UNRECORDED';
 const profiles=trial3Profiles(key,project);
 const mount=el('div','trial-v3-mount');
 root.append(mount);
 if(!profiles.length){
  const box=el('section','demo-page trial-lab');
  box.setAttribute('data-trial-workspace',key);
  box.setAttribute('data-trial-status','UNCONFIGURED');
  box.append(el('h3',null,'Trials · '+(project?.index?.project?.title||key)),
    el('p','demo-safety','NO TRIAL CONFIGURED — the Page does not invent a prototype, cases, runnable command or test PASS for this project.'),
    trial3Info('Project evidence and the Workflow demo remain available. A new trial requires a reviewed project/WBS-scoped template.'));
  const source=project?.index?.project?.aimSrc;
  if(typeof source==='string'&&TRIAL3_URL.test(source))box.append(link(source,'Open recorded project source'));
  mount.append(box);
  return {configured:false,profiles:0};
 }
 let active=0;
 function display(template){
  mount.replaceChildren();
  const state={head:null,confirmed:false,outcomes:{},notes:{}};
  const selections=[],notes=[],statusRows=[],cards=[];
  const section=el('section','demo-page trial-lab');
  section.setAttribute('data-trial-workspace',key);
  section.setAttribute('data-prototype-trial',key); // V2 deep-link/browser compatibility
  section.setAttribute('data-trial-status','CONFIGURED');
  const header=el('div','trial-header'),title=el('div');
  title.append(el('p','trial-eyebrow',(project?.index?.project?.title||key)+' · WBS '+template.scope.wbs),
    el('h3',null,template.title+' · Trials'),
    trial3Info('One shared trial interface. Outcomes are your local observations, not approved engineering or Owner acceptance.'));
  const resetSession=trial3Button('Reset session',()=>clearSession());
  header.append(title,resetSession);
  section.append(header);
  if(profiles.length>1){
   const label=el('label','trial-field-label','Choose a trial profile');
   const selector=el('select','trial-profile-select');
   selector.setAttribute('aria-label','Select trial profile');
   profiles.forEach((p,i)=>{
    const option=el('option',null,p.title);option.value=String(i);selector.append(option);
   });
   selector.value=String(active);
   selector.addEventListener('change',()=>{active=Number(selector.value);display(profiles[active]);});
   label.append(selector);section.append(label);
  }
  section.append(el('p','demo-safety',template.launch.kind==='local-web'
   ?'RUNTIME NOT VERIFIED — this is a draft/source-bound local candidate, not a hosted application or engineering PASS.'
   :'REVIEW ONLY — this project has no verified executable prototype configured in Progress Page. Review the original source without promoting its status.'));
  if(historical)section.append(el('p','demo-safety','HISTORICAL VIEW — this template represents a current source/review link, not a historical runtime attestation.'));
  const status=el('div','trial-status');
  const sourceBadge=el('span','trial-status-item','Source · '+(template.candidate.kind==='github-pr'?'NOT CHECKED':'LINK ONLY'));
  status.append(sourceBadge,el('span','trial-status-item','Runtime · NOT VERIFIED'),
    el('span','trial-status-item','Acceptance · HOLD'));
  const sessionBadge=el('span','trial-status-item','Session · NOT RUN');
  status.append(sessionBadge);section.append(status);

  const prepare=el('section','trial-panel');
  prepare.append(el('h4',null,'1. Prepare candidate'));
  const sourceRow=el('div','trial-row trial-row-wrap');
  const sourceLine=el('p','trial-source-line',
   template.candidate.kind==='github-pr'?'Native PR source: NOT_CHECKED':
    'Configured source link · no automated provenance verification');
  sourceLine.setAttribute('aria-live','polite');
  if(template.candidate.kind==='github-pr'){
   const refresh=trial3Button('Check latest PR head',async()=>{
    const priorHead=state.head;
    refresh.disabled=true;
    state.head=null;confirmBox.checked=false;updateLaunch();updateStatus();
    sourceLine.textContent='Checking original GitHub PR…';
    try{
     const observed=await trial3ReadHead(template,fetcher);
     if(observed.head!==priorHead){resetObservations();confirmBox.checked=false;state.confirmed=false;}
     state.head=observed.head;
     sourceLine.textContent='Native '+observed.state+' / '+(observed.draft?'DRAFT':'not draft')+
      ' · exact source head '+observed.head+' · runtime NOT VERIFIED';
     setup.textContent=trial3Checkout(template,state.head)||'No supported setup for this template';
    }catch{
     state.head=null;resetObservations();confirmBox.checked=false;
     sourceLine.textContent='SOURCE READ FAILED — head UNKNOWN; no candidate verified.';
     setup.textContent='Source unavailable. Do not run an unpinned candidate.';
    }finally{refresh.disabled=false;updateLaunch();updateStatus();}
   });
   sourceRow.append(refresh);
  }else sourceRow.append(el('span','trial-hint','Source type: '+template.candidate.kind+' · review manually'));
  sourceRow.append(link(template.candidate.url,'Open original source'));
  prepare.append(sourceRow,sourceLine);
  const setupDetails=el('details','trial-setup');
  const setup=el('pre','demo-mono trial-command');
  setup.textContent='Check the native PR source head first; no SHA is assumed.';
  const copySetup=trial3Button('Copy setup commands',()=>{
   const command=trial3Checkout(template,state.head);
   if(command)copyText(command,copySetup);
  });
  copySetup.disabled=true;
  if(template.launch.kind==='local-web'){
   setupDetails.append(el('summary',null,'Exact-head local setup commands'),
    trial3Info('Run these commands only in an isolated, suitable native environment. The Page does not run them.'),setup,copySetup);
   prepare.append(setupDetails);
  }
  section.append(prepare);

  const launchPanel=el('section','trial-panel');
  launchPanel.append(el('h4',null,template.launch.kind==='local-web'
   ?'2. Open the real prototype':'2. Open the original review'));
  const launchNote=trial3Info('');
  const confirmBox=el('input');confirmBox.type='checkbox';
  const urlInput=el('input','trial-url');urlInput.setAttribute('aria-label','Local native preview URL');
  const launch=el('a','btn small trial-launch',template.launch.kind==='local-web'
   ?'Open prototype':'Open source for review');
  launch.target='_blank';launch.rel='noopener noreferrer';
  if(template.launch.kind==='local-web'){
   const address=el('label','trial-field-label','Your local running preview URL (localhost only)');
   urlInput.placeholder='http://127.0.0.1:8080/';
   address.append(urlInput);
   const confirm=el('label','trial-confirm');
   confirmBox.setAttribute('aria-label','I checked out this exact source head locally');
   confirm.append(confirmBox,' I checked out this exact native source head locally (self-attested).');
   launchPanel.append(address,confirm);
   launch.setAttribute('aria-disabled','true');
   const launchRow=el('div','trial-row trial-row-wrap');launchRow.append(launch);
   launchPanel.append(launchRow,launchNote);
   urlInput.addEventListener('input',updateLaunch);
   confirmBox.addEventListener('change',updateLaunch);
  }else{
   launch.href=template.candidate.url;launchPanel.append(launch);
   launchPanel.append(trial3Info('Read or inspect the linked source yourself. Opening it does not verify provenance or certify a test result.'));
  }
  section.append(launchPanel);

  const scenarios=el('section','trial-panel');
  const heading=el('div','trial-row trial-between');
  const progress=el('span','trial-progress','0 / '+template.cases.length+' OBSERVED');
  progress.setAttribute('aria-live','polite');
  heading.append(el('h4',null,'3. Test scenarios'),progress);
  scenarios.append(heading,trial3Info('Inspect each expectation and record a result only after observing the native runtime or reviewed material.'));
  const list=el('div','trial-scenarios');
  for(const item of template.cases){
   const card=el('article','trial-case');
   const top=el('div','trial-case-top');
   const id=el('span','trial-case-id',item.id);
   const name=el('strong','trial-case-name',item.title);
   const stateText=el('span','trial-case-status','NOT RUN');
   const details=el('details','trial-inspect');
   details.append(el('summary',null,'Inspect'));
   const body=el('div','trial-inspect-body');
   body.append(el('p','trial-expected','EXPECTED BEHAVIOR'),trial3Info(item.expected));
   const label=el('label','trial-field-label','Observed result');
   const select=el('select');select.setAttribute('aria-label',item.id+' observed result');
   for(const status of TRIAL3_OUTCOMES){
    const option=el('option',null,status.replace('_',' '));option.value=status;select.append(option);
   }
   select.addEventListener('change',()=>{state.outcomes[item.id]=select.value;updateSummary();});
   label.append(select);body.append(label);
   const note=el('textarea','trial-notes');note.rows=2;note.maxLength=300;
   note.setAttribute('aria-label',item.id+' observation notes');
   note.placeholder='Brief observation; do not paste protected inputs or private URLs';
   note.addEventListener('input',()=>{state.notes[item.id]=note.value;});
   body.append(note);details.append(body);
   top.append(id,name,stateText,details);card.append(top);list.append(card);
   selections.push(select);notes.push(note);statusRows.push(stateText);cards.push(card);
  }
  scenarios.append(list);section.append(scenarios);

  const results=el('section','trial-panel');
  results.append(el('h4',null,'4. Review results'));
  const counters={};const counts=el('div','trial-counts');
  for(const [status,label] of [['PASS','Passed'],['FAIL','Failed'],['BLOCKED','Blocked'],['NOT_RUN','Not run']]){
   const box=el('div','trial-counter'),value=el('strong',null,'0');
   value.setAttribute('data-trial-count',status);
   box.append(value,el('span',null,label));counts.append(box);counters[status]=value;
  }
  results.append(counts,trial3Info('These are self-reported observations, never independent IR or technical/Owner acceptance.'));
  const actions=el('div','trial-row trial-row-wrap');
  const copy=trial3Button('Copy trial report',()=>copyText(trial3Packet(template,{
   head:state.head,confirmed:state.confirmed,outcomes:state.outcomes,notes:state.notes
  }),copy));
  const reset=trial3Button('Reset observations',resetObservations);
  actions.append(copy,reset);
  results.append(actions,trial3Info('No upload, Page/Cycle write or mandatory agent report. Unobserved cases remain NOT_RUN.'));
  section.append(results);
  const related=el('section','trial-related');
  related.append(el('h4',null,'Related tools'));
  const relatedRow=el('div','trial-row trial-row-wrap');
  if(key==='ciifr-node'||key==='ciifr'){
   const board=el('a','btn small','Cycle Board');board.href='#/'+key+'/cycle-board';
   relatedRow.append(board);
  }
  if(template.task&&TRIAL3_URL.test(template.task))relatedRow.append(link(template.task,'Original task'));
  const demo=trial3Button('Workflow demo',()=>{
   const disclosure=root.querySelector('#'+key+'-workflow-demo');
   if(disclosure){
    disclosure.open=true;
    if(typeof disclosure.scrollIntoView==='function')
     disclosure.scrollIntoView({block:'start',behavior:'smooth'});
   }
  });
  relatedRow.append(demo);related.append(relatedRow);section.append(related);
  function updateStatus(){
   sourceBadge.textContent='Source · '+(template.candidate.kind==='github-pr'
    ?state.head?'HEAD OBSERVED':'NOT CHECKED':'LINK ONLY');
   sessionBadge.textContent='Session · '+(trial3Summary(template,state.outcomes).observed?'OBSERVATIONS':'NOT RUN');
  }
  function updateLaunch(){
   state.confirmed=!!state.head&&confirmBox.checked;
   const valid=trial3Loopback(urlInput.value);
   const ready=!!valid&&state.confirmed;
   copySetup.disabled=!state.head;
   launch.setAttribute('aria-disabled',String(!ready));
   if(ready)launch.href=valid;else launch.removeAttribute('href');
   launchNote.textContent=ready
    ?'Launch is self-attested. Actual runtime and checkout are NOT independently verified.'
    :'Launch disabled until an observed head, localhost URL and your checkout confirmation are present.';
  }
  function updateSummary(){
   const counts=trial3Summary(template,state.outcomes);
   progress.textContent=counts.observed+' / '+counts.total+' OBSERVED';
   for(const status of TRIAL3_OUTCOMES)counters[status].textContent=String(counts[status]);
   template.cases.forEach((item,i)=>{
    const outcome=TRIAL3_OUTCOMES.includes(state.outcomes[item.id])?state.outcomes[item.id]:'NOT_RUN';
    statusRows[i].textContent=outcome.replace('_',' ');
    cards[i].setAttribute('data-result',outcome);
   });
   updateStatus();
  }
  function resetObservations(){
   state.outcomes={};state.notes={};
   selections.forEach(x=>{x.value='NOT_RUN';});
   notes.forEach(x=>{x.value='';});
   updateSummary();
  }
  function clearSession(){
   state.head=null;confirmBox.checked=false;urlInput.value='';
   sourceLine.textContent=template.candidate.kind==='github-pr'
    ?'Native PR source: NOT_CHECKED':'Configured source link · no automated provenance verification';
   setup.textContent='Check the source head to generate an exact checkout.';
   resetObservations();updateLaunch();updateStatus();
  }
  updateSummary();
  if(template.launch.kind==='local-web')updateLaunch();
  mount.append(section);
 }
 display(profiles[0]);
 return {configured:true,profiles:profiles.length};
}
