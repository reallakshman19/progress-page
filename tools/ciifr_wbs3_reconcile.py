#!/usr/bin/env python3
"""One-time CIIFR WBS3 status reconciliation, using ONLY the audited Progress Page CLI.

Run in an actual git checkout at the pinned post-PR32 main head. No direct JSON writes.
All native engineering acceptance, Writer, TARGET1, Cycle control and merge gates stay untouched.
"""
import json
import subprocess
import sys
from pathlib import Path

TOP = Path(__file__).resolve().parents[1]
BASE = "7fd1c8088ceb3312aab39375a8c20534d8d368f0"
ACTOR = "CIIFR WBS3 Progress recorder"
GEO = "https://github.com/reallakshman19/Common/blob/main/oracle-cycles/ciifr/CURRENT.json"
ELEMENT = "https://github.com/reallakshman19/Common/blob/main/oracle-cycles/ciifr-element/CURRENT.json"
F1 = "https://github.com/reallakshman19/XML_Compare_Utilities/issues/186#issuecomment-6412690110"
BROWSER = "https://github.com/reallakshman19/XML_Compare_Utilities/issues/186#issuecomment-6415117812"
G2 = "https://github.com/reallakshman19/XML_Compare_Utilities/issues/177#issuecomment-6407926621"
G2_WRONG = "https://github.com/reallakshman19/XML_Compare_Utilities/issues/177#issuecomment-6401698353"
PR185 = "https://github.com/reallakshman19/XML_Compare_Utilities/pull/185"

def git(*args):
    return subprocess.check_output(["git", *args], cwd=TOP, text=True).strip()

def cli(*args):
    cmd = [sys.executable, "tools/pp_cli.py", *args]
    result = subprocess.run(cmd, cwd=TOP, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"CLI refused {args[:4]}: {result.stdout}\n{result.stderr}")
    print("AUDITED:", " ".join(args[:4]), result.stdout.strip())

def stamp(*args, src):
    return (*args, "--actor", ACTOR, "--src", src,
            "--summary", "Reconcile CIIFR R4 WBS3 against canonical Geometry Cycle rev12 and exact native evidence")

def set_card(cid, state, now, actor, next_text, source, evidence):
    cli("card","set","--project","ciifr","--card",cid,"--state",state,
        "--now",now,"--next-actor",actor,"--next-text",next_text,
        "--ref",f"comment|Current native evidence|{evidence}",
        *stamp(src=source))

def plan(mid, activity, cap, can_do, source):
    cli("plan","milestone","--project","ciifr","--id",mid,
        "--activity",activity,"--cap",cap,"--can-do",can_do,"--cap-src",source,
        *stamp(src=source))

def fixture_add(lst, text, status, url, milestone=None):
    args=["fixture","add","--project","ciifr","--list",lst,"--text",text,
          "--status",status,"--url",url]
    if milestone: args.extend(["--milestone",milestone])
    cli(*args,*stamp(src=url))

def retire_fixture(lst, status, source):
    doc=json.loads((TOP/"data/ciifr/fixtures.json").read_text(encoding="utf-8"))
    matches=[it for it in doc[lst] if it.get("s")==status]
    if len(matches)!=1: raise AssertionError(f"{lst}.{status}: expected one legacy record, got {len(matches)}")
    old=matches[0]
    cli("fixture","remove","--project","ciifr","--list",lst,"--text",old["t"],*stamp(src=source))
    historical="SUPERSEDED past-state claim ("+lst+"/"+status+"): "+old["t"]
    if len(historical)>400: raise AssertionError(f"history text overflow: {status}")
    fixture_add("inputs",historical,"HISTORICAL_SUPERSEDED",old.get("u") or source,old.get("milestone"))

def main():
    actual=git("rev-parse","HEAD")
    if git("merge-base", BASE, actual) != BASE or git("rev-parse","origin/main") != BASE:
        raise SystemExit(f"STOP: exact original main {BASE} required; HEAD={actual}; origin/main={git('rev-parse','origin/main')}")
    docs=TOP/"data/ciifr"
    index=json.loads((docs/"index.json").read_text(encoding="utf-8"))
    cards=json.loads((docs/"cards.json").read_text(encoding="utf-8"))
    fixtures=json.loads((docs/"fixtures.json").read_text(encoding="utf-8"))
    if next((r for r in index["revisions"] if r["status"]=="current"),{}).get("id")!="R4":
        raise SystemExit("STOP: CIIFR live revision changed; do not migrate R4 or rewrite history")
    for ident, milestone, state in [
        ("geo-g0","M12","SUBMITTED"),("geo-g1","M13","SUBMITTED"),
        ("geo-g2","M14","SUBMITTED"),("geo-g3","M15","NOT_STARTED"),
        ("geo-g4","M16","NOT_STARTED")]:
        old=cards.get(ident)
        if not old or old.get("milestone")!=milestone or old.get("state")!=state:
            raise SystemExit(f"STOP: unexpected card {ident} state/milestone; no speculative overwrite")
    for list_name,status in [("pending","ORACLE_CYCLE_SEPARATION"),
                              ("pending","NEEDS_COORDINATION"),
                              ("knownIssues","NOT_YET_BUILT")]:
        if len([x for x in fixtures[list_name] if x.get("s")==status])!=1:
            raise SystemExit(f"STOP: changed legacy fixture {list_name}/{status}")
    if any(x.get("s")=="GEO_CYCLE_R12" for x in fixtures["inputs"]):
        raise SystemExit("STOP: reconciliation appears already applied")

    # Retain prior assertions as explicit historical provenance, not misleading live pending/known issues.
    retire_fixture("pending","ORACLE_CYCLE_SEPARATION",GEO)
    retire_fixture("pending","NEEDS_COORDINATION",PR185)
    retire_fixture("knownIssues","NOT_YET_BUILT",G2)

    plan("M12","ROUTING DOCUMENTED · Geometry Cycle ACTIVE rev12; draft G1 stack exists; authority and Owner trial still separate.",
         "CANDIDATE","G0 source and bounded stacked-PR routing documented, not acceptance.",GEO)
    plan("M13","DRAFT CODE DELIVERED · PR174/181/183/185; F1 scoped non-author native PASS; served WebGL/Owner trial NOT_RUN.",
         "CANDIDATE","Opt-in hosted G1 viewer loads its shell; functional original-pair and WebGL acceptance pending.",F1)
    plan("M14","SOURCE PROTOTYPE SUBMITTED · PR182 author 7/7; real PR181 S1/T and non-author falsification NOT_RUN.",
         "CANDIDATE","Pose-free G2 CLI candidate exists; no independently qualified node correspondence.",G2)
    plan("M15","NOT_STARTED AS QUALIFIED G3 · G1 XML preview is not original-CII F05 receipt provenance.",
         "NOT_DEMONSTRATED","No qualified original-bound XMLv1.1 evidence bridge.",GEO)
    plan("M16","NOT QUALIFIED · G1 prototype JSON/CSV/SVG downloads exist; integrated G4/Owner export checks NOT_RUN.",
         "NOT_DEMONSTRATED","No accepted integrated G4 exports/invalidations or independent release.",BROWSER)

    set_card("geo-g0","SUBMITTED",
        "Geometry Cycle ACTIVE rev12: G0 source/assignment and PR stack routes documented. Routing is established; browser, independent full-path and Owner acceptance are not.",
        "Geometry Oracle / browser executor",
        "Retain exact PR185/PR183/PR181/PR174 heads and ownership; execute the outstanding G1 trial, not duplicate onboarding.",
        GEO,GEO)
    set_card("geo-g1","SUBMITTED",
        "G1 draft PR174 dual SVG + PR181 XML adapter + PR183 scene + PR185 opt-in 3D. F1 async ownership repaired; separate non-author exact-head native PASS at 3787acdf. Hosted shell opened, but real XML/3D/WebGL and Owner trial NOT_RUN.",
        "Capable browser executor / Geometry Oracle",
        "On PR185 exact 3787acdf load XML pair, anchors/Method C, SVG and 3D overlay/split, picks, stale cases, downloads; separately test true original S1/T.",
        BROWSER,F1)
    set_card("geo-g2","SUBMITTED",
        "G2 PR182 pose-free source CLI exists; 7/7 author tests PASS only. Original S1/T signature: 3910 has three TARGET alternatives, 3940/3970 have 319 each. Real PR181 graph run and non-author falsification NOT_RUN.",
        "Separate read-only G2 reviewer",
        "Challenge PR182 on real PR181 graphs: keep alternatives, target collisions, Manual/Topology/OR/AND exclusions and hash-epoch guards; do not auto-map.",
        G2,G2_WRONG)
    set_card("geo-g3","NOT_STARTED",
        "G3 original-CII-bound XMLv1.1 F05 receipt/field witness bridge not delivered; G1 XML parsing/preview must not be mistaken for this engineering provenance gate.",
        "Geometry Oracle after qualified G2",
        "Design original-file SHA, source endpoint and field witness comparisons with XML_UNVERIFIED negatives; do not certify correspondence.",
        GEO,GEO)
    set_card("geo-g4","NOT_STARTED",
        "G4 integrated qualification NOT_STARTED. G1 prototype JSON/CSV/SVG export features exist, but full source-bound stale/byte-regression/independent browser and Owner acceptance remain NOT_RUN.",
        "Geometry Oracle after G1/G2 gates",
        "Revisit export identity and protected regressions only after actual G1 WebGL and G2 real-graph review; no merge implied.",
        BROWSER,BROWSER)

    fixture_add("inputs",
        "Canonical Geometry Cycle ACTIVE rev12; exact draft PR185 head 3787acdf with scoped F1 non-author native PASS; complete browser/WebGL/Owner original-pair trial NOT_RUN. G2/G3/G4 not released.",
        "GEO_CYCLE_R12",GEO,"M13")
    fixture_add("inputs",
        "Separate Element Cycle ACTIVE rev3 (not rev0/rev1); independent WBS4 source/config gate, no Writer/TARGET1 or Geometry control transfer.",
        "ELEMENT_CYCLE_R3",ELEMENT)
    fixture_add("pullRequests",
        "Draft PR185 G1 3D opt-in viewer stacked on PR183/181: fixed async session ownership at head 3787acdf, scoped non-author native F1 PASS; served WebGL/GPU and Owner acceptance pending; unmerged.",
        "G1_PR185_F1_SCOPED",PR185,"M13")
    fixture_add("pending",
        "G1 rev12 PRIORITY: complete PR185 original file journey + hosted XML profile parity separately; overlay/split, linked SVG/3D picks, stale callbacks and downloads. Last automation stalled selecting fixtures; INCONCLUSIVE, not product FAIL.",
        "G1_BROWSER_REV12_PENDING",BROWSER,"M13")
    fixture_add("pending",
        "Geometry integration ownership: reconcile dual-SVG PR174 with XML/scene/viewer stacked PR181/183/185, including original-CII vs public same-S1 XML profiles, before product merge/acceptance.",
        "G1_STACK_CONVERGENCE",PR185,"M13")

    cli("check")
    cli("check","--base","origin/main")
    post=json.loads((docs/"cards.json").read_text(encoding="utf-8"))
    fx=json.loads((docs/"fixtures.json").read_text(encoding="utf-8"))
    for k,desired in [("geo-g0","SUBMITTED"),("geo-g1","SUBMITTED"),("geo-g2","SUBMITTED"),
                      ("geo-g3","NOT_STARTED"),("geo-g4","NOT_STARTED")]:
        assert post[k]["state"]==desired
    assert len([r for r in fx["inputs"] if r.get("s")=="GEO_CYCLE_R12"])==1
    assert len([r for r in fx["inputs"] if r.get("s")=="ELEMENT_CYCLE_R3"])==1
    assert len([r for r in fx["pending"] if r.get("s")=="ORACLE_CYCLE_SEPARATION"])==0
    assert all("Writer" not in post[k]["state"] for k in post)
    print("SUCCESS: audited CIIFR R4 WBS3 reconciliation; state gates unchanged")

if __name__=="__main__": main()
