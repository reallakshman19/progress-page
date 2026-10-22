"""Card, decision and fixture operations. Each one records a Timeline entry and runs the checker."""
import pp_lib as L
from pp_ops import open_project, record, save


def _write(data, root, docs, names):
    txn = L.Txn()
    save(txn, root, docs, names)
    L.finish(txn, data)


def _ref(text):
    parts = text.split("|")
    if len(parts) not in (3, 4):
        raise SystemExit("--ref must be kind|label|https-url or kind|label|https-url|status")
    out = {"k": parts[0], "l": parts[1], "u": parts[2]}
    if len(parts) == 4:
        out["s"] = parts[3]
    return out


def card_set(data, key, cid, actor, src, summary, at=None, label=None, group=None, milestone=None, state=None, now=None,
             next_actor=None, next_text=None, chat=None, role=None, flags=None, refs=None, edges=None, order=None):
    """Create a card (BASELINE) or change it (STATE when the state moves, UPDATE otherwise)."""
    root, docs = open_project(data, key)
    cards, index = docs["cards"], docs["index"]
    old = cards.get(cid)
    if old and old.get("closed"):
        raise SystemExit(f"Card {cid!r} is {old['closed']['kind']} and final. Add a new card instead.")
    card = dict(old) if old else {
        "order": max([c.get("order", 0) for c in cards.values()] + [0]) + 1,
        "group": sorted(index["groups"], key=lambda g: index["groups"][g]["order"])[0],
        "milestone": sorted(index["milestones"], key=lambda m: index["milestones"][m]["order"])[0],
        "label": cid, "who": {}, "state": "NOT_STARTED", "now": "", "next": {"actor": "-", "text": ""}}
    for name, val in (("label", label), ("group", group), ("milestone", milestone), ("state", state), ("now", now), ("order", order)):
        if val is not None:
            card[name] = val
    if next_actor is not None or next_text is not None:
        card["next"] = {"actor": next_actor or card["next"]["actor"], "text": next_text if next_text is not None else card["next"]["text"]}
    if chat is not None or role is not None:
        card["who"] = {**card.get("who", {}), **({"chat": chat} if chat else {}), **({"role": role} if role else {})}
    if flags is not None:
        card["flags"] = flags
    if refs:
        card["refs"] = (card.get("refs") or []) + [_ref(r) for r in refs]
    if edges:
        card["edges"] = (card.get("edges") or []) + [dict(zip(("to", "k"), e.split(":"))) for e in edges]
    when = at or L.now_iso()
    placed_only = (old is not None and at is None and any(v is not None for v in (group, milestone, order))
                   and all(v is None for v in (label, state, now, next_actor, next_text, chat, role, flags)) and not refs and not edges)
    if (card["state"] != "NOT_STARTED" or old) and not placed_only:
        card["updatedAt"], card["src"] = when, src
    if placed_only:   # a block placed in a milestone or group: a plan entry; the block keeps its evidence time and source
        cards[cid] = card
        where = f"milestone:{milestone}" if milestone is not None else (f"group:{group}" if group is not None else "order")
        record(docs, key, "PLAN", actor, summary, src, scope=where)
        _write(data, root, docs, ("index", "cards", "audit"))
        return f"Placed card {cid} ({where}); its time and source are unchanged."
    kind = "BASELINE" if old is None else ("STATE" if old["state"] != card["state"] else "UPDATE")
    cards[cid] = card
    record(docs, key, kind, actor, summary, src, card=cid, before=old["state"] if old else None, after=card["state"],
           source_at=at if at else None)
    _write(data, root, docs, ("index", "cards", "audit"))
    return f"{kind} recorded for card {cid} ({card['state']})."


def card_close(data, key, cid, kind, why, actor, src, by=None):
    """SUPERSEDE (replaced by another card) or CANCEL a card. It stays on the page, greyed, with its reason."""
    root, docs = open_project(data, key)
    card = docs["cards"].get(cid)
    if card is None:
        raise SystemExit(f"No card {cid!r} in {key}.")
    if card.get("closed"):
        raise SystemExit(f"Card {cid!r} is already {card['closed']['kind']}.")
    if kind == "SUPERSEDE" and (not by or by == cid or by not in docs["cards"]):
        raise SystemExit("--by must name another card of this project.")
    before, now = card["state"], L.now_iso()
    card["state"] = "NOT_APPLICABLE"
    card["closed"] = {"kind": "superseded" if kind == "SUPERSEDE" else "cancelled", "why": why, "at": now, "src": src, **({"by": by} if by else {})}
    card["next"], card["flags"], card["updatedAt"], card["src"] = {"actor": "-", "text": ""}, [], now, src
    record(docs, key, kind, actor, why, src, card=cid, before=before, after="NOT_APPLICABLE", to=by)
    _write(data, root, docs, ("index", "cards", "audit"))
    return f"Card {cid} is {card['closed']['kind']}."


def card_transfer(data, key, cid, to_chat, role, why, actor, src):
    """Move a card to another agent chat (a successor or a replacement). The old chat is kept as 'from'."""
    root, docs = open_project(data, key)
    card = docs["cards"].get(cid)
    if card is None or card.get("closed"):
        raise SystemExit(f"Card {cid!r} does not exist or is closed.")
    frm = (card.get("who") or {}).get("chat")
    if frm is None or to_chat not in docs["index"]["chats"]:
        raise SystemExit("The card needs a current chat, and --to-chat must be in the project's chats (add it with: plan chat).")
    now = L.now_iso()
    card["who"] = {**card["who"], "from": frm, "chat": to_chat, **({"role": role} if role else {})}
    card["updatedAt"], card["src"] = now, src
    record(docs, key, "TRANSFER", actor, why, src, card=cid, before=card["state"], after=card["state"], **{"from": frm, "to": to_chat})
    _write(data, root, docs, ("index", "cards", "audit"))
    return f"Card {cid} moved from {frm} to {to_chat}."


def action_add(data, key, akey, title, lead, options, suggested, actor, src, links=None):
    """Add an open decision card for the Owner. Each option is KEY|label|body|reply (the reply is what the Owner sends)."""
    root, docs = open_project(data, key)
    if akey in docs["actions"]:
        raise SystemExit(f"Decision {akey!r} exists.")
    opts = []
    for o in options:
        k, label, body, reply = (o.split("|", 3) + ["", "", "", ""])[:4]
        opts.append({"key": k, "label": label + (" (suggested)" if k == suggested else ""), "suggested": k == suggested, "body": body, "reply": reply})
    docs["actions"][akey] = {"order": max([a.get("order", 0) for a in docs["actions"].values()] + [0]) + 1, "status": "open", "title": title, "lead": lead,
                             "options": opts, "links": [{"l": x.split("|")[0], "u": x.split("|")[1]} for x in links or []]}
    record(docs, key, "ACTION", actor, f"Decision for the Owner: {title}", src, action=akey)
    _write(data, root, docs, ("index", "actions", "audit"))
    return f"Decision {akey} is open for the Owner."


def action_answer(data, key, akey, text, ref, actor, at=None):
    """Record the Owner's answer to a decision. ref is the public record of the Owner's words (an issue comment)."""
    root, docs = open_project(data, key)
    act = docs["actions"].get(akey)
    if act is None or act["status"] != "open":
        raise SystemExit(f"No open decision {akey!r} in {key}.")
    act["status"], act["answer"] = "done", {"text": text, "at": at or L.now_iso(), "ref": ref}
    record(docs, key, "ANSWER", actor, f"Owner answered {akey}: {text[:120]}", ref, action=akey)
    _write(data, root, docs, ("index", "actions", "audit"))
    return f"Decision {akey} answered."


def fixture_edit(data, key, lst, op, text, actor, src, summary, url=None, status=None, note=None):
    root, docs = open_project(data, key)
    items = docs["fixtures"].setdefault(lst, [])
    if op == "add":
        items.append({"t": text, **({"u": url} if url else {}), **({"s": status} if status else {}), **({"n": note} if note else {})})
    else:
        hit = next((i for i in items if i["t"] == text), None)
        if hit is None:
            raise SystemExit(f"No item with exactly that text in {lst}.")
        items.remove(hit)
    record(docs, key, "FIXTURE", actor, summary, src, list=lst, op=op)
    _write(data, root, docs, ("index", "fixtures", "audit"))
    return f"{op} recorded on {lst}."


def nudge_add(data, key, card, text, by, actor, src, at=None):
    """Queue one instruction for the coordinator to fold into its next message to the agent (the agent does not read it)."""
    root, docs = open_project(data, key)
    if card not in docs["cards"]:
        raise SystemExit(f"No card {card!r} in {key}.")
    items = docs["nudges"]["nudges"]
    nid = f"N{len(items) + 1}"
    items[nid] = {"card": card, "text": text, "by": by, "at": at or L.now_iso(), "src": src, "status": "open"}
    record(docs, key, "NUDGE", actor, f"Nudge for {card}: {text[:100]}", src, nudge=nid, op="add", target=card)
    _write(data, root, docs, ("index", "nudges", "audit"))
    return f"Nudge {nid} is open for {card}."


def nudge_close(data, key, nid, op, by, actor, src):
    """op 'done': the coordinator has put it in a sent nudge. op 'withdraw': the Owner took it back. The row stays."""
    root, docs = open_project(data, key)
    n = docs["nudges"]["nudges"].get(nid)
    if n is None or n["status"] != "open":
        raise SystemExit(f"No open nudge {nid!r} in {key}.")
    now = L.now_iso()
    pre = "done" if op == "done" else "withdrawn"
    n["status"] = pre
    n.update({pre + "By": by, pre + "At": now, pre + "Src": src})
    record(docs, key, "NUDGE", actor, f"Nudge {nid} {pre} by {by}", src, nudge=nid, op=op, target=n["card"])
    _write(data, root, docs, ("index", "nudges", "audit"))
    return f"Nudge {nid} is {pre}."
