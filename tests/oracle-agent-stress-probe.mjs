// Snapshot projection used by the isolated Python CLI stress harness.
// Takes a disposable data directory as argv[2]; never writes any file.
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {onboardingModel} from '../onboarding.js';
import {oracleContinuityModel} from '../oracle-continuity.js';
import {projectHomeModel} from '../actions.js';
import {agentStartModel,agentStartTaskText} from '../agent-start.js';
import {wbsGroups} from '../progress.js';

export function evaluate(project,cardId='onb1',milestone='M5'){
 const home=projectHomeModel(project);
 const onb=onboardingModel(project,{cardId});
 const oracle=oracleContinuityModel(project);
 const family=wbsGroups(project.index).find(g=>g.steps.some(s=>s.key===milestone));
 const agent=agentStartModel(project,{family,step:milestone,
   revision:project.index.revisions.find(r=>r.status==='current')?.id,cardId});
 const packet=agentStartTaskText(agent);
 return {project:project.index.project.key,
  aimSource:home.aimSrc,
  conceptCount:home.concepts.length,conceptSources:home.concepts.map(x=>x.u),
  architectureCount:home.architecture.length,architectureSources:home.architecture.map(x=>x.u),
  sources:home.sources.map(x=>x.u),relay:home.relayInputs.map(x=>({status:x.s,source:x.u})),
  onboardingStage:onb?.stage??null,recipient:onb?.recipient??null,
  assignment:onb?.assignment??null,oracleCards:oracle.cards.map(x=>x.id),
  oracleEvents:oracle.events.length,oracleRevision:oracle.revision,
  agentMode:agent.mode,selectedTask:agent.selected?.id??null,
  agentSources:agent.sources.map(x=>x.url),packet,
  capability:agent.focused?.cap??null};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const dir=resolve(process.argv[2]||'.');
 const key=process.argv[3]||'demo';
 const pick=f=>JSON.parse(readFileSync(join(dir,key,f+'.json'),'utf8'));
 const p={index:pick('index'),cards:pick('cards'),
  fixtures:pick('fixtures'),audit:pick('audit'),actions:pick('actions')};
 process.stdout.write(JSON.stringify(evaluate(p))+'\n');
}
