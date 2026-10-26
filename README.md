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
```

Every write needs `--actor` (who), `--src` (a public GitHub link, or `OWNER_PRIVATE_REF:<id>`) and a reason. It writes one Timeline entry, runs the checker,
and leaves every file as it was if the check fails. Nothing is deleted: supersede, cancel, archive or withdraw. Use plain `python` (not `python -I`).

## What the page shows

- Project tabs, `+` to add a project (a copy-paste brief for another agent), **Archived (n)** for closed projects.
- **Aim** first (Owner, 22 Oct 2026, Lesson 1): every active tab shows the Owner's aim under its title, with its source; the checker refuses an active project without one (`project add --aim`, `project aim`). Under it, **How we work** links the Common agent-work modules.
- **Who writes what:** the coordinator writes agent blocks, decisions and revisions; the project's **Oracle sets the milestones** (`plan milestone`; placing a block with `card set --milestone` alone keeps the block's evidence time and source); **anybody may add grounding fixtures** under their own name; an Oracle may push its own project's data.
- **Revisions** row: R1, R2 ... A revision is added only when an Owner decision changes direction. Older ones open read-only from GitHub history.
- **Project Home**: compact Overview, Roadmap, Sources and Risks & handoffs pages; long source lists start collapsed and can be searched. Original fixtures and native issues remain authoritative; roadmap entries are plans, not engineering PASS.
- **Progress / WBS**: first select a numbered WBS family (1 / 2 / 3 / …), then its 3.0 / 3.1 / … subtabs; unnumbered M-series milestones remain under **Other milestones**. All WBS is a compact family overview, not a 23-item navigation strip. The selection filters relevant agents, actions, fixtures and timeline; native milestone IDs and evidence stay unchanged. Attention counts remain project-wide. Existing `#/project/progress` URLs continue to open operational progress; `#/project/home[-roadmap|-sources|-risks]` opens the relevant Home section. G0 onboarding is shown once as a collapsed WBS 3.0 disclosure; expanding it reveals evidence and the original task card without a duplicate global panel.
  Superseded and cancelled blocks stay, greyed, with the reason. **Nudge +** on each block queues instructions for the coordinator (OTM or the Oracle), not for the agent.
  Historical revision links use that revision's immutable GitHub snapshot for the Owner aim, WBS families/children, milestones, cards and sources; never fill a missing R1/R2/R3 snapshot from current R4. WBS selections are revision-scoped, shareable links such as `#/ciifr/progress/R3/wbs%3A3/M13`; Back/Forward restores the exact selection.
- **My actions** remains a primary tab. **Grounding fixtures** and **Timeline** are under **Project Home** as subtabs; existing `#/project/fixtures[/revision]` and `#/project/timeline[/revision]` deep links still work, including revision-scoped WBS links.

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
