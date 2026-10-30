// Optional OWNER trial worksheet for the *native* Property Transfer draft.
// It DOES NOT execute native CII parsing, publish a preview, or attest a checkout.
import {TRIAL3_PROPERTY_CASES} from './trial-templates.js?v=34';
import {renderTrialWorkspace} from './trial-workspace.js?v=34';

const TRIAL_NATIVE_REPO='reallakshman19/XML_Compare_Utilities';
export const NATIVE_PR='https://github.com/'+TRIAL_NATIVE_REPO+'/pull/232';
export const NATIVE_ISSUE='https://github.com/'+TRIAL_NATIVE_REPO+'/issues/231';
export const SOURCE_API='https://api.github.com/repos/'+TRIAL_NATIVE_REPO+'/pulls/232';
const TRIAL_SHA40=/^[0-9a-f]{40}$/i;
const TRIAL_OUTCOMES=Object.freeze(['NOT_RUN','PASS','FAIL','BLOCKED']);

export const PROPERTY_CASES=TRIAL3_PROPERTY_CASES;

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
export function trialSummary(outcomes={}){
 const counts={PASS:0,FAIL:0,BLOCKED:0,NOT_RUN:0};
 for(const item of PROPERTY_CASES){
  const result=TRIAL_OUTCOMES.includes(outcomes?.[item.id])?outcomes[item.id]:'NOT_RUN';
  counts[result]++;
 }
 return {...counts,observed:PROPERTY_CASES.length-counts.NOT_RUN,total:PROPERTY_CASES.length};
}

// Backward-compatible V2 entrypoint: only the V3 renderer owns UI behavior.
export function renderPropertyTrial(root,{project=null,projectKey='ciifr-node',historical=false,fetcher=fetch}={}){
 return renderTrialWorkspace(root,{projectKey,project,historical,fetcher});
}
