# Lesson 2 — Outcome-led Oracle: build, observe, correct, carry forward

**Proposed home:** Progress page → **Lessons** (existing tab), following Lesson 1.
**Source:** Owner-private engineering-prototype conversation, 23 October 2026; public-safe synthesis, not a public engineering evidence archive.
**Status:** DRAFT lesson; no Owner acceptance implied.

**Practice:** [Nine public-safe Oracle decision cases](lesson-02-oracle-cases.json) are designed to accompany this text when placed under `docs/lessons/` in the Progress page repository. They are reasoning exercises, not an acceptance exam.

## The Owner's aim

Build something the Owner can actually use and inspect. Preserve the engineering meaning and private originals. Make bounded progress yourself when useful; delegate coherent remaining work; independently challenge consequential claims; keep integration and continuity rather than passing each next decision to a new agent.

This extends **Lesson 1 (aim first, proportionate process)**; it does not replace it. The reference operating guide is [Common agent-work START_HERE](https://github.com/reallakshman19/Common/blob/624ff12440651d82b9f1741c4a29a4ca76e9ac0c/skills/agent-work/START_HERE.md). High-consequence engineering field transfers justify stronger verification than a disposable personal learning interface. The quality bar follows the *consequence of the failure*, not the prestige of the process.

## The development pattern (anonymized)

| Step | Observed need / contradiction | Oracle action and retained boundary | Evidence tier |
|---|---|---|---|
| P1 | Need an actual CII↔structured-XML route, not just a plan | Built independent typed converter, tested byte-preserving no-edit round trips, retained working original | Contributor self-test; no claim of independent review |
| P2 | Owner needed branch-level T1/P1 transfer | Bounded whole-line transfer behind a new mode, preserving earlier editor | Contributor self-test |
| P2.1 discovery | Source and target line identifiers can differ | Tried geometric signatures, discovered nonunique geometry; prohibited blind auto-accept | Controlled experiment on one model pair; does not prove identity across revisions |
| P2.1 authorization | Plausible candidate does not equal approved identity | Candidate → Accepted → Transfer-ready; bind approvals to full source/target revisions and compatibility guards | Synthetic and actual backend exercise, still author-tested |
| P2.1 user run | Output appeared unchanged, despite a planned T1 change | Inspected export audit: `applied: false`; reproduced Preview vs Apply; corrected UI labels and export gating rather than changing the converter | Owner screen + artifact audit + bounded reproduced fix |
| P2.5-A | Flexible interface and visual connectors requested | Isolated customizable workspace; node/element connector sockets disabled; layout profiles presentation-only | Standalone/mock UI tests, not CII engineering evidence |
| P2.5-B | Successor claimed real integration but some environments lacked backend | Recovered exact frozen backend for handoff; kept adapter work, challenged mock/real evidence separation and whole-document stale mapping behavior | Agent-reported real HTTP checks; native served-browser Owner acceptance remains separate |
| Next | Other Oracles need the behavior, not only files | Store decisions, corrections, counterexamples, evidence level, reusable exercises and precise next actions | This lesson draft |

Numbers in private benchmarks, client line labels, file hashes, screenshots and customer models are intentionally omitted. The lesson records *decisions and tests*, not a leaked benchmark.

## The Oracle loop (repeat as needed, not a compulsory stage machine)

1. **Write the Owner's aim in operational terms:** who must be able to do what, with which real artifact; name the protected baseline and the failure consequences.
2. **Inspect the working state:** read source bytes, implementation, past outputs and actual failure evidence. Distinguish what a person reports, what files demonstrate, and what was independently exercised.
3. **Choose the smallest consequential next move:** implement a bounded working slice yourself when your context has value; otherwise hand off a coherent task with exact inputs, constraints and falsification targets.
4. **Use a discriminating case:** identify at least one plausible wrong implementation that a superficial happy-path test would miss; predict how it should fail before running.
5. **Keep old capability runnable:** new mode/adapter before invasive refactor; no silent replacement of validated P1/P2/P2.1 paths.
6. **Separate decision states:** candidate vs authorization vs current readiness; preview vs Apply; output generation vs saved changes; contributor checks vs independent verification vs Owner acceptance.
7. **React to contradiction, do not defend prior verdicts:** read the audit, reproduce minimally, fix the correct layer, and re-run affected prior tests.
8. **Preserve continuation:** exact candidate/revision identity, what was changed, scope of PASS, negative tests, unknowns, runnable instructions and next owner/agent action.

## Eight operating rules

**Aim before apparatus.** A plan is not an outcome. Favor the first usable narrow slice over building coordination machinery.

**Contribute before handover where it genuinely helps.** A thoughtful local proof, minimal adapter or reproduced failure can spare the next agent ambiguity. But a planning-only request need not trigger coding; roles do not confer authority.

**Keep a single continuity owner.** The Oracle is accountable for fit and integration when another coder executes. Each handoff records artifact bytes/hash and exact next test, not just a status word.

**Never confuse resemblance with identity.** Same geometry can recur in multiple lines; a candidate mapping requires human engineering judgment. Different line identifiers can still refer to corresponding branches; aliases or matching names alone are not sufficient proof.

**Make state explicit.** A mapping can be Accepted yet not Transfer-ready. A preview can forecast changes with `applied: false`; it must not silently become an exported applied model.

**Bind authority to inputs.** After any target document mutation, other previously accepted whole-document-hash mappings are stale. Do not auto-renew or silently chain transfers.

**Challenge one significant surviving error.** A parser PASS says it can parse. An HTTP PASS says the endpoint works. A mock browser PASS is not a live served-browser PASS. Byte equality on an *unchanged* round trip does not prove field-level correctness after a transfer.

**Size gates to risk and use.** A confidential engineering-data edit needs field-level preservation and owner approval. A UI concept needs honest mock labeling and working interaction, not an invented external review organization.

## Recoveries worth preserving

**Geometry collisions:** a candidate resolver identified unique geometry for some groups but multiple plausible counterparts for others. The correction was *explicit acceptance with ambiguity blocking*, not a more confident auto-match.

**Preview/export misunderstanding:** the audit showed readiness and three *planned* cell changes but `applied: false`, with identical before/after target XML hashes. The correction was to execute Apply explicitly, fix the direction of before/after display, and block misleading export during pending unapplied preview. Never blame serializer or user before reading the audit.

**Global Find & Replace side effects:** text replacement in a raw CII may modify many records outside a selected branch. The correction was a controlled fixture with only line identifiers changed and byte-scope checks; branch-scoped edit flows are safer than manual replace-all.

**Mock versus authentic integration:** a staged interface can be correctly wired in a mock without establishing a real backend transfer. Preserve that progress, recover the original backend, and test the complete server/API/export chain. A missing native browser walkthrough remains NOT_RUN rather than a failure or fictional PASS.

**Over-review risk:** independent falsification is valuable when it challenges a consequential unverified claim. Don't mandate a new reviewer or agent by habit after each bounded patch; choose next effort from the actual uncertainty.

## Outcomes and limits

The Owner confirmed a corrected P2.1 workflow worked on Windows. The later P2.5-B successor reported genuine 25-cell backend transfer checks, but that report must not be restated as independent Oracle/Owner acceptance. Native served-browser acceptance remained explicitly outstanding in the recorded handoff. No general performance, time savings, return on investment, or future-agent success rate has been measured.

**Success for a future Oracle:** deliver a usable scoped artifact, explain *which evidence proves which claim*, find and correct the most important contradiction, keep private inputs private, and leave an executable continuation—not a bigger diagram or a generic delegation chain.