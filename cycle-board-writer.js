// CT-3: source-bound Page writer reconciliation *preview*, never publication.
// The existing pp_cli.py propose / pp_batch.py dry-run are the only writer path.
import { el, link, copyText } from './util.js?v=34';

const PR=/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9][0-9]*$/;
const ISSUE=/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[1-9][0-9]*$/;
const SHA=/^[a-f0-9]{40}$/;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
const KEY=/^[a-z][a-z0-9-]{0,48}$/;
const safeId=x=>typeof x==='string'&&KEY.test(x);
const cleanUrl=x=>typeof x==='string'&&(PR.test(x)||ISSUE.test(x));
const ordered=xs=>xs.slice().sort((a,b)=>a.source.localeCompare(b.source));

function evidenceIdentity(s){
  if(!s||!cleanUrl(s.source)||typeof s.occurrenceId!=='string')return false;
  const match=/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/(pull|issues)\/([1-9][0-9]*)$/.exec(s.source);
  if(!match)return false;
  const [,owner,repo,type,number]=match;
  const stem='github:'+owner+'/'+repo+':'+(type==='pull'?'pull-head':'issue-revision')+':'+number+':';
  if(s.kind==='PULL'&&type==='pull'&&SHA.test(s.revision))
    return s.occurrenceId===stem+s.revision;
  if(s.kind==='ISSUE'&&type==='issues'&&ISO.test(s.revision))
    return s.occurrenceId===stem+s.revision;
  return false;
}

// Scoped candidate judgment is NOT a claim that writer CLI will accept a
// manifest. Only its own fresh source observation and checker can do that.
export function cycleBoardWriterModel(page,context,delta,{historical=false}={}){
  const key=page?.index?.project?.key;
  const audit=page?.audit?.events||[],cards=page?.cards||{},
    milestones=page?.index?.milestones||{};
  const base={schema:'cycle-board.writer-preview/v1',project:key||'UNKNOWN',
    status:'NOT_READY',items:[],pendingCount:0,recordedCount:0,
    note:'Read-only review candidate. No Page data written, approval or technical PASS.'};
  if(historical)return {...base,status:'HISTORICAL',note:
    'Historical Page revision: current source proposals are not offered on archived data.'};
  if(!safeId(key)||context?.project!==key||context?.schema!=='cycle-board.context/v1')
    return {...base,status:'UNKNOWN',note:'Source and Page project identity are not established.'};
  if(context?.native?.coverage!=='COMPLETE'||context?.page?.status!=='ok'||
     !['STALE_PAGE','CURRENT','UNKNOWN','UNMAPPED'].includes(delta?.publication?.status))
    return {...base,status:'UNKNOWN',note:'A complete native observation and successful Page read are required before source reconciliation.'};
  const drift=new Set((delta?.publication?.sources||[]).filter(s=>s.status==='NEWER_NATIVE_UNPUBLISHED')
    .map(s=>s.source+'\n'+s.revision));
  const items=ordered(context.sources||[]).map(s=>{
    const exactSource=evidenceIdentity(s),m=milestones[s?.milestone];
    const validScope=!!(m?.wbs&&m.wbs===s.wbs&&s.scope==='SOURCE_MATCHED');
    const auditMatches=audit.filter(a=>a.source===s.source).map(a=>a.id).filter(Boolean);
    const existingRefs=Object.entries(cards).filter(([,c])=>c.src===s.source||
      (c.refs||[]).some(r=>r.u===s.source)).map(([id])=>id).sort();
    const options=Object.entries(cards).filter(([,c])=>!c.closed&&
      c.milestone===s.milestone).map(([id])=>id).sort();
    let status='REVIEW_REQUIRED',reason='Native source needs original review before any Page proposal.',cardId=null;
    if(!exactSource) {
      status='UNKNOWN';reason='Original source or immutable occurrence identity cannot be verified.';
    } else if(!validScope){
      status='UNMAPPED';reason='No exact current Page milestone/WBS mapping.';
    } else if(auditMatches.length){
      status='ALREADY_RECORDED';reason='Original source URL is already in append-only Page audit. Current writer refuses duplicate URL even for a later head. Review a distinct native event rather than counting a second achievement.';
    } else if(existingRefs.length){
      status='REVIEW_REQUIRED';reason='Source URL is already recorded on a Page card; duplicate reference proposal is not permitted.';
    } else if(options.length!==1){
      status='CARD_SELECTION_REQUIRED';reason='No unique open Page card for this WBS; the writer must select and verify the actual evidence owner.';
    } else if(!drift.has(s.source+'\n'+s.revision)){
      status='REVIEW_REQUIRED';reason='CT-2 has not established this exact source/revision as newer than published Page evidence.';
    } else{
      cardId=options[0];status='PROPOSAL_CANDIDATE';
      reason='One existing Page card and a newer native occurrence are identified. Writer must inspect original scope/head and run existing propose + dry-run; no automatic update.';
    }
    const command=cardId?[
      'python tools/pp_cli.py propose --project '+key+
       ' --source '+s.source+
       ' --actor "REPLACE_WITH_AUTHORIZED_PAGE_WRITER"'+
       ' --card '+cardId+
       (s.kind==='PULL'?' --expected-head '+s.revision:'')+
       ' --output reviewed-proposal.json',
      'python tools/pp_batch.py reviewed-proposal.json --data data',
      'python tools/pp_cli.py check'
    ]:null;
    return {source:s.source,occurrenceId:s.occurrenceId,revision:s.revision,
      wbs:validScope?s.wbs:null,cardId,status,reason,
      auditIds:auditMatches,existingRefs,options,kind:s.kind,
      technicalPass:'NOT_ESTABLISHED',publication:'NOT_PUBLISHED_BY_BOARD',
      command};
  });
  const pendingCount=items.filter(i=>i.status==='PROPOSAL_CANDIDATE').length;
  const recordedCount=items.filter(i=>i.status==='ALREADY_RECORDED').length;
  // A previously audited URL is not necessarily an audited new PR head.
  // Only CT-2 exact scoped revision correlation permits ALREADY_RECONCILED.
  const exactPublished=delta?.publication?.status==='CURRENT';
  return {...base,status:pendingCount?'REVIEW_PENDING':
    items.length&&items.every(i=>i.status==='ALREADY_RECORDED')&&exactPublished?'ALREADY_RECONCILED':
    items.some(i=>i.status==='UNKNOWN'||i.status==='UNMAPPED')?'UNKNOWN':'REVIEW_REQUIRED',
    items,pendingCount,recordedCount};
}

export function renderCycleBoardWriter(root,model){
  const panel=el('section','cb-writer');
  panel.append(el('h4',null,'Reviewed Page reconciliation · CT-3'),
    el('p','muted','Original native evidence → existing Page writer proposal → checked dry-run → separately authorized publication. Never a second status report or automatic Page write.'));
  const h=el('p','cb-writer-state');
  h.append(el('strong',null,model.status+' · '+model.pendingCount+' proposal candidate(s)'),
    el('span','muted',' · '+model.recordedCount+' source URL(s) already audited'));
  panel.append(h);
  if(!model.items.length)panel.append(el('p','banner',model.note));
  for(const s of model.items){
    const card=el('article','cb-writer-item');
    card.append(el('b',null,s.status+' · '+(s.wbs?'WBS '+s.wbs:'WBS UNMAPPED')),
      el('p','muted',s.reason),
      el('p','muted','Source occurrence: '+s.occurrenceId),
      el('p','muted','Publication: '+s.publication+' · independent technical PASS '+s.technicalPass),
      link(s.source,'Inspect original native evidence','btn small'));
    if(s.cardId)card.append(el('p','muted','Candidate Page card: '+s.cardId+
      ' · writer must verify association before applying.'));
    if(s.auditIds.length)card.append(el('p','muted','Existing Page audit IDs: '+s.auditIds.join(', ')));
    if(s.command){
      const details=el('details','cb-writer-commands');
      details.append(el('summary',null,'Existing writer commands · review and dry-run'));
      const pre=el('pre','cb-writer-code');
      pre.textContent=s.command.join('\n');
      details.append(el('p','muted',
        'Replace the actor placeholder; run from the repository checkout. The CLI rereads GitHub and may stop on changed head, duplicated URL, missing scope or existing reference. A dry-run does not publish.'),
        pre);
      const button=el('button','btn small','Copy writer commands (requires review)');
      button.type='button';button.addEventListener('click',()=>copyText(s.command.join('\n'),button));
      details.append(button);card.append(details);
    }
    panel.append(card);
  }
  panel.append(el('p','muted','If an authorized Page PR later merges, reread the actual Page audit and match the source/receipt. Do not mark published from an unmerged proposal, an INFO card or a successful dry-run.'));
  root.append(panel);
}
