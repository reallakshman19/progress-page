# Oracle / agent onboarding readiness (Progress Page viewer)

**Scope:** small read-only projection over the existing project cards, milestones, fixtures, audit and current Owner aim. It creates **no assignment or control state**, does not activate an Oracle Cycle, does not certify engineering work and does not change the owner-merge boundary.

## Where it appears

On the **Progress** view, for a project with a live group whose key/title contains `onboard`, the compact panel appears below the WBS strip. It presents a single current onboarding card's next action and public task references. Expand details to see:

- **Start Here:** Owner aim and source, canonical issue/PR and repo instructions, role/assignment, capability/access, protected boundaries, one runnable slice, evidence return. Public pinned Contribution & Handoff and Oracle Continuity links are taken from existing `fixtures.repository`.
- **Continuity checkpoint:** the recorded plan revision and exact candidate (or explicitly **not recorded**), current task card and next two milestone slices. The actual Oracle epoch/in-flight assignment adoption must still be read from the canonical GitHub records.
- **Contribution and independence:** author/expectation exposure, source/fixture lineage, no PASS beyond evidence, one surviving-error challenge, self-assessment versus independent reviewer.
- **Resume-from-GitHub check:** can the successor find one real current candidate, the material surviving wrong case and a single executable next operation from native repo records?

The existing G0 card remains the source of truth; this is a more usable view, **not a duplicate tracker**. For CIIFR the source is Geometry G0, based on [Issue #166](https://github.com/reallakshman19/XML_Compare_Utilities/issues/166). Existing R3, XMLv2, nodal roadmap and historical cards remain visible in their own sections.

## Readiness meanings: recorded observations, never authorization

| Display stage | What the panel requires |
| --- | --- |
| **Not assigned** | No bounded recipient with a current recorded chat id, or no scoped source-check record; default fail-closed state |
| **Sources checked** | Active onboarding card has an existing `who.chat` binding to a project `chats` entry with `id8`; `fixtures.pending` contains `ONB_SOURCES_CHECKED` for this milestone, with `n=id8` and a public GitHub evidence URL |
| **Access verified** | The above **and** `ONB_ACCESS_VERIFIED`, with the same exact recipient and milestone |
| **Ready for bounded task** | All above **and** `ONB_READY`, also source-linked, for this recipient and milestone |

Stage labels describe **what someone recorded**, not independent verification or a verified principal. An unrelated VERIFIED task, accessible skill links, an unsourced note, a matching NodeName or a different chat's earlier readiness must never advance this panel. The current assignment must still be checked in its native source, and an active Oracle Cycle requires actual `CURRENT.json` activation. The Owner controls engineering approval, merge and release.

**Native CLI write route, not JSON editing:** Once a participant has been legitimately assigned via the project's normal protocol and `card set --chat` with an existing registered chat ID, the Oracle records successful checks through the existing `fixture add` command, for example:

```bash
python tools/pp_cli.py fixture add --project ciifr --list pending \
  --text "Sources and exact baseline inspected by assigned participant" \
  --status ONB_SOURCES_CHECKED --note 6ad12345 --milestone M12 \
  --url https://github.com/<owner>/<repo>/issues/<n>#issuecomment-<receipt> \
  --actor "Oracle" --src https://github.com/<owner>/<repo>/issues/<n>#issuecomment-<receipt> \
  --summary "Participant checked original sources on exact task candidate"
```

`--note` is the **short display ID of the recipient** from `index.json.chats`, not an authenticated principal or a chat URL. Substitute actual public-safe values. Advance other stages **only** after the corresponding real operation, with new `fixture add` evidence and a real GitHub receipt. Use `fixture remove` with a new Timeline entry to withdraw a stale/incorrect item; if the actual assignment or candidate has changed, re-ground and explicitly re-record relevant checks. This lightweight fixture encoding is a **viewer convention**, not a new ledger/schema. The Timeline captures the actor/source of each add/remove.

### Engineering-sensitive boundary

For CAD/CII/XML takeover, obey repository `AGENTS.md`: start `TAKEOVER_AUTHORITY=READ_ONLY`; independently re-ground active SHA, diffs, fixtures and overlaps; complete Appendix A before production mutation. Geometry is review-only: a topological or registered-near NODE candidate never becomes an approved physical identity or Writer/Apply permission. Preserve original SOURCE/TARGET hash, segment-only witnesses, and actual Windows behaviour.

### What the panel explicitly does not do

It does not generate a new chat, authenticate a recipient, permit a commit, check private input accessibility on its own, enforce exclusive file locks, certify a reviewer or automatically publish handovers. A task can remain blocked despite the panel's highest recorded stage; the actual GitHub task/PR and Owner decisions prevail.

### Normative references

- [Oracle Standalone pinned](https://github.com/reallakshman19/Common/blob/a9491531fb98f6fd14bc486a4cc78ee4680cb1f5/skills/agent-work/oracle-standalone/SKILL.md)
- [Contribution & Handoff pinned](https://github.com/reallakshman19/Common/blob/a9491531fb98f6fd14bc486a4cc78ee4680cb1f5/skills/agent-work/CONTRIBUTION_HANDOFF.md)
- [Oracle Continuity pinned](https://github.com/reallakshman19/Common/blob/a9491531fb98f6fd14bc486a4cc78ee4680cb1f5/skills/agent-work/oracle-continuity/PROTOCOL.md)
- [Progress Page protocol pinned](https://github.com/reallakshman19/Common/blob/a9491531fb98f6fd14bc486a4cc78ee4680cb1f5/skills/agent-work/progress-page/SKILL.md)
