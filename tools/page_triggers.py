#!/usr/bin/env python3
"""Print the triggers the Progress page shows, from the data files alone (standard library only).

The rules are the same as in triggers.js: needs you, coordinator owes (OTM by default), quiet agent, waiting agent, stale project tab.
Usage: python tools/page_triggers.py [--data <folder or https url>] [--json] [--now 2026-10-22T02:00:00Z]
"""
import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DEFAULTS = {"coordinator": "OTM", "staleAfterMin": 120, "quietAfterMin": 30, "idleAfterMin": 15, "owesAfterMin": 15, "waitingAfterMin": 15, "nudgeAfterMin": 15}
SKIP = {"VERIFIED", "NOT_APPLICABLE", "NOT_STARTED"}
SLOT = {"needs-you": "needsYou", "owes": "owes", "quiet": "quiet", "waiting": "waiting"}


def load(base, path):
    if str(base).startswith("https://"):
        with urllib.request.urlopen(base.rstrip("/") + "/" + path, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    return json.loads((Path(base) / path).read_text(encoding="utf-8"))


def rules_of(index):
    r = dict(DEFAULTS)
    r.update(index.get("project", {}))
    r.update(index.get("rules", {}))
    return r


def minutes_since(iso, now):
    if not iso:
        return None
    try:
        t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    return int((now - t).total_seconds() // 60)


def fmt(m):
    if m < 60:
        return f"{m}m"
    h = m // 60
    return f"{h}h {m % 60}m" if h < 48 else f"{h // 24}d {h % 24}h"


def card_tags(c, rules, now, hold=False):
    """At most one tag per card. See triggers.js for the rules; sev 2 = far past the limit, sev 0 = informational."""
    if c.get("state") in SKIP:
        return []
    age = minutes_since(c.get("updatedAt"), now)
    actor = (c.get("next") or {}).get("actor") or "-"
    flags = c.get("flags") or []
    is_coord = str(actor).lower() == str(rules["coordinator"]).lower()
    if actor == "YOU" or "needs-you" in flags:
        return [{"k": "needs-you", "t": "needs you" + ("" if age is None else " · " + fmt(age)), "sev": 2}]
    if c.get("state") == "BLOCKED":
        return []
    if "paused" in flags or hold:
        return [{"k": "paused", "t": "paused", "sev": 0}]
    if age is None:
        return []
    if is_coord and age >= rules["owesAfterMin"]:
        return [{"k": "owes", "t": rules["coordinator"] + " owes · " + fmt(age), "sev": 2 if age >= rules["owesAfterMin"] * 4 else 1}]
    if c.get("state") == "IN_PROGRESS" and age >= rules["quietAfterMin"]:
        return [{"k": "quiet", "t": "quiet " + fmt(age) + ": ping it", "sev": 2 if age >= rules["quietAfterMin"] * 2 else 1}]
    if c.get("state") == "SUBMITTED" and actor != "-" and not is_coord and age >= rules["waitingAfterMin"]:
        return [{"k": "waiting", "t": "waiting for " + actor + " · " + fmt(age), "sev": 2 if age >= rules["waitingAfterMin"] * 4 else 1}]
    return []


def nudge_tag(open_list, rules, now):
    """Rule 8: open Nudge + lines the coordinator still owes. Fires even when the card is paused or the project is on hold."""
    if not open_list:
        return None
    oldest = max(minutes_since(n.get("at"), now) or 0 for n in open_list)
    n = len(open_list)
    return {"k": "nudge", "t": f"{n} nudge{'s' if n > 1 else ''} for {rules['coordinator']} · {fmt(oldest)}",
            "sev": 2 if oldest >= rules["nudgeAfterMin"] * 4 else 1 if oldest >= rules["nudgeAfterMin"] else 0}


def evaluate(base, now):
    out = []
    for p in load(base, "projects.json")["projects"]:
        if p.get("status", "active") != "active":
            continue
        key = p["key"]
        index, cards = load(base, f"{key}/index.json"), load(base, f"{key}/cards.json")
        try:
            nudges = load(base, f"{key}/nudges.json").get("nudges", {})
        except (OSError, ValueError):
            nudges = {}
        rules = rules_of(index)
        hold = bool((index.get("hold") or {}).get("active"))
        stale_for = minutes_since(index.get("project", {}).get("updatedAt"), now)
        rec = {"project": key, "label": p["label"], "coordinator": rules["coordinator"], "stale": stale_for is not None and stale_for > rules["staleAfterMin"] and not hold, "staleFor": stale_for,
               "needsYou": 0, "owes": 0, "quiet": 0, "waiting": 0, "nudges": 0, "items": []}
        for cid, c in sorted(cards.items(), key=lambda kv: kv[1].get("order", 0)):
            if c.get("closed") or c.get("state") == "NOT_APPLICABLE":
                continue
            tags = card_tags(c, rules, now, hold)
            opened = [n for n in nudges.values() if n.get("card") == cid and n.get("status") == "open"]
            nt = nudge_tag(opened, rules, now)
            if nt:
                tags.append(nt)
                rec["nudges"] += len(opened)
            for t in tags:
                if t["k"] in SLOT:
                    rec[SLOT[t["k"]]] += 1
                rec["items"].append({"card": cid, "label": c["label"], "tag": t["k"], "text": t["t"], "sev": t["sev"], "next": (c.get("next") or {}).get("text", "")})
        out.append(rec)
    return out


def run(data, now=None, as_json=False):
    """Print the triggers for every active project (used by pp_cli.py triggers and by main)."""
    when = datetime.fromisoformat(now.replace("Z", "+00:00")) if now else datetime.now(timezone.utc)
    res = evaluate(data, when)
    if as_json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return
    for r in res:
        tab = "tab STALE " + fmt(r["staleFor"]) if r["stale"] else "tab fresh"
        print(f"{r['label']}: {tab} | needs you {r['needsYou']} | {r['coordinator']} owes {r['owes']} | nudges {r['nudges']} | quiet {r['quiet']} | waiting {r['waiting']}")
        for i in r["items"]:
            print(f"   {i['label']}: {i['text']}" + (f" -> {i['next']}" if i["next"] else ""))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", default=str(Path(__file__).resolve().parents[1] / "data"))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--now")
    a = ap.parse_args()
    run(a.data, a.now, a.json)


if __name__ == "__main__":
    sys.exit(main())
