"""End-to-end stress through *real* pp_cli, Page checker and JS projections.

All writes occur in helpers.copy_valid() disposable test data. No live data,
Common relay, native issue, Page publication, Oracle activation or assignments.
"""
import json
import subprocess
import sys
import unittest
from pathlib import Path
from helpers import copy_valid, ok, refused, load, tree, errors_of, ROOT

SRC="https://github.com/acme/demo/issues/1#issuecomment-100"
ASSIGN="https://github.com/acme/demo/issues/1#issuecomment-200"
REASSIGN="https://github.com/acme/demo/issues/1#issuecomment-201"
COMMON="https://github.com/reallakshman19/Common/blob/999dd8d1516af6a65a840d9f3f489b5f0115d261/skills/agent-work/"
CODES=("ONB_SOURCES_CHECKED","ONB_ACCESS_VERIFIED","ONB_READY")
SHA="a"*40
P=("--project","demo")
A=("--actor","Oracle stress (synthetic)","--src",SRC,"--summary","Isolated lifecycle stress evidence")

def project(data):
    return {name:load(Path(data)/"demo"/f"{name}.json") for name in
            ("index","cards","fixtures","audit","actions")}

def preview(data):
    proc=subprocess.run(["node","--experimental-default-type=module",
       str(ROOT/"tests/oracle-agent-stress-probe.mjs"),str(data),"demo"],
       cwd=ROOT,capture_output=True,text=True,timeout=25)
    if proc.returncode:
        raise AssertionError(f"JS projections failed: {proc.stderr}")
    return json.loads(proc.stdout)

class LifecycleStress(unittest.TestCase):
    def setUp(self):
        self.data=copy_valid()

    def build(self):
        go=lambda *a:ok(self.data,*a)
        go("plan","group",*P,"--id","agent-onboarding",
           "--title","Agent onboarding","--order","3",*A)
        go("plan","group",*P,"--id","oracle-coordination",
           "--title","Oracle coordination","--order","4",*A)
        go("plan","milestone",*P,"--id","M5","--wbs","2",
           "--commit",SHA,*A)
        go("card","set",*P,"--card","onb1","--label","Agent onboarding",
           "--group","agent-onboarding","--milestone","M5",
           "--chat","c1","--role","builder","--state","IN_PROGRESS",
           "--now","Inspect source and original fixtures",
           "--next-actor","Oracle","--next-text","Verify source access",
           "--ref","comment|Onboarding assignment|"+ASSIGN,*A)
        go("card","set",*P,"--card","oracle1","--label","Oracle continuity handover",
           "--group","oracle-coordination","--milestone","M5",
           "--role","Oracle","--state","IN_PROGRESS",
           "--now","Control epoch and predecessor exclusion NOT_RUN",
           "--next-actor","Owner","--next-text","Validate control transfer",*A)
        for name,status,url in (
           ("CONCEPT_NOTE — synthetic architecture guide","CONCEPT_NOTE",COMMON+"PROJECT_HOME_GUIDE.md"),
           ("ARCHITECTURE_CONCEPT — concept map","ARCHITECTURE_CONCEPT",COMMON+"ARTIFACT_RELAY.md"),
           ("Source protocol — pinned","SOURCE_INPUT",COMMON+"START_HERE.md")):
            go("fixture","add",*P,"--list","repository","--text",name,
               "--status",status,"--url",url,"--milestone","M5",*A)
        go("fixture","add",*P,"--list","inputs",
           "--text","AGENT_INPUT source only; receiver bytes NOT_RUN",
           "--url",COMMON+"CONTRIBUTION_HANDOFF.md","--status","RELAY_REGISTERED",
           "--milestone","M5",*A)

    def proof(self,code,note="aaaa1111",assignment=ASSIGN,commit=SHA):
        ok(self.data,"fixture","add",*P,"--list","pending",
           "--text","Synthetic proof ONB_ASSIGNMENT="+assignment+" ONB_COMMIT="+commit,
           "--status",code,"--note",note,"--milestone","M5","--url",SRC,*A)

    def test_full_oracle_agent_home_fixtures_and_page_writer_lifecycle(self):
        production=tree(ROOT/"data")
        self.build()
        initial=preview(self.data)
        self.assertEqual(initial["onboardingStage"],0)
        self.assertEqual(initial["oracleCards"],["oracle1"])
        self.assertEqual(initial["conceptCount"],1)
        self.assertEqual(initial["architectureCount"],1)
        self.assertEqual(len(initial["relay"]),1)
        self.assertEqual(initial["agentMode"],"step")
        self.assertEqual(initial["selectedTask"],"onb1")
        self.assertIn("NOT_DEMONSTRATED",initial["packet"])
        for stage,code in enumerate(CODES,1):
            self.proof(code)
            self.assertEqual(preview(self.data)["onboardingStage"],stage)
        ready=preview(self.data)
        self.assertEqual(ready["onboardingStage"],3)
        self.assertIn("not an acknowledged assignment",ready["packet"])
        self.assertTrue(all(x.startswith("https://github.com/") for x in ready["conceptSources"]+ready["architectureSources"]))
        self.assertEqual(ready["oracleRevision"],"R1")
        self.assertEqual(ready["oracleCards"],["oracle1"])

        # Change successor: current readiness cannot be inherited.
        ok(self.data,"card","transfer",*P,"--card","onb1",
           "--to-chat","c2","--role","builder",
           "--actor","Oracle stress (synthetic)","--src",SRC,
           "--why","Synthetic successor handover")
        ok(self.data,"card","set",*P,"--card","onb1",
           "--ref","comment|Onboarding assignment|"+REASSIGN,*A)
        after=preview(self.data)
        self.assertEqual(after["recipient"],"bbbb2222")
        self.assertEqual(after["onboardingStage"],0)
        for stage,code in enumerate(CODES,1):
            self.proof(code,"bbbb2222",REASSIGN)
            self.assertEqual(preview(self.data)["onboardingStage"],stage)
        self.assertEqual(preview(self.data)["onboardingStage"],3)

        # SHA drift invalidates all old checks even for the same successor.
        ok(self.data,"plan","milestone",*P,"--id","M5","--commit","b"*40,*A)
        self.assertEqual(preview(self.data)["onboardingStage"],0)

        # Attacker tries to claim PASS without source, or add bogus fixture list.
        before=tree(self.data)
        self.assertIn("unknown list",refused(self.data,"fixture","add",*P,
            "--list","fake-concept-db","--text","invented concept map",*A))
        self.assertEqual(tree(self.data),before)
        self.assertIn("src",refused(self.data,"card","set",*P,
            "--card","onb1","--state","VERIFIED",
            "--actor","test","--src","http://unsafe.example","--summary","Fake acceptance"))
        self.assertEqual(tree(self.data),before)
        self.assertEqual(errors_of(self.data),[])
        ev=project(self.data)["audit"]["events"]
        self.assertTrue(all(e["seq"]==i+1 for i,e in enumerate(ev)))
        self.assertTrue(all(i==0 or e["previous_id"]==ev[i-1]["id"] for i,e in enumerate(ev)))
        self.assertEqual(tree(ROOT/"data"),production,"stress wrote to production data")

    def test_repeated_unknowns_and_multi_project_isolation(self):
        production=tree(ROOT/"data")
        self.build()
        previous=tree(self.data)
        for _ in range(12):
            s=preview(self.data)
            self.assertEqual(s["onboardingStage"],0)
            self.assertEqual(s["selectedTask"],"onb1")
            self.assertEqual(tree(self.data),previous)
        other_before=project(self.data)["index"]["project"]
        self.assertEqual(errors_of(self.data),[])
        self.assertEqual(project(self.data)["index"]["project"],other_before)
        self.assertEqual(tree(ROOT/"data"),production)

if __name__=="__main__":
    unittest.main()
