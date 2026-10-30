// Declarative, reviewed trial profiles — never a project status ledger.
// Profiles are optional. No profile means no invented executable prototype.
export const TRIAL3_SCHEMA='progress-trial-template/v1';

export const TRIAL3_PROPERTY_CASES=Object.freeze([
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

// Frozen registry: these links are user-readable evidence, not a source of
// engineering authority, execution commands, or an implicit Page publication.
export const TRIAL3_TEMPLATES=Object.freeze([
 Object.freeze({
  schema:TRIAL3_SCHEMA,project:'ciifr-node',id:'property-r0',
  title:'Property Transfer R0',scope:Object.freeze({wbs:'2',card:'node-r0-code'}),
  candidate:Object.freeze({kind:'github-pr',url:'https://github.com/reallakshman19/XML_Compare_Utilities/pull/232',
   api:'https://api.github.com/repos/reallakshman19/XML_Compare_Utilities/pulls/232'}),
  task:'https://github.com/reallakshman19/XML_Compare_Utilities/issues/231',
  launch:Object.freeze({kind:'local-web',repo:'reallakshman19/XML_Compare_Utilities'}),
  cases:TRIAL3_PROPERTY_CASES
 }),
 Object.freeze({
  schema:TRIAL3_SCHEMA,project:'ciifr',id:'r3-launch-guide',
  title:'R3 native prototype launch qualification',scope:Object.freeze({wbs:'5'}),
  candidate:Object.freeze({kind:'pinned-document',
   url:'https://github.com/reallakshman19/XML_Compare_Utilities/blob/a67487023bcafc13d68b62dbfc9bb74c61b3c64c/prototypes/CIIFR-R3-PROTOTYPES.md'}),
  launch:Object.freeze({kind:'source-review'}),
  cases:Object.freeze([
   Object.freeze({id:'R3-01',title:'Separate prototype launchers',expected:'The pinned native guide describes distinct versioned launch paths; do not infer that running one validates the others.'}),
   Object.freeze({id:'R3-02',title:'Source and revision provenance',expected:'The reviewed document refers to the intended pinned source revision and native test evidence, not merely a mutable project URL.'}),
   Object.freeze({id:'R3-03',title:'Qualification holds',expected:'Native/Windows/original-file and Owner acceptance gates stay explicit where independently unverified.'})
  ])
 }),
 Object.freeze({
  schema:TRIAL3_SCHEMA,project:'ciifr',id:'geometry-rca',
  title:'Geometry RCA source review',scope:Object.freeze({wbs:'3'}),
  candidate:Object.freeze({kind:'source-document',
   url:'https://github.com/reallakshman19/XML_Compare_Utilities/issues/350'}),
  launch:Object.freeze({kind:'source-review'}),
  cases:Object.freeze([
   Object.freeze({id:'GEO-01',title:'Original bore/port source',expected:'Compare the pinned source witnesses rather than relying on an unverified preview or narrative summary.'}),
   Object.freeze({id:'GEO-02',title:'REST and datum configuration',expected:'Record the original configuration and baseline without changing masses, model bytes or engineering approval.'})
  ])
 }),
 Object.freeze({
  schema:TRIAL3_SCHEMA,project:'g9v35',id:'qrt-grid',
  title:'QRT grid · Work, Power and Energy',scope:Object.freeze({wbs:'2.5'}),
  candidate:Object.freeze({kind:'hosted-review',
   url:'https://reallakshman19.github.io/progress-page/reviews/g9v35/qrt-grid.html'}),
  launch:Object.freeze({kind:'hosted-review'}),
  cases:Object.freeze([
   Object.freeze({id:'QRT-01',title:'Tile and topic coverage',expected:'Review the hosted Work, Power and Energy QRT grid; record actual missing or incorrect tiles.'}),
   Object.freeze({id:'QRT-02',title:'Question-to-teaching correspondence',expected:'Check the tile points to the intended teaching/try objective; do not claim a learning outcome from its presence alone.'}),
   Object.freeze({id:'QRT-03',title:'Unknown and unresolved content',expected:'Leave unanswered review questions visible; mark BLOCKED when the original lesson or independent verification is unavailable.'})
  ])
 })
]);

export function trial3Profiles(projectKey,project){
 if(typeof projectKey!=='string'||!project?.index?.milestones)return [];
 const milestones=project.index.milestones;
 return TRIAL3_TEMPLATES.filter(t=>{
  if(t.project!==projectKey||t.schema!==TRIAL3_SCHEMA)return false;
  if(!Object.values(milestones).some(m=>m?.wbs===t.scope.wbs))return false;
  if(t.scope.card){
   const card=project.cards?.[t.scope.card];
   if(!card||!milestones[card.milestone]||milestones[card.milestone].wbs!==t.scope.wbs)return false;
  }
  return true;
 });
}

export function trial3ValidateRegistry(){
 const ids=new Set();
 for(const t of TRIAL3_TEMPLATES){
  const key=t.project+'/'+t.id;
  if(ids.has(key)||t.schema!==TRIAL3_SCHEMA||!t.scope.wbs||!t.cases.length)throw Error('invalid trial template '+key);
  ids.add(key);
  if(!['github-pr','pinned-document','source-document','hosted-review'].includes(t.candidate.kind)||
   !['local-web','source-review','hosted-review'].includes(t.launch.kind))throw Error('unsupported trial source/launch '+key);
  if(!/^https:\/\/(?:github\.com|reallakshman19\.github\.io)\//.test(t.candidate.url)||
   (t.candidate.api&&!/^https:\/\/api\.github\.com\/repos\/[\w.-]+\/[\w.-]+\/pulls\/\d+$/.test(t.candidate.api)))
    throw Error('untrusted source URL '+key);
  const cases=new Set();
  for(const row of t.cases){
   if(cases.has(row.id)||!row.id||!row.title||!row.expected)throw Error('invalid case in '+key);
   cases.add(row.id);
  }
 }
 return true;
}
