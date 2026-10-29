"""CT-3 integrated real-project replay: existing Page writer on a COPY of CIIFR-Node.

No GitHub API mutation, no edits to checked-out data/, no proposal on production.
The original PR232/issue231 identities are replay fixtures, not live acceptance.
"""
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
import pp_propose as P
import pp_batch as B

PR="https://github.com/reallakshman19/XML_Compare_Utilities/pull/232"
ISSUE="https://github.com/reallakshman19/XML_Compare_Utilities/issues/231"
SHA="7f5dc773ac7bb08544d086be734e4337295088a0"
NEW_SHA="b"*40
UPDATED="2026-10-29T07:00:00Z"

def native(url):
    if url.endswith("/pulls/232"):
        return {"number":232,"title":"R0 repair SELF_ASSESSED, IR HOLD",
                "state":"open","draft":True,"head":{"sha":SHA},
                "updated_at":"2026-10-29T08:00:00Z"}
    if url.endswith("/issues/231"):
        return {"number":231,"title":"Native issue · repair evidence",
                "state":"open","updated_at":UPDATED}
    raise ValueError("unexpected replay API "+url)

class WriterVertical(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix="ct3-writer-")
        self.addCleanup(self.tmp.cleanup)
        self.data=Path(self.tmp.name)/"data"
        # Preserve all original site validation dependencies and public fixtures.
        shutil.copytree(ROOT/"data",self.data)
        self.source_bytes={p:p.read_bytes() for p in
            [ROOT/"data/ciifr-node/index.json",
             ROOT/"data/ciifr-node/cards.json",
             ROOT/"data/ciifr-node/audit.json"]}
        self.audit_before=json.loads((self.data/"ciifr-node/audit.json").read_text())["events"]
        self.cards_before=json.loads((self.data/"ciifr-node/cards.json").read_text())
    def assert_production_unmodified(self):
        for path,value in self.source_bytes.items():
            self.assertEqual(path.read_bytes(),value)
        self.assertEqual(json.loads((self.data/"ciifr-node/audit.json").read_text())["events"],
                         self.audit_before)
        self.assertEqual(json.loads((self.data/"ciifr-node/cards.json").read_text()),
                         self.cards_before)
    def proposal(self,source=PR,head=SHA):
        return P.propose(self.data,"ciifr-node",source,"Authorized writer review fixture",
                         card_id="node-r0-code",expected_head=head if source==PR else None,
                         fetch=native)
    def test_pr232_existing_writer_manifest_and_real_dry_run(self):
        p=self.proposal()
        self.assertEqual(p["selectedCard"],"node-r0-code")
        self.assertEqual(p["selectedCardExistingState"],"SUBMITTED")
        self.assertFalse(p["dataWritten"])
        self.assertTrue(p["reviewRequired"])
        self.assertEqual(p["blockers"],[])
        manifest=p["proposal"]
        self.assertEqual(manifest["sourceObservation"],
                         {"kind":"pull","observedHead":SHA})
        self.assertEqual(manifest["proposalVersion"],2)
        self.assertEqual(manifest["nativeOccurrenceId"],
                         "github:reallakshman19/XML_Compare_Utilities:pull-head:232:"+SHA)
        self.assertEqual(manifest["wbs"],"2")
        self.assertEqual(len(manifest["changes"]),1)
        self.assertEqual(manifest["changes"][0]["command"],"card set")
        self.assertEqual(set(manifest["changes"][0]["args"]),{"card","summary","ref"})
        self.assertNotIn("state",manifest["changes"][0]["args"])
        self.assertNotIn("next",manifest["changes"][0]["args"])
        proposalFile=Path(self.tmp.name)/"reviewed-proposal.json"
        proposalFile.write_text(json.dumps(manifest),encoding="utf-8")
        result=B.run(self.data,proposalFile)
        self.assertFalse(result["applied"])
        self.assertTrue(result["checked"])
        self.assertEqual(result["commands"],1)
        self.assertEqual(len(result["newEventIds"]),1)
        self.assertIn("ciifr-node/audit.json",result["changedFiles"])
        self.assertIn("ciifr-node/cards.json",result["changedFiles"])
        self.assert_production_unmodified()
        with self.assertRaisesRegex(ValueError,"drifted"):
            B.source_fresh(manifest,reader=lambda u:{"kind":"pull","observedHead":NEW_SHA})
        B.source_fresh(manifest,reader=lambda u:{"kind":"pull","observedHead":SHA})
    def test_issues_use_revision_updated_at_no_head_or_auto_pass(self):
        p=self.proposal(source=ISSUE)
        self.assertEqual(p["blockers"],[])
        m=p["proposal"]
        self.assertEqual(m["sourceObservation"],
                         {"kind":"issue","updatedAt":UPDATED})
        self.assertEqual(set(m["changes"][0]["args"]),{"card","summary","ref"})
        self.assertEqual(m["nativeOccurrenceId"],
                         "github:reallakshman19/XML_Compare_Utilities:issue-revision:231:"+UPDATED)
        self.assertEqual(m["changes"][0]["args"]["ref"].split("|")[0],"issue")
        self.assert_production_unmodified()
    def test_legacy_url_audit_requires_explicit_writer_review(self):
        path=self.data/"ciifr-node/audit.json"
        audit=json.loads(path.read_text())
        latest=audit["events"][-1].copy()
        latest.update({"seq":len(audit["events"])+1,"id":"CIIFR-NODE-R-0030",
                      "previous_id":audit["events"][-1]["id"],
                      "source":PR,"card":"node-r0-code"})
        audit["events"].append(latest)
        path.write_text(json.dumps(audit))
        p=self.proposal()
        self.assertIsNone(p["proposal"])
        self.assertTrue(any("LEGACY_REVIEW_REQUIRED" in b for b in p["blockers"]))
        self.assertEqual(json.loads(path.read_text())["events"][-1]["source"],PR)
        self.assertEqual((ROOT/"data/ciifr-node/audit.json").read_bytes(),
                         self.source_bytes[ROOT/"data/ciifr-node/audit.json"])
    def test_wrong_head_and_invalid_card_never_produce_manifest(self):
        bad=self.proposal(head=NEW_SHA)
        self.assertIsNone(bad["proposal"])
        self.assertTrue(any("HEAD_DRIFT" in x for x in bad["blockers"]))
        with self.assertRaises((KeyError,ValueError)):
            P.propose(self.data,"ciifr-node",PR,"Writer",card_id="absent",
                      expected_head=SHA,fetch=native)
        self.assert_production_unmodified()
    def test_tampered_writer_manifest_cannot_promote_gate(self):
        m=self.proposal()["proposal"]
        m["changes"][0]["args"]["state"]="VERIFIED"
        with self.assertRaisesRegex(ValueError,"only append"):
            B.commands(m)
        m["changes"][0]["args"].pop("state")
        m["changes"][0]["args"]["next_text"]="Owner accepted"
        with self.assertRaisesRegex(ValueError,"only append"):
            B.commands(m)
        self.assert_production_unmodified()

if __name__=="__main__":unittest.main()
