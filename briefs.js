// "+" dialogs: a short form that writes a copy-paste brief, so the Owner can hand the addition to another agent.
import { el, copyText } from './util.js?v=25';
import { dialog } from './popup.js?v=25';

const quote = (s) => '"' + String(s || '').replace(/"/g, "'") + '"';

function briefHead(site) {
  return 'Repository: https://github.com/' + site.repo + '   Page: ' + site.page + '\n'
    + 'Guide (read first, two minutes): ' + (site.guide || 'README.md in the repository') + '\n'
    + 'Use the tools in ' + site.tools + ' (pp_cli.py, pp_check.py). Do not rewrite the page or the checker.\n';
}

const BRIEF_RULES = 'RULES\n'
  + '- Public-safe data only: chat ids are the short id (never a chat link), no Drive links, no emails.\n'
  + '- Every change goes through pp_cli.py, so it is recorded on the Timeline (who, what, why, source). Never edit audit.json by hand. Never delete: supersede, cancel or archive.\n'
  + '- A card is VERIFIED only on evidence you can link. Say what you did not check.\n';

const BRIEF_END = '4. python tools/pp_cli.py check    (must end with OK)\n'
  + '   python tools/pp_cli.py check --base origin/main    (the Timeline only grew, nothing was deleted)\n'
  + '5. Commit only the data/ folder.\n'
  + '6. Reply with: the commit or pull request link, the output of both checks, and what you added.\n\n';

const briefVia = (mode) => (mode === 'otm'
  ? 'Mode otm: a data-only commit to main is allowed.'
  : 'Mode standalone: work on a branch pp/<project>-<your name> and open a DRAFT pull request; the Owner merges it.');

export function projectBrief(site, v) {
  return 'TASK: add a project to the Progress page\n' + briefHead(site) + '\n'
    + 'PROJECT  key: ' + (v.key || '<key>') + '   title: ' + (v.title || '<title>') + '\n'
    + '         mode: ' + v.mode + '   coordinator (who owes replies): ' + (v.coordinator || '<name>') + '\n'
    + '         started by this Owner decision: ' + (v.decision || '<link or the Owner\'s words>') + '\n\n'
    + 'STEPS (run from the repository root with plain python)\n'
    + '1. git pull. ' + briefVia(v.mode) + '\n'
    + '2. python tools/pp_cli.py project add --key ' + (v.key || '<key>') + ' --title ' + quote(v.title || '<title>') + ' --mode ' + v.mode + ' --coordinator ' + quote(v.coordinator || '<name>')
    + ' --aim "<the Owner\'s aim, at most 400 characters>" --actor "<your name>" --src "<GitHub link of the Owner decision>" --owner-words "<the Owner\'s words, short>" --why "<why this project starts>"\n'
    + '   This creates data/' + (v.key || '<key>') + '/ (index, cards, actions, fixtures, nudges, audit), adds the project to data/projects.json (the root level) and records revision R1.\n'
    + '3. Add what the project needs, each with --actor, --src and a reason:\n'
    + '   python tools/pp_cli.py plan chat --project ' + (v.key || '<key>') + ' --id <chat key> --label "<name>" --id8 <8-character chat id> --engine <ChatGPT|Antigravity|...> ...\n'
    + '   python tools/pp_cli.py plan milestone|group --project ' + (v.key || '<key>') + ' --id <id> --name|--title "<text>" --order <n> ...\n'
    + '   python tools/pp_cli.py card set --project ' + (v.key || '<key>') + ' --card <id> --label "<agent>" --state NOT_STARTED --now "<status>" --next-actor <who> --next-text "<next step>" --chat <chat key> ...\n'
    + BRIEF_END + BRIEF_RULES;
}

export function revisionBrief(site, p, v) {
  const key = p.key;
  const revs = (p.index.revisions || []);
  const cur = revs[revs.length - 1] || { id: 'R1' };
  return 'TASK: add a plan revision to the project ' + quote(p.index.project.title) + ' (' + key + ') on the Progress page\n'
    + 'A revision is added only because an Owner decision changed direction.\n' + briefHead(site) + '\n'
    + 'OWNER DECISION  words: ' + (v.words || '<the Owner\'s words>') + '\n'
    + '                link: ' + (v.link || '<GitHub link of the decision>') + '\n'
    + '                what changes: ' + (v.change || '<one sentence>') + '\n\n'
    + 'STEPS (run from the repository root with plain python)\n'
    + '1. git pull; commit what is pending so data/ is clean. ' + briefVia(p.mode) + '\n'
    + '2. python tools/pp_cli.py revision add --project ' + key + ' --why ' + quote(v.change || '<what changes>') + ' --owner-words ' + quote(v.words || '<the Owner\'s words>')
    + ' --src ' + quote(v.link || '<GitHub link>') + ' --actor "<your name>"\n'
    + '   ' + cur.id + ' becomes superseded and keeps the commit it was in, so it can still be opened; the next revision becomes current.\n'
    + '3. Bring the plan to the new direction, each with --actor, --src and a reason: card supersede --by <new card> or card cancel for what no longer applies;\n'
    + '   card set for new cards; plan milestone|group|chat for structure; action add for decisions the Owner must make; nudge add for instructions to the coordinator.\n'
    + BRIEF_END + BRIEF_RULES;
}

// fields: [{id, label, value, options?}]; make(values) returns the brief text.
export function briefDialog(title, intro, fields, make) {
  const d = dialog(title, 'wide');
  d.body.append(el('p', 'muted', intro));
  const vals = {};
  const out = el('textarea', 'brief');
  out.readOnly = true;
  out.rows = 14;
  const redraw = () => { out.value = make(vals); };
  fields.forEach((f) => {
    vals[f.id] = f.value || '';
    const row = el('label', 'fld');
    row.append(el('span', null, f.label));
    const inp = f.options ? el('select') : el('input');
    if (f.options) f.options.forEach((o) => { const op = el('option', null, o); op.value = o; inp.append(op); });
    inp.value = vals[f.id];
    inp.addEventListener('input', () => { vals[f.id] = inp.value; redraw(); });
    row.append(inp);
    d.body.append(row);
  });
  const bar = el('div', 'bt');
  const cp = el('button', 'btn pri', 'Copy brief');
  cp.type = 'button';
  cp.addEventListener('click', () => copyText(out.value, cp));
  bar.append(cp, el('span', 'hint', 'Paste it to the agent that will build this. It works with the repository tools and reports back.'));
  d.body.append(bar, out);
  redraw();
  return d;
}

export function addProjectDialog(site) {
  briefDialog('Add a project (copy-paste brief)', 'A new project is a new tab at the root level: one line in data/projects.json and one folder under data/. Fill the few fields, then copy the brief.', [
    { id: 'key', label: 'Project key (lower case, no spaces)', value: '' },
    { id: 'title', label: 'Title', value: '' },
    { id: 'mode', label: 'Mode', value: 'standalone', options: ['standalone', 'otm'] },
    { id: 'coordinator', label: 'Coordinator (who owes replies: OTM, or the Oracle name)', value: 'Oracle' },
    { id: 'decision', label: 'Owner decision that starts it (link or words)', value: '' },
  ], (v) => projectBrief(site, v));
}

export function addRevisionDialog(site, p) {
  briefDialog('Add a revision to ' + p.label + ' (copy-paste brief)', 'A revision is only for an Owner decision that changes direction. Everyday status changes go to the Timeline.', [
    { id: 'words', label: "The Owner's words that changed direction", value: '' },
    { id: 'link', label: 'Link to that decision (GitHub comment)', value: '' },
    { id: 'change', label: 'What changes (one sentence)', value: '' },
  ], (v) => revisionBrief(site, p, v));
}
