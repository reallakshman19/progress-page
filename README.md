# Progress page

A static page that shows, for each project, its **milestones**, **agent blocks** (who is doing what, how long ago it moved, what is next),
the Owner's **decisions** ("My actions"), **grounding fixtures**, a **Timeline** of every update, plan **revisions** and a **Nudge +** queue per agent.
The data is plain JSON in `data/`. GitHub history is the trace. No build step, no database.

Status: reference deployment, prototype v0.1. The portable copy with the full how-to is the Common module
`skills/agent-work/progress-page` (README, references, tools, tests). Read that README first; this file is the short version.

## Owner-go-ahead merge rule — this repository only

**Owner direction (25 October 2026):** After the Owner gives go-ahead to proceed with a **draft PR targeting `reallakshman19/progress-page`**, that go-ahead **also authorizes merging the same scoped PR without a second Owner approval**. The authorized operator reviews its exact current head and diff, required CI/tests, compatibility with the current base and applicable GitHub branch protections; if satisfied, mark the draft ready, merge it, and read back/report the resulting merge SHA. A failed required check, material scope drift, conflicting engineering/Owner HOLD or unsafe merge is a blocker to address, **not** grounds to bypass GitHub protections or manufacture a PASS.

This repository-specific merge authorization **does not apply to Common or other repositories** and does not itself confer engineering acceptance, independent-review PASS, permission to expose protected artifacts, automatic deployment or background agent execution. These remain under their own selected native rules.

## Use the tools, do not edit the JSON by hand

```
python tools/pp_cli.py --help          # project / revision / plan / card / action / fixture / nudge / check / triggers / local / links
python tools/pp_cli.py check           # must print OK
python tools/pp_cli.py triggers        # what the Owner and the coordinator owe right now
python tools/pp_cli.py reconcile --project ciifr --source https://github.com/reallakshman19/XML_Compare_Utilities/pull/185 --json  # read-only source checkpoint; use --expected-head SHA for drift warning
```

Every write needs `--actor` (who), `--src` (a public GitHub link, or `OWNER_PRIVATE_REF:<id>`) and a reason. It writes one Timeline entry, runs the checker,
and leaves every file as it was if the check fails. Nothing is deleted: supersede, cancel, archive or withdraw. Use plain `python` (not `python -I`).

## Evidence-first, reviewable batch updates (coordinator only)

For one native source supporting several related changes, prepare a reviewed public-safe JSON manifest:

```json
{"project":"ciifr","actor":"Oracle","source":"https://github.com/OWNER/REPO/issues/33",
 "changes":[{"command":"plan milestone","args":{"id":"M8","wbs":"5","summary":"Classify XMLv1.1 under WBS 5"}}]}
```

Dry-run first: `python tools/pp_batch.py update.json --data data`. It stages the native CLI commands in a temporary copy, checks every operation, validates append-only events and prints changed paths/event IDs without touching `data/`. After reviewing the actual source and diff, `python tools/pp_batch.py update.json --data data --apply --base origin/main` swaps the checked data directory and runs the history comparison, rolling back on failure. Then commit through your normal authorization/PR workflow. The script does **not** read the source's engineering meaning, infer status, grant approval or merge. A source already recorded is refused by default.

## Task-scoped Agent Start (v29 draft)

The optional `#/PROJECT/start/REV/wbs%3AN/Mn/CARD_ID` route selects exactly one source-recorded card inside the milestone. A wrong, closed or mismatched ID produces a visible unresolved request, never another card. **Copy this task** exports the selected card and its full recorded status, next action, source links, unknowns and authorization boundary; **Copy milestone evidence** remains the explicitly broader multi-item export. Neither action sends a task, acknowledges an assignment or grants authority. Legacy workstream and milestone links are retained.

## Canonical Cycle-to-WBS binding preflight (source only)

Before proposing a Page `data/projects.json` Cycle binding, the authorized coordinator can run `python tools/pp_cli.py cycle-preflight --project ciifr --cycle ciifr --wbs 3`. This read-only command pins Common `main` to its observed commit, validates the returned canonical `CURRENT.json` Git blob, and checks exact Page project/WBS, original native WBS and task references, observed PR candidate head, active Cycle and Page revision/publication. It returns exactly **READY_FOR_REVIEW**, **SCOPE_MISMATCH**, or **INSUFFICIENT_EVIDENCE** with specific source gaps/conflicts. A green result means *eligible for separately authorized review of a binding*, **not** that a binding, agent assignment, engineering PASS or Owner acceptance exists. Missing/failed sources fail closed, not inferred by name or stored cached prose. Never auto-write Page data, Cycle state or acknowledgements. Any human-approved binding must still be restricted to the original `wbs:N` and use existing Page writer and Common Owner rules.

## Automated CIIFR native source monitor (read-only pilot)

The reference Page repo has a **daily, manual-runnable GitHub Actions pilot** (`.github/workflows/native-source-watch.yml`) that observes public sources linked to active `ciifr` Page cards **and** the explicitly selected canonical CIIFR Cycle's WBS 3 task/candidate. It invokes existing `pp_watch.collect` and the read-only `pp_cycle_preflight.preflight` through `tools/pp_watch_job.py` with a **maximum of 100 unique links**, read-only GitHub credentials, and a short-lived **Actions cache of source fingerprints** (not a second task ledger). The first complete observation establishes a baseline. Subsequent identical observations are a silent **NO_CHANGE** with no Page write, issue, PR, receipt, or artifact; native metadata differences create a **review-only** CI artifact and summary. Retrieval failure, expired/broken cache, or truncation yields **UNKNOWN** and never overwrites the last healthy baseline.

The initial link-only pilot could not monitor unlinked evidence. The current explicitly scoped source-coverage extension additionally reads pinned canonical CIIFR Cycle WBS 3 and its native task/PR without activating a binding. It reports an existing missing-link or stale-merge gap **once**, remains quiet when unchanged, and preserves the last healthy baseline when Cycle/native retrieval fails. The designated Oracle and sole Page writer still own real reconciliation and publication. For CIIFR the unreconciled, **not-yet-Page-linked** sources are task [XCU #180](https://github.com/reallakshman19/XML_Compare_Utilities/issues/180) and [PR #191](https://github.com/reallakshman19/XML_Compare_Utilities/pull/191). They are now observed via the explicit canonical Cycle source scope, but remain outside the Page-linked watcher until the authorized CIIFR Page writer reconciles WBS 3. It does not edit `data/**`, activate a Cycle mapping, interpret engineering PASS, decide Owner acceptance, post issues, or automatically run `pp_propose`/`pp_batch`. A change alert requires source and custody review. The native GitHub/Oracle/Page mismatch is an **existing Oracle and Page writer reconciliation**, not a request for another builder report. GitHub Actions scheduling is best-effort; a missed scheduled run is not proof of no change.

## Material native-source delta scan (no extra agent logging)

The coordinator can run `python tools/pp_cli.py watch --project KEY --limit 25` to inspect up to 25 **unique public native GitHub sources already linked to active Page cards**. The JSON response can be retained as an ephemeral CI artifact and supplied on the next check with `--baseline prior-scan.json`. It compares PR exact head/state/merge or issue/comment updatedAt/state and reports `SOURCE_CHANGED`, `NEW_SOURCE`, `NO_CHANGE`, or `UNKNOWN`. A first run without a baseline reports `BASELINE_REQUIRED`, not fabricated changes. Truncation and unavailable sources explicitly make the scan incomplete. Exit 0 is successful complete no-change/first observation, exit 1 means an actual source difference, exit 2 means incomplete/error. Neither scan nor duplicate suppression writes Page records, generates engineering PASS, dispatches agents or maintains another Timeline. An authorized coordinator must still inspect actual native evidence and use existing `reconcile`, `propose` and reviewed `pp_batch` only when meaningful. This is a **read-only polling primitive**, not an enabled GitHub webhook or automatic Page publication.

## Read-only checkpoints and optional Cycle scope (v32)

Project Home shows a Project checkpoint; Progress/WBS and Continuity expose compact checkpoint disclosures; scoped Agent Start leaves the native task first and offers its WBS checkpoint afterward. These are **derived solely from existing milestone/task/source evidence**. The latest recorded task is chronological, **not** the next priority or engineering acceptance. A recorded HOLD survives; missing qualification and native-source timestamps remain UNKNOWN. A Page JSON fetch is shown separately from native GitHub/Cycle retrieval.

An explicitly configured, project-specific `cycle` binding in `data/projects.json` can enable a **read-only** Common Cycle observation. Required fields: `pageProject` (existing Page key), `project` (canonical Cycle project), `scope` (`wbs:N`), and `url` exactly `https://raw.githubusercontent.com/reallakshman19/Common/main/oracle-cycles/PROJECT/CURRENT.json`. The viewer validates schema, matching canonical identity and `progress_projection.project_key`, activation, and WBS scope before displaying the recorded next recipient. **No matching by name; no binding ships by default**, because the live CIIFR Cycle currently covers a narrower Geometry frontier than the Page's broader project. An authorized coordinator must inspect the source and add a mapping through the normal reviewed Page-data/owner process. Failed fetch, historical data or mismatched scope may never imply an assignment. The UI does not execute `Cycle now` or modify its existing receipt contract. No new Page logs, agent acknowledgement or handoff report. When a scoped canonical Cycle is explicitly bound, its recorded next status is rendered as **OWNER_DECISION_PENDING**, **AWAIT_ORACLE_RECONCILIATION** or **ROLE_AND_GENERATION_RECHECK_REQUIRED** for new agents; these are advisory continuation cues only, not dispatch verdicts. WBS checkpoints contain a short cold-start source checklist. No binding is added by this release.

## What the page shows

- **Stable project shell**: project title, revision row, collapsed Owner-aim/method disclosure and main navigation keep the same desktop/mobile geometry on Home, Progress/WBS and Continuity routes. The full Owner aim remains visible inside the Home overview. Narrow desktop WBS grids use three readable columns, and navigation scrolls horizontally on phones rather than wrapping or moving the other tabs.
- **WBS family tiles** in both Progress / WBS and Agent Start show the recorded workstream title and milestone `full` description for all projects (including Doc to Table WBS 1–7). When no parent WBS exists, the viewer lists original child milestone names rather than inventing a parent aim; no additional JSON field or agent report is required.

- Project tabs, `+` to add a project (a copy-paste brief for another agent), **Archived (n)** for closed projects.
- **Aim** first (Owner, 22 Oct 2026, Lesson 1): every active tab shows the Owner's aim under its title, with its source; the checker refuses an active project without one (`project add --aim`, `project aim`). Under it, **How we work** links the Common agent-work modules.
- **Who writes what:** the coordinator writes agent blocks, decisions and revisions; the project's **Oracle sets the milestones** (`plan milestone`; placing a block with `card set --milestone` alone keeps the block's evidence time and source); **anybody may add grounding fixtures** under their own name; an Oracle may push its own project's data.
- **Revisions** row: R1, R2 ... A revision is added only when an Owner decision changes direction. Older ones open read-only from GitHub history.
- **Agent Start**: choose the authoritative workstream and milestone first. An unscoped `#/PROJECT/start` is intentionally **not** a global task priority list: card order is plan order, not assignment. Family views list WBS steps; scoped step views show every recorded work item with concise next action, native source, and actor or explicit unassigned label. Long audit/status text is collapsed; Owner aim and restrictions remain available. A missing candidate SHA is NOT_RECORDED, never inferred. Task-specific read-only context at `#/ciifr/start/R4/wbs%3A3/M13` (example). It shows the recorded task, candidate, exact source links, next action and explicit qualification gaps without granting assignment, independent PASS or Owner acceptance. Agent evidence still belongs in its native issue/PR; no duplicate status submission.
- **Primary navigation**: Project Home → Progress / WBS → **Continuity / Onboard Central**. The Central groups Agent Start, Oracle continuity, Risks & handoffs and Grounding fixtures in a local subnav. Old routes (`#/PROJECT/start`, `#/PROJECT/oracle-continuity`, `#/PROJECT/home-risks`, `#/PROJECT/fixtures` and scoped/historical variants) remain valid and highlight the Central tab. My actions and Timeline remain under Project Home.
- **Project Home**: compact Overview, Roadmap and Sources pages, plus My actions and Timeline; long source lists start collapsed and can be searched. Original fixtures and native issues remain authoritative; roadmap entries are plans, not engineering PASS.
- **Progress / WBS**: first select a numbered WBS family (1 / 2 / 3 / …), then its 3.0 / 3.1 / … subtabs; unnumbered M-series milestones remain under **Other milestones**. All WBS is a compact family overview, not a 23-item navigation strip. The selection filters relevant agents, actions, fixtures and timeline; native milestone IDs and evidence stay unchanged. Attention counts remain project-wide. Existing `#/project/progress` URLs continue to open operational progress; `#/project/home[-roadmap|-sources|-risks]` opens the relevant Home section. G0 onboarding is shown once as a collapsed WBS 3.0 disclosure; expanding it reveals evidence and the original task card without a duplicate global panel.
  Superseded and cancelled blocks stay, greyed, with the reason. **Nudge +** on each block queues instructions for the coordinator (OTM or the Oracle), not for the agent.
  Historical revision links use that revision's immutable GitHub snapshot for the Owner aim, WBS families/children, milestones, cards and sources; never fill a missing R1/R2/R3 snapshot from current R4. WBS selections are revision-scoped, shareable links such as `#/ciifr/progress/R3/wbs%3A3/M13`; Back/Forward restores the exact selection.
- **My actions** and **Timeline** remain under Project Home; **Grounding fixtures** is under Continuity / Onboard Central. Existing `#/project/actions`, `#/project/fixtures[/revision]` and `#/project/timeline[/revision]` deep links continue to work.

## Data (public-safe only)

```
data/projects.json                 the tabs, mode, reply route, status; site info for the "+" briefs
data/<project>/index.json          title, rules, chats (id8 only), milestones, groups, revisions
                                   (a milestone may carry wbs, bench, keeps, cap, canDo, capSrc: a WBS step and what the user can do;
                                    actions and fixture items may carry milestone: the WBS step they belong to)
data/<project>/cards.json          agent blocks
data/<project>/actions.json        decisions for the Owner
data/<project>/fixtures.json       grounding fixtures (ten lists)
data/<project>/nudges.json         Nudge + lines and their status (open, done by whom and when, withdrawn)
data/<project>/audit.json          the Timeline: append-only, one entry per change
```

No chat link, Drive link, email or token belongs here. Chat ids are the short id only. The checker refuses the rest.
To make chat ids clickable in one browser, open the page once with a private setup link
(`python tools/pp_links.py links.private.json --page <page url>`); the part after `#` is never sent to a server.

## Run it

```
python -m http.server 8765
```

then open http://127.0.0.1:8765/. `?data=<folder url>` points the page at another data folder.

## One local file (works offline and in previews)

```
python tools/pp_cli.py local progress-local.html --links links.private.json --prerender "<path to msedge.exe or chrome.exe>"
```

The file embeds the page and a snapshot of `data/`. With scripts on it shows the snapshot at once, then reads the live data.
With `--prerender` it also holds a static copy (expandable sections) that still shows when a viewer blocks scripts.
A file built with `--links` holds private chat links: keep it on your machine, never commit it.

## Tests

```
python -B -m unittest discover -s tests -v
```

### CIIFR ROI hygiene (Issue #31)

The CIIFR **High ROI · prospective** and **Medium ROI · conditional** views on Project Home → Architecture and sources and on Grounding fixtures are a **read-only projection** of existing ten-list fixtures, not a new schema, milestone or audited data mutation. The original 18 `highRoi` records remain intact and discoverable under **Original High-ROI source inventory**, including source links, indices, historical receipts, vendor references and governance rules. Four prospective High and four conditional Medium opportunity groups are backed by audited `highRoi`, `roadmap`, `pending` or `knownIssues` records, and conceptual E0/E1 and RIGID duplicates appear only once in the current-priority views.

The classifier in `roi.js` validates original list position, status and opening text, **fails closed** for moved/changed/new records, and shows a visible classification warning rather than promoting unknown evidence. A later data-model migration to `mediumRoi` would require a separate ten-list-contract revision and audited `pp_cli.py fixture` operations, with full reviewer approval. Nothing here confers Writer, TARGET1, E2–E6 or native CAESAR acceptance authority, replaces WBS3/WBS4 milestones, or asserts measured savings. Source classifications use impact, likelihood, effort, dependencies and native evidence; engineering controls remain separate. Generate exact original-text SHA-256 inventory for review with `node tools/ciifr_roi_inventory.mjs`.

## Live-browser acceptance (deployed page, not a PR preview)

The on-demand `Agent Start live browser acceptance` workflow uses headless Chromium to exercise the **published GitHub Pages URL** with anonymous desktop and 390×844 mobile contexts. It verifies exact deployed viewer version against the checked-out `index.html`, task-before-fold, no horizontal overflow, source popup destination, source-backed copy handoff, WBS 3/4/5 HOLD, WBS browser navigation and Back, G0 onboarding disclosure, and explicit NOT_RECORDED candidate identity. Results include screenshots, the copied handoff and machine-readable `report.json` as a 14-day workflow artifact. It is *not* a human comprehension trial, an independent engineering PASS, or Owner acceptance. Trigger manually after a successful Pages deployment, or run on the dedicated QA branch; **do not treat a green live-main run as validation of unmerged PR code**.

## Source observation -> reviewed Page update (no duplicate report)

Use the original GitHub URL **once**. The proposal generator observes a PR/issue/comment, binds its exact head or revision timestamp, and prepares only one **reference-only** `card set` change; it never interprets claim meaning or changes a card's state, actor, next action, capability, engineering PASS, or Owner acceptance. A unique native URL match can select an existing card; ambiguous/unmatched sources require explicit `--card`. Existing recorded evidence and PR-head drift fail closed.

```sh
python tools/pp_cli.py propose --project ciifr --source https://github.com/OWNER/REPO/pull/185 --actor Oracle --card geo-g1 --output proposal.json
python tools/pp_batch.py proposal.json --data data           # dry run and review proposed diff/audit
python tools/pp_batch.py proposal.json --data data --apply --base origin/main
```

Before apply, the batch tool re-fetches the proposal's native source to reject stale PR heads or edited issues/comments. The operator still verifies meaning, scope, the exact head and permission, reviews the dry run and publishes only via an authorized GitHub PR. No background monitoring or automatic approval is implied.

## Desktop Agent Start
At >=1100px, WBS workstreams are three equal-width choices, milestone options form a two-column grid, and scoped actions appear in a wider primary panel with source identity, Owner wording and rules in a separate sidebar. Mobile retains a linear task-first reading order. This changes presentation, not stored WBS data.

## Shared desktop layout across all projects (v28)

The full site—not only Agent Start—uses a wider responsive desktop shell. On Progress / WBS, Project Home, Actions, Fixtures, Timeline and other project sections, the primary view selector appears before scoped WBS filters; the project Owner aim, methods and optional private-chat setup remain accessible through disclosures instead of occupying the first screen on every view. Project Home still shows the full original Owner aim. The WBS family grid uses four consistent desktop columns, three tablet columns, and one mobile column; agent cards, decisions and fixtures wrap long source text rather than forcing page overflow. Historical revision routes, evidence references, mobile/desktop navigation and read-only governance remain unchanged.

To check all affected view types against PR code before merging, run the `All project tabs desktop layout` workflow: it tests Doc to Table, CIIFR, G9 and the Lessons reading views at PC/tablet/phone sizes, including dark mode screenshot evidence. It is a rendering regression, not an Owner or engineering acceptance test.
