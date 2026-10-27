// Timeline view: every recorded update of the project, newest first. The tools write one entry per change (who, what, why, source).
import { el, link, whenText } from './util.js?v=31';

const KIND_CLASS = { REVISION: 's', ANSWER: 's', RESTORE: 's', SUPERSEDE: 'w', CANCEL: 'w', ARCHIVE: 'w', TRANSFER: 'w', STATE: 'a', NUDGE: 'a', ACTION: 'a' };
const FIRST = 60;

const dayOf = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

function subjectOf(e, p) {
  const label = (id) => ((p.cards || {})[id] || {}).label || id;
  if (e.card) return label(e.card);
  if (e.nudge) return 'Nudge ' + e.nudge + (e.target ? ' for ' + label(e.target) : '');
  if (e.action) return 'Decision ' + e.action;
  if (e.list) return 'Fixtures: ' + e.list;
  return e.scope && e.scope !== 'project' ? e.scope : 'Project';
}

function eventRow(e, p) {
  const r = el('div', 'tl-row');
  const t = new Date(e.at);
  r.append(el('span', 'tl-t', Number.isNaN(t.getTime()) ? '' : t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })));
  r.append(el('span', 'chip ' + (KIND_CLASS[e.kind] || ''), e.kind));
  const m = el('div', 'tl-m');
  const top = el('div', 'tl-s');
  top.append(el('b', null, subjectOf(e, p)));
  if (e.before !== undefined && e.after !== undefined && e.before !== e.after) top.append(' ' + (e.before || 'new') + ' → ' + e.after);
  if (e.from && e.to) top.append(' ' + e.from + ' → ' + e.to);
  m.append(top, el('div', 'tl-x', e.summary));
  const meta = el('div', 'tl-w');
  meta.append('by ' + e.actor + ' · ' + e.id + (e.rev ? ' · ' + e.rev : '') + ' · ', link(e.source, 'source'));
  m.append(meta);
  r.append(m);
  return r;
}

export function renderTimeline(root, p) {
  const events = ((p.audit || {}).events || []).slice().reverse();
  root.append(el('p', 'muted', 'Every update to this project, newest first: what changed, who changed it, why, and the GitHub record behind it. '
    + 'The tools write one entry per change and the checker refuses a change without one. Earlier entries are never edited or removed.'));
  if (!events.length) {
    root.append(el('p', 'empty', 'No entries yet.'));
    return;
  }
  const list = el('div', 'tl');
  const draw = (all) => {
    list.replaceChildren();
    let day = null;
    (all ? events : events.slice(0, FIRST)).forEach((e) => {
      const d = dayOf(e.at);
      if (d !== day) { list.append(el('div', 'tl-d', d)); day = d; }
      list.append(eventRow(e, p));
    });
    if (!all && events.length > FIRST) {
      const more = el('button', 'btn', 'Show all ' + events.length + ' entries');
      more.type = 'button';
      more.addEventListener('click', () => draw(true));
      list.append(more);
    }
  };
  draw(false);
  root.append(list);
}
