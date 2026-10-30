# Oracle → continuity → agent → Page + concept/source fixtures stress

**Mode:** deterministic author-side regression, isolation-only. This never runs an actual Oracle, authenticates a private agent, creates a Cycle, checks private bytes, posts Common relay data, grants Owner acceptance, or changes production Page data.

The test follows a **synthetic** Owner aim and pinned Common protocol sources through an acyclic **concept/source dependency map**, Oracle handover, assignment-bound agent onboarding and readiness, scoped Agent Start packet, task-scoped artifact relay fixture, real `pp_cli.py` Page mutations on a disposable test project, audit-chain checks and strict no-production-write equality.

It uses existing project data schema only; **no parallel WBS** and **no new mandatory reporting**. The graph is a falsification contract rather than a new canonical concept-map registry. All guide references point to actual pinned Common files, but the acme/demo task is synthetic; a structurally valid GitHub link is not authenticated evidence. A real project concept document must separately be source checked, not inferred from protocol documents.

## Run
```
node --experimental-default-type=module --test tests/oracle-agent-lifecycle.stress.test.mjs
python -B -m unittest tests/test_oracle_agent_stress.py -v
python tools/pp_check.py data
```
The Python suite calls the **real** CLI on `helpers.copy_valid()` data and reads Node projections. The 64-seed Node matrix checks same/different assignments, stale commits, partial stages, wrong participant, missing sources, Oracle/Builder split, concept-map graph reachability and projection immutability.

## Adhoc Projects (included in the same lifecycle, never a second source of truth)

The Adhoc navigation layer has three distinct workspaces: **Progress Page**
(`overview`, `cycle-board`, `contracts`, `delivery`, `tests`),
**XML-PS Mapping** (`overview`, `candidate-matrix`, `matching-rules`, `evidence`),
and **XML-Compare** (`overview`, `sources`, `validation`, `delivery`).
New adversarial cases exercise each current nested route, unique active tabs,
correct native source links, source-specific review-only HOLD wording,
**256 invalid cross-workspace route mutations**, and read-only data integrity.

The existing Chromium layout workflow additionally visits all eight XML source
workspace sections at 1440px desktop and 390px mobile, plus an invalid
cross-project route. A successful Adhoc view **does not** authenticate a
source, start an Oracle, register a WBS, count a private byte receipt,
grant an agent assignment or publish a Page update. It only navigates to
the native source and existing page/fixture evidence.

Run `node --experimental-default-type=module --test tests/oracle-agent-adhoc.stress.test.mjs`
or use the CI workflow. Browser tests remain a separate workflow, triggered
by the targeted existing `tests/test_all_tabs_layout.e2e.py` amendment.

## Required negative cases
- missing concept, source or relay record → `not recorded`, never imaginary source delivery
- corrupted concept-map edge, orphan source, unpinned Common file → explicit failure
- Oracle transfer without an authoritative epoch/write-exclusion proof → NOT ESTABLISHED
- agent source/access/ready evidence belonging to previous recipient, prior assignment or changed SHA → stage 0 until fresh checks
- agent task packet remains an **unacknowledged** assignment and never technical/Owner PASS
- rejected Page CLI operation leaves every test file byte-for-byte unchanged
- no test accesses or edits `data/**` except read-only snapshot and checker; audit entries are chained in isolated copy

CI success establishes **code behavior on synthetic evidence**, not operational onboarding, original-source acceptance, live Progress Page publication or verified fixture receipt. The next gate is an independent agent cold start from pinned original GitHub/relay materials and a real Owner review, with UNKNOWN/NOT_RUN recorded for inaccessible sources.
