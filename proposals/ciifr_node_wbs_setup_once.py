#!/usr/bin/env python3
"""CIIFR-Node Progress Page setup. Uses existing official tools/pp_cli.py only.

Run in checkout of reallakshman19/progress-page:
  python path/to/CIIFR_NODE_PAGE_UPDATE.py --page-root .          # dry-run in copy
  python path/to/CIIFR_NODE_PAGE_UPDATE.py --page-root . --apply  # after review

Never invoke for an already existing ciifr-node project; no events are overwritten.
This script does NOT create a GitHub/CIIFR-Node source repository or dispatch agents.
"""
from __future__ import annotations
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

KEY = "ciifr-node"
ACTOR = "Owner-directed CIIFR-Node Page source operator"
WBS = "https://github.com/reallakshman19/XML_Compare_Utilities/issues/227"
PR = "https://github.com/reallakshman19/XML_Compare_Utilities/pull/226"
N01 = "https://github.com/reallakshman19/XML_Compare_Utilities/issues/228"
N02 = "https://github.com/reallakshman19/XML_Compare_Utilities/issues/229"
N03 = "https://github.com/reallakshman19/XML_Compare_Utilities/issues/230"
COMMON_RELAY = "https://github.com/reallakshman19/Common/tree/docs/ciifr-node-wbs-fixtures-20261028/relay/AGENT_WORK/CIIFR-Node/CIIFR-NODE-WBS-P0-20261028"
CONCEPT = "https://github.com/reallakshman19/XML_Compare_Utilities/blob/b2b695f66fc8dfc907f2b9a493b39bd4d4109570/docs/ciifr/property-transfer/CONCEPT_NOTE_v1.0.md"
IMPLEMENTATION = "https://github.com/reallakshman19/XML_Compare_Utilities/blob/b2b695f66fc8dfc907f2b9a493b39bd4d4109570/docs/ciifr/property-transfer/IMPLEMENTATION_PLAN.md"
PR_HEAD = "b2b695f66fc8dfc907f2b9a493b39bd4d4109570"

# Page WBS labels are 1..7 because the native Page CLI forbids zero; these
# map to canonical engineering phases P0..P6 respectively. Child 1.1 is P0.1,
# 2.1=P1.1, etc. Canonical engineering phase names remain in 'full' text.
# Human-reviewed native WBS from #227. This table is a page projection, not
# a second engineering source of truth. P3 is READ_ONLY, P4 writer candidate.
MILESTONES = [
 ("M1","1","Home, intent and custody","P0.0 · Owner aim, independent modules, concept/architecture, source/version/authority","CANDIDATE",WBS),
 ("M2","1.1","Core fixture and original custody","P0.1 · Common public synthetic F00–F07, actual relay bytes plus private V14 receipt","NOT_DEMONSTRATED",N02),
 ("M3","2","Two-path read-only inspector","P1.0 · Independent Property Transfer tab and isolated SOURCE/TARGET intake; no TARGET1","CANDIDATE",PR),
 ("M4","2.1","Native tab regression IR","P1.1 · Reproduce existing Nodal test baseline vs repaired head and all affected tests","NOT_DEMONSTRATED",N01),
 ("M5","2.2","Owner original V14 R0 trial","P1.2 · Private original read-only Node/Element/AUX/MISC inspector, sanitised counts","NOT_DEMONSTRATED",N02),
 ("M6","3","Qualified SOURCE→TARGET correspondence","P2.0 · Numeric-node/element orientation identity, multiple owners, ambiguity HOLD","NOT_DEMONSTRATED",N03),
 ("M7","3.1","TO-only discovery and element selection","P2.1 · Find every element with selected TO node; explicit pick, no arbitrary first","NOT_DEMONSTRATED",N03),
 ("M8","3.2","Auxiliary-occurrence correlation","P2.2 · Element pointer, block, slot, CNode/Tag/GUID and epoch evidence","NOT_DEMONSTRATED",WBS),
 ("M9","4","Restraint semantics, read-only","P3.0 · Restraint type/slot, stiffness/gap/friction, CNode; first future writer priority","NOT_DEMONSTRATED",WBS),
 ("M10","4.1","Process semantics, read-only","P3.1 · T/P/density/units/cases/material dependencies; reuse Element E1 #178","NOT_DEMONSTRATED",WBS),
 ("M11","4.2","Other properties semantic catalogue","P3.2 · Rigid, displ, force, hangers/nozzles, material/geometry/aux positives","NOT_DEMONSTRATED",WBS),
 ("M12","5","Restraint-first existing-slot writer HOLD","P4.0 · Exact approved restraint-field writer; byte oracle + licensed CAESAR import","NOT_DEMONSTRATED",WBS),
 ("M13","5.1","Process field writer HOLD","P4.1 · Only after independent element/case/unit source-semantic authority","NOT_DEMONSTRATED",WBS),
 ("M14","6","Structural CONTROL/MISC transaction HOLD","P5.0 · Counts/pointers, auxiliary record insertion, RRMAT and other MISC ownership","NOT_DEMONSTRATED",WBS),
 ("M15","7","Owner-gated standalone release","P6.0 · Native source/target, Windows, independent review and release decision","NOT_DEMONSTRATED",WBS),
]
FIXTURES = [
 ("repository","CONCEPT_NOTE · full two-path source and risk/ownership contract",CONCEPT,"CONCEPT_NOTE"),
 ("repository","ARCHITECTURE_CONCEPT · canonical P0–P6 implementation and typed writer holds",IMPLEMENTATION,"ARCHITECTURE_CONCEPT"),
 ("repository","CIIFR-Node canonical WBS and complete engineering/property requirements",WBS,"SOURCE_WBS"),
 ("repository","Current R0 Property Transfer draft PR226, head verification required",PR,"DRAFT_HOLD"),
 ("inputs","Common public-safe synthetic core F00–F07; fixture receipt only; receiver NOT_RUN",COMMON_RELAY,"RELAY_PROPOSED_NOT_RECEIVED"),
 ("inputs","Owner-controlled original V14 GLRD, protected bytes not in public GitHub",N02,"OWNER_PRIVATE_REF_HANDOFFS_PRIMARY_NOT_RECEIVED"),
 ("roadmap","P0–P6 canonical WBS: P3 read-only and P4 restraint-first prospective writer",WBS,"WBS_BASELINE"),
 ("knownIssues","P1 native/Chromium/real V14 R0 IR still NOT_RUN after PR226 source repair",N01,"QUALIFICATION_HOLD"),
 ("pending","N-01→N-02→N-03 tasks prepared; recipients UNASSIGNED, not dispatched",WBS,"NEXT_THREE_TASKS"),
]
CARDS = [
 ("node-r0-code","Property R0 draft candidate","M3","SUBMITTED",
  "Draft PR226 read-only source present at prior exact head; independent native/browser original not run","Unassigned independent reviewer","Execute N-01 exact-head native/GUI regression",PR,"pr|PR226 read-only Property Transfer|"+PR+"|DRAFT"),
 ("node-r0-ir","N-01 independent native/regression","M4","NOT_STARTED",
  "Prepared independent read-only task; no reviewer bound","Unassigned independent reviewer","Prove old Nodal baseline vs repaired candidate and full tab integrity",N01,"issue|N-01 independent review|"+N01+"|PREPARED"),
 ("node-original","N-02 core fixtures and private V14","M5","NOT_STARTED",
  "Common public-safe fixture relay proposed; original/private receiver access NOT_RUN","Unassigned fixture reviewer","Verify real relay bytes and authorized original V14 custody",N02,"issue|N-02 fixture qualification|"+N02+"|PREPARED"),
 ("node-correspondence","N-03 TO-only and SOURCE/TARGET mapping","M7","NOT_STARTED",
  "Read-only TO-only discovery/concordance concept prepared; implementation NOT_STARTED","Unassigned correspondence analyst","After N-01 reconcile, independently design TO-only conflict ledger",N03,"issue|N-03 correspondence|"+N03+"|PREPARED"),
]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--page-root",type=Path,required=True)
    ap.add_argument("--apply",action="store_true",help="Apply only after reviewed dry-run")
    args = ap.parse_args()
    root=args.page_root.resolve()
    cli=root/"tools"/"pp_cli.py"
    data=root/"data"
    if not cli.is_file() or not (data/"projects.json").is_file():
        raise SystemExit("BLOCKED: not a checked-out Progress Page repo")
    if (data/KEY).exists():
        raise SystemExit("BLOCKED: ciifr-node exists; inspect/reconcile rather than duplicate events")
    with tempfile.TemporaryDirectory(prefix="ciifr-node-page-") as td:
        stage=Path(td)/"data"
        shutil.copytree(data,stage)
        def call(*args):
            cmd=[sys.executable,str(cli),"--data",str(stage),*args]
            p=subprocess.run(cmd,capture_output=True,text=True,encoding="utf-8")
            if p.returncode:raise SystemExit("FAILED: "+" ".join(args[:5])+"\n"+(p.stdout+p.stderr)[-4000:])
            return p.stdout.strip()
        call("project","add","--key",KEY,"--title","CIIFR-Node",
             "--label","CIIFR-Node","--subtitle","Two independent Node→Element→Data / Node→Data property mapping workstreams",
             "--mode","standalone","--coordinator","Oracle",
             "--aim","Auditable SOURCE→TARGET CII node/element and node-attached property transfer; inspect exact FROM→TO elements and individually owned restraints first, protect existing NodeName/Geometry, approve qualified edits only with independent byte and CAESAR evidence.",
             "--owner-words","Create CIIFR-Node WBS, core fixtures and a separate Property Transfer tab; keep Node Name and other tabs unchanged.",
             "--actor",ACTOR,"--src",WBS,"--why","Owner requested separate CIIFR-Node project/WBS and fixtures.")
        for n,(mid,wbs,name,full,cap,source) in enumerate(MILESTONES):
            call("plan","milestone","--project",KEY,"--id",mid,"--order",str(n+1),
                 "--wbs",wbs,"--name",name,"--full",full,
                 "--repo","reallakshman19/XML_Compare_Utilities",
                 "--cap",cap,
                 "--can-do","Draft source present; this WBS gate not independently accepted" if cap=="CANDIDATE" else "Not yet independently demonstrated" if cap=="NOT_DEMONSTRATED" else "Source plan recorded; no product acceptance",
                 "--cap-src",source,
                 "--actor",ACTOR,"--src",source,
                 "--summary","CIIFR-Node WBS "+wbs+": source-backed "+name)
        for family,title,url,status in FIXTURES:
            call("fixture","add","--project",KEY,"--list",family,
                 "--text",title,"--url",url,"--status",status,
                 "--actor",ACTOR,"--src",url,
                 "--summary","Add source-linked "+family+" evidence with "+status)
        for card,label,milestone,state,now,nextActor,nextText,source,ref in CARDS:
            call("card","set","--project",KEY,"--card",card,"--label",label,
                 "--milestone",milestone,"--state",state,"--now",now,
                 "--next-actor",nextActor,"--next-text",nextText,"--ref",ref,
                 "--actor",ACTOR,"--src",source,
                 "--summary","Record CIIFR-Node WBS task and true unassigned/qualification state")
        check=call("check")
        print(json.dumps({"mode":"APPLY" if args.apply else "DRY_RUN",
          "project":KEY,"milestones":len(MILESTONES),"cards":len(CARDS),
          "fixtures":len(FIXTURES),"check":check[-600:],
          "expectedFiles":["data/projects.json","data/ciifr-node/index.json",
                           "data/ciifr-node/fixtures.json","data/ciifr-node/cards.json",
                           "data/ciifr-node/audit.json"]},indent=2))
        if args.apply:
            # Promote only the CLI-generated project files, never hand-edit audit.
            # Backup checkout with git before executing as permitted Page writer.
            shutil.copy2(stage/"projects.json",data/"projects.json")
            shutil.copytree(stage/KEY,data/KEY)
            fin=subprocess.run([sys.executable,str(cli),"--data",str(data),"check"],
                               capture_output=True,text=True,encoding="utf-8")
            if fin.returncode:raise SystemExit("POST-APPLY CHECK FAILED: "+fin.stdout+fin.stderr)
            print("APPLIED: run git diff -- data/; check --base origin/main; open data-only DRAFT PR; verify published Page readback.")
if __name__=="__main__":
    main()
