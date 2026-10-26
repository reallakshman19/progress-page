// Search current published progress data across projects. Pure, read-only; no inferred approvals.
const norm = s => String(s || '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
const LINK_RE = /https:\/\/github\.com\/[^\s<>)\]]+/gi;
function urls(s) { return String(s || '').match(LINK_RE) || []; }
function refs(item) {
  return [...(item?.refs || []).map(r => r.u || ''), ...(item?.links || []).map(r => r.u || ''),
    item?.src || '', item?.u || '', item?.source || ''].filter(Boolean);
}
function routeFor(project, view, revision = null, milestone = null) {
  let path = '#/' + encodeURIComponent(project.key) + '/' + view;
  if (!revision && !milestone) return path;
  const rev = revision || project.currentRevision || 'current';
  path += '/' + encodeURIComponent(rev);
  const meta = (project.index?.milestones || {})[milestone];
  if (!meta || !milestone) return path;
  const wbs = String(meta.wbs || '');
  const major = /^\d+/.exec(wbs);
  const family = major ? 'wbs:' + major[0] : 'other';
  return path + '/' + encodeURIComponent(family) + '/' + encodeURIComponent(milestone);
}
function wbsFor(p, milestone) { return p.index?.milestones?.[milestone]?.wbs || ''; }
function linkNumbers(text) {
  const prs = new Set(), issues = new Set();
  const all = String(text || '');
  for (const m of all.matchAll(/github\.com\/[^\s/]+\/[^\s/]+\/(pull|issues)\/(\d+)/gi)) {
    (m[1].toLowerCase() === 'pull' ? prs : issues).add(m[2]);
  }
  for (const m of all.matchAll(/\bPR\s*#?\s*(\d+)\b/gi)) prs.add(m[1]);
  for (const m of all.matchAll(/\b(?:issue|XCU)\s*#?\s*(\d+)\b/gi)) issues.add(m[1]);
  return { prs: [...prs], issues: [...issues] };
}
export function buildSearchIndex(projects, data) {
  const rows = [];
  for (const entry of projects || []) {
    const raw = data?.[entry.key]; if (!raw?.index) continue;
    const rev = (raw.index.revisions || []).find(r => r.status === 'current')?.id || null;
    const p = { ...raw, key: entry.key, currentRevision: rev };
    const add = (type, id, title, detail, milestone, revision, view, inputs = []) => {
      const wbs = wbsFor(p, milestone);
      const evidence = inputs.flatMap(x => [String(x || ''), ...urls(x)]);
      const searchable = [entry.label, entry.key, type, id, title, detail, milestone, wbs && 'WBS ' + wbs, revision,
        ...evidence].join(' ');
      const numbers = linkNumbers(searchable);
      rows.push({
        key: entry.key + ':' + type + ':' + id, project: entry.label || entry.key, projectKey: entry.key,
        type, title: title || id, detail: String(detail || '').slice(0, 450), wbs, revision: revision || rev,
        url: routeFor(p, view, revision && revision !== rev ? revision : null, milestone),
        source: evidence.find(x => /^https:\/\/github\.com\//.test(x)) || '',
        text: norm(searchable), prs: numbers.prs, issues: numbers.issues,
      });
    };
    add('Project', entry.key, raw.index.project?.title || entry.label, raw.index.project?.aim,
      null, rev, 'home', [raw.index.project?.aimSrc]);
    for (const [id, m] of Object.entries(raw.index.milestones || {}))
      add('WBS', id, (m.wbs ? 'WBS ' + m.wbs + ' · ' : '') + (m.name || id), [m.full,m.activity,m.canDo].join(' '),
        id, rev, 'progress', [m.capSrc]);
    for (const [id, c] of Object.entries(raw.cards || {}))
      add('Agent', id, c.label, [c.state,c.now,c.next?.text,c.who?.role].join(' '),
        c.milestone, rev, 'progress', refs(c).concat([c.now]));
    for (const [id, a] of Object.entries(raw.actions || {}))
      add('Decision', id, a.title, [a.status,a.lead,a.answer?.text].join(' '), a.milestone,
        rev, 'actions', refs(a).concat(a.answer?.ref || []));
    for (const [section, list] of Object.entries(raw.fixtures || {}))
      if (Array.isArray(list)) list.forEach((f, i) => add('Fixture', section + '-' + i,
        f.t, [f.s,f.n,section].join(' '), f.milestone, rev, 'fixtures', refs(f)));
    for (const e of raw.audit?.events || []) {
      const relatedCard = raw.cards?.[e.card || e.target];
      // An older revision event cannot inherit the card's present-day WBS owner.
      const milestone = /^milestone:/.test(e.scope || '') ? e.scope.slice(10)
        : e.rev && e.rev !== rev ? null : relatedCard?.milestone;
      add('Timeline', e.id || String(e.seq), e.summary || e.kind, [e.actor,e.kind,e.card,e.scope].join(' '),
        milestone, e.rev || rev, 'timeline', [e.source]);
    }
  }
  return rows;
}
export function searchProgress(index, query, limit = 45) {
  const q = norm(query).replace(/[：]/g, ':');
  if (!q) return [];
  const number = /^#?(\d+)$/.exec(q);
  const pr = /^(?:pr|pull request)\s*#?\s*(\d+)$/.exec(q);
  const issue = /^(?:issue|issues)\s*#?\s*(\d+)$/.exec(q);
  const wbs = /^wbs\s*[:#]?\s*(\d+(?:\.\d+)*)$/.exec(q);
  const terms = q.split(/\s+/).filter(Boolean);
  const ranked = [];
  for (const r of index || []) {
    let score = 0;
    if (pr) { if (!r.prs.includes(pr[1])) continue; score = 100; }
    else if (issue) { if (!r.issues.includes(issue[1])) continue; score = 100; }
    else if (number) {
      if (!r.prs.includes(number[1]) && !r.issues.includes(number[1])) continue;
      score = 90;
    } else if (wbs) {
      if (!(r.wbs === wbs[1] || r.wbs.startsWith(wbs[1] + '.'))) continue;
      score = r.wbs === wbs[1] ? 90 : 70;
    } else {
      if (!terms.every(t => r.text.includes(t))) continue;
      score = terms.reduce((n,t) => n + (norm(r.title).includes(t) ? 8 : 2),0);
    }
    score += ({Agent:5,Decision:4,WBS:3,Fixture:2,Timeline:1,Project:2}[r.type] || 0);
    ranked.push({ ...r, score });
  }
  return ranked.sort((a,b) => b.score-a.score || a.project.localeCompare(b.project) || a.title.localeCompare(b.title)).slice(0,limit);
}
