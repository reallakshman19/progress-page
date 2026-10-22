// Appended inside the page script of the temporary pre-render build only (see build_local.py).
// It replaces render() with one that draws every project and view as plain <details> sections, so the saved page
// still shows, and still expands, when scripts are blocked or the viewer cannot follow #anchors.
render = function renderStatic() {
  if (!state.projects.length) return;
  const root = document.getElementById('root');
  root.replaceChildren(el('h1', null, 'Progress page'));
  const bar = el('p', 'snapbar');
  bar.id = 'snapbar';
  root.append(bar);
  state.projects.forEach((pr, i) => {
    const p = state.data[pr.key];
    const sum = sumOf(p);
    const open = openCount(p.actions);
    const pj = p.index.project || {};
    const sec = el('details', 'sp');
    sec.open = i === 0;
    sec.append(el('summary', null, p.label + (open ? ' · ' + open + ' open action' + (open > 1 ? 's' : '') : '') + (needsAttention(sum) ? ' · needs attention' : '')));
    sec.append(el('h2', null, pj.title || p.label));
    if (pj.subtitle) sec.append(el('p', 'muted', pj.subtitle));
    if (pj.updatedAt) sec.append(el('div', 'live', 'Data updated ' + whenText(pj.updatedAt) + (pj.updatedBy ? ' by ' + pj.updatedBy : '')));
    const ctx = { chats: p.index.chats || {}, links: state.links, rules: rulesOf(p.index), hold: holdOf(p.index), sum };
    [['Progress', (b) => renderProgress(b, p, ctx)],
      ['My actions' + (open ? ' (' + open + ')' : ''), (b) => renderActions(b, p)],
      ['Grounding fixtures', (b) => renderFixtures(b, p.fixtures)]].forEach(([label, draw], j) => {
      const d = el('details', 'sv');
      d.open = i === 0 && j === 0;
      d.append(el('summary', null, label));
      const body = el('div', 'body');
      draw(body);
      d.append(body);
      sec.append(d);
    });
    root.append(sec);
  });
};
