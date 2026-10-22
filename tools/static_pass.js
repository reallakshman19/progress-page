// Appended inside the page script of the temporary pre-render build only (see build_local.py).
// It replaces render() with one that draws every project and view as plain <details> sections, so the saved page
// still shows, and still expands, when scripts are blocked or the viewer cannot follow #anchors.
function staticProject(p, open) {
  const sum = sumOf(p);
  const nOpen = openCount(p.actions);
  const pj = p.index.project || {};
  const rules = rulesOf(p.index);
  const sec = el('details', 'sp');
  sec.open = open;
  sec.append(el('summary', null, p.label + (isActive(p) ? '' : ' · ' + p.status) + (nOpen ? ' · ' + nOpen + ' open action' + (nOpen > 1 ? 's' : '') : '')
    + (isActive(p) && needsAttention(sum) ? ' · needs attention' : '')));
  sec.append(projectHead(p, {
    key: p.key, view: 'progress', rev: null, revBanner: null,
    nav: (href, text, cls) => el('span', cls, text),
    addRevision: () => {},
    statusLine: () => el('div', 'live', pj.updatedAt ? 'Data updated ' + whenText(pj.updatedAt) + (pj.updatedBy ? ' by ' + pj.updatedBy : '') : ''),
  }));
  const ctx = {
    chats: p.index.chats || {}, links: state.links, rules, hold: holdOf(p.index), sum, readOnly: false,
    nudge: { static: true, openList: (id) => nudgesOf(p, id).filter((n) => n.status === 'open'), list: (id) => nudgesOf(p, id), open: () => {} },
  };
  [['Progress', (b) => renderProgress(b, p, ctx)],
    ['My actions' + (nOpen ? ' (' + nOpen + ')' : ''), (b) => renderActions(b, p)],
    ['Grounding fixtures', (b) => renderFixtures(b, p.fixtures)],
    ['Timeline', (b) => renderTimeline(b, p)]].forEach(([label, draw], j) => {
    const d = el('details', 'sv');
    d.open = open && j === 0;
    d.append(el('summary', null, label));
    const body = el('div', 'body');
    draw(body);
    d.append(body);
    sec.append(d);
  });
  return sec;
}

render = function renderStatic() {
  if (!state.projects.length) return;
  const root = document.getElementById('root');
  root.replaceChildren(el('h1', null, 'Progress page'));
  const bar = el('p', 'snapbar');
  bar.id = 'snapbar';
  root.append(bar);
  const active = state.projects.filter(isActive);
  const closed = state.projects.filter((x) => !isActive(x));
  active.forEach((x, i) => root.append(staticProject(state.data[x.key], i === 0)));
  if (closed.length) {
    const arc = el('details', 'sp');
    arc.append(el('summary', null, 'Archived (' + closed.length + ')'));
    closed.forEach((x) => arc.append(staticProject(state.data[x.key], false)));
    root.append(arc);
  }
};
