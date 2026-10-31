# Task Evidence v2 — frozen five-line Cycle Board card

**Scope:** every existing Agent/Oracle task on registered Progress Page Cycle Boards and TOPO-A/B Adhoc tasks. One **read-only projection**, never a new WBS, assignment, receipt store, messaging action or approval channel. Owner-facing during **Cycle now**.

The card title is **TASK EVIDENCE v2 · Project / Agent / Task**. Metadata: **Last reconciled: actual reviewed event or NOT_VERIFIED · Source status: CURRENT / PARTIAL / UNKNOWN.** Source read timestamps remain in provenance, not an extra Owner line. Metadata is not an information line.

Exactly five information lines:

1. **TASK:** linked repository; governing WBS; native issue; linked PR number with verified current status (otherwise STATUS UNKNOWN); Progress Page.
2. **PROGRESS:** completed/agreed deliverables; current task completed/total; scoped acceptance level and actor. Unknown denominators are **TOTAL UNKNOWN**, not percentages.
3. **WORK & PROOF:** work actually recorded; source-measured numbers only when linked to the original witness; direct native return/review links; PASS / FAIL / NOT_RUN / UNKNOWN distinguish execution from expectation.
4. **BLOCKERS & RELAY:** actual original agent return, review and authority level, source/recipient/file/writer blockers and engineering/release HOLD.
5. **NEXT → ONE ACTOR:** one bounded authorized action, expected evidence and original return destination, plus read-only/no-production-write restriction.

## Fast Lane — execution inside an already authorized native assignment

A native issue may contain one Oracle-approved **Execution Envelope** naming exact recipient, task, pinned source/SHA, enumerated related permitted read-only substeps, stop conditions, HOLD and original return. An established `Cycle now` may execute the still-authorized substeps **during that active invocation** and return one changed-only evidence delta; passing tests never extend authority. Oracle performs feasible scoped decisions immediately, and escalates only genuine change-of-authority, actor, source/risk, independent review or Owner-only dependency. The Cycle Board's new pure next-action hint cannot authenticate the original envelope or send a message. No automatic background work, new WBS or separate receipt.

## Action to Owner — copy/paste after the five lines

A **small separate transaction section** may appear under a five-line Task Evidence v2 card. It offers a source-bound, plain-text **Copy Cycle now to Agent** or **Copy Cycle now to Oracle** message for the *existing* conversation, or an exact Owner-only decision/input where the acting Agent/Oracle has established one. It is **not** line six, a native return, a new WBS, message transport or acknowledgment. Show **NONE** if no Owner handoff is justified. Other Owner issues need explicit source-linked actor reporting; Page summaries cannot invent them.

The Board CT-5 control uses the current original issue and same-issue scoped acceptance. Missing/older/foreign-issue authorization routes to Oracle reconciliation rather than an executable Agent instruction. Copy means **NOT SENT**; recipient ACK remains independent. The authoritative [Common Action to Owner contract](https://github.com/reallakshman19/Common/blob/main/skills/agent-work/TASK_EVIDENCE_V2.md) governs both chat and Page presentation.

## When an established agent or Oracle receives Cycle now

1. Read the **Cycle Board first** as operational start: current WBS, task, INFO-Auto, native delta, agent return, authority and blockers.
2. Read original native issue/PR and relay sources to resolve stale Board labels or source gaps; do not assume the Board is authoritative.
3. Apply acting-role ownership: **Oracle chat defaults to one own coordination card**, Agent/IR chat to its own task, while the Board may show all existing source-backed role-owned cards. Include Action to Owner only for a genuinely needed copy/paste transaction. If the Board cannot be rendered, use original native sources and report BOARD_NOT_OBSERVED with PARTIAL/UNKNOWN.
4. Continue only the existing authorized native task, or for an explicitly activated canonical Oracle Cycle verify actual CURRENT.json on main, assignment/generation and receipt gates.
5. Keep evidence in the original issue and Common relay. Oracle reconciles before reviewed Progress Page publication. Never create a duplicate Board report.

CT-5 copy/open does not send or verify ACK. Neither CT-5 nor the card grants protected code writes, engineering PASS, Page publication, merge or release.

## Runtime source boundaries

- Shared task-evidence-v2.js model and renderer integrate with CT-5 across project boards and TOPO-A/B. Existing Page index/cards/audit are reused; no new public data schema.
- TOPO-A/B also read actual public issue-comment occurrences and explicit related PR states **on demand**. HTTP errors, wrong source identity, failed PR reads and incomplete pagination yield UNKNOWN or PARTIAL.
- A native return and an Oracle acceptance claim are correlated only when a later comment references the exact original return. Actor self-labels are **reported**, not independently authenticated; no recipient ACK or technical acceptance is inferred.
- Measured counts and totals appear only when source-anchored. Unknown denominators are TOTAL UNKNOWN. A new unclassified return requires reconciliation, not automatic PASS.
- Original engineering evidence stays at source links. Private chat URLs and protected XML never enter the read model.

## Acceptance evidence

tests/task-evidence-v2.test.mjs covers five unrelated Page projects; native TOPO-A/B readings; five-line invariants; false Oracle acceptance; wrong issue/comment/PR identity; missing source and newer unclassified return; No extra Page or task writes. Existing CT-5 adversarial tests remain required.

**NOT shown merely by these tests:** live authenticated delivery to another agent, chat ACK, non-author review, original-byte transfer, engineering qualification or release.

**Freeze:** APPROVED format and operational projection. PR merge, production deployment and independent acceptance are separate evidence gates.
