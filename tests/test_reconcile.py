"""Reconciliation tests: source validation, exact SHA identity and no auto-PASS."""
import json
import tempfile
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import pp_reconcile as R

PR="https://github.com/example/engineering/pull/185"
COMMENT="https://github.com/example/engineering/issues/186#issuecomment-2"
SHA1="a"*40
SHA2="b"*40

class Reconcile(unittest.TestCase):
    def mkdata(self):
        t=tempfile.TemporaryDirectory()
        d=Path(t.name)/"data"/"demo";d.mkdir(parents=True)
        (d/"index.json").write_text(json.dumps({"project":{"key":"demo"}}))
        (d/"cards.json").write_text(json.dumps({"builder":{"state":"SUBMITTED"}}))
        (d/"audit.json").write_text(json.dumps({"events":[{"id":"DEMO-R-0001","source":PR}]}))
        self.addCleanup(t.cleanup)
        return str(Path(t.name)/"data")
    def fake(self,url):
        if url.endswith("/pulls/185"):
            return {"head":{"sha":SHA2},"title":"Real change","state":"open","merged":False}
        if url.endswith("/issues/186"):
            return {"title":"Trial record"}
        if url.endswith("/issues/comments/2"):
            return {"html_url":COMMENT, "updated_at":"2026-10-26T11:00:00Z"}
        raise ValueError("unexpected "+url)
    def test_drift_is_high_signal_and_read_only(self):
        root=self.mkdata(); before=(Path(root)/"demo"/"audit.json").read_bytes()
        result=R.reconcile(root,"demo",PR,SHA1,"builder",self.fake)
        self.assertEqual(result["alerts"][0]["code"],"CANDIDATE_DRIFT")
        self.assertEqual(result["recordedEventIds"],["DEMO-R-0001"])
        self.assertEqual(result["existingCardState"],"SUBMITTED")
        self.assertFalse(result["automatedStatusPromotion"])
        self.assertEqual(before,(Path(root)/"demo"/"audit.json").read_bytes())
    def test_duplicate_source_does_not_create_new_event(self):
        root=self.mkdata();r=R.reconcile(root,"demo",PR,SHA2,fetch=self.fake)
        self.assertEqual([a["code"] for a in r["alerts"]],["ALREADY_RECORDED"])
    def test_missing_receipt_is_reported_and_comment_identity_bound(self):
        root=self.mkdata();r=R.reconcile(root,"demo",COMMENT,fetch=self.fake)
        self.assertEqual(r["observation"]["kind"],"issue-comment")
        self.assertEqual(r["alerts"][0]["code"],"SOURCE_NOT_RECORDED")
    def test_url_restrictions(self):
        bad=["http://github.com/example/engineering/pull/185","https://github.com.evil.com/example/engineering/pull/185",
             "https://github.com/example/engineering/pull/185?token=x","https://github.com/example/engineering/issues/186#bogus",
             "https://github.com/example/engineering/pull/185#extra","https://github.com/example/engineering/actions"]
        for u in bad:
            with self.subTest(u=u),self.assertRaises(ValueError): R.source_target(u)
    def test_no_head_observation_cannot_accept_expected_head(self):
        with self.assertRaises(ValueError): R.reconcile(self.mkdata(),"demo",COMMENT,SHA1,fetch=self.fake)

if __name__=="__main__": unittest.main()
