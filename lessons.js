// Read-only Lessons Learned library; the detailed case studies scroll vertically.
import { el, link } from './util.js?v=30';

function llHeading(parent, level, content) { const e = el(level, null, content); parent.append(e); return e; }
function llParagraph(parent, content, klass) { parent.append(el('p', klass, content)); }
function llSection(parent, title) {
  const e = el('section', 'll-section');
  llHeading(e, 'h3', title);
  parent.append(e);
  return e;
}
function llStatus(parent, content) { parent.append(el('span', 'll-status', content)); }
function llRecord(parent, title, body, sourceUrl, note) {
  const e = el('article', 'll-record');
  llHeading(e, 'h4', title);
  llParagraph(e, body);
  if (note) llStatus(e, note);
  if (sourceUrl) e.append(link(sourceUrl, 'Original evidence ↗', 'll-source'));
  parent.append(e);
  return e;
}
function llRoute(nav, where, label) { return nav(where, label, 'll-route'); }

function llLibrary(root, lessons, nav) {
  const page = el('div', 'll-page');
  llHeading(page, 'h2', 'Lessons Learned');
  llParagraph(page, 'What failed, what changed, what the evidence actually proves, and how to prevent repetition.', 'll-lead');
  const stats = el('p', 'll-stats');
  stats.append(el('span', 'll-status', lessons.length + ' captured lessons'));
  stats.append(el('span', 'll-status', 'Original records preserved'));
  page.append(stats);
  const cards = el('div', 'll-library');
  lessons.forEach(x => {
    const card = el('article', 'll-card');
    llParagraph(card, x.id + ' · ' + x.date + ' · ' + x.origin, 'll-meta');
    llHeading(card, 'h3', x.title);
    llStatus(card, x.status === 'DRAFT' ? 'Draft — not Owner accepted' : 'Recorded retrospective');
    llParagraph(card, x.summary);
    llParagraph(card, x.id === 'L01' ? '7 causes · 8 recorded mitigations · 3 open entries' : '8 operating rules · 9 decision exercises', 'll-meta');
    card.append(llRoute(nav, '#/learned/' + x.id, 'Read full lesson →'));
    cards.append(card);
  });
  page.append(cards);
  llParagraph(page, 'Lessons describe evidence and preventive practice, not agent completion percentages.', 'll-note');
  const history = el('p', 'll-meta');
  history.append('Original Lessons R1 remains under Archived. ');
  history.append(llRoute(nav, '#/lessons/progress', 'Read the legacy tab'));
  page.append(history);
  root.append(page);
}
function llDetail(root, lesson, lessons, nav) {
  const page = el('article', 'll-page ll-detail');
  page.append(llRoute(nav, '#/learned/progress', '← All lessons'));
  const head = el('header', 'll-heading');
  llParagraph(head, lesson.id + ' · ' + lesson.date + ' · ' + lesson.origin, 'll-meta');
  llHeading(head, 'h2', lesson.title);
  llStatus(head, lesson.status === 'DRAFT' ? 'DRAFT — Owner acceptance not recorded' : 'Recorded retrospective');
  llParagraph(head, lesson.summary, 'll-lead');
  page.append(head);

  let s = llSection(page, '01 — Original aim');
  llParagraph(s, lesson.aim);
  s = llSection(page, '02 — What happened');
  llParagraph(s, lesson.observation);
  if (lesson.id === 'L01') {
    s = llSection(page, '03 — Root causes and corrective steps');
    llParagraph(s, 'Each cause is paired with actions documented in the original retrospective. Reported actions are not proof of sustained improvement.', 'll-note');
    lesson.issues.forEach(c => {
      const card = llRecord(s, c.id + ' — ' + c.title, c.observation, c.source);
      const related = el('div', 'll-related');
      llHeading(related, 'h5', 'Steps taken against this cause');
      c.actions.forEach(id => {
        const a = lesson.actions.find(x => x.id === id);
        if (!a) return;
        const p = el('p');
        p.append(el('strong', null, id + ': '), document.createTextNode(a.text.replace(/^MITIGATION DONE \d+ \([^)]*\):\s*/, '')));
        related.append(p);
      });
      card.append(related);
    });
    s = llSection(page, '04 — Mitigations and outstanding work');
    llParagraph(s, 'The following eight entries were marked DONE in the historical record; keep that wording separate from independent verification.');
    lesson.actions.forEach(a => llRecord(s, a.id + ' — Recorded step', a.text, a.source, 'Recorded done · effectiveness not inferred'));
    llHeading(s, 'h4', 'Open mitigation entries');
    lesson.open.forEach(x => llRecord(s, x.id + ' — Open', x.text, x.source, 'Open in legacy record'));
    llRecord(s, 'Method benchmark — reference, not acceptance', lesson.benchmark.text, lesson.benchmark.source, 'Benchmark reported');
  } else {
    s = llSection(page, '03 — Contradictions and corrections');
    lesson.recoveries.forEach(x => {
      const card = llRecord(s, x.title, x.problem);
      llParagraph(card, 'Correction: ' + x.correction, 'll-correction');
    });
    s = llSection(page, '04 — Development steps and their evidence');
    lesson.stages.forEach(x => {
      const card = llRecord(s, x.title, x.action);
      llParagraph(card, 'Evidence boundary: ' + x.evidence, 'll-note');
    });
  }
  s = llSection(page, '05 — What to carry forward');
  const takeaway = el('div', 'll-takeaway');
  llHeading(takeaway, 'h4', 'Core learning');
  llParagraph(takeaway, lesson.takeaway);
  s.append(takeaway);
  if (lesson.rules) {
    lesson.rules.forEach(([title, body], i) => llRecord(s, (i + 1) + '. ' + title, body));
    llParagraph(s, lesson.evidenceLimit, 'll-note');
  }
  s = llSection(page, '06 — Prevention checklist');
  const list = el('ul', 'll-checklist');
  lesson.checklist.forEach(x => {
    const li = el('li');
    li.append(el('span', 'll-checkicon', '□'), document.createTextNode(x));
    list.append(li);
  });
  s.append(list);
  s = llSection(page, '07 — Where the lesson was applied or proposed');
  lesson.applications.forEach(x => llRecord(s, x.text, x.state.replace(/_/g, ' ').toLowerCase(), x.source));
  if (lesson.cases) {
    s = llSection(page, '08 — Nine decision exercises');
    llParagraph(s, 'These fictional public-safe cases support reasoning and coaching, not project acceptance. Expand an answer below each scenario.', 'll-note');
    lesson.cases.forEach(c => {
      const card = el('article', 'll-record');
      llHeading(card, 'h4', c.id + ' — ' + c.title);
      llParagraph(card, c.scenario);
      const reveal = el('details', 'll-reveal');
      reveal.append(el('summary', null, 'Reveal decision and falsifying test'));
      const answer = el('div', 'll-answer');
      llParagraph(answer, 'Expected decision: ' + c.expected_decision);
      llParagraph(answer, 'Falsifying test: ' + c.discriminating_test);
      llParagraph(answer, 'Evidence limit: ' + c.evidence_limit, 'll-note');
      reveal.append(answer);
      card.append(reveal);
      s.append(card);
    });
  }
  s = llSection(page, lesson.cases ? '09 — Original sources and history' : '08 — Original sources and history');
  lesson.sources.forEach(x => {
    const p = el('p', 'll-sourceline');
    p.append(link(x.url, x.label + ' ↗'));
    s.append(p);
  });
  llParagraph(s, 'The archived R1 timeline and original source documents remain unchanged; this view is read-only.', 'll-note');
  const foot = el('nav', 'll-bottom');
  foot.append(llRoute(nav, '#/learned/progress', '← Lesson library'));
  const other = lessons.find(x => x.id !== lesson.id);
  if (other) foot.append(llRoute(nav, '#/learned/' + other.id, 'Next: ' + other.id + ' →'));
  page.append(foot);
  root.append(page);
}
export function renderLessons(root, data, view, nav) {
  const items = data && Array.isArray(data.items) ? data.items : [];
  const lesson = items.find(x => x.id === view);
  if (lesson) llDetail(root, lesson, items, nav);
  else llLibrary(root, items, nav);
}
