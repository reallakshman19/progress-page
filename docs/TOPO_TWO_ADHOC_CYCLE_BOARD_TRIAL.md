# Two Adhoc Cycle Board trials — TOPO-A and TOPO-B

**Current source status (31 October 2026):** Adhoc PR #97 and Pages asset/cache PR #98 are merged (Owner reports deployed). Page PR #95 is merged; the governing TopoFix WBS remains R1. The Adhoc board is still read-only. Neither a merge nor the Owner deployment report establishes a new Cycle activation, agent receipt, private source verification or engineering acceptance.

These are two Adhoc **views** at the existing site, not duplicate engineering projects or a substitute for original TopoFix WBS R1.

| Workspace | Adhoc browser route | Governing native task | Scope |
|---|---|---|---|
| TOPO-A | `#/adhoc/topo-a/cycle-board` | [TopoFix issue #12](https://github.com/reallakshman19/xml229-topology-wp1-preview-20261028/issues/12) | Original WBS 3.2/4.1; RIGID node 6880 ↔ FBLI node 6450, 240.6 mm, conflicting `CLOS` |
| TOPO-B | `#/adhoc/topo-b/cycle-board` | [XML Compare issue #239](https://github.com/reallakshman19/XML_Compare_Utilities/issues/239) | Existing TopoFix WBS 2.1 → 4.1; InputXML + CIIFR F05/R4/GLRD read-only topology-adapter seam |

### Detailed concept / specification fixtures

- [TOPO-A Assisted Connection Repair — Concept & Detailed Spec R1](TOPO_A_ASSISTED_CONNECTION_CONCEPT_SPEC_R1.md): CLOS/remote-port problem, source port identity, GUI lookup, separate source-review and executable queues, atomic replay, falsification, onboarding.
- [TOPO-B Universal XML Topology Adapter — Concept & Detailed Spec R1](TOPO_B_UNIVERSAL_XML_TOPOLOGY_CONCEPT_SPEC_R1.md): format-specific intake, InputXML Workspace/CIIFR reuse, evidence graph/provenance, read-only acceptance, F05/R4/GLRD scope, onboarding.

Both are **proposed design fixtures**, not new engineering WBS documents or accepted writer policy. Their links are registered separately in each Adhoc **Sources & fixtures** and appear on the appropriate Overview/Oracle continuity surface.

Each contains **Overview, Cycle Board, Sources & fixtures, Oracle / agent, Test cases**. Original issue remains the single authoritative agent task. Its Page source/relay links are a concept/lineage map and evidence pointers, not proofs of receipt.

## Read-only Board behavior

Each Board queries **four explicitly configured public GitHub sources** on first open and on user-initiated recheck only:

1. Its own exact native issue (`#12` or `#239`).
2. [TopoFix WBS R1 issue #3](https://github.com/reallakshman19/xml229-topology-wp1-preview-20261028/issues/3).
3. [Common draft relay PR #572](https://github.com/reallakshman19/Common/pull/572).
4. [Progress Page draft update PR #95](https://github.com/reallakshman19/progress-page/pull/95).

An issue observation is keyed by owner/repository + issue number + `updated_at`; a PR observation is keyed by owner/repository + PR number + exact head SHA. The displayed original source timestamp and read timestamp are separate. First read has no comparable baseline: delta `UNKNOWN`, never `UNCHANGED`. Same exact source occurrences on explicit recheck produce `UNCHANGED`; a changed issue revision or PR head produces `CHANGED`. Missing, inaccessible, mismatched or rate-limited source yields explicit `PARTIAL` / `UNKNOWN`, never empty healthy proof.

The Board displays four **separate axes**: native observation, Cycle authority, agent acknowledgment, and Page publication. Cycle status is `NOT_VERIFIED`; authority always `NOT_ESTABLISHED` in this public viewer. The recipient is `UNBOUND`, and Page publication remains `NOT_RECONCILED` as a Board authority claim until original Page/audit correlation is independently verified, even though Page PR #95 itself is now merged. A PR merge by itself does not imply exact Page audit correlation. No attempt to authenticate a private recipient is made.

**Never** infer a new assignment, release, source-byte receipt, WBS advance, engineering PASS, `CONTINUE_AUTHORIZED`, Page write or CII writer permission. The first agent return is read-only. The Oracle retains source and writer reconciliation; new work requires the original authorized protocol. The private `EF-05-PRO.TEST.xml`, F05, R4 and GLRD sources are not copied to the Adhoc source graph.

## Operational acceptance challenges

- **A:** detect and explain an engineer-questioned intended pair even though `CLOS` suppresses an automatic disconnection finding. The 240.6 mm gap is not an autofix; require source design intent, distinguish intentionally closed endpoints, keep the 25 mm auto threshold.
- **B:** distinguish PSI116, InputXML, Categorized and CII RichInput profiles; unsupported input must not yield a success with zero branches. F05/R4 have 56 elements each, GLRD 521; do not conflate elements, nodes or accepted connectivity.
- **Both:** preserve exact original task, governing WBS, relay and Page identities, no cross-task source spill, stale-head and 403 fail closed, private contents never rendered. No new mandatory status post.
- **Trial:** independent agents open each Adhoc Cycle Board, recover their native task/fixtures, return a source-grounding/overlap receipt in that same issue; Oracle checks actual source, recipient/epoch, and progress-data reconciliation separately. The test suite alone cannot attest those human actions.

## Automated tests

```sh
node --experimental-default-type=module --test tests/adhoc-projects.test.mjs tests/adhoc-topo-cycle-board.test.mjs
python -B -m unittest discover -s tests -v
```

The existing `.github/workflows/check.yml` registers the new isolated Board test; `tests/test_all_tabs_layout.e2e.py` visits the ten new Adhoc views on desktop (1440px) and mobile (390px), with fail-closed routing and screenshots. CI results are author-side synthetic/mock-source verification, not independent engineering/Owner acceptance.

### Status that must remain visible

TOPO-A and TOPO-B native tasks were **PREPARED / READ_ONLY FIRST** at assignment. Current agent/chat acknowledgement, private original byte custody, exclusive product writer, Common receipt acceptance, Oracle cutover, a separately evidenced Page-audit reconciliation, independent engineering qualification, and Owner approval remain **NOT_VERIFIED / HOLD** until source-specific evidence establishes otherwise.
