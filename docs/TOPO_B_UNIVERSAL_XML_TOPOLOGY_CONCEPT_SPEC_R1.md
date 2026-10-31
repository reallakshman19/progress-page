# TOPO-B — Universal XML Topology Adapter
## Concept Note and Detailed Functional / Architecture Specification · R1 · 31 October 2026

**Disposition:** Proposed **read-only** multi-format topology ingress and inspection. No converter/writer release, CII engineering acceptance, new governing WBS or activated agent/Cycle follows from this document.

**Owner outcome:** Offload format interoperability to one agent, **reuse XML_Compare_Utilities InputXML Workspace** and existing geometry parsers, and enable a common TopoFix audit/review surface for source-qualified topology evidence. “Universal” means a reusable extension architecture with explicit profile admission; it **does not** mean silently accepting arbitrary XML or treating all formats as semantically interchangeable.

**Governed by:** [TopoFix WBS R1 issue #3](https://github.com/reallakshman19/xml229-topology-wp1-preview-20261028/issues/3), existing **WBS 2.1 source admission → WBS 4.1 evidenced connectivity**; the RichInput scope is a **proposed extension requiring the existing Page writer's reviewed WBS amendment if adopted**. Preserve native CIIFR WBS / Writer scopes independently. [TOPO-B issue #239](https://github.com/reallakshman19/XML_Compare_Utilities/issues/239) is the native task and sole agent return. [Adhoc sources](https://reallakshman19.github.io/progress-page/#/adhoc/topo-b/sources) and [Cycle Board](https://reallakshman19.github.io/progress-page/#/adhoc/topo-b/cycle-board) are read-only.

---

## 1. Current architectural reality

**TopoFix** currently understands AVEVA PSI116 PipeStressExport with branches and Node occurrences. CAESAR II RichInput profiles use PIPINGELEMENT records and/or Section/Record/Row field containers, not PSI116 Branch/Node. Routing such input into the PSI116 parser can yield **zero branches and zero nodes with an apparent zero-findings success**, which is an invalid admission result. Well-formed XML is necessary but not sufficient.

**XML_Compare_Utilities at measured main 417bf6a954c5a6de72237537e94b05b285191350** contains reusable code:

| Existing component | Proven / source-described role | Scope limitation |
|---|---|---|
| [InputXML Workspace main tab](https://github.com/reallakshman19/XML_Compare_Utilities/blob/417bf6a954c5a6de72237537e94b05b285191350/tabs/inputxml-workspace/inputxml-workspace-tab.js) | CleanXML generation, CleanXML → 5C conversion, InputXML enrichment, categorized conversion and topology compare | Does **not** itself certify all RichInput profiles |
| [Workspace schema detector](https://github.com/reallakshman19/XML_Compare_Utilities/blob/417bf6a954c5a6de72237537e94b05b285191350/tabs/inputxml-workspace/inputxml-workspace-xml-detect.js) | AVEVA-style XML, conventional InputXML, CategorizedInputXML, Unknown | “unknown” must not be guessed into inputxml |
| [Workspace orchestration](https://github.com/reallakshman19/XML_Compare_Utilities/blob/417bf6a954c5a6de72237537e94b05b285191350/tabs/inputxml-workspace/inputxml-workspace-orchestration.js) | CleanXML→5C handoff, positive-element preflight, source invalidation, diagnostics | A conversion route is not automatic topology authority |
| [CIIFR geometry profile parser](https://github.com/reallakshman19/XML_Compare_Utilities/blob/417bf6a954c5a6de72237537e94b05b285191350/prototypes/ciifr-map/xml-profiles.js) | Strict F05 RichInputXML-P1.v1.1 and R4 RichInputXMLv2.1 geometry, units and field witnesses | Geometry evidence; not full pointer/Writer proof |
| [CIIFR geometry tests](https://github.com/reallakshman19/XML_Compare_Utilities/blob/417bf6a954c5a6de72237537e94b05b285191350/prototypes/ciifr-map/tests/adapter.test.mjs) | Public S1 pair: 56 edges / 57 node witnesses; negative schema/units/cycles; XML SHA | Same source represented twice, not independent physical validation |
| [Workbench3D input adapter](https://github.com/reallakshman19/XML_Compare_Utilities/blob/417bf6a954c5a6de72237537e94b05b285191350/workbench3d/adapters/inputxml-adapter.js) | Conventional InputXML/Categorized/NodeSet/PSI detector and element records | Its schema markers are different from RichInput field/row profiles |
| [Workbench3D graph builder](https://github.com/reallakshman19/XML_Compare_Utilities/blob/417bf6a954c5a6de72237537e94b05b285191350/workbench3d/adapters/canonical-graph-builder.js) | Derived paths/components/relative node positions for visualization | Seedless components starting at zero are **not certified global XYZ**; short-element consumption is not source deletion authority |

**Do not duplicate or replace** InputXML Workspace, 5C, CIIFR Method C, Workbench3D or the PSI116 transaction engine to achieve read-only display. A small adapter/profile registry may compose their existing read contracts. The current independent engineering semantics and file writers remain with their native owners.

## 2. Format-admission matrix and evidence limits

The Owner supplied three RichInput files: F05 and R4 with **56 elements each**, GLRD with **521 elements**. Their new-agent original byte retrieval and SHA are **NOT_RUN** until separately received through protected storage. The repository has independent public S1 F05/R4 fixtures with its own manifest; do not misrepresent those public fixture hashes as Owner-private file receipts.

| Format/profile | Structural authority | Planned admission / output |
|---|---|---|
| PSI116 PipeStressExport | Branch / Node occurrence, source namespace, units | Preserve existing TopoFix workflow; strict parser/source admission before actionable audit |
| CAESAR II conventional InputXML | PIPINGELEMENT with FROM_NODE/TO_NODE and delta attributes | Reuse InputXML Workspace/workbench adapter; read-only graph if field/unit provenance valid |
| CategorizedInputXML | Line / Element and structured property blocks | Reuse categorized adapter, preserve original raw reference and category semantics |
| F05 RichInputXML-P1.v1.1 | CAESARII, PIPINGMODEL, SECTIONS, ELEMENTS, PIPINGELEMENT / Numeric / Field | Reuse existing CIIFR strict parser; source-linked 56-element pilot |
| R4 RichInputXMLv2.1 | RichInputXMLv2, Sections/Section/Record/Row/Field, explicit profile | Reuse existing CIIFR strict parser; compare same-source geometry and coordinate witnesses |
| GLRD RichInput P1 v1 | CAESARII RichInput P1, 521 elements; profile differs from F05 v1.1 | DISCOVER_FIRST: inspect exact schema/units/seeds/pointer variants before declaring support |
| Unknown/foreign XML | no authenticated supported profile | **UNSUPPORTED_INPUT**, non-actionable; never successful empty model |

**Element count is not node count, and a graph edge is not by itself an engineering-approved physical connection.** F05/R4 public S1 test expects 56 source elements / 56 graph edges / 57 graph node witnesses. GLRD 521 elements must not be described as 521 nodes or as a passing graph until its exact profile is qualified.

## 3. Proposed layering and contract

### 3.1 Pipeline

1. **Snapshot:** read the exact file bytes, measure XML byte SHA-256/size, retain original separately, and establish a generation ID. A filename cannot establish schema or source identity.
2. **Strict profile router:** parse XML safely; resolve root/namespace/profile/version and required structure, unit and cardinality constraints. Unknown yields a clear error, not zero findings.
3. **Profile-specific read-only adapter:** consume F05/R4/GLRD/conventional InputXML fields only under their own names and authorities. Preserve element FROM/TO labels, signed DX/DY/DZ, OD/wall, explicit COORDS seeds, source section/record/field references and all relevant auxiliary-pointer *witnesses*.
4. **Topology evidence graph:** reconstruct source-node IDs and component-relative geometry with cycle/vector checks. Only declare absolute metric XYZ for components anchored by valid explicit coordinate seeds/authority. A graph may have multiple disconnected islands, unresolved records or ambiguous pointers.
5. **Viewer/audit seam:** pass a typed immutable evidence graph and diagnostics into a read-only topology/inspection UI using existing scene/picking machinery. Show supported and unsupported portions honestly. Keep source witnesses from XML to visual node/element.
6. **Future repair seam:** a potential edit is a format-qualified *request for design review*, **not** a generic PSI116 edit. CII Writer/Final/Weight and mutable conversions are outside this task.

### 3.2 Proposed evidence graph shape (illustrative contract, not already implemented)

Required top-level fields:
- schemaVersion, admittedProfile, classifierVersion and admitted/partial/unsupported status;
- measured XML byte digest/size, original name, parse generation, declared unit system and conversion evidence;
- claimed original CII SHA/size when present **tagged CLAIMED_NOT_REVERIFIED**, distinct from measured XML SHA;
- nodes keyed by profile + source node ID with component/coordinate status and provenance;
- source elements with FROM/TO, signed delta, dimensions, original section/record/field addresses and pointer/aux witnesses;
- edges labeled SOURCE_ELEMENT with orientation/delta and qualified geometry/identity status;
- components/islands, coordinate-seed status and closure/cycle residual diagnostics;
- explicit warning/error codes, original missing fields, blocked repair reasons and stale-generation marker.

No topology edge should be invented solely by 3D proximity. Where a source lacks absolute coordinate anchors, either (a) show a **clearly labeled relative graph** without claiming global placement, or (b) fail the metric-view admission. The existing CIIFR map's strict seed requirement must not be weakened by an unrelated fallback. Decide the relative-display policy from a specific source trial, not a guess.

### 3.3 Provenance requirements

Each displayed node/edge must let the engineer inspect its originating XML section, record ordinal/ID, field name/value, unit and source fingerprint. Auxiliary pointer indices, sentinel/default values and explicit relationships remain typed source evidence; an auxiliary record must not become an independent physical element. Effective values and CII pointer ownership require their own authoritative proof. R4 embedded CII SHA is not authenticated unless original CII bytes are available and checked.

The old PSI116 original and the converted graph must not share ambiguous “node number” identities; include format, source digest and record/occurrence address to prevent cross-format or cross-model false matches. A transform/registration candidate is not permission to edit native node coordinates.

## 4. User-facing InputXML / TopoFix journey

**Upload → Format detected → Source validation → Topology preview → Source evidence → Export read-only evidence.** A profile banner states exact schema, element/node count, unit basis, absolute versus relative geometry scope and any unknown records. No false “0 errors” success on unsupported input. A user can inspect original fields while selecting an element/node. Source change clears dependent outputs and invalidates previous graphs/review selections; unchanged reusable lookup helper tables need not be reset.

The InputXML Workspace retains its existing CleanXML → Tab 3 5C → positive InputXML → Tab 2 enrichment path and separate categorized conversion. Do not hand node-based CleanXML to an InputXML-only enrichment engine, silently reroute a user-uploaded RichInput profile to 5C, or drop its unsupported fields. Existing diagnostics and provenance use the same source-change semantics.

**First runnable pilot:** two original-public-derived S1 F05/R4 inputs through one read-only profile router and existing viewer; inspect one pinned element FROM/TO/delta and its exact source fields; show same derived 56-edge/57-node geometry with no physical identity qualification. Then attempt GLRD 521-element read-only smoke with a separate profile-specific coverage report. A rejection with a precise unsupported reason is preferable to a fabricated pass.

## 5. Engineering and performance rules

- Never mutate input XML, CII, pointers, Weight, NodeName, Final or source line ownership as part of read-only admission.
- Use signed vectors and explicit native millimetre constraints from verified profile authority. An R4 observed conversion factor must not be silently multiplied into already native-mm coordinates.
- A reversed endpoint needs an opposite signed delta to preserve physical geometry; test this counterexample.
- Any impossible cycle closure, contradictory seed, unsupported units, zero-element file, duplicate/conflicting element identity, bad count, malicious DTD/entity or malformed XML must fail closed with a source-linked diagnostic.
- Keep read-only graph calculation separately testable; large-model work should avoid repeated full parse/re-render or UI-thread blocking and support cancellation/epoch suppression. Measure the 521-element fixture's wall time and UI responsiveness; do not claim a speed target without an actual browser benchmark.
- A parsed XML file and an imported graph do **not** imply that source geometry/engineering intent has been independently verified.

## 6. Tests, acceptance and falsifiers

| Gate | Positive observation | False outcome to reject |
|---|---|---|
| B0 source audit | Real InputXML Workspace/5C/profile-parser trace, current code and file claims | Reimplementing an existing converter from memory |
| B1 admission | Recognized PSI116/InputXML/Categorized/F05/R4; unknown explicit | Foreign XML returns 0 branches / 0 findings PASS |
| B2 S1 geometry | Public F05/R4 each show 56 edges, 57 node witnesses with source field trace | Hard-coded fixture geometry; false original-byte claim |
| B3 units/seeds | Anchored absolute and relative frame status explicit | Seedless disconnected islands displayed at same global zero |
| B4 safety | Wrong profile/namespace/count, DTD, wrong units, delta reversal, stale SHA fail or show justified difference | Silent normalization/truncation |
| B5 GLRD scale | 521 elements source-checked under its own v1 profile, with supported/unknown records counted | Treating GLRD as F05 v1.1 without independent parsing |
| B6 interface | Current revision graph with source witness and no engine mutation | Previous file's graph survives source replacement |
| B7 future writer gate | Explicitly **NOT IN SCOPE**; integration proposal only | CII Writer/Weight/Final activated by viewer acceptance |

Native author tests alone do not establish full engineering semantics or independent review. The first Agent 2 read-only return is **B0** plus a format matrix and one source-to-graph trace. Later implementation stages require verified writer ownership and a separately scoped task; original private XML tests are NOT_RUN until recipient-byte retrieval.

## 7. TOPO-A interface and WBS ownership

TOPO-B may provide a **read-only typed EvidenceGraph** and its source/authority/diagnostics contract to TopoFix. TOPO-A owns the PSI116 intended-connection search, source closure review and approved queue. Neither agent writes the other's production files. Cross-format “Apply fix” is explicitly deferred until format-specific mutation permissions, source record/pointer preservation, round-trip byte identity and independent review are established.

A read-only CII graph can show a candidate missing connection or island, but it cannot automatically reuse PSI116 closure/port semantics as an engineering-certified correction. Later integration stays with the Oracle against **one existing TopoFix WBS**, with the RichInput admission extension proposed rather than already adopted. Preserve CIIFR Geometry/Element/Node/Map custody and active PR conflicts.

## 8. Adhoc Cycle Board / agent onboarding

The [TOPO-B Cycle Board](https://reallakshman19.github.io/progress-page/#/adhoc/topo-b/cycle-board) must reuse **native issue #239**, TopoFix WBS issue #3, Common relay PR #572 and actual current Page PR #95. Initial source comparison UNKNOWN; identical immutable occurrence UNCHANGED; changed issue revision/head CHANGED; missing/403 PARTIAL or UNKNOWN. A merged PR may still be only a source fact, not Page publication audit or product qualification. No implicit Common Cycle activation, recipient ACK, CII writer or status report is created.

Agent 2 reads [Common START_HERE](https://github.com/reallakshman19/Common/blob/999dd8d1516af6a65a840d9f3f489b5f0115d261/skills/agent-work/START_HERE.md), the actual native task and [repository AGENTS.md](https://github.com/reallakshman19/XML_Compare_Utilities/blob/417bf6a954c5a6de72237537e94b05b285191350/AGENTS.md). Engineering-critical takeover starts **READ_ONLY**, with the native Appendix A before production mutation. Agent returns in **the same issue #239**: original source/fixture access, its own-words F05 element-to-graph trace, exact profile matrix, code-path reuse and overlap verdict, one falsifier and one bounded next deliverable. No duplicate Board report.

**Artifact custody:** [Common relay draft PR #572](https://github.com/reallakshman19/Common/pull/572) is proposed public-safe metadata, not a private XML transfer. Public F05/R4 fixtures may ground a first source trace; the Owner-provided F05/R4/GLRD XMLs require authorized private Handoffs and receiver-verified byte identities. Keep names/hashes private where required; do not publish protected originals.

**HOLD:** CII edits, Writer/Final/Weight, protected source changes, engineering acceptance, Owner release, and any new Page WBS amendment without the existing reviewed Page writer process. Production first. Evidence once. No duplicate reporting.
