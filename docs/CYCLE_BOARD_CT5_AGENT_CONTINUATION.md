# CT-5 — Agent Continuation and Acknowledgment Bridge

**Mode:** shared, read-only Cycle Board functionality for all registered Progress Page projects and the existing TOPO-A / TOPO-B Adhoc native tasks. **No second WBS, no standalone Cycle activation, no automated message delivery and no new agent report.** The native engineering task, original evidence and existing Common instructions remain authoritative.

## TE2-ROLE — "Cycle now" acting-role gate (O4)

The **Cycle Board** remains a comprehensive read-only source view: its existing Agent/IR/Oracle task cards retain their own ownership. When an **existing Oracle** receives `Cycle now`, the Oracle normally reports **one five-line Oracle coordination Task Evidence v2 card**, referencing subordinate original issue evidence rather than reprinting each agent card. An Agent/IR reports its own task. Expand subordinate cards in the Oracle response only at explicit Owner request. Never add a fictitious Oracle WBS/task merely to show an extra card.

For TOPO-A/B Adhoc Boards the explicit **Copy Oracle Cycle now · not sent** control creates a role-scoped coordination prompt with the two known native source issue links, reminding the Oracle to check actual assignment, latest native returns and current-instruction relay status. The button is a copy operation, **not an authenticated send or ACK**. A non-Oracle Board has no implied Oracle copy control unless acting role is supplied by its existing approved assignment.

For the **current** next instruction, `PREPARED`, `POSTED`, `DELIVERED`, `ACKNOWLEDGED`, `EVIDENCE_RETURNED` and `ORACLE_RECONCILED` are separate observations. An earlier agent return does not acknowledge a later task. Declare `CONTINUED` only on current-instruction recipient ACK or source-backed subsequent execution; otherwise `AWAITING_RELAY` with named necessary actor or `BLOCKED` with an actual authority/custody barrier. One-time Owner relay does not transfer Oracle coordination. An existing native task does **not** require formal `oracle-cycles/CURRENT.json` unless the formal transport was expressly selected.

## Owner problem

An Oracle posted a bounded instruction on a native GitHub issue, but the existing ChatGPT agent conversation did not receive or acknowledge it. The old Cycle Board could see the GitHub occurrence yet could not distinguish **posted**, **delivered**, **acknowledged**, **returned**, and **reconciled**. It must not call a posted issue message an agent continuation.

## Action to Owner — compact copy/paste transaction

Each existing Task Evidence v2 card can expose a **small Action to Owner** section directly beneath the five information lines. It is **not a sixth line** or a second task ledger. The Board offers a **Copy Cycle now to Agent · NOT SENT** message only when a current native task has a source-linked, Oracle-reported bounded next action and the review comment belongs to that same issue. For a completed/review-gated, stale, wrong-source, unverified-role or unsupported task, the surface fails closed to **Copy Cycle now to Oracle** for reconciliation, or **NONE** if no original task/acting role is verified.

All Board-generated copy blocks have status **PREPARED_NOT_SENT** and are *options*, not proof of a required Owner action; the acting Oracle decides `AWAITING_RELAY` separately from authenticated coordination evidence. The block uses the original native issue, current Board link, expected native return and unchanged READ_ONLY/HOLD restriction. It includes **no private conversation URL**; the Owner pastes it into the **existing and manually verified** Agent or Oracle conversation. Copying does not imply delivery, ACK or approval. The acting Agent/Oracle may separately report one **actual Owner-only decision or source/custody input** with its own link, rather than fabricating a Board task. If there is no genuine Owner dependency, say `Action to Owner: NONE`.

**Other issues needing Owner attention** are concise, source-linked exceptions written by the acting Agent/Oracle. The Board does not manufacture them from Page labels; when not observed it says NOT_VERIFIED and points to the original issue.

## Fast Lane F2 — source-derived next-action decision (no second tracker)

The existing CT-5 task row now displays a **Cycle now · Next-action decision** hint derived from the original native issue read. `decideNextAction(facts)` is a pure, non-dispatching decision aid. `CONTINUE_EXISTING_SCOPE` requires an **exact original Execution Envelope** (verified task and recipient, source SHA, same-issue native authorization permalink, current source, named permitted read-only substep, untriggered STOP conditions). An ordinary Board NEXT label, old Oracle-reported instruction, passed synthetic test, or a copied packet never supplies that authorization.

Current CT-5 is deliberately **not** an envelope verifier. It will **not** auto-promote a Board row into `CONTINUE_EXISTING_SCOPE`. If a native comment follows the source-linked Oracle instruction, the row instead recommends `ORACLE_RECONCILE`, marks the changed evidence and suppresses replay of the older next-action copy packet. Without verified authority it recommends `ORACLE_QUALIFY_SCOPE`; no new agent work is authorized.

A completed scoped return → `DECIDE_NEXT_ASSIGNMENT`, a critical falsifier → affected-scope HOLD, changed source/authority → requalify affected scope, unknown writer custody → block production writes while separately authorized read-only work remains eligible, required independent qualification → Oracle/reviewer gate, and verified Owner-only decision → exact source-linked Owner action. **`Action to Owner: NONE`** and no copy button when the acting Oracle has no genuine Owner dependency. The five-line card and original issue/relay remain unchanged.

No background execution, automatic chat messaging, fabricated ACK, engineering PASS, private-source transfer, new WBS or extra data ledger. The Oracle makes available authorized decisions in the same invoked `Cycle now`; agent continuation means only related substeps within its previously approved envelope in that *same active turn*. F1 source of truth: [Common TASK_EVIDENCE_V2.md](https://github.com/reallakshman19/Common/blob/main/skills/agent-work/TASK_EVIDENCE_V2.md) after F1 authorized merge.

## User workflow

1. Open the **Cycle Board** in any registered project: `#/ciifr/cycle-board`, `#/ciifr-node/cycle-board`, `#/g9v35/cycle-board`, `#/topofix/cycle-board`, `#/doc2table/cycle-board` and other active project tabs; or one of `#/adhoc/topo-a/cycle-board`, `#/adhoc/topo-b/cycle-board`.
2. Find **Agent continuation · CT-5**, scoped to existing project WBS/task cards or to the actual native TOPO issue. It reuses `agentStartModel` and `agentStartTaskText` for published Page tasks, `smartBadgesForScope` for shared identities, and the native-source observation/provenance graph.
3. Inspect current role, original source, recorded next actor, task state and surviving HOLD. If a row says **RECONCILE_FIRST** or **ACTOR_REVIEW_REQUIRED**, do not rerun it.
4. Select **Copy Cycle now · not sent**. This is a source-scoped changed-only native continuation packet with an explicit no-dispatch/ACK notice. Copying does **not** send a message.
5. Use **My links** (private to this browser) to associate the recorded agent short chat ID with an existing ChatGPT/Claude conversation, or for native TOPO use the `topo-a`/`topo-b` keys. The Board then offers **Open existing conversation (private shortcut)**. Opening does **not** paste or deliver the instruction.
6. Paste the packet into the actual existing agent chat, where the agent should check the current original source and respond in the existing native task/selected relay. A human/coordinator checks that it is really the correct recipient and that it acknowledged the intended source revision. **No browser-only self-ack button** is provided.
7. Oracle rechecks the original source and a genuine, task-linked return before any reviewed Progress Page reconciliation. No duplicate Board report is requested.

## Truthful status axes

| Axis | Source-derived initial state |
|---|---|
| Native task | Source pointer on existing Page card or native issue; immutable native occurrence shown only if verified by configured source read |
| Recipient | Recorded role and short ID from existing private `My links` map, **not authenticated** |
| Instruction | Copy-ready, `NOT SENT`; a GitHub issue link is not evidence of actual message delivery |
| Delivery | `NOT_VERIFIED` until actual messaging-channel evidence exists |
| ACK | `NOT_VERIFIED` until actual intended-agent acknowledgment and source readback |
| Return | `NOT_VERIFIED`; an exact Page audit `AGENT_RETURN/RETURN/REVIEW_RETURN` pointer is `PAGE_AUDIT_RETURN_POINTER_ONLY`, not authenticated acceptance |
| Canonical Cycle / engineering / Page | Existing source/authority rules unchanged. CT-5 **cannot** activate or dispatch a Cycle, grant protected code write, source-byte receipt, technical PASS or publish a Page revision |

## Scope and privacy boundaries

- Existing Page tasks derive from original `index.json`, `cards.json`, `audit.json`; project key and WBS must match. No public recipient full UUID, raw private chat link, hidden file content, fabricated task or new WBS.
- Private conversation links are browser-only `My links` entries keyed by recorded short ID or native TOPO task key, and only recognized ChatGPT/Claude conversation URLs are eligible. Nothing is written to public `data/**`; private URL is not copied into the Cycle now task packet.
- A Page `DONE` card needs Oracle reconciliation, not replay. A recorded Owner/IR next actor cannot be promoted into a builder dispatch.
- Historic or missing project data cannot generate continuation packets. Native source/read failures keep the affected evidence explicitly `NOT_VERIFIED`.
- The UI does not have a ChatGPT conversation-send, agent acknowledgement or private recipient authentication API. **Do not infer it from GitHub issue comments, UI clicks, PR head, sender labels or Page audit records.**

## Qualification

`tests/cycle-board-ct5-continuation.test.mjs` covers five different Page project families, exact WBS isolation, existing Agent Start packet reuse, private conversation boundary, false ACK, completed/Owner tasks, source-return pointer spoofing, native TOPO source revision and historical fail-closed behavior. Chromium browser matrix additionally visits the five project Cycle Boards and two TOPO Adhoc Cycle Boards at 1440px and 390px.

These are **author-side synthetic/browser regressions**, not independent user trial, private recipient ACK, actual delivery, non-author engineering review or CT-4 measured effort reduction.

**Remaining acceptance gate:** a real existing Oracle uses both Boards and private established agent links, sends the packet through the actual conversation, receives independent agent source-readback and native return, then reconciles source and Page without Owner intervention. If a connector enabling authenticated delivery and readback later becomes available, it must use a separate, explicitly authorized transport and immutable receipt; do not upgrade this copy/open UI into a delivery claim.
