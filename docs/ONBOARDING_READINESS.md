# Oracle / agent onboarding readiness (Progress Page viewer)

**Scope:** small read-only projection over the existing project cards, milestones, fixtures, audit and current Owner aim. It creates **no assignment or control state**, does not activate an Oracle Cycle, does not certify engineering work and does not change the owner-merge boundary.

## Where it appears

On the **Progress** view, for a project with a live group whose key/title contains `onboard`, the compact panel appears below the WBS strip. It presents a single current onboarding card's next action and public task references. Expand details to see:

- **Start Here:** A direct [Common START HERE](https://github.com/reallakshman19/Common/blob/main/skills/agent-work/START_HERE.md) role/mode entry link, then the seven checks: Owner aim and source, canonical issue/PR and repo instructions, role/assignment, capability/access, protected boundaries, one runnable slice, evidence return. Supplemental pinned Contribution & Handoff and Oracle Continuity links still come from existing `fixtures.repository`.
- **Continuity checkpoint:** the recorded plan revision and exact candidate (or explicitly **not recorded**), current task card and next two milestone slices. The actual Oracle epoch/in-flight assignment adoption must still be read from the canonical GitHub records.
- **Contribution and independence:** author/expectation exposure, source/fixture lineage, no PASS beyond evidence, one surviving-error challenge, self-assessment versus independent reviewer.
- **Resume-from-GitHub check:** can the successor find one real current candidate, the material surviving wrong case and a single executable next operation from native repo records?

The existing G0 card remains the source of truth; this is a more usable view, **not a duplicate tracker**. For CIIFR the source is Geometry G0, based on [Issue #166](https://github.com/reallakshman19/XML_Compare_Utilities/issues/166). Existing R3, XMLv2, nodal roadmap and historical cards remain visible in their own sections.

## Readiness meanings: recorded observations, never authorization

| Display stage | What the panel requires |
| --- | --- |
| **Not assigned** | No bounded recipient with a current recorded chat id, or no scoped source-check record; default fail-closed state |
| **Sources checked** | Active onboarding card has an existing `who.chat` binding to a project `chats` entry with `id8`; `fixtures.pending` contains `ONB_SOURCES_CHECKED` for this milestone, with `n=id8`, a GitHub evidence URL **and the current assignment binding token** (plus the exact candidate commit when one is recorded) |
| **Access verified** | The above **and** `ONB_ACCESS_VERIFIED`, with the same exact recipient, milestone, latest assignment reference and recorded candidate commit |
| **Ready for bounded task** | All above **and** `ONB_READY`, also bound to this exact recipient, milestone, assignment and recorded candidate |

Stage labels describe **what someone recorded**, not independent verification or a verified principal. An unrelated VERIFIED task, accessible skill links, an unsourced note, a matching NodeName or a different chat's earlier readiness must never advance this panel. The current assignment must still be checked in its native source, and an active Oracle Cycle requires actual `CURRENT.json` activation. The Owner controls engineering approval, merge and release.

**Native CLI write route, not JSON editing:** An actual Oracle must first confirm a legitimate assignment in the project's native task/transport. On the current onboarding card, append a **new** GitHub permalink identifying the assignment via `card set --ref "comment|Onboarding assignment|<assignment-url>"`. The latest such ref is treated as current. For each actual source/access/ready probe, add a new `fixtures.pending` entry with a proof token `ONB_ASSIGNMENT=<exact-current-assignment-url>`; if this milestone has a `commit`, also include `ONB_COMMIT=<exact-sha>`. Earlier participants, assignments or candidate commits cannot confer current readiness.

For example (substitute the real registered chat key, immutable GitHub permalinks and original fixture observations):

```bash
# First: bind the actual recipient and assignment receipt in the existing card.
python tools/pp_cli.py card set --project ciifr --card geo-g0 \
  --chat builder-chat-key \
  --ref "comment|Onboarding assignment|https://github.com/example/ciifr/issues/166#issuecomment-123" \
  --actor Oracle --src https://github.com/example/ciifr/issues/166#issuecomment-123 \
  --summary "Record confirmed G0 builder assignment"

# Only after that recipient has inspected the actual original source:
python tools/pp_cli.py fixture add --project ciifr --list pending \
  --text "Original source checked ONB_ASSIGNMENT=https://github.com/example/ciifr/issues/166#issuecomment-123" \
  --status ONB_SOURCES_CHECKED --note 6ad12345 --milestone M12 \
  --url https://github.com/example/ciifr/issues/166#issuecomment-456 \
  --actor Oracle --src https://github.com/example/ciifr/issues/166#issuecomment-456 \
  --summary "Read back exact source and assignment-bound evidence"
```

`--note` contains the **short display ID of the recipient** from `index.json.chats`, not an authenticated principal or a chat URL. If the WBS milestone records a commit SHA, the evidence text must additionally carry `ONB_COMMIT=<exact-current-milestone-sha>`. `ONB_ACCESS_VERIFIED` and `ONB_READY` use the same convention but require **separate source-linked actual observations**. These receipt strings are **display-bound assertions**, not cryptographic signatures: a forged/public GitHub link or a self-declared test does not establish real access or independent verification.

If the assignment changes, append a new `Onboarding assignment` ref; if the candidate commit changes, update its milestone via native `plan milestone` and re-run affected probes. The viewer then fails closed on the old receipts, even when the *same* chat ID and WBS are reused. Use `fixture remove` through the CLI to withdraw any incorrect entries. The Timeline records the actor and source of adds/removals. This is a lightweight **viewer convention**, not an independent assignment ledger or a new schema.

### Engineering-sensitive boundary

For CAD/CII/XML takeover, obey repository `AGENTS.md`: start `TAKEOVER_AUTHORITY=READ_ONLY`; independently re-ground active SHA, diffs, fixtures and overlaps; complete Appendix A before production mutation. Geometry is review-only: a topological or registered-near NODE candidate never becomes an approved physical identity or Writer/Apply permission. Preserve original SOURCE/TARGET hash, segment-only witnesses, and actual Windows behaviour.

### What the panel explicitly does not do

It does not generate a new chat, authenticate a recipient, permit a commit, check private input accessibility on its own, enforce exclusive file locks, certify a reviewer or automatically publish handovers. A task can remain blocked despite the panel's highest recorded stage; the actual GitHub task/PR and Owner decisions prevail.

### Cross-repository integration

The Common role/mode router is authored separately in a **Common draft PR**. This UI link deliberately targets **Common/main**; before that PR merges it opens the prior entry guide, and after merge it opens the unified router. Neither project gets an automatic deploy, task activation or new approval process from the link. This is a documentation dependency, not a readiness-stage condition.

### Normative references

- [Common START HERE (main)](https://github.com/reallakshman19/Common/blob/main/skills/agent-work/START_HERE.md)
- [Oracle Standalone pinned](https://github.com/reallakshman19/Common/blob/a9491531fb98f6fd14bc486a4cc78ee4680cb1f5/skills/agent-work/oracle-standalone/SKILL.md)
- [Contribution & Handoff pinned](https://github.com/reallakshman19/Common/blob/a9491531fb98f6fd14bc486a4cc78ee4680cb1f5/skills/agent-work/CONTRIBUTION_HANDOFF.md)
- [Oracle Continuity pinned](https://github.com/reallakshman19/Common/blob/a9491531fb98f6fd14bc486a4cc78ee4680cb1f5/skills/agent-work/oracle-continuity/PROTOCOL.md)
- [Progress Page protocol pinned](https://github.com/reallakshman19/Common/blob/a9491531fb98f6fd14bc486a4cc78ee4680cb1f5/skills/agent-work/progress-page/SKILL.md)
