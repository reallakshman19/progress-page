"""Checks for cards.json, actions.json, fixtures.json and nudges.json of one project."""
import pp_lib as L

CARD_LOOK = ("done", "working", "waiting", "hold", "idle", "gap")
CHIP_COLORS = ("n", "w", "d", "s")
REF_KINDS = ("issue", "comment", "pr")


def check_cards(c, key, index, cards):
    w = f"{key}/cards.json"
    if not isinstance(cards, dict):
        c.err(w, "expected an object of cards")
        return
    chats = index.get("chats") or {}
    for cid, card in cards.items():
        at = f"{w} card {cid!r}"
        if not L.CARD_ID.match(cid):
            c.err(at, "card id must be letters, digits, - or _")
        c.integer(at, card, "order")
        c.member(at, card, "group", index.get("groups") or {})
        c.member(at, card, "milestone", index.get("milestones") or {})
        c.text(at, card, "label", limit=40)
        state = c.member(at, card, "state", L.STATES)
        c.text(at, card, "now", limit=700)
        nxt = card.get("next")
        if nxt is not None and (not isinstance(nxt, dict) or not nxt.get("actor") or not isinstance(nxt.get("text"), str)):
            c.err(at, "next, when present, needs an actor (use - for none) and a text")
        if state != "NOT_STARTED":
            c.stamp(at, card, "updatedAt")
            c.link(at, card, "src", source=True)
        who = card.get("who") or {}
        for f in ("chat", "from"):
            if who.get(f) is not None and who[f] not in chats:
                c.err(at, f"who.{f} {who[f]!r} is not in chats")
        for r in card.get("refs") or []:
            c.member(at + " ref", r, "k", REF_KINDS)
            c.text(at + " ref", r, "l", limit=60)
            c.link(at + " ref", r, "u")
        for e in card.get("edges") or []:
            if e.get("to") not in cards or e.get("to") == cid:
                c.err(at, f"edge to {e.get('to')!r} must name another card")
            c.member(at + " edge", e, "k", L.EDGE_KINDS)
        for f in card.get("flags") or []:
            if f not in L.FLAGS:
                c.err(at, f"flag {f!r} is not one of " + ", ".join(L.FLAGS))
        for ch in card.get("chips") or []:
            c.text(at + " chip", ch, "t", limit=40)
            c.member(at + " chip", ch, "c", CHIP_COLORS, opt=True)
        c.member(at, card, "kind", CARD_LOOK, opt=True)
        closed = card.get("closed")
        if closed is not None:
            c.member(at + " closed", closed, "kind", ("superseded", "cancelled"))
            c.text(at + " closed", closed, "why", limit=240)
            c.stamp(at + " closed", closed, "at")
            c.link(at + " closed", closed, "src", source=True)
            if state != "NOT_APPLICABLE":
                c.err(at, "a superseded or cancelled card must have state NOT_APPLICABLE")
            if closed.get("kind") == "superseded" and closed.get("by") not in cards:
                c.err(at, "closed.by must name the card that replaces it")


def check_actions(c, key, actions, index=None):
    w = f"{key}/actions.json"
    if not isinstance(actions, dict):
        c.err(w, "expected an object of decision cards")
        return
    for ak, a in actions.items():
        at = f"{w} action {ak!r}"
        c.integer(at, a, "order")
        status = c.member(at, a, "status", ("open", "done"))
        _step(c, at, a, index)
        c.text(at, a, "title", limit=160)
        c.text(at, a, "lead", limit=1200)
        opts = a.get("options") or []
        if status == "open" and not opts:
            c.err(at, "an open decision needs at least one option")
        if status == "open" and sum(1 for o in opts if o.get("suggested")) != 1:
            c.err(at, "an open decision needs exactly one suggested option")
        for o in opts:
            for f in ("key", "label", "body", "reply"):
                c.text(at + " option", o, f)
        for lk in a.get("links") or []:
            c.text(at + " link", lk, "l")
            c.link(at + " link", lk, "u")
        for t in a.get("tables") or []:
            if any(len(r) != len(t.get("cols") or []) for r in t.get("rows") or []):
                c.err(at, "every table row must have as many cells as columns")
        if status == "done":
            ans = a.get("answer") or {}
            c.text(at + " answer", ans, "text")
            c.stamp(at + " answer", ans, "at")
            c.link(at + " answer", ans, "ref", source=True)


def _step(c, at, item, index):
    """An action or fixture may belong to one WBS step (a milestone of the project); without one it is project-wide."""
    if item.get("milestone") is not None:
        c.member(at, item, "milestone", list(((index or {}).get("milestones") or {}).keys()))


def check_fixtures(c, key, fixtures, index=None):
    w = f"{key}/fixtures.json"
    for name, items in (fixtures or {}).items():
        if name not in L.FIXTURE_LISTS:
            c.err(w, f"unknown list {name!r}; use " + ", ".join(L.FIXTURE_LISTS))
            continue
        for it in items:
            c.text(f"{w} {name}", it, "t", limit=400)
            c.link(f"{w} {name}", it, "u", opt=True)
            c.text(f"{w} {name}", it, "s", opt=True, limit=40)
            c.text(f"{w} {name}", it, "n", opt=True, limit=40)
            _step(c, f"{w} {name}", it, index)


def check_nudges(c, key, cards, doc):
    w = f"{key}/nudges.json"
    items = doc.get("nudges")
    if doc.get("schema") != 3 or not isinstance(items, dict):
        return c.err(w, "expected schema 3 and a nudges object")
    for i, (nid, n) in enumerate(items.items(), 1):
        at = f"{w} nudge {nid!r}"
        if nid != f"N{i}":
            c.err(at, f"id must be N{i}, in order")
        c.member(at, n, "card", cards)
        c.text(at, n, "text", limit=400)
        c.text(at, n, "by", limit=60)
        c.stamp(at, n, "at")
        c.link(at, n, "src", source=True)
        status = c.member(at, n, "status", L.NUDGE_STATUS)
        for state in ("done", "withdrawn"):
            if status == state:
                c.text(at, n, state + "By", limit=60)
                c.stamp(at, n, state + "At")
                c.link(at, n, state + "Src", source=True)
