#!/usr/bin/env python3
"""Check a Progress page data folder against contract v3 (standard library only).

Usage: python tools/pp_check.py [<data folder>] [--private] [--base <git ref>]
Prints one line per problem and exits 1; prints OK and exits 0 when clean.
--private allows chat links (for a private local folder, never for a public one).
--base <ref> also compares with an earlier git revision: the Timeline may only grow, nothing may be deleted,
and a project whose files changed must have gained Timeline entries (see pp_history.py).
"""
import argparse
import json
import unicodedata
import re
import sys
from pathlib import Path

import pp_lib as L
from urllib.parse import unquote
from pp_check_files import check_actions, check_cards, check_fixtures, check_nudges
from pp_ctx import Ctx
from pp_ledger_check import check_ledger

SECRETS = ((re.compile(r"(?:drive|docs)\.google\.com\b", re.I), "contains a Google Drive link"),
           (re.compile(r"(?:1drv\.ms|onedrive\.(?:live\.)?com|docs\.live\.net|sharepoint(?:-df)?\.(?:com|us|de|cn))\b", re.I),
            "contains a OneDrive or SharePoint link"),
           (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "contains an email address"),
           (re.compile(r"ghp_\w{20,}|github_pat_\w{20,}|sk-[A-Za-z0-9]{20,}"), "contains what looks like an access token"))
CHAT = re.compile(r"chatgpt\.com/c/|chat\.openai\.com|antigravity\.google\.com|claude\.ai/(?:chat|code)/")


def load(c, root, path):
    try:
        return L.read_json(path)
    except (OSError, ValueError) as exc:
        c.err(str(Path(path).relative_to(root)), f"cannot read JSON ({exc})")
        return None


def check_projects(c, doc):
    plist = doc.get("projects")
    if doc.get("schema") != 3:
        c.err("projects.json", "schema must be 3")
    if not isinstance(plist, list):
        c.err("projects.json", "projects must be a list (it may be empty in a new repository)")
        return []
    seen = set()
    for p in plist:
        if not isinstance(p, dict):
            c.err("projects.json", "each project must be an object")
            continue
        at = f"projects.json project {p.get('key')!r}"
        if not L.KEY.match(str(p.get("key"))) or p["key"] in seen:
            c.err(at, "key must be unique lower-case letters, digits and -")
        seen.add(p.get("key"))
        c.text(at, p, "label", limit=40)
        c.integer(at, p, "order")
        c.member(at, p, "mode", L.MODES)
        reply = p.get("replyTo")
        if not isinstance(reply, dict) or reply.get("kind") not in ("github-issue", "none"):
            c.err(at, "replyTo.kind must be github-issue or none")
        elif reply["kind"] == "github-issue":
            for f in ("repo", "template", "target", "site"):
                c.text(at + " replyTo", reply, f)
        status = c.member(at, p, "status", L.PROJECT_STATUS, opt=True) or "active"
        if status != "active":
            c.text(at, p, "statusWhy")
            c.text(at, p, "statusBy")
            c.stamp(at, p, "statusAt")
            c.link(at, p, "statusSrc", source=True)
        if status == "superseded" and p.get("supersededBy") not in [q.get("key") for q in plist]:
            c.err(at, "supersededBy must name another project key")
    return plist


def check_index(c, key, index, status="active"):
    w = f"{key}/index.json"
    if index.get("schema") != 3:
        c.err(w, "schema must be 3")
    pr = index.get("project") or {}
    if pr.get("key") != key:
        c.err(w, f"project.key must be {key!r}")
    c.text(w + " project", pr, "title", limit=80)
    c.text(w + " project", pr, "subtitle", opt=True, limit=240)
    # the Owner's aim comes first: an active project without one fails (Lesson 1, 22 Oct 2026)
    if c.text(w + " project", pr, "aim", opt=status != "active", limit=400):
        c.link(w + " project", pr, "aimSrc", source=True)
    c.stamp(w + " project", pr, "updatedAt")
    c.text(w + " project", pr, "updatedBy", limit=60)
    c.integer(w + " project", pr, "staleAfterMin", low=1)
    rules = index.get("rules") or {}
    for f in ("quietAfterMin", "idleAfterMin", "owesAfterMin", "waitingAfterMin"):
        c.integer(w + " rules", rules, f, opt=True, low=1)
    c.text(w + " rules", rules, "coordinator", opt=True, limit=40)
    hold = index.get("hold")
    if hold is not None and not isinstance(hold.get("active"), bool):
        c.err(w, "hold.active must be true or false")
    for ck, chat in (index.get("chats") or {}).items():
        at = f"{w} chat {ck!r}"
        c.text(at, chat, "label", limit=40)
        if not L.ID8.match(str(chat.get("id8"))):
            c.err(at, "id8 must be the short chat id (4-16 letters, digits, - or _), never a link")
        c.text(at, chat, "engine", opt=True, limit=30)
    for name, noun in (("milestones", "name"), ("groups", "title")):
        items = index.get(name)
        if not isinstance(items, dict) or not items:
            c.err(w, f"{name} must be a non-empty object")
            continue
        for k, v in items.items():
            c.integer(f"{w} {name} {k!r}", v, "order")
            c.text(f"{w} {name} {k!r}", v, noun, limit=80)
    check_capability(c, w, index)
    check_revisions(c, w, index)


REPO = re.compile(r"[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}")
SHA = re.compile(r"[0-9a-f]{7,40}")


def check_capability(c, w, index):
    """Optional WBS fields of a milestone: the WBS number, the benchmark it adds and keeps, and what the user can do."""
    items = index.get("milestones")
    if not isinstance(items, dict):
        return
    seen = {}
    for k, m in items.items():
        at = f"{w} milestones {k!r}"
        wbs = c.text(at, m, "wbs", opt=True, limit=15)
        if wbs is not None:
            if not L.WBS.fullmatch(wbs):
                c.err(at, "wbs must be a WBS number like 1, 1.1 or 1.2.3")
            elif wbs in seen:
                c.err(at, f"wbs {wbs} is also used by milestone {seen[wbs]!r}")
            else:
                seen[wbs] = k
        c.text(at, m, "bench", opt=True, limit=40)
        c.text(at, m, "keeps", opt=True, limit=80)
        cap = c.member(at, m, "cap", L.CAPABILITY, opt=True)
        can = c.text(at, m, "canDo", opt=True, limit=200)
        src = c.link(at, m, "capSrc", opt=True, source=True)
        if src is not None and not L.https(src):
            c.err(at, "capSrc must be a public GitHub link: a capability claim needs evidence anyone can open")
            src = None
        if cap is not None and can is None:
            c.err(at, "cap needs canDo: one line on what the user can actually do")
        if cap not in (None, "NOT_DEMONSTRATED") and src is None:
            c.err(at, f"cap {cap} needs capSrc: the evidence link")
        if cap is None and (can is not None or m.get("capSrc")):
            c.err(at, "canDo and capSrc need cap")
        repo = c.text(at, m, "repo", opt=True, limit=100)
        if repo is not None and not REPO.fullmatch(repo):
            c.err(at, "repo must be owner/name (a GitHub repository, never a local path or link)")
        c.text(at, m, "branch", opt=True, limit=100)
        sha = c.text(at, m, "commit", opt=True, limit=40)
        if sha is not None and not SHA.fullmatch(sha):
            c.err(at, "commit must be 7 to 40 hex characters")
        c.text(at, m, "activity", opt=True, limit=160)


def check_revisions(c, w, index):
    revs = index.get("revisions")
    if not isinstance(revs, list) or not revs:
        c.err(w, "revisions must list at least R1 (the plan the project started with)")
        return
    for i, r in enumerate(revs, 1):
        at = f"{w} revision {i}"
        if r.get("id") != f"R{i}":
            c.err(at, f"id must be R{i}, in order")
        c.stamp(at, r, "at")
        c.text(at, r, "by", limit=60)
        c.text(at, r, "why", limit=240)
        c.text(at, r, "ownerWords", limit=400)
        c.link(at, r, "src", source=True)
        c.member(at, r, "status", L.REV_STATUS)
        if i > 1 and r.get("supersedes") != f"R{i - 1}":
            c.err(at, f"supersedes must be R{i - 1}")
        if r.get("commit") and not L.SHA.match(str(r["commit"])):
            c.err(at, "commit must be a git sha (7-40 hex characters)")
    cur = [r for r in revs if r.get("status") == "current"]
    if len(cur) > 1 or (cur and cur[0] is not revs[-1]):
        c.err(w, "only the last revision can be current")


def _plain(raw):
    """The text as a reader sees it: JSON escapes such as a backslash-u002e dot decoded, %-encoding undone however deep, invisible
    characters dropped, so a link cannot hide behind a spelling."""
    try:
        t = json.dumps(json.loads(raw), ensure_ascii=False)
    except ValueError:
        t = raw
    for _ in range(5):
        u = unquote(t)
        if u == t:
            break
        t = u
    return "".join(ch for ch in unicodedata.normalize("NFKC", t) if unicodedata.category(ch) != "Cf")


def scan_text(c, root, private):
    for path in sorted(Path(root).rglob("*.json")):
        where = str(path.relative_to(root))
        try:
            raw = path.read_text(encoding="utf-8")
        except (OSError, ValueError) as exc:
            c.err(where, f"cannot read JSON ({exc})")
            continue
        for pattern, why in SECRETS:
            if any(pattern.search(t) for t in (raw, _plain(raw))):
                c.err(where, why)
        if not private and CHAT.search(raw):
            c.err(where, "contains a chat link (public data keeps the 8-character chat id only)")


def check_tree(data, private=False):
    root = Path(data)
    c = Ctx()
    doc = load(c, root, root / "projects.json")
    if not isinstance(doc, dict):
        return c.errors
    for p in check_projects(c, doc):
        key = p.get("key")
        if not isinstance(key, str) or not (root / key).is_dir():
            c.err("projects.json", f"folder data/{key}/ is missing")
            continue
        docs = {f: load(c, root, root / key / f"{f}.json") for f in L.FILES}
        if any(v is None for v in docs.values()):
            continue
        try:
            check_index(c, key, docs["index"], p.get("status") or "active")
            check_cards(c, key, docs["index"], docs["cards"])
            check_actions(c, key, docs["actions"], docs["index"])
            check_fixtures(c, key, docs["fixtures"], docs["index"])
            check_nudges(c, key, docs["cards"], docs["nudges"])
            check_ledger(c, key, p, docs)
        except (AttributeError, TypeError, KeyError, ValueError) as exc:
            c.err(key, f"unexpected structure ({type(exc).__name__}: {exc}); each file must follow the contract")
    scan_text(c, root, private)
    return c.errors


def main_for(data, private=False, base=None):
    """Print the result and return the exit code (0 clean, 1 problems)."""
    errors = check_tree(data, private)
    if base and not errors:
        from pp_history import check_against_base
        errors = check_against_base(data, base)
    for e in errors:
        print(e)
    print("OK" if not errors else f"{len(errors)} problem(s)")
    return 1 if errors else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("data", nargs="?", default="data")
    ap.add_argument("--private", action="store_true")
    ap.add_argument("--base", help="git ref to compare with (for example origin/main)")
    a = ap.parse_args()
    return main_for(a.data, a.private, a.base)


if __name__ == "__main__":
    sys.exit(main())
