// Reviewer manifest: exact original High-ROI source text hashes and list positions, no writes.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ciifrRoiModel } from '../roi.js';
const fixtures = JSON.parse(readFileSync(new URL('../data/ciifr/fixtures.json', import.meta.url), 'utf8'));
const model = ciifrRoiModel('ciifr', fixtures);
for (const row of model.inventory) {
  const sha256 = createHash('sha256').update(row.item.t, 'utf8').digest('hex');
  console.log(JSON.stringify({
    originalIndex: row.index, originalTextSha256: sha256, status: row.item.s || null,
    milestone: row.item.milestone || null, url: row.item.u || null,
    classification: row.category, rationale: row.reason
  }));
}
if (model.unclassified.length) process.exitCode = 1;
