// Nudge +: instructions queued for the coordinator (OTM, or the Oracle in standalone mode) to fold into its next message to an agent.
// The agent does not read this list. The coordinator marks a line Done, with its source, once the line is in a nudge that was sent.
import { el, link, whenText, copyText } from './util.js?v=29';
import { dialog } from './popup.js?v=29';
import { issueUrl, pageUrl } from './reply.js?v=29';

const DRAFTS = 'pp-nudge-drafts';
let draftMemory = {};

function loadDrafts() {
  try { return JSON.parse(localStorage.getItem(DRAFTS) || '{}'); } catch (e) { return draftMemory; }
}

function keepDrafts(all) {
  draftMemory = all;
  try { localStorage.setItem(DRAFTS, JSON.stringify(all)); } catch (e) { /* storage blocked: the lines stay for this visit only */ }
}

export const nudgesOf = (project, cardId) =>
  Object.entries(((project.nudges || {}).nudges) || {}).filter(([, n]) => n.card === cardId).map(([id, n]) => Object.assign({ id }, n));

export const openNudgeCount = (project, cardId) => nudgesOf(project, cardId).filter((n) => n.status === 'open').length;

export function nudgeRow(n) {
  const r = el('div', 'nd-row nd-' + n.status);
  r.append(el('span', 'chip', n.id), el('span', 'nd-t', n.text));
  const st = el('span', 'nd-s');
  if (n.status === 'done') st.append('Done by ' + n.doneBy + ' on ' + whenText(n.doneAt) + ' ', link(n.doneSrc, 'source'));
  else if (n.status === 'withdrawn') st.append('Withdrawn by ' + n.withdrawnBy + ' on ' + whenText(n.withdrawnAt) + ' ', link(n.withdrawnSrc, 'source'));
  else st.append('Open since ' + whenText(n.at));
  r.append(st);
  return r;
}

export function openNudge(project, card, coord) {
  const rt = project.replyTo;
  const slot = project.key + '/' + card.id;
  const mine = () => loadDrafts()[slot] || [];
  const setMine = (list) => { const all = loadDrafts(); all[slot] = list; keepDrafts(all); };
  const d = dialog('Nudge for ' + card.label, 'wide');
  const formUrl = (suffix, type, text) => issueUrl(rt, {
    title: '[Owner input] NUDGE' + suffix + ' ' + card.id + ' (' + project.key + ')',
    project: project.key,
    type,
    text,
    evidence_link: pageUrl(rt) + '#/' + project.key + '/progress',
  });

  function removeControl(n) {
    const text = 'withdraw ' + n.id + ' (' + card.id + '): ' + n.text;
    const url = formUrl(' withdraw ' + n.id, 'NUDGE-WITHDRAW', text);
    if (url) return link(url, 'Delete', 'btn small');
    const b = el('button', 'btn small', 'Copy delete request');
    b.type = 'button';
    b.addEventListener('click', () => copyText(text, b));
    return b;
  }

  function draftRow(x) {
    const row = el('div', 'nd-row nd-draft');
    row.append(el('span', 'nd-t', x.text));
    row.append(el('span', 'nd-s', x.sentAt ? 'Sent ' + whenText(x.sentAt) + '; waiting for ' + coord + ' to record it' : 'Not sent yet'));
    const bt = el('span', 'nd-b');
    const url = formUrl('', 'NUDGE', card.id + ': ' + x.text);
    if (url) {
      const send = link(url, x.sentAt ? 'Send again' : 'Send to ' + coord, 'btn pri small');
      send.addEventListener('click', () => { x.sentAt = new Date().toISOString(); setMine(mine().map((y) => (y.id === x.id ? x : y))); setTimeout(draw, 400); });
      bt.append(send);
    }
    const cp = el('button', 'btn small', 'Copy');
    cp.type = 'button';
    cp.addEventListener('click', () => copyText(card.id + ': ' + x.text, cp));
    const del = el('button', 'btn small', 'Delete');
    del.type = 'button';
    del.addEventListener('click', () => { setMine(mine().filter((y) => y.id !== x.id)); draw(); });
    bt.append(cp, del);
    row.append(bt);
    return row;
  }

  function draw() {
    d.body.replaceChildren();
    d.foot.replaceChildren();
    d.body.append(el('p', 'muted', 'Instructions for ' + coord + ' to fold into the next message to this agent. The agent does not read this list. '
      + coord + ' marks a line Done, with its source, once it is in a nudge that was sent.'));
    const rec = nudgesOf(project, card.id);
    d.body.append(el('div', 'h-label', 'On record'));
    if (!rec.length) d.body.append(el('p', 'muted', 'Nothing recorded yet.'));
    rec.forEach((n) => {
      const row = nudgeRow(n);
      if (n.status === 'open') row.append(removeControl(n));
      d.body.append(row);
    });
    const recorded = new Set(rec.map((n) => n.text));
    const list = mine().filter((x) => !recorded.has(x.text));
    if (list.length !== mine().length) setMine(list);
    d.body.append(el('div', 'h-label', 'Your lines (kept in this browser until ' + coord + ' records them)'));
    list.forEach((x) => d.body.append(draftRow(x)));
    const form = el('div', 'nd-add');
    const inp = el('input');
    inp.type = 'text';
    inp.maxLength = 300;
    inp.placeholder = 'One instruction for ' + coord + ', for example: ask it for its METER line first';
    const add = el('button', 'btn pri small', 'Add');
    add.type = 'button';
    const doAdd = () => {
      const t = inp.value.trim();
      if (!t) return;
      setMine(list.concat([{ id: 'd' + Date.now(), text: t, sentAt: null }]));
      draw();
    };
    add.addEventListener('click', doAdd);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
    form.append(inp, add);
    d.body.append(form);
    const lines = rec.filter((n) => n.status === 'open').map((n) => n.text + ' (' + n.id + ')').concat(list.map((x) => x.text));
    const all = el('button', 'btn', 'Copy all open lines');
    all.type = 'button';
    all.addEventListener('click', () => copyText('NUDGE for ' + card.label + ' (' + project.key + '), for ' + coord + ' to fold into the next message to the agent:\n'
      + lines.map((t, i) => (i + 1) + '. ' + t).join('\n'), all));
    d.foot.append(all, el('span', 'hint', rt && rt.kind === 'github-issue'
      ? 'Send opens GitHub with the line filled in; tick "I am the Owner" and submit. ' + coord + ' records it here.'
      : 'This project has no reply route: copy the lines and paste them to ' + coord + ' in chat.'));
  }
  draw();
  return d;
}
