"""Isolated real CIIFR-Node Page replay through the existing Page writer.

No checked-out data or canonical Cycle writes; native API responses are test
fixtures. A positive rehearsal is not an authorized production publication.
"""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
import pp_propose as P
import pp_batch as B
from pp_occurrence import occurrence_id, valid_identity

URL="https://github.com/reallakshman19/XML_Compare_Utilities/pull/232"
HEAD_A="7f5dc773ac7bb08544d086be734e4337295088a0"
HEAD_B="b"*40

def api(head):
    def reader(url):
        if not url.endswith("/pulls/232"):
            raise ValueError("not the selected native original")
        return {"number":232,"title":"R0 SELF_ASSESSED; IR HOLD",
            "head":{"sha":head},"state":"open","draft":True,
            "updated_at":"2026-10-29T10:22:02Z"}
    return reader

def head_observation(head):
    return lambda _:{"kind":"pull","observedHead":head}

class NativeReuse(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix="ct4-native-reuse-")
        self.addCleanup(self.temp.cleanup)
        self.data=Path(self.temp.name)/"data"
        shutil.copytree(ROOT/"data",self.data)
        self.original={p.name:p.read_bytes() for p in (ROOT/"data/ciifr-node").glob("*.json")}
    def doc(self,name):
        return json.loads((self.data/"ciifr-node"/(name+".json")).read_text(encoding="utf-8"))
    def unchanged(self, prior=None):
        for name,raw in self.original.items():
            self.assertEqual((ROOT/"data/ciifr-node"/name).read_bytes(),raw)
        if prior is not None:
            for name,raw in prior.items():
                self.assertEqual((self.data/"ciifr-node"/name).read_bytes(),raw)
    def snapshot(self):
        return {p.name:p.read_bytes() for p in (self.data/"ciifr-node").glob("*.json")}
    def propose(self,head=HEAD_A,**kw):
        return P.propose(self.data,"ciifr-node",URL,"Scoped authorized Page writer replay",
                         card_id="node-r0-code",expected_head=head,fetch=api(head),**kw)
    def manifest(self,p,name):
        path=Path(self.temp.name)/name
        path.write_text(json.dumps(p["proposal"]),encoding="utf-8")
        return path
    def board_coverage(self, head):
        """Read the *actual staged Page JSON* through the JS Board classifier."""
        script=r"""
import { readFileSync } from 'node:fs';
import { cycleBoardContextModel } from './cycle-board-context.js';
import { classifyPageCoverage } from './cycle-board-delta.js';
const path=process.argv[1],head=process.argv[2];
const read=kind=>JSON.parse(readFileSync(path+'/ciifr-node/'+kind+'.json','utf8'));
const page={index:read('index'),cards:read('cards'),audit:read('audit')};
const url='https://github.com/reallakshman19/XML_Compare_Utilities/pull/232';
const native={status:'ok',observedAt:'2026-10-29T11:00:00Z',failures:[],
 observations:[{kind:'PULL',number:232,milestone:'M3',source:url,
 occurrenceId:'github:reallakshman19/XML_Compare_Utilities:pull-head:232:'+head,
 revision:head,sourceAt:'2026-10-29T10:22:02Z',observedAt:'2026-10-29T11:00:00Z',
 state:'DRAFT',qualification:'SELF_ASSESSED',reportedHold:true}]};
const ctx=cycleBoardContextModel(page,{native,pageFetch:{status:'ok',observedAt:'2026-10-29T11:00:00Z'}});
console.log(classifyPageCoverage(page,ctx).status);
"""
        result=subprocess.run(["node","--input-type=module","-e",script,str(self.data),head],
                              cwd=ROOT,capture_output=True,text=True,timeout=25)
        self.assertEqual(result.returncode,0,result.stderr)
        return result.stdout.strip()
    def test_exact_occurrence_then_new_head_reuses_url_without_promoting_progress(self):
        before=self.snapshot();cards_before=self.doc("cards")
        self.assertNotEqual(self.board_coverage(HEAD_A),"CURRENT",
                            "URL-only historic Page has not published this head")
        p=self.propose()
        self.assertEqual(p["blockers"],[])
        self.assertEqual(p["proposal"]["nativeOccurrenceId"],occurrence_id(URL,p["observed"]))
        self.assertEqual(p["proposal"]["wbs"],"2")
        file=self.manifest(p,"first.json")
        dry=B.run(self.data,file)
        self.assertFalse(dry["applied"]);self.assertEqual(len(dry["newEventIds"]),1)
        self.unchanged(before)
        first=B.run(self.data,file,apply=True,observe_source=head_observation(HEAD_A))
        self.assertTrue(first["applied"])
        events=self.doc("audit")["events"]
        self.assertEqual(len(events),len(json.loads(before["audit.json"])["events"])+1)
        prior_event=events[-1]
        self.assertEqual(prior_event["nativeOccurrenceId"],
                         "github:reallakshman19/XML_Compare_Utilities:pull-head:232:"+HEAD_A)
        self.assertEqual(prior_event["source"],URL)
        self.assertEqual(prior_event["card"],"node-r0-code")
        self.assertEqual(prior_event["wbs"],"2")
        self.assertEqual(prior_event["kind"],"UPDATE")
        self.assertEqual(self.board_coverage(HEAD_A),"CURRENT",
                         "exact event through real writer must be recognized by real Board")
        self.assertNotEqual(self.board_coverage(HEAD_B),"CURRENT",
                            "new mutable head is not published just because URL matches")
        self.assertEqual(self.doc("cards")["node-r0-code"]["state"],
                         cards_before["node-r0-code"]["state"])
        self.assertEqual(self.doc("cards")["node-r0-code"]["next"],
                         cards_before["node-r0-code"]["next"])
        self.assertEqual(self.doc("index")["milestones"]["M3"],
                         json.loads(before["index.json"])["milestones"]["M3"])
        self.assertTrue(any(r.get("nativeOccurrenceId")==prior_event["nativeOccurrenceId"] for r in
              self.doc("cards")["node-r0-code"]["refs"]))
        repeat=self.propose()
        self.assertIsNone(repeat["proposal"])
        self.assertTrue(any("ALREADY_RECORDED" in e for e in repeat["blockers"]))
        no_changes=self.snapshot()
        with self.assertRaisesRegex(ValueError,"already recorded"):
            B.run(self.data,file,apply=True,observe_source=head_observation(HEAD_A))
        self.unchanged(no_changes)
        second=self.propose(HEAD_B)
        self.assertEqual(second["blockers"],[],"different exact head can be reviewed on same URL")
        fp=self.manifest(second,"second.json")
        B.run(self.data,fp)
        self.unchanged(no_changes)
        with self.assertRaisesRegex(ValueError,"drifted"):
            B.run(self.data,fp,apply=True,observe_source=head_observation(HEAD_A))
        self.unchanged(no_changes)
        done=B.run(self.data,fp,apply=True,observe_source=head_observation(HEAD_B))
        self.assertTrue(done["applied"])
        after=self.doc("audit")["events"]
        self.assertEqual(len(after),len(events)+1)
        self.assertEqual(after[-2],prior_event)
        self.assertEqual(after[-1]["nativeOccurrenceId"],
                         "github:reallakshman19/XML_Compare_Utilities:pull-head:232:"+HEAD_B)
        self.assertEqual(self.board_coverage(HEAD_B),"CURRENT")
        self.assertEqual(self.doc("cards")["node-r0-code"]["state"],
                         cards_before["node-r0-code"]["state"])
        self.assertEqual(self.doc("cards")["node-r0-code"]["next"],
                         cards_before["node-r0-code"]["next"])
        self.unchanged()
    def test_wrong_card_wbs_project_or_failed_dry_run_preserves_live_copy(self):
        p=self.propose()["proposal"];before=self.snapshot()
        for change in [
            lambda m:m.update(wbs="99"),
            lambda m:m["changes"][0]["args"].update(card="node-r0-ir"),
            lambda m:m.update(project="ciifr"),
            lambda m:m["changes"][0]["args"].update(state="VERIFIED"),
            lambda m:m.update(nativeOccurrenceId="github:other/repo:pull-head:232:"+HEAD_A),
        ]:
            changed=json.loads(json.dumps(p));change(changed)
            path=Path(self.temp.name)/"bad.json";path.write_text(json.dumps(changed))
            with self.assertRaises((ValueError,KeyError,SystemExit)):
                B.run(self.data,path)
            self.unchanged(before)
    def test_legacy_url_only_history_requires_explicit_acknowledgement(self):
        # Seed an older URL-only audit via the original writer path, preserving
        # valid index/card ledger state. No exact head may be inferred from it.
        path=Path(self.temp.name)/"legacy.json"
        legacy={"project":"ciifr-node","actor":"Legacy fixture writer","source":URL,
                "changes":[{"command":"card set","args":{
                   "card":"node-r0-code","summary":"Earlier unversioned reference only",
                   "ref":"pr|Legacy URL|"+URL+"|not independently qualified"}}]}
        path.write_text(json.dumps(legacy))
        B.run(self.data,path,apply=True)
        old=self.doc("audit")["events"][-1]
        self.assertNotIn("nativeOccurrenceId",old)
        self.assertNotEqual(self.board_coverage(HEAD_A),"CURRENT")
        unreviewed=self.propose()
        self.assertIsNone(unreviewed["proposal"])
        self.assertTrue(any("LEGACY_REVIEW_REQUIRED" in e for e in unreviewed["blockers"]))
        before=self.snapshot()
        reviewed=self.propose(review_legacy=True,legacy_reason=
            "Original URL-only history inspected; current head independently rechecked.")
        self.assertEqual(reviewed["blockers"],[])
        self.assertTrue(reviewed["proposal"]["legacyReview"]["acknowledged"])
        reviewed_file=self.manifest(reviewed,"reviewed.json")
        dry=B.run(self.data,reviewed_file)
        self.assertFalse(dry["applied"])
        self.unchanged(before)
        B.run(self.data,reviewed_file,apply=True,observe_source=head_observation(HEAD_A))
        audited=self.doc("audit")["events"]
        self.assertEqual(audited[-2],old,"legacy history remains unchanged")
        self.assertEqual(audited[-1]["nativeOccurrenceId"],reviewed["nativeOccurrenceId"])
        self.unchanged()
    def test_issue_and_comment_board_id_formats_are_source_bound(self):
        self.assertTrue(valid_identity(
            "https://github.com/reallakshman19/XML_Compare_Utilities/issues/231",
            "github:reallakshman19/XML_Compare_Utilities:issue-revision:231:2026-10-29T09:00:00Z"))
        self.assertEqual(occurrence_id(
            "https://github.com/acme/demo/issues/1#issuecomment-100",
            {"kind":"issue-comment","commentId":"100","updatedAt":"2026-10-29T09:00:00Z"}),
            "github:acme/demo:comment-revision:100:2026-10-29T09:00:00Z")
        self.assertFalse(valid_identity(URL,"github:other/repo:pull-head:232:"+HEAD_A))
        self.unchanged()

if __name__=="__main__":unittest.main()
