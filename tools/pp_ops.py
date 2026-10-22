"""Project-level operations: add a project, edit its plan, add a revision, archive, restore, supersede, cancel, transfer.

Every operation writes its files, records one Timeline entry (who, what, why, source) and runs the checker;
if the check fails, nothing stays written."""
from pathlib import Path

import pp_lib as L


def open_project(data, key):
    root = Path(data) / key
    if not root.is_dir():
        raise SystemExit(f"No project {key!r} under {data}. Add it first: pp_cli.py project add --key {key} ...")
    return root, {f: L.read_json(root / f"{f}.json") for f in L.FILES}


def save(txn, root, docs, names=L.FILES):
    for n in names:
        txn.write(root / f"{n}.json", docs[n])


def record(docs, key, kind, actor, summary, source, **extra):
    """Append one Timeline entry and move the project's 'updated' time and name."""
    ev = {"kind": kind, "actor": actor, "summary": summary, "source": source}
    ev.update({k: v for k, v in extra.items() if v is not None or k == "before"})
    out = L.append_event(docs["audit"], key, ev, L.current_rev(docs["index"]))
    docs["index"]["project"]["updatedAt"] = out["at"]
    docs["index"]["project"]["updatedBy"] = actor
    return out


def projects_doc(data):
    path = Path(data) / "projects.json"
    return (L.read_json(path) if path.exists() else {"schema": 3, "site": {}, "projects": []}), path


def add_project(data, key, title, label, mode, coordinator, subtitle, actor, src, owner_words, why, reply):
    if not L.KEY.match(key):
        raise SystemExit("key must be lower-case letters, digits and -")
    doc, path = projects_doc(data)
    if any(p["key"] == key for p in doc["projects"]) or (Path(data) / key).exists():
        raise SystemExit(f"Project {key!r} already exists.")
    now = L.now_iso()
    docs = {
        "index": {"schema": 3, "project": {"key": key, "title": title, "subtitle": subtitle or "", "updatedAt": now, "updatedBy": actor, "staleAfterMin": 120},
                  "rules": {"coordinator": coordinator, "quietAfterMin": 30, "idleAfterMin": 15, "owesAfterMin": 15, "waitingAfterMin": 15},
                  "chats": {},
                  "milestones": {m: {"order": i, "name": n, "full": f} for i, (m, n, f) in enumerate(
                      (("M1", "Plan", "Plan and approvals"), ("M2", "Build", "Work in progress"), ("M3", "Review", "Review and decisions"), ("M4", "Accept", "Owner acceptance")), 1)},
                  "groups": {"main": {"order": 1, "title": "Work"}},
                  "revisions": [{"id": "R1", "at": now, "by": actor, "why": why, "ownerWords": owner_words, "src": src, "status": "current"}]},
        "cards": {}, "actions": {}, "fixtures": {n: [] for n in L.FIXTURE_LISTS}, "nudges": {"schema": 3, "nudges": {}},
        "audit": {"schema": L.LEDGER_SCHEMA, "project": key, "baseline_at": now,
                  "scope": "Ledger of published Progress maintenance from this declared baseline; not a reconstruction of historic agent execution.", "events": []},
    }
    record(docs, key, "REVISION", actor, why, src, revision="R1", scope="project")
    doc["projects"].append({"key": key, "label": label or title, "order": max([p.get("order", 0) for p in doc["projects"]] + [0]) + 1,
                            "mode": mode, "replyTo": reply or {"kind": "none"}})
    txn = L.Txn()
    txn.mkdir(Path(data) / key)
    save(txn, Path(data) / key, docs)
    txn.write(path, doc)
    L.finish(txn, data)
    return f"Added project {key} (revision R1). Next: add chats, milestones and groups with 'plan', then cards with 'card set'."


def plan(data, key, what, ident, fields, actor, summary, src):
    """Create or edit a milestone, a group or a chat of the project."""
    root, docs = open_project(data, key)
    table = {"milestone": "milestones", "group": "groups", "chat": "chats"}[what]
    item = docs["index"].setdefault(table, {}).setdefault(ident, {})
    item.update({k: v for k, v in fields.items() if v is not None})
    record(docs, key, "PLAN", actor, summary, src, scope=f"{what}:{ident}")
    txn = L.Txn()
    save(txn, root, docs, ("index", "audit"))
    L.finish(txn, data)
    return f"Recorded {what} {ident}."


def revision_add(data, key, why, owner_words, src, actor):
    """A new plan revision, only because an Owner decision changed direction. The old one keeps its words and its commit."""
    root, docs = open_project(data, key)
    revs = docs["index"]["revisions"]
    old = revs[-1]
    if old["status"] != "current":
        raise SystemExit("The project has no current revision to supersede.")
    head = L.git_head(data)
    if head is not None and _dirty(data):
        raise SystemExit("Commit the current data first, so the old revision can be opened from its commit.")
    old["status"], old["commit"] = "superseded", head
    new = {"id": f"R{len(revs) + 1}", "at": L.now_iso(), "by": actor, "why": why, "ownerWords": owner_words, "src": src, "status": "current", "supersedes": old["id"]}
    revs.append(new)
    record(docs, key, "REVISION", actor, why, src, revision=new["id"], supersedes=old["id"], scope="project")
    txn = L.Txn()
    save(txn, root, docs, ("index", "audit"))
    L.finish(txn, data)
    return f"Revision {new['id']} is current; {old['id']} is superseded" + (f" (snapshot commit {head})." if head else ".")


def _dirty(data):
    import subprocess
    out = subprocess.run(["git", "-C", str(data), "status", "--porcelain", "--", str(Path(data).resolve())], capture_output=True, text=True, timeout=30)
    return bool(out.stdout.strip())


def lifecycle(data, key, kind, why, actor, src, to=None):
    """ARCHIVE, RESTORE, SUPERSEDE or CANCEL a whole project. Nothing is deleted; the tab moves to 'Archived'."""
    root, docs = open_project(data, key)
    doc, path = projects_doc(data)
    entry = next(p for p in doc["projects"] if p["key"] == key)
    status = {"ARCHIVE": "archived", "SUPERSEDE": "superseded", "CANCEL": "cancelled", "RESTORE": "active"}[kind]
    if kind == "SUPERSEDE" and (not to or to == key or to not in [p["key"] for p in doc["projects"]]):
        raise SystemExit("--by must name another existing project key.")
    for f in ("statusWhy", "statusAt", "statusBy", "statusSrc", "supersededBy"):
        entry.pop(f, None)
    if kind == "RESTORE":
        entry["status"] = "active"
    else:
        entry.update({"status": status, "statusWhy": why, "statusAt": L.now_iso(), "statusBy": actor, "statusSrc": src})
        if to:
            entry["supersededBy"] = to
    record(docs, key, kind, actor, why, src, scope="project", to=to)
    txn = L.Txn()
    save(txn, root, docs, ("index", "audit"))
    txn.write(path, doc)
    L.finish(txn, data)
    return f"Project {key} is now {status}."


def transfer(data, key, to_coordinator, to_mode, reply_target, why, actor, src):
    """Hand the whole project to another coordinator (for example OTM to an Oracle). It stays active."""
    root, docs = open_project(data, key)
    doc, path = projects_doc(data)
    entry = next(p for p in doc["projects"] if p["key"] == key)
    docs["index"].setdefault("rules", {})["coordinator"] = to_coordinator
    if to_mode:
        entry["mode"] = to_mode
    if reply_target and entry.get("replyTo", {}).get("kind") == "github-issue":
        entry["replyTo"]["target"] = reply_target
    record(docs, key, "TRANSFER", actor, why, src, scope="project", to=f"{to_mode or entry['mode']}:{to_coordinator}")
    txn = L.Txn()
    save(txn, root, docs, ("index", "audit"))
    txn.write(path, doc)
    L.finish(txn, data)
    return f"Project {key} is now coordinated by {to_coordinator}."
