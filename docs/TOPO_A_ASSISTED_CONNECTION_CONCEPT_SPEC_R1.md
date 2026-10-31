# TOPO-A — Assisted Connection Repair
## Concept Note and Detailed Functional Specification · R1 · 31 October 2026

**Disposition:** Concept and proposed design. Source/engineering qualification PENDING. This document is a grounding fixture; it does not introduce another WBS, activate a Cycle, grant source-writer authority or replace the native task.

**Owner objective:** Topology should provide auditable automatic solutions wherever safe and clear manual-review directions otherwise. Extend the user path to an engineer-questioned connection that the current finding list does not show. In particular, a long gap or a declared closed end must be discoverable and explainable, without automatically joining it.

**Governing:** [TopoFix WBS R1 #3](https://github.com/reallakshman19/xml229-topology-wp1-preview-20261028/issues/3), WBS **3.2** (manual review) and **4.1** (source-qualified connections); later **3.3, 4.2, 4.3** for source reimport, independent proof and Owner trial. [Native TOPO-A issue #12](https://github.com/reallakshman19/xml229-topology-wp1-preview-20261028/issues/12) is the sole agent return. [Adhoc sources](https://reallakshman19.github.io/progress-page/#/adhoc/topo-a/sources) and [Cycle Board](https://reallakshman19.github.io/progress-page/#/adhoc/topo-a/cycle-board) are read-only views.

---

## 1. Problem and source evidence

The standalone XML229 workflow accepts AVEVA PSI116 PipeStressExport / Branch / Node occurrence data. Its existing inclusive **25 mm** limit applies to compatible automatic port closure; optional **6 mm** short-element handling is a separate operation. The presence of source-declared terminations can make an engineer-questioned pair invisible to the ordinary unresolved-gap list; a finding-driven Second Pass then offers no button.

**Owner-provided original-source witness (awaiting independent original-byte recheck):**

| Occurrence | Source role | Declaration |
|---|---|---|
| Node 6880, branch 31 | RIGID endpoint 2 | CLOS |
| Node 6450, branch 30 | FBLI endpoint 1 | no declaration at that occurrence |
| Adjacent BRAN helper on branch 30 | component endpoint 1 | CLOS |

The questioned Node 6880 ↔ 6450 separation is **240.6 mm**; the reported outside diameter is **114.3 mm** and X/Z align. This is a **candidate design question**, not physical connectivity proof. Protected original XML has not been transferred/verified in the new agent session; original trial = **NOT_RUN**. The product must distinguish: (H1) two intentionally closed ends, (H2) a missing intended connection whose source declaration is wrong, and (H3) an incorrectly chosen occurrence/owner.

A source-order colored route stroke on the canvas is illustration, not a certified solver connection. Geometric proximity, aligned axes, equal OD or a user-entered Node Number are evidence inputs, not sufficient authorization to modify topology.

## 2. Conceptual engineering model

**Separate identities:** (a) human Node Number; (b) exact source occurrence and component port; (c) connection hypothesis; (d) approved source-revision-bound transaction. A source occurrence key must preserve measured XML digest, branch identity, source ordinal/record key, endpoint, owner and original declaration. Node Numbers may repeat across branches or change after reexport. Negative helper nodes must not automatically be treated as physical ends.

**Source authority:** S0 is immutable. A new S1 working copy has its own digest, parent revision, engine/rules/configuration identity, analysis generation and transaction receipt. S0 approvals cannot silently carry to a changed S1. Preserve NodeName, ComponentRefNo, restraint, RIGID, OD, wall, Weight, meaningful PIPEs and all other protected records unless a field-specific qualified policy authorizes exact changes.

**Case types for display (proposed, not parser assertions):**

| Kind | Engineer-facing meaning | First permitted result |
|---|---|---|
| KNOWN_CONNECTED | explicitly source-qualified connected ports | Explain; no edit |
| DECLARED_CLOSED | an exported intended termination, possibly disputed | Review the design authority |
| UNRESOLVED_NEAR | port pair within the existing auto threshold | Existing source-guarded automatic workflow |
| ENGINEER_QUESTIONED_REMOTE | manually nominated pair outside that threshold | Source review + measured preview |
| AMBIGUOUS_SOURCE | multiple ports or conflicting owners | Disambiguate; no edit |
| INCOMPATIBLE | failed OD/direction/component/field guards | Clear reason, no edit |
| SOURCE_UNVERIFIED | missing private bytes or stale/different generation | Hold mutations |

Classification and displayed warnings are independent of repair eligibility. **Counts are scoped:** findings, unique engineering cases, declared terminations, potential pairs, queued approvals, committed actions and residual cases have different denominators. A past banner claiming “57 connections/terminations resolved” must not be treated as 57 successfully repaired errors on a later revision.

## 3. Required operator journey

### 3.1 Find an intended connection even if no finding exists

Add an always-accessible **Find / Review Connection** entry, separate from the current Manual Fix list. Provide primary Node Number A / Node Number B fields. Show every qualifying occurrence, with optional branch/line filters, a source-key disambiguator and existing canvas-pick support. Never silently select the geographically nearest record or hide a CLOS occurrence.

Selecting two verified occurrences displays: owner branch, component/ref, endpoint, source declaration, 3D distance/vector in verified units, OD/wall, connection direction and continuity evidence. Canvas highlights exact original ports; a temporary review line is visibly a *proposal*, never an established solver edge. Missing numbers or unsupported helper-only endpoints get specific explanatory errors.

### 3.2 Review and source-qualification states

Every manually proposed pair begins **REVIEW ONLY**. Reuse existing source/port qualification guards plus a distinct declared-closure conflict check. Return explicit dispositions (suggested): SOURCE_REVIEW_REQUIRED, CONFLICTS_WITH_CLOS, INCOMPATIBLE_PORTS, AMBIGUOUS_PORT, SOURCE_UNVERIFIED, STALE_EPOCH, QUALIFIED_PREVIEW.

A user checkbox or prose evidence alone does **not** authorize removing CLOS. Where the authoritative correction belongs in upstream CAD/piping design, show that exact step and reimport workflow. An engineer may record “intentional termination,” “drawing check pending,” “upstream source correction required” or “no reliable design authority”; these are audit decisions, not executable XML edits.

### 3.3 Preview a source-qualified change

For eligible pairs, reuse existing Second Pass calculations, scene and action checks. Show old/new port coordinates, delta/axis, explicit proposed mutation type, impacted neighbor elements/branches, changed source records and required original-field-preservation comparison. A visual snap or 3D line does not validate the change.

Approval requires a current, measured XML/analysis generation, the exact two source-port identities, compatible engineering constraints, design evidence reference and independent source-authority check where applicable. Any unspecified CLOS ownership, conflicting component references or absent exact original prohibits the Apply transition.

### 3.4 Two queues

**Source Review Queue:** unresolved/remote/CLOS/ambiguous cases. It retains exact witnesses, unanswered design decision and reimport instructions. Changing a review-state label has no XML mutation consequence.

**Executable Approved Fix Queue:** only current-generation, source-qualified, individually previewed pairs with explicit approval. Each row records source/target ports, approved edit kind, engineering evidence, affected records, expected postconditions and transaction lineage. Detect duplicate pairs and shared occurrence conflicts; report a collision rather than silently applying whichever was selected first.

The queue UI must work in bulk rather than repeatedly selecting/publishing intermediate source states or forcing arbitrary 8-item operator batches. It may stage previews/read-only candidate computations without blocking canvas interactions. Do not change automatic tolerance merely to make a manual review executable.

### 3.5 Safe execution/reanalysis

Freeze the current working revision and verify all selected approved actions at exact source/engine generation. Execute on a disposable copy with the existing transaction/preservation guards. Validate the **entire** output (not just selected finding disappearance), run full TopoFix and publish one new validated working revision and action receipt. Cancellation, stale input or validation failure keeps the last validated XML/canvas unchanged; no partial source leaks to downloads. UI progress must come from real engine stages, not invented “1 action(s)” or stale count reuse.

After S1, reconcile original / outstanding / newly introduced / intentionally retained / unverifiable cases by source-qualified lineage. Changed node ordinals cannot silently close a preexisting case.

## 4. Architecture and responsibility

Reuse the PSI116 parser, source-port index, existing 2D/3D picking, Second Pass preview, transaction guards, worker/cancel semantics, approved Manual Fix Queue, source-revision tracking and full audit. Add the smallest independent **search/source-port review seam** and fix eligibility/confirmation state. Keep screen logic free of new topology authority; do not build another resolver or automatically edit CAD owned CLOS. The format-adapter contract belongs to TOPO-B; TOPO-A must not change TOPO-B adapter files.

**Excluded:** automatic >25 mm joining; 240.6 mm tolerance expansion; arbitrary CLOS deletion; cross-branch auto-renumbering; Weight/Final; native CII writer; protected 3D_Converters PR #346; engineering or Owner approval from a synthetic PASS.

## 5. Acceptance and falsifiers

| Gate | Required observable result | Wrong outcome to reject |
|---|---|---|
| A0 read-only source trace | Show exact code path responsible for CLOS suppression and absence from current findings | Inferring suppression solely from a screenshot |
| A1 source search | 6880 + 6450 are findable with original CLOS/branch context on an authorized original trial | Hidden candidate or silently nearest occurrence |
| A2 design safety | 240.6 mm remains review-only absent qualified design authority | Two legitimately closed systems joined |
| A3 identity | Duplicate Node Numbers require branch/port choice | Wrong branch or negative helper chosen |
| A4 preview | Exact authorized change with complete source preservation evidence | Wrong OD/direction, lost meaningful record or invented edit |
| A5 queue | Only current approved pair executable | S0 approval applied on changed S1 |
| A6 atomicity | Cancel/failure leaves validated XML intact; full findings rechecked | Partial download, frozen APPLYING, unexplained tally |
| A7 real trial | Owner on original Windows source + independent engineering preservation check | Author-side synthetic green claimed as physical acceptance |

A0 is the **first bounded Agent 1 return**; implementation A1–A6 requires source/writer scope reconciliation and a separately authorized task slice. A7 remains Owner/independent reviewer work. Results must distinguish OBSERVED, EXECUTED_HERE, SELF_ASSESSED, NOT_RUN and UNKNOWN.

## 6. Cycle Board / onboarding trial

The Adhoc [TOPO-A Cycle Board](https://reallakshman19.github.io/progress-page/#/adhoc/topo-a/cycle-board) must show native issue #12, WBS issue #3, Common relay PR #572 and *current real* state of Progress Page PR #95 as separate facts. Issue observations bind to issue number + updated_at; PR observations bind to exact head SHA. Initial comparison = UNKNOWN, same occurrence on recheck = UNCHANGED, changed revision = CHANGED, inaccessible/403 = PARTIAL/UNKNOWN. The Board must never claim current private recipient identity, source-byte receipt, engineering pass, activated canonical Cycle or publisher authority from those observations.

Agent 1 reads [Common START_HERE](https://github.com/reallakshman19/Common/blob/999dd8d1516af6a65a840d9f3f489b5f0115d261/skills/agent-work/START_HERE.md), WBS and #12, then returns its **own-words source explanation, private-byte access status, active PR/path overlap, one falsifier and one next bounded step** in the **same issue #12**. Reuse unchanged grounding on later Cycle checks; no additional agent status report. Oracle alone reconciles actual source, protected handoff and capability.

**Artifact boundary:** [Common relay draft PR #572](https://github.com/reallakshman19/Common/pull/572) is a PROPOSED public-safe handoff, not a recipient download. Original protected model remains in Owner-authorized private Handoffs; no original XML/coordinates or protected hash are republished to the Page. Product/Owner merge, original CLOS semantic edit and independent engineering acceptance remain HOLD.

**End state:** The engineer can find, explain and source-review the missing pair, then advance only a separately qualified remedy through a preview, approved queue, atomic revised copy and full recheck. Production first. Evidence once. No duplicate reporting.
