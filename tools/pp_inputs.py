"""List the Owner's replies and nudges that arrived as GitHub issues (label owner-input) and are not recorded yet.

For each one it prints the command that records it. The coordinator (OTM, or the Oracle) runs that command, then closes the issue.
Standard library only. It reads public repositories; set GITHUB_TOKEN to read private ones or to avoid rate limits.

  python tools/pp_cli.py inputs --actor "OTM" [--since 2026-10-22T00:00:00Z] [--json]
"""
import json
import os
import re
import shlex
import urllib.request
from pathlib import Path

import pp_lib as L

FIELDS = {"Project": "project", "Target": "target", "Input type": "type", "Your instruction or message": "text", "Evidence link (optional)": "evidence"}


def parse_form(body):
    """GitHub issue-form bodies are blocks of '### Label', a blank line, then the value."""
    found = {}
    for m in re.finditer(r"^### (.+?)\r?\n\r?\n(.*?)(?=\r?\n### |\Z)", body or "", re.S | re.M):
        key = FIELDS.get(m.group(1).strip())
        if key:
            found[key] = m.group(2).strip()
    return found


def fetch(repo, token=None):
    req = urllib.request.Request(f"https://api.github.com/repos/{repo}/issues?labels=owner-input&state=open&per_page=100",
                                 headers={"Accept": "application/vnd.github+json", "User-Agent": "progress-page-tools", **({"Authorization": "Bearer " + token} if token else {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return [i for i in json.loads(r.read().decode("utf-8")) if "pull_request" not in i]


def recorded(data):
    """Every source link the Timeline already holds: an issue that appears here has been recorded."""
    seen = set()
    for p in L.read_json(Path(data) / "projects.json")["projects"]:
        audit = L.read_json(Path(data) / p["key"] / "audit.json")
        seen.update(e.get("source") for e in audit["events"])
    return seen


def quote(s):
    """Single-quoted for the shell (bash/sh): $, ` and operators in Owner text stay literal."""
    return shlex.quote(str(s))


def suggest(data, form, url, actor):
    """The command that records this input, or a note saying what to do instead."""
    key, kind, text = form.get("project", ""), (form.get("type") or "").upper(), form.get("text", "")
    if key not in {p["key"] for p in L.read_json(Path(data) / "projects.json")["projects"]} or not (Path(data) / key).is_dir():
        return f"NOT RECORDED: no project {key!r}; show the Owner in chat first"
    base = f"python tools/pp_cli.py --data {quote(data)} "
    who = f"--actor {quote(actor)} --src {quote(url)}"
    if kind == "DECISION":
        actions = L.read_json(Path(data) / key / "actions.json")
        norm = " ".join(text.split())
        hit = next((k for k, a in actions.items() if a.get("status") == "open" and any(" ".join(o.get("reply", "").split()) == norm for o in a.get("options", []))), None)
        if hit:
            return base + f"action answer --project {quote(key)} --key {quote(hit)} --text {quote(text)} --ref {quote(url)} --actor {quote(actor)}"
        return "NO MATCH with any open decision reply: show the Owner in chat first"
    if kind == "NUDGE":
        card, _, line = text.partition(": ")
        if card not in L.read_json(Path(data) / key / "cards.json"):
            return f"NOT RECORDED: no card {card!r} in {key}, show the Owner in chat first"
        return base + f"nudge add --project {quote(key)} --card {quote(card)} --text {quote(line)} --by Owner {who}"
    if kind == "NUDGE-WITHDRAW":
        m = re.match(r"withdraw (N\d+)", text)
        return base + f"nudge withdraw --project {quote(key)} --id {m.group(1)} --by Owner {who}" if m else "NOT RECORDED: cannot read the nudge id; show the Owner"
    return f"NOT RECORDED: unknown input type {kind!r}; show the Owner in chat first"


def list_inputs(data, actor, since=None, as_json=False):
    doc = L.read_json(Path(data) / "projects.json")
    repos = sorted({p["replyTo"]["repo"] for p in doc["projects"] if p.get("replyTo", {}).get("kind") == "github-issue"})
    floor = since or min(L.read_json(Path(data) / p["key"] / "audit.json").get("baseline_at", "") for p in doc["projects"])
    seen, token, out = recorded(data), os.environ.get("GITHUB_TOKEN"), []
    for repo in repos:
        for issue in fetch(repo, token):
            if issue["created_at"] < floor or issue["html_url"] in seen:
                continue
            form = parse_form(issue.get("body"))
            out.append({"issue": issue["html_url"], "at": issue["created_at"], "from": issue["user"]["login"], **form,
                        "record": suggest(data, form, issue["html_url"], actor)})
    if as_json:
        return json.dumps(out, indent=2, ensure_ascii=False)
    if not out:
        return "No unrecorded Owner inputs."
    return "\n".join(f"{i['issue']}  {i['at']}  type {i.get('type', '?')}  project {i.get('project', '?')}\n  text: {i.get('text', '')}\n  record: {i['record']}\n" for i in out)
