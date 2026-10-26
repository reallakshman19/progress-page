#!/usr/bin/env python3
"""One-time native audited CIIFR WBS5 classification for Issue #33.

Must be executed in an authenticated checkout at the exact main base.
No hand-edited Progress JSON, no revision promotion, no Writer/engineering change.
"""
import copy
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "73078a80de14920823aabf93da930ac865f4894c"
ACTOR = "CIIFR Progress Page WBS5 recorder"
SOURCE = "https://github.com/reallakshman19/progress-page/issues/33"
ASSIGN = (("M8","5"),("M9","5.1"),("M10","5.2"),("M11","5.3"))
OTHER = ("M6","M7","M4","M5","M1","M2","M3")
GEO = ("M12","M13","M14","M15","M16")
ELEMENT = ("M17","M18","M19","M20","M21","M22","M23")

def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()

def cli(*args):
    result = subprocess.run([sys.executable, "tools/pp_cli.py", *args],
                            cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"CLI REFUSED {args}: {result.stdout}\n{result.stderr}")
    print("AUDITED:", " ".join(args[:5]), result.stdout.strip(), flush=True)

def get_json(name):
    return json.loads((ROOT/"data"/"ciifr"/(name+".json")).read_text(encoding="utf-8"))

def main():
    head = git("rev-parse", "HEAD")
    upstream = git("rev-parse", "origin/main")
    if upstream != BASE or git("merge-base", BASE, head) != BASE:
        raise SystemExit(f"STOP: main drift/unrelated head: expected origin/main {BASE}; actual main={upstream} HEAD={head}")
    if git("status","--porcelain"):
        raise SystemExit("STOP: dirty native checkout before audited fixture writes")
    print("Verified exact main base and clean checkout:", BASE, flush=True)
    cli("--help")
    cli("check")
    before = {key:get_json(key) for key in ("index","cards","fixtures","audit","actions","nudges")}
    index=before["index"]
    live = [x["id"] for x in index["revisions"] if x["status"]=="current"]
    if live != ["R4"] or index["project"]["key"]!="ciifr":
        raise SystemExit(f"STOP: unexpected project/revision {live}")
    milestone=index["milestones"]
    keys=tuple(k for k,_ in sorted(milestone.items(),key=lambda pair:(pair[1].get("order",0))))
    required=set(dict(ASSIGN))|set(OTHER)|set(GEO)|set(ELEMENT)
    if set(keys)!=required:
        raise SystemExit(f"STOP: original milestone set changed; {set(keys)^required}")
    for key in (*tuple(x[0] for x in ASSIGN),*OTHER):
        if "wbs" in milestone[key]:
            raise SystemExit(f"STOP: legacy {key} already has WBS metadata")
    if [k for k in keys if k in set(OTHER)] != list(OTHER):
        raise SystemExit("STOP: original Other order does not match issue #33")
    for name,number in ASSIGN:
        cli("plan","milestone","--project","ciifr","--id",name,
            "--wbs",number,"--actor",ACTOR,"--src",SOURCE,
            "--summary",f"Classify existing {name} under WBS 5 CIIFR-MAP per Issue #33; no engineering state or authority change")
    after = {key:get_json(key) for key in before}
    assert before["cards"] == after["cards"]
    assert before["fixtures"] == after["fixtures"]
    assert before["actions"] == after["actions"]
    assert before["nudges"] == after["nudges"]
    assert before["index"]["revisions"] == after["index"]["revisions"]
    assert {k:v for k,v in before["index"].items() if k not in ("milestones","project")} == \
           {k:v for k,v in after["index"].items() if k not in ("milestones","project")}
    assert all(after["index"]["milestones"][k] == before["index"]["milestones"][k] for k in (*OTHER,*GEO,*ELEMENT))
    for id,number in ASSIGN:
        new=copy.deepcopy(after["index"]["milestones"][id])
        assert new.pop("wbs")==number, (id,number)
        assert new == before["index"]["milestones"][id], "milestone evidence unexpectedly modified: "+id
    assert len(after["audit"]["events"]) == len(before["audit"]["events"])+4
    appended=after["audit"]["events"][-4:]
    assert [e.get("scope") for e in appended] == ["milestone:"+key for key,_ in ASSIGN]
    assert all(e.get("kind")=="PLAN" and e.get("source")==SOURCE and e.get("rev")=="R4" for e in appended)
    for r in index["revisions"]:
        if r["id"] not in ("R1","R2","R3"): continue
        if not r.get("commit"): continue
        old=json.loads(git("show",r["commit"]+":data/ciifr/index.json"))
        for key,_ in ASSIGN:
            if key in old.get("milestones",{}):
                assert not old["milestones"][key].get("wbs"), (r["id"],key)
        print("Historical "+r["id"]+" source snapshot: unchanged", flush=True)
    cli("check")
    cli("check","--base","origin/main")
    print("SUCCESS: four audited WBS5 assignments, unchanged engineering and 4 append-only R4 events", flush=True)

if __name__=="__main__":
    main()
