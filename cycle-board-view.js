// CT-1 source-bound Board presentation. Do not infer Cycle assignment or engineering PASS.
import {el,link} from './util.js?v=33';
import {smartBadgesForScope,renderSmartBadges} from './smart-badges.js?v=33';

const chip=(label)=>el('span','chip',label);
export function renderCycleBoardContext(root,project,ctx){
  const section=el('section','panel cycle-board-context');
  section.append(el('h3',null,'Cycle Board · source-bound current context'),
    el('p','muted','CT-1 read-only pilot. Original sources and the published Page audit are distinct. '
      +'No new reporting, Cycle assignment, technical PASS or Page publication.'));
  const scope=el('p');
  scope.append(chip('Project '+(ctx.project||'UNKNOWN')),chip('Page '+(ctx.scope.pageRevision||'UNKNOWN')),
    chip('WBS '+(ctx.scope.wbs||'NOT_SELECTED')),chip('Cycle '+ctx.cycle.binding));
  section.append(scope);
  if(ctx.scope.aim) {
    const aim=el('p','ct-description',ctx.scope.aim);
    section.append(aim);
    if(ctx.scope.aimSrc)section.append(link(ctx.scope.aimSrc,'Original Owner aim'));
  }
  if(ctx.scope.mapping==='SOURCE_MATCHED'){
    const tags=el('div','ct-tags');
    renderSmartBadges(tags,smartBadgesForScope(project,{
      cardId:ctx.scope.pageCard,milestoneId:ctx.scope.milestone
    }));
    section.append(tags);
  }else section.append(el('p','banner','Selected WBS/card mapping not established. No task inferred.'));
  section.append(el('h4',null,'Native sources · read-only observation'));
  const sourceHealth=el('p','muted','Coverage '+ctx.coverage+' · successful native observation '+
    (ctx.observedAt||'UNKNOWN')+' · Page JSON read '+(ctx.page.observedAt||'UNKNOWN'));
  section.append(sourceHealth);
  if(!ctx.sources.length)section.append(el('p','banner','No complete native source occurrence observed. '
    +'Prior Page records remain useful history, not current native verification.'));
  for(const s of ctx.sources){
    const item=el('div','ct-card');
    const heading=el('div','ct-top');
    heading.append(chip(s.kind),chip(s.state),el('b',null,s.title||s.kind));
    item.append(heading,link(s.url,'Original native '+s.kind),
      el('p','muted','Occurrence '+s.occurrenceId),
      el('p','muted','Source updated '+(s.sourceAt||'UNKNOWN')+
        ' · observed '+(s.observedAt||'UNKNOWN')+
        ' · reported evidence, not independent PASS'));
    if(s.headSha)item.append(el('p','muted','Exact PR head '+s.headSha+
      (s.draft?' · DRAFT':'')+(s.merged?' · MERGED':'')));
    section.append(item);
  }
  for(const err of ctx.readErrors||[]){
    const row=el('p','banner','Source not qualified: '+err.reason+' · ');
    row.append(link(err.url,'source'));section.append(row);
  }
  section.append(el('h4',null,'Existing published Page history'));
  if(!ctx.page.events.length)section.append(el('p','muted','No scoped audited Page events found.'));
  for(const e of ctx.page.events){
    const row=el('p','ct-description');
    row.append(el('b',null,e.kind+' · '+e.auditId+' '),e.summary+' · ',
      link(e.source,'recorded original'));section.append(row);
  }
  section.append(el('p','muted','Page card state: '+(ctx.page.recordedState||'UNKNOWN')+
    ' · recorded next (may be stale): '+(ctx.page.recordedNext||'UNKNOWN')),
    el('p','muted','Delta/authority classification: CT-2 NOT_IMPLEMENTED. '
      +'A displayed newer native source is not an authorized next assignment.'));
  root.append(section);
}
