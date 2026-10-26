"""Source-to-Page proposals: exact GitHub identity, minimal audited reference, no implicit PASS."""
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
import pp_propose as P
import pp_batch as B
from helpers import copy_valid,load

SOURCE="https://github.com/acme/demo/pull/999"
HEAD="a"*40
CHANGED="b"*40
ISSUE="https://github.com/acme/demo/issues/999"
def fake(url):
    if url.endswith("/pulls/999"):
        return {"title":"Candidate (not Owner verified)","state":"open","merged":False,
                "head":{"sha":HEAD},"updated_at":"2026-10-26T17:00:00Z"}
    if url.endswith("/issues/999"):
        return {"title":"Trial record","state":"open","updated_at":"2026-10-26T17:00:00Z"}
    raise ValueError("unexpected GitHub endpoint: "+url)

class Proposal(unittest.TestCase):
    def setUp(self):self.data=copy_valid()
    def test_unmatched_source_never_infers_a_card_or_writes_data(self):
        audit=Path(self.data)/"demo"/"audit.json"
        before=audit.read_bytes()
        p=P.propose(self.data,"demo",SOURCE,"Oracle",fetch=fake)
        self.assertIsNone(p["proposal"])
        self.assertIn("CARD_SELECTION_REQUIRED",p["blockers"][0])
        self.assertEqual(before,audit.read_bytes())
    def test_selected_card_generates_ref_only_not_state_or_permission(self):
        p=P.propose(self.data,"demo",SOURCE,"Oracle",card_id="a1",fetch=fake)
        self.assertEqual(p["proposalVersion"] if "proposalVersion" in p else p["proposal"]["proposalVersion"],1)
        m=p["proposal"]
        self.assertEqual(m["sourceObservation"]["observedHead"],HEAD)
        self.assertEqual(len(m["changes"]),1)
        change=m["changes"][0]
        self.assertEqual(change["command"],"card set")
        self.assertEqual(set(change["args"]),{"card","summary","ref"})
        self.assertNotIn("state",change["args"])
        self.assertEqual(p["selectedCardExistingState"],"SUBMITTED")
        path=Path(self.data).parent/"proposal.json"
        path.write_text(json.dumps(m),encoding="utf-8")
        before=load(Path(self.data)/"demo"/"cards.json")
        audit_before=load(Path(self.data)/"demo"/"audit.json")
        dry=B.run(self.data,path)
        self.assertFalse(dry["applied"])
        self.assertEqual(before,load(Path(self.data)/"demo"/"cards.json"))
        with self.assertRaisesRegex(ValueError,"drifted"):
            B.run(self.data,path,apply=True,observe_source=lambda _: {"kind":"pull","observedHead":CHANGED})
        applied=B.run(self.data,path,apply=True,observe_source=lambda _: {"kind":"pull","observedHead":HEAD})
        self.assertTrue(applied["applied"])
        after=load(Path(self.data)/"demo"/"cards.json")
        self.assertEqual(after["a1"]["state"],"SUBMITTED")
        self.assertEqual(after["a1"]["next"],before["a1"]["next"])
        self.assertEqual(after["a1"]["now"],before["a1"]["now"])
        self.assertEqual(len(after["a1"]["refs"]),len(before["a1"]["refs"])+1)
        self.assertEqual(len(load(Path(self.data)/"demo"/"audit.json")["events"]),len(audit_before["events"])+1)
    def test_existing_event_and_drift_fail_closed(self):
        from helpers import SRC
        def existing(url):
            if url.endswith("/issues/1"): return {"title":"Source","state":"open"}
            if url.endswith("/issues/comments/100"): return {"html_url":SRC,"updated_at":"2026-10-26T17:00:00Z"}
            raise ValueError(url)
        p=P.propose(self.data,"demo",SRC,"Oracle",card_id="a1",fetch=existing)
        self.assertIsNone(p["proposal"])
        self.assertTrue(any("ALREADY_RECORDED" in x for x in p["blockers"]))
        p2=P.propose(self.data,"demo",SOURCE,"Oracle",card_id="a1",expected_head=CHANGED,fetch=fake)
        self.assertIsNone(p2["proposal"])
        self.assertTrue(any("HEAD_DRIFT" in x for x in p2["blockers"]))
    def test_commentless_issue_updatedat_is_fingerprinted_and_rechecked(self):
        p=P.propose(self.data,"demo",ISSUE,"Oracle",card_id="a1",fetch=fake)
        self.assertEqual(p["proposal"]["sourceObservation"]["updatedAt"],"2026-10-26T17:00:00Z")
        B.source_fresh(p["proposal"],lambda _: {"kind":"issue","updatedAt":"2026-10-26T17:00:00Z"})
        with self.assertRaisesRegex(ValueError,"drifted"):
            B.source_fresh(p["proposal"],lambda _: {"kind":"issue","updatedAt":"2026-10-26T17:01:00Z"})
    def test_tampered_manifest_cannot_assign_status_or_replace_next(self):
        p=P.propose(self.data,"demo",SOURCE,"Oracle",card_id="a1",fetch=fake)["proposal"]
        p["changes"][0]["args"]["state"]="VERIFIED"
        with self.assertRaisesRegex(ValueError,"only append"):B.commands(p)
        p["changes"][0]["args"].pop("state")
        p["changes"][0]["args"]["next_text"]="Release"
        with self.assertRaisesRegex(ValueError,"only append"):B.commands(p)
    def test_commit_without_native_ref_kind_is_not_published(self):
        url="https://github.com/acme/demo/commit/"+HEAD
        p=P.propose(self.data,"demo",url,"Oracle",card_id="a1",
           fetch=lambda _:{"sha":HEAD,"commit":{"message":"ready"}})
        self.assertIsNone(p["proposal"])
        self.assertTrue(any("COMMIT_CARD_REF_UNSUPPORTED" in x for x in p["blockers"]))

if __name__=="__main__":unittest.main()
