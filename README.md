# Progress page (DRAFT preview)

An independent Progress page for projects run with OTM or standalone with an Oracle and its agents.
It is a static page: no build step, no database. It reads plain JSON files from `data/`.

Status: DRAFT preview, built by OTM as the visual spec. The production viewer, checker and tools follow as a sealed work order.

## What you see

Project tabs. For each project, three views:

- **Progress**: a milestone strip, then groups of agent blocks (status, next step, "updated X ago", issue, PR and chat links).
- **My actions**: the Owner's open decisions, each with options, a copy-ready reply and a prefilled Send link.
- **Grounding fixtures**: the sources and starting context any agent or Oracle should read first.

## Data (public-safe only)

```
data/projects.json                 the project tabs
data/<project>/index.json          title, chats (id8 only), milestones, groups, last update
data/<project>/cards.json          the agent blocks, each with a milestone, a state, a source and an event time
data/<project>/actions.json        the Owner's decision cards
data/<project>/fixtures.json       grounding fixtures (ten lists)
data/<project>/audit.json          append-only ledger of card states, each event with a public source
```

No chat link, Drive link, email or private text belongs here. Chat ids are the first 8 characters only.
The page can show chat links if you load your own `{ "<id8>": "https://..." }` map with "My links"; it stays in your browser.

## Run it

```
python -m http.server 8765
```

then open http://127.0.0.1:8765/. Use `?data=<folder url>` to point the page at another data folder.
