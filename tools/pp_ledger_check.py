"""Timeline (ledger) checks for one project: the chain, every event, and agreement with the current data."""
import pp_lib as L

TOLERANCE = 60  # seconds a card's updatedAt may be later than the Timeline entry that records it


def _card_event(c, at, e, cards, chats, st):
    cid, kind = e["card"], e.get("kind")
    if cid not in cards:
        return c.err(at, f"card {cid!r} is not in cards.json")
    if kind not in L.CARD_KINDS:
        return c.err(at, f"{kind} cannot be recorded on a card; use " + ", ".join(L.CARD_KINDS))
    if cid in st["closed"]:
        c.err(at, f"card {cid!r} was already superseded or cancelled; nothing may follow")
    before, after, prev = e.get("before"), e.get("after"), st["last"].get(cid)
    if kind == "BASELINE":
        if cid in st["last"] or before is not None:
            c.err(at, "BASELINE is the first event of a card and has before = null")
    elif cid not in st["last"]:
        c.err(at, f"the first event of card {cid!r} must be BASELINE")
    elif before != prev:
        c.err(at, f"before is {before!r} but the card was {prev!r}")
    if after not in L.STATES:
        c.err(at, "after must be one of the states")
    if kind == "STATE" and before == after:
        c.err(at, "STATE must change the state; use UPDATE")
    if kind in ("UPDATE", "TRANSFER") and before != after:
        c.err(at, f"{kind} keeps the state; use STATE")
    if kind in ("SUPERSEDE", "CANCEL"):
        st["closed"].add(cid)
        if after != "NOT_APPLICABLE":
            c.err(at, f"{kind} ends in NOT_APPLICABLE")
        if kind == "SUPERSEDE" and e.get("to") not in cards:
            c.err(at, "SUPERSEDE needs to = the card that replaces it")
    if kind == "TRANSFER":
        for f in ("from", "to"):
            if e.get(f) not in chats:
                c.err(at, f"TRANSFER {f} must be a chat key from index.json")
        st["transfer"][cid] = e.get("to")
    st["last"][cid] = after
    st["last_ev"][cid] = (e.get("source"), L.parse_iso(e.get("at")))


def _project_event(c, at, e, st):
    kind = e.get("kind")
    if kind not in L.PROJECT_KINDS:
        return c.err(at, f"{kind} needs a card, an action or a list; project events are " + ", ".join(L.PROJECT_KINDS))
    status = st["status"]
    if kind == "REVISION":
        want = f"R{len(st['revs']) + 1}"
        if e.get("revision") != want or e.get("rev") != want:
            c.err(at, f"REVISION must name {want} in both revision and rev")
        st["revs"].append(e.get("revision"))
    elif kind in ("ARCHIVE", "SUPERSEDE", "CANCEL"):
        if status != "active":
            c.err(at, f"the project is already {status}")
        st["status"] = {"ARCHIVE": "archived", "SUPERSEDE": "superseded", "CANCEL": "cancelled"}[kind]
        if kind == "SUPERSEDE" and not e.get("to"):
            c.err(at, "project SUPERSEDE needs to = the project that replaces it")
    elif kind == "RESTORE":
        if status == "active":
            c.err(at, "RESTORE on a project that is active")
        st["status"] = "active"
    elif kind in ("PLAN", "TRANSFER") and not e.get("scope" if kind == "PLAN" else "to"):
        c.err(at, "PLAN needs scope (for example milestone:M1)" if kind == "PLAN" else "project TRANSFER needs to = the new coordinator or mode")


def _nudge_event(c, at, e, nudges, st):
    nid, op = e.get("nudge"), e.get("op")
    if nid not in nudges or op not in L.NUDGE_OPS:
        return c.err(at, "NUDGE needs nudge = an id from nudges.json and op = add, done or withdraw")
    ops = st["nudge"].setdefault(nid, [])
    if (op == "add") != (not ops) or (ops and ops[-1][0] != "add"):
        c.err(at, f"nudge {nid} cannot take op {op!r} after {[o for o, _ in ops] or 'nothing'}: add first, then done or withdraw once")
    ops.append((op, e.get("source")))


def _nudge_state(c, w, nudges, st):
    names = {"add": "open", "done": "done", "withdraw": "withdrawn"}
    for nid, n in nudges.items():
        ops = st["nudge"].get(nid)
        if not ops:
            c.err(w, f"nudge {nid} has no Timeline entry")
            continue
        if names[ops[-1][0]] != n.get("status"):
            c.err(w, f"nudge {nid}: the Timeline ends at {names[ops[-1][0]]} but nudges.json says {n.get('status')}")
        last_field = {"done": "doneSrc", "withdraw": "withdrawnSrc"}.get(ops[-1][0])
        wanted = [("src", ops[0][1])] + ([(last_field, ops[-1][1])] if last_field else [])
        for field, src in wanted:
            if n.get(field) != src:
                c.err(w, f"nudge {nid}: {field} differs from the source of its Timeline entry")


def _events(c, w, key, docs, st):
    index, cards, actions = docs["index"], docs["cards"], docs["actions"]
    revs, chats = [r["id"] for r in index.get("revisions") or []], index.get("chats") or {}
    prev_id, rev_no = None, 0
    for i, e in enumerate(docs["audit"]["events"], 1):
        at = f"{w} event {i}"
        if e.get("seq") != i or e.get("id") != f"{key.upper()}-R-{i:04d}" or e.get("previous_id") != prev_id:
            c.err(at, "the chain is broken (seq, id or previous_id)")
        prev_id = e.get("id")
        c.member(at, e, "kind", L.EVENT_KINDS)
        t = L.parse_iso(c.stamp(at, e, "at"))
        st["newest"] = max(st["newest"], t) if st["newest"] and t else (t or st["newest"])
        c.text(at, e, "actor", limit=60)
        c.text(at, e, "summary", limit=400)
        c.link(at, e, "source", source=True)
        if revs:
            n = int(e["rev"][1:]) if e.get("rev") in revs else None
            if n is None:
                c.err(at, "rev must be one of " + ", ".join(revs))
            elif n < rev_no:
                c.err(at, "an event may not belong to an earlier revision than the event before it")
            rev_no = max(rev_no, n or 0)
        if st["status"] != "active" and e.get("kind") != "RESTORE":
            c.err(at, f"the project is {st['status']}; only RESTORE is allowed until it is active again")
        if "card" in e:
            _card_event(c, at, e, cards, chats, st)
        elif e.get("kind") in ("ANSWER", "ACTION"):
            if e.get("action") not in actions:
                c.err(at, f"{e.get('kind')} needs action = a key from actions.json")
            if e.get("kind") == "ANSWER":
                st["answered"].add(e.get("action"))
        elif e.get("kind") == "NUDGE":
            _nudge_event(c, at, e, docs["nudges"].get("nudges") or {}, st)
        elif e.get("kind") == "FIXTURE":
            if e.get("list") not in L.FIXTURE_LISTS:
                c.err(at, "FIXTURE needs list = one of the fixture lists")
        else:
            _project_event(c, at, e, st)


def check_ledger(c, key, entry, docs):
    w = f"{key}/audit.json"
    led, index, cards, actions = docs["audit"], docs["index"], docs["cards"], docs["actions"]
    if led.get("schema") != L.LEDGER_SCHEMA or led.get("project") != key:
        c.err(w, f"schema must be {L.LEDGER_SCHEMA} and project {key!r}")
    if not isinstance(led.get("events"), list) or not led["events"]:
        return c.err(w, "events must be a non-empty list")
    st = {"last": {}, "last_ev": {}, "closed": set(), "transfer": {}, "status": "active", "revs": [], "newest": None, "answered": set(), "nudge": {}}
    _events(c, w, key, docs, st)
    if (entry.get("status") or "active") != st["status"]:
        c.err(f"projects.json project {key!r}", f"status is {entry.get('status') or 'active'} but the Timeline says {st['status']}")
    if index.get("revisions") and st["revs"] != [r.get("id") for r in index["revisions"]]:
        c.err(w, "every revision needs exactly one REVISION event, in order")
    for cid, card in cards.items():
        if cid not in st["last"]:
            c.err(w, f"card {cid!r} has no event")
            continue
        src, when = st["last_ev"][cid]
        if st["last"][cid] != card.get("state"):
            c.err(w, f"card {cid!r}: the Timeline ends at {st['last'][cid]} but the card says {card.get('state')}")
        if card.get("src") and card["src"] != src:
            c.err(w, f"card {cid!r}: src differs from the source of its latest Timeline entry")
        up = L.parse_iso(card.get("updatedAt"))
        if up and when and (up - when).total_seconds() > TOLERANCE:
            c.err(w, f"card {cid!r}: updatedAt is later than the Timeline entry that records it")
        if (cid in st["closed"]) != (card.get("closed") is not None):
            c.err(w, f"card {cid!r}: the closed marking and the Timeline disagree")
        if cid in st["transfer"] and (card.get("who") or {}).get("chat") != st["transfer"][cid]:
            c.err(w, f"card {cid!r}: who.chat is not the chat its latest TRANSFER names")
    _nudge_state(c, w, docs["nudges"].get("nudges") or {}, st)
    first = L.parse_iso(led["events"][0].get("at"))
    for ak, a in actions.items():
        ans = L.parse_iso((a.get("answer") or {}).get("at"))
        if a.get("status") == "done" and ans and first and ans > first and ak not in st["answered"]:
            c.err(w, f"action {ak!r} was answered after the Timeline began but has no ANSWER event")
    tab = L.parse_iso((index.get("project") or {}).get("updatedAt"))
    if st["newest"] and tab and (st["newest"] - tab).total_seconds() > TOLERANCE:
        c.err(f"{key}/index.json", "project.updatedAt is older than the newest Timeline entry")
