// Frozen RCA observations. This view never writes project or engineering state.
import { el, link } from './util.js?v=33';

export const RCA_SOURCE = Object.freeze({
  revision: '9ad61417dbd3c473b4e6c0f6fa1aa8eb6005221b',
  sha256: '20be936279ba5b7128afdfac1759d1d822f746a3ebe05750bf5adb5085856b6b',
  url: 'https://raw.githubusercontent.com/reallakshman19/3D_Converters/9ad61417dbd3c473b4e6c0f6fa1aa8eb6005221b/Benchmarks/XML-CII-2019/revamped/PL-BM1.xml',
});
const rcaIssue = n => 'https://github.com/reallakshman19/3D_Converters/issues/' + n;
const RCA_CASES = Object.freeze({
  bore: {
    title: 'Bore and takeoff · PL-BM1', source: rcaIssue(351),
    columns: ['Case', 'Source / expected', 'Recorded output', 'First wrong boundary'],
    rows: [
      ['Valve 12370 → 12380 · ref 1006657947/114', 'OD 273 mm → DN250; length 838 mm',
        'Node Preview: DN250. Canonical Worker: DN300, marked VERIFIED.',
        'Physical bore is copied from the branch summary. The branch inlet has OD323.8.'],
      ['OLET leg 12260 → 3610', 'Connected branch port: OD60.3 mm → DN50',
        'Native diameter selector: OD323.8 mm; length 200 mm.',
        'FROM OLET diameter is used without connected-port lookup.'],
    ],
    note: 'Node 3610 has main-run and small-branch occurrences. A global diameter replacement would affect the main run. No correction has been applied.',
  },
  restraint: {
    title: 'REST fallback and Datum · EF-05', source: rcaIssue(350) + '#issuecomment-6490791640',
    columns: ['Executed entry', 'REST / TYPE result', 'Zero stiffness', 'Datum with restraint'],
    rows: [
      ['9 Oct pinned full fallback chain', '173 × +Y', '0', '73 / 73'],
      ['Current legacy fallback control', '173 × +Y', '0', '73 / 73'],
      ['Current direct engine enrichment', '119 × Z retained', '119', '55 / 73'],
    ],
    note: 'The full chain replaces 94 placeholders and adds 79 missing REST rows. Governed Run bypasses that wrapper. These are enriched-XML observations; final native CII validation remains pending.',
  },
  defaults: {
    title: 'Config defaults · probes on both revisions', source: rcaIssue(350) + '#issuecomment-6490791640',
    columns: ['Probe', 'Configured input', 'Recorded output', 'Evidence'],
    rows: [
      ['Default stiffness', '123456', 'REST stiffness 123456', 'Consumed by the shared fallback.'],
      ['Default friction', '0', '0.3', 'Reproduced in both revisions.'],
      ['Default gap', '7 mm', 'REST gap 0 mm', 'Reproduced in both revisions.'],
      ['TYPE mutation', 'Enabled; shipped rows; TYPE17', 'TYPE14', 'Existing mapping works.'],
      ['TYPE mutation: empty table', 'Enabled; rows []; TYPE17', 'TYPE17', 'Empty rows are preserved; no mutation.'],
      ['Tee SIF: omitted key', 'No defaultTeeSifType key', 'UI fallback 5; seeded/native fallback 0', 'Source inspection only.'],
    ],
    note: 'The friction and gap results are inherited in both tested revisions. An empty mutation table is an observed configuration behavior. This page does not choose a new policy.',
  },
});

const rcaCell = node => { node.style.cssText = 'overflow-wrap:anywhere;'; return node; };
function rcaTable(columns, rows) {
  const wrap = el('div'); wrap.style.cssText = 'overflow:auto;margin:12px 0;';
  const t = el('table'); t.style.cssText = 'width:100%;border-collapse:collapse;text-align:left;';
  const head = el('tr');
  for (const title of columns) {
    const th = rcaCell(el('th', null, title)); th.scope = 'col';
    th.style.cssText += 'padding:9px;border-bottom:2px solid var(--bd);'; head.append(th);
  }
  const thead = el('thead'); thead.append(head); t.append(thead);
  const body = el('tbody');
  for (const row of rows) {
    const tr = el('tr');
    for (const value of row) {
      const td = rcaCell(el('td', null, value));
      td.style.cssText += 'padding:10px 9px;vertical-align:top;border-bottom:1px solid var(--bd);'; tr.append(td);
    }
    body.append(tr);
  }
  t.append(body); wrap.append(t); return wrap;
}
function rcaChild(node, name) {
  return [...node.childNodes].find(n => n.nodeType === 1 && n.localName === name)?.textContent.trim() || '';
}
export function inspectBoreWitnesses(xmlText, Parser = globalThis.DOMParser) {
  const document = new Parser().parseFromString(xmlText, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('Source XML did not parse.');
  const rows = [];
  for (const branch of document.getElementsByTagName('Branch')) {
    const branchName = rcaChild(branch, 'Branchname');
    const nodes = [...branch.childNodes].filter(n => n.nodeType === 1 && n.localName === 'Node');
    for (const [ordinal, node] of nodes.entries()) {
      const ref = rcaChild(node, 'ComponentRefNo').replace(/^=/, '');
      const inlet = branchName.endsWith('S8810105-HOT-01/B3') && ordinal === 0;
      const smallPort = branchName.endsWith('S8810100-HOT-01/B1') && ordinal === 0;
      if (ref !== '1006657947/114' && ref !== '1006649755/12118' && !inlet && !smallPort) continue;
      rows.push([branchName, 'ordinal ' + ordinal + ' · ' + rcaChild(node, 'ComponentType') +
        ' · ref ' + ref + ' · endpoint ' + rcaChild(node, 'Endpoint'), rcaChild(node, 'OutsideDiameter') + ' mm', rcaChild(node, 'Position')]);
    }
  }
  if (!rows.length) throw new Error('No matching source witnesses found.');
  return rows;
}
function rcaSourceInspector(parent) {
  const details = el('details'); details.append(el('summary', null, 'Check the pinned source XML'));
  details.append(el('p', 'muted', 'Fetch the original public PL-BM1 file, verify its SHA-256, and inspect the actual component and port records. This checks source bytes; it does not rerun Preview or certify a fix.'));
  const button = el('button', 'btn', 'Load and verify PL-BM1 witnesses'); button.type = 'button';
  const status = el('p', 'muted', 'Source not loaded in this browser.'); status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'overflow-wrap:anywhere;';
  const output = el('div'); details.append(button, status, output); parent.append(details);
  button.addEventListener('click', async () => {
    button.disabled = true; status.textContent = 'Loading pinned source…'; output.replaceChildren();
    try {
      const response = await fetch(RCA_SOURCE.url, { credentials: 'omit' });
      if (!response.ok) throw new Error('Source fetch returned HTTP ' + response.status);
      const bytes = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
      if (hash !== RCA_SOURCE.sha256) throw new Error('Source SHA-256 mismatch; witnesses withheld.');
      const rows = inspectBoreWitnesses(new TextDecoder().decode(bytes));
      status.textContent = 'Original bytes verified · ' + bytes.byteLength.toLocaleString() + ' bytes · ' + hash;
      output.append(rcaTable(['Branch occurrence', 'Source identity', 'Source OD', 'Source position'], rows));
    } catch (error) { status.textContent = 'Source check unavailable: ' + error.message; }
    finally { button.disabled = false; }
  });
}
export function renderRcaBench(root, project, { historical = false } = {}) {
  if (historical || project?.index?.project?.key !== 'ciifr') return;
  const section = el('section', 'panel'); section.setAttribute('aria-label', 'XML CII RCA test bench');
  section.style.cssText += 'border-style:solid;margin-bottom:24px;';
  section.append(el('h3', null, 'XML → CII · RCA test bench'),
    el('p', null, 'Check the two recorded findings before a repair: bore / port sizing and restraint defaults.'),
    el('p', 'muted', 'Recorded observations, 29 Oct 2026. No fixes applied. Final CII and independent engineering acceptance remain pending.'));
  const controls = el('div', 'tools'); controls.style.flexWrap = 'wrap';
  controls.setAttribute('aria-label', 'Choose RCA comparison');
  const body = el('div'); const buttons = [];
  const show = key => {
    const record = RCA_CASES[key]; body.replaceChildren(el('h4', null, record.title));
    body.append(rcaTable(record.columns, record.rows), el('p', null, record.note), link(record.source, 'Open native RCA evidence'));
    if (key === 'bore') rcaSourceInspector(body);
    for (const [id, button] of buttons) button.setAttribute('aria-pressed', String(id === key));
  };
  for (const [key, title] of [['bore', 'Bore & takeoff'], ['restraint', 'REST & Datum'], ['defaults', 'Config defaults']]) {
    const button = el('button', 'btn', title); button.type = 'button';
    button.addEventListener('click', () => show(key)); controls.append(button); buttons.push([key, button]);
  }
  const download = el('a', 'btn pri', 'Download XMLs, source witnesses and RCA evidence');
  download.href = 'https://reallakshman19.github.io/progress-page/data/ciifr/test/rca-350-351.zip';
  download.download = 'rca-350-351.zip';
  section.append(controls, body, download,
    el('p', 'muted', 'Bore source: 9ad61417dbd3. Restraint comparison: 57710dd74466 → 25db94769994. Browser controls are local and do not change masses, config, tasks or release status.'));
  root.append(section); show('bore');
}
