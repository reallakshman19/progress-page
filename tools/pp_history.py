"""Compare a data folder with an earlier git revision (used by pp_check.py --base).

The Timeline may only grow, no card, decision or project may disappear, a revision keeps its words, and a project
whose files changed must have gained Timeline entries. This is the part of the protocol a pull request cannot skip."""
import json
import subprocess
from pathlib import Path

import pp_lib as L

REV_FIXED = ("id", "at", "by", "why", "ownerWords", "src", "supersedes")


def _git(args, cwd):
    out = subprocess.run(["git", "-C", str(cwd)] + args, capture_output=True, text=True, timeout=60)
    return out.stdout if out.returncode == 0 else None


def _at_base(top, ref, rel):
    text = _git(["show", f"{ref}:{rel}"], top)
    return json.loads(text) if text else None


def check_against_base(data, ref):
    data = Path(data).resolve()
    top = _git(["rev-parse", "--show-toplevel"], data)
    if not top:
        return [f"{data}: not inside a git repository, so --base {ref} cannot be used"]
    top = Path(top.strip()).resolve()
    if _git(["rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}"], top) is None:
        return [f"--base {ref}: no such commit in this repository, so nothing could be compared"]
    rel = data.relative_to(top).as_posix()
    base_doc = _at_base(top, ref, f"{rel}/projects.json")
    if base_doc is None:
        return []
    errs = []
    now_entries = {p["key"]: p for p in L.read_json(data / "projects.json")["projects"]}
    now_keys = set(now_entries)
    for p in base_doc["projects"]:
        key = p["key"]
        if key not in now_keys:
            errs.append(f"projects.json: project {key!r} was removed; archive it instead")
            continue
        old = {f: _at_base(top, ref, f"{rel}/{key}/{f}.json") for f in L.FILES}
        new = {f: L.read_json(data / key / f"{f}.json") for f in L.FILES}
        if any(v is None for v in old.values()):
            continue
        errs += _project(key, old, new, entry_changed=p != now_entries[key])
    return errs


def _project(key, old, new, entry_changed=False):
    errs = []
    for what, name in (("cards", "card"), ("actions", "decision")):
        gone = sorted(set(old[what]) - set(new[what]))
        if gone:
            errs.append(f"{key}/{what}.json: {name} {gone[0]!r} was deleted; supersede or cancel it instead")
    gone = sorted(set(old["nudges"]["nudges"]) - set(new["nudges"]["nudges"]))
    if gone:
        errs.append(f"{key}/nudges.json: nudge {gone[0]!r} was deleted; withdraw it instead")
    old_ev, new_ev = old["audit"]["events"], new["audit"]["events"]
    if new_ev[:len(old_ev)] != old_ev:
        errs.append(f"{key}/audit.json: an earlier Timeline entry was changed or removed; the Timeline only grows")
    for r in old["index"].get("revisions") or []:
        now = next((x for x in new["index"].get("revisions") or [] if x.get("id") == r["id"]), None)
        if now is None or any(now.get(f) != r.get(f) for f in REV_FIXED):
            errs.append(f"{key}/index.json: revision {r['id']} was changed; a revision keeps its words")
    changed = entry_changed or any(old[f] != new[f] for f in ("index", "cards", "actions", "fixtures", "nudges"))
    if changed and len(new_ev) <= len(old_ev):
        errs.append(f"{key}: data changed but the Timeline gained no entry (use tools/pp_cli.py so it is recorded)")
    return errs
