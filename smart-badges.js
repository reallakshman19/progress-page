// Shared source-grounded Smart Badge identifiers for Timeline, Agent Start and Oracle continuity.
// A badge is a read-only index into recorded evidence; never a status/approval/assignment.
import { el, link } from './util.js?v=33';

export const SMART_BADGE_TYPES = Object.freeze([
  'AIM','ROADMAP','WBS','PLAN','FIXTURE','ORACLE_CONTINUITY'
]);
const SB_PUBLIC = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/|$)/;
const SB_BOUND = /^[a-z0-9_.-]{1,72}$/i;
const badgeSourceOf = value => SB_PUBLIC.test(value || '') ? value : null;

function smartBadgeRecord(project, type, key, label, source, origin, target) {
  if (!SMART_BADGE_TYPES.includes(type) || !SB_BOUND.test(key||'') || !SB_BOUND.test(project||'')) return null;
  return { id: project + '/' + type + '/' + key, type, key,
    label: String(label||key).slice(0,100), source: badgeSourceOf(source),
    origin, target, evidence: badgeSourceOf(source) ? 'SOURCE_LINKED' : 'SOURCE_UNAVAILABLE' };
}

export function smartBadgesForScope(project, {cardId=null, milestoneId=null, event=null, continuity=false}={}) {
  const index=project?.index||{}, milestones=index.milestones||{}, cards=project?.cards||{};
  const key=index.project?.key, foundCard=cardId ? cards[cardId] : null;
  if (!SB_BOUND.test(key||'') || (cardId && !foundCard)) return [];
  const derivedId=foundCard?.milestone||null;
  // A card's owning milestone cannot be overridden by a different WBS.
  if (milestoneId && derivedId && milestoneId!==derivedId) return [];
  const id=derivedId||milestoneId;
  if (id && !milestones[id]) return [];
  const milestone=id ? milestones[id] : null;
  const output=[],add=(type,token,label,source,origin,target)=>{
    const b=smartBadgeRecord(key,type,token,label,source,origin,target);
    if (b && !output.some(x=>x.id===b.id)) output.push(b);
  };
  const aim=index.project||{};
  if (aim.aim) add('AIM','project','Owner AIM',aim.aimSrc,
    'index.project.aim', '#/'+key+'/home');
  if(milestone?.wbs){
    add('WBS',milestone.wbs,'WBS '+milestone.wbs,
      milestone.capSrc||foundCard?.src||event?.source,
      'index.milestones.'+id, '#/'+key+'/progress');
    // Roadmap here means published milestone sequence/description, not a
    // separately approved roadmap fixture or a successful capability test.
    if(milestone.name||milestone.full){
      add('ROADMAP',id,'Milestone '+id+' · '+(milestone.name||''),
        milestone.capSrc, 'index.milestones.'+id,
        '#/'+key+'/home-roadmap');
    }
  }
  // PLAN and FIXTURE mean these specific kinds of published source events;
  // ordinary task/status updates cannot claim plan approval or fixture receipt.
  if(event?.kind==='PLAN' && id){
    add('PLAN',id,'Recorded plan · '+id,event.source,
      'audit.'+event.id, '#/'+key+'/home-roadmap');
  }
  if(event?.kind==='FIXTURE'&&id&&typeof event.list==='string'&&SB_BOUND.test(event.list)){
    add('FIXTURE',event.list,'Fixture list · '+event.list,event.source,
      'audit.'+event.id, '#/'+key+'/fixtures');
  }
  if(continuity && foundCard) {
    add('ORACLE_CONTINUITY',cardId,'Oracle continuity · '+cardId,
      foundCard.src, 'cards.'+cardId, '#/'+key+'/oracle-continuity');
  }
  return output;
}

export function smartBadgeText(badges) {
  return (badges||[]).map(b=>
    '- '+b.type+' ['+b.id+'] '+b.label+' · '+b.evidence+
    ' · origin '+b.origin+' · source '+(b.source||'NOT_RECORDED')).join('\n');
}

export function renderSmartBadges(root,badges) {
  if(!badges?.length)return;
  const panel=el('div','ct-tags smart-badges');
  panel.setAttribute('aria-label','Source-grounded Smart Badge identifiers');
  for(const b of badges){
    const node=b.source?link(b.source,b.type+' · '+b.label,'chip') :
      el('span','chip',b.type+' · '+b.label+' · source unknown');
    node.setAttribute('data-badge-id',b.id);
    node.title=b.id+' · '+b.origin+' · '+b.evidence;
    panel.append(node);
  }
  root.append(panel);
}
