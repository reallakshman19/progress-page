"""Shared constants and helpers for the Progress page tools (standard library only)."""
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

LEDGER_SCHEMA = "progress-ledger/v3"
STATES = ("NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "VERIFIED", "BLOCKED", "STALE", "UNKNOWN", "NOT_APPLICABLE")
MODES = ("otm", "standalone")
PROJECT_STATUS = ("active", "archived", "superseded", "cancelled")
REV_STATUS = ("current", "superseded", "cancelled")
FLAGS = ("paused", "needs-you")
EDGE_KINDS = ("to", "back", "both")
FIXTURE_LISTS = ("repository", "issues", "pullRequests", "roadmap", "highRoi", "future", "intent", "inputs", "knownIssues", "pending")
CARD_KINDS = ("BASELINE", "STATE", "UPDATE", "SUPERSEDE", "CANCEL", "TRANSFER")
PROJECT_KINDS = ("REVISION", "PLAN", "ARCHIVE", "RESTORE", "SUPERSEDE", "CANCEL", "TRANSFER")
OTHER_KINDS = ("ANSWER", "FIXTURE", "ACTION", "NUDGE")
NUDGE_STATUS = ("open", "done", "withdrawn")
NUDGE_OPS = ("add", "done", "withdraw")
EVENT_KINDS = tuple(sorted(set(CARD_KINDS + PROJECT_KINDS + OTHER_KINDS)))
FILES = ("index", "cards", "actions", "fixtures", "nudges", "audit")
KEY = re.compile(r"^[a-z0-9][a-z0-9-]*$")
CARD_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
ID8 = re.compile(r"^[A-Za-z0-9_-]{4,16}$")
REV_ID = re.compile(r"^R[1-9][0-9]*$")
SHA = re.compile(r"^[0-9a-f]{7,40}$")
ISO = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$")
DEFAULT_RULES = {"coordinator": "OTM", "staleAfterMin": 120, "quietAfterMin": 30, "idleAfterMin": 15, "owesAfterMin": 15, "waitingAfterMin": 15}


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, obj):
    Path(path).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(s):
    if not isinstance(s, str) or not ISO.match(s):
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def public_source(u):
    """A source is a public GitHub link, or OWNER_PRIVATE_REF:<id> for something only the Owner can open."""
    return isinstance(u, str) and (u.startswith("https://github.com/") or re.fullmatch(r"OWNER_PRIVATE_REF:\S+", u) is not None)


def https(u):
    return isinstance(u, str) and u.startswith("https://") and " " not in u


def git_head(folder):
    """Short sha of HEAD in the repository that holds folder, or None when git or a repository is missing."""
    try:
        out = subprocess.run(["git", "-C", str(folder), "rev-parse", "--short=12", "HEAD"], capture_output=True, text=True, timeout=20)
        return out.stdout.strip() if out.returncode == 0 and SHA.match(out.stdout.strip()) else None
    except (OSError, subprocess.SubprocessError):
        return None


def current_rev(index):
    for r in index.get("revisions") or []:
        if r.get("status") == "current":
            return r["id"]
    return None


def append_event(ledger, key, event, rev):
    """Append one event: seq, id and previous_id are filled in, so the chain stays unbroken. Returns the event."""
    events = ledger["events"]
    n = len(events) + 1
    full = {"seq": n, "id": f"{key.upper()}-R-{n:04d}", "previous_id": events[-1]["id"] if events else None, "at": event.get("at") or now_iso()}
    full.update(event)
    if rev:
        full["rev"] = rev
    events.append(full)
    return full


class Txn:
    """Write several JSON files; if the check fails afterwards, every file is put back as it was."""

    def __init__(self):
        self.saved = {}
        self.made = []

    def mkdir(self, path):
        path = Path(path)
        if not path.exists():
            path.mkdir(parents=True)
            self.made.append(path)

    def write(self, path, obj):
        path = Path(path)
        self.saved.setdefault(path, path.read_bytes() if path.exists() else None)
        write_json(path, obj)

    def rollback(self):
        for p, raw in self.saved.items():
            if raw is None:
                p.unlink(missing_ok=True)
            else:
                p.write_bytes(raw)
        for d in reversed(self.made):
            try:
                d.rmdir()
            except OSError:
                pass


def finish(txn, data):
    """Run the checker on the written folder; on any problem restore the files and stop with the list."""
    from pp_check import check_tree
    errors = check_tree(data)
    if errors:
        txn.rollback()
        raise SystemExit("Nothing was written. The check failed:\n  " + "\n  ".join(errors))
