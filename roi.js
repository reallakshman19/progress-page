// CIIFR-only, read-only ROI presentation. The ten audited fixture lists and Timeline remain authoritative.
// Index + status + opening text fail closed on upstream changes; unknown entries never become priorities.
const ORIGINAL = [
  ['', 'Benchmark R0 (method):', 'history', 'Historical comparison, not a new saving'],
  ['NEXT_READ_ONLY_SLICE', 'Use the source-backed XMLv1.1', 'prospective', 'Source-backed reuse candidate'],
  ['SOURCE_GROUNDED', 'Ground truth: ELEMENTS', 'reference', 'Physical field invariant'],
  ['BOUNDED_NODAL_SCOPE', 'DISPLMNT has', 'reference', 'Nodal sentinel and scope invariant'],
  ['GROUNDING_CATALOGUE', 'Official CAESAR II v14 basic-element', 'reference', 'Vendor field reference'],
  ['GROUNDING_CATALOGUE', 'Official CAESAR II v14 auxiliary-data', 'reference', 'Vendor auxiliary reference'],
  ['BYTE_PRESERVING_TRANSPORT', 'Scoped Git -text attributes', 'history', 'Completed byte-preservation evidence'],
  ['BOUNDED_FIXES', 'BM2 isolated fixes:', 'history', 'Completed bounded fix evidence'],
  ['ONBOARDING_PROPOSAL', 'Geometry onboarding protocol:', 'governance', 'Existing onboarding protocol'],
  ['EVIDENCE_RULE', 'Oracle onboarding:', 'governance', 'Source and independence rule'],
  ['CONTINUITY_RULE', 'Oracle continuity:', 'governance', 'Continuity and authority protocol'],
  ['HIGH_PROSPECTIVE', 'E0/E1 first:', 'prospective', 'E0/E1 duplicate priority A'],
  ['HIGH_PROSPECTIVE', 'Rigid Weight first', 'prospective', 'RIGID duplicate priority A'],
  ['E0_E1_HIGH', 'Architecture-first E0/E1', 'prospective', 'E0/E1 duplicate priority B'],
  ['RIGID_FIRST', 'Rigid Weight is bounded practical', 'prospective', 'RIGID duplicate priority B'],
  ['CI_SCOPED_PASS', 'E1 source-layout qualification', 'history', 'Scoped test receipt, not native acceptance'],
  ['G2_DISJOINT_CORE', 'Reuse G2 pure topology', 'prospective', 'Conditional Geometry reuse'],
  ['EXISTING_G1_RENDERER_REUSE', 'Reuse established G1 SVG', 'prospective', 'Conditional renderer reuse'],
];
const RULES = [
  {
    id: 'effective-job-provenance', tier: 'high',
    title: 'Prevent unsafe original-job unit/config substitution in read-only qualification',
    indexes: [], anchors: [['knownIssues', 'R4_SOURCE_UNIT_MISMATCH'], ['pending', 'NATIVE_JOB_PROVENANCE']],
    impact: 'High cost-of-error avoidance, not quantified savings',
    likelihood: 'Conditional on native job identity and unit evidence',
    effort: 'Focused read-only source qualification; unmeasured',
    dependency: 'Original active CAESAR.cfg/units/material/FDM evidence and independent E1 review; no Writer/TARGET1'
  },
  {
    id: 'source-backed-reader', tier: 'high',
    title: 'Reuse the source-backed XMLv1.1 F05 reader, not a speculative replacement',
    indexes: [1], anchors: [],
    impact: 'Avoid duplicate read-only ingestion work',
    likelihood: 'Candidate with prior bounded evidence; integration unaccepted',
    effort: 'Bounded reuse rather than a new parser; unmeasured',
    dependency: 'Original-file hash, hierarchy and literal-byte regressions; XMLv2 remains distinct'
  },
  {
    id: 'e0-e1', tier: 'high',
    title: 'E0/E1 first: independently qualify fields, pointers and sentinels before editing',
    indexes: [11, 13], anchors: [['roadmap', 'WBS4_EXECUTION_CHAIN']],
    impact: 'Avoid wrong-field, wrong-sentinel and wrong-unit engineering decisions',
    likelihood: 'Conditional on independent source/negative-case review',
    effort: 'Read-only field ledger and contrary synthetic cases; unmeasured',
    dependency: 'WBS4 M17/M18; native config and five-field inspector remain separately gated'
  },
  {
    id: 'rigid-weight', tier: 'high',
    title: 'Bound RIGID Weight via pointer #2 before any Type/editor release',
    indexes: [12, 14], anchors: [['knownIssues', 'RIGID_TYPE_NATIVE_HOLD']],
    impact: 'Avoid conflating absent pointer, zero weight and Type semantics',
    likelihood: 'Prospective only; independent v14/native qualification outstanding',
    effort: 'Small pointer-resolved read-only slice first; unmeasured',
    dependency: 'M20; nonzero pointer ownership, Type code source, effective units, native import; E3 Writer HOLD'
  },
  {
    id: 'g2-topology', tier: 'medium',
    title: 'Reuse G2 topology/Boolean ledger after independent real-input challenge',
    indexes: [16], anchors: [['pending', 'G2_REAL_INPUT_REVIEW']],
    impact: 'Reduce duplicate Geometry logic if parity holds',
    likelihood: 'Conditional; author-exposed 7/7 is not independent PASS',
    effort: 'Focused original-graph comparison and UI integration; unmeasured',
    dependency: 'WBS3 M14, independent PR181/182 source challenge; no Geometry release inferred'
  },
  {
    id: 'g1-renderer', tier: 'medium',
    title: 'Reuse G1 SVG/Three floating-origin rendering after browser parity trial',
    indexes: [17], anchors: [['roadmap', 'WBS3_EXECUTION_CHAIN']],
    impact: 'Potential avoidance of renderer rewrite',
    likelihood: 'Conditional on original-input browser parity and scalability',
    effort: 'Trial/performance characterization; unmeasured',
    dependency: 'WBS3 M13/M14; retain SVG and existing viewer boundaries'
  },
  {
    id: 'field-ledger-ux', tier: 'medium',
    title: 'Improve read-only field-ledger discoverability and preview ergonomics',
    indexes: [], anchors: [['pending', 'READONLY_ELEMENT_PREVIEW']],
    impact: 'Improve inspectability of proposed values, not accepted transfer',
    likelihood: 'Blocked by effective field semantics and original-job configuration',
    effort: 'Read-only presentation work after qualification; unmeasured',
    dependency: 'M18/M19; SOURCE→TARGET correspondence, five-field effective-value evidence; no Writer/TARGET1'
  },
  {
    id: 'e4-branch-label', tier: 'medium',
    title: 'Scope E4 Line Number/branch-label read-only groundwork separately',
    indexes: [], anchors: [['roadmap', 'E4_PLANNED'], ['roadmap', 'E4_IMPLEMENT']],
    impact: 'Potential preparation for bounded field work, not topology edits',
    likelihood: 'Conditional on field width, source semantics and shared endpoint review',
    effort: 'Read-only inventory first; unmeasured',
    dependency: 'M21; no FROM/TO renumbering, graph edits, release or Writer'
  },
];

function sourceList(fixtures, list, status) {
  return (fixtures[list] || []).map((item, index) => ({ item, from: list + '[' + index + ']' }))
    .filter(r => r.item.s === status);
}

// Never rewrite, mutate, delete or assign an acceptance status to the audited originals.
export function ciifrRoiModel(projectKey, fixtures = {}, originals = fixtures) {
  if (projectKey !== 'ciifr') return null;
  const original = originals.highRoi || [];
  // WBS-scoped lists can reindex and clone originals. Match exact original text against the
  // displayed subset while retaining the original whole-project source position.
  const included = fixtures === originals ? null : new Set((fixtures.highRoi || []).map(x => x.t));
  const inventory = original.map((item, index) => {
    const rule = ORIGINAL[index];
    const matching = rule && (item.s || '') === rule[0] && item.t?.startsWith(rule[1]);
    return { item, index, from: 'highRoi[' + index + ']',
      category: matching ? rule[2] : 'unclassified',
      reason: matching ? rule[3] : 'Unrecognized or changed source: needs explicit new classification' };
  }).filter(r => !included || included.has(r.item.t));
  const candidates = RULES.map(rule => {
    const sources = rule.indexes.map(index => inventory.find(r => r.index === index))
      .filter(r => r?.category === 'prospective')
      .map(r => ({ item: r.item, from: r.from }));
    for (const [list, status] of rule.anchors) sources.push(...sourceList(fixtures, list, status));
    return { ...rule, sources, s: 'PROSPECTIVE_' + rule.tier.toUpperCase(), t: rule.title,
      n: 'No measured savings or independent engineering acceptance' };
  }).filter(rule => rule.sources.length);
  return {
    high: candidates.filter(r => r.tier === 'high'),
    medium: candidates.filter(r => r.tier === 'medium'),
    inventory,
    unclassified: inventory.filter(r => r.category === 'unclassified'),
    // Original source rows remain accessible even when removed from the current-priority projection.
    rawCount: inventory.length,
  };
}
