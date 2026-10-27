"""Scheduled source monitor: no Page writes, no duplicated log or false no-op."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
import pp_watch_job as J

PR="https://github.com/acme/sample/pull/12"
HEAD0="0"*40
HEAD1="1"*40

class Monitor(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root=Path(self.temp.name)
        self.data=root/"data"
        (self.data/"ciifr").mkdir(parents=True)
        (self.data/"ciifr"/"index.json").write_text(json.dumps({"project":{"key":"ciifr"}}))
        (self.data/"ciifr"/"cards.json").write_text(json.dumps({"only":{"src":PR}}))
        self.baseline=root/"state"/"prior.json"
        self.report=root/"artifacts"/"observation.json"
        self.cache=root/"state"/"latest.json"
    def fetch(self,head):
        def reply(url):
            if url.endswith("/pulls/12"):
                return {"head":{"sha":head},"state":"open","merged":False}
            raise ValueError("unexpected GitHub source")
        return reply
    def scan(self,fetch):
        return J.check(self.data,"ciifr",self.baseline,self.report,self.cache,fetch=fetch)
    def freeze(self):
        return {str(p):p.read_bytes() for p in self.data.rglob("*.json")}
    def test_first_complete_scan_seeds_baseline_without_faking_change(self):
        prior=self.freeze()
        first=self.scan(self.fetch(HEAD0))
        self.assertEqual(first["monitorStatus"],"BASELINE_ESTABLISHED")
        self.assertEqual(first["counts"]["BASELINE_REQUIRED"],1)
        self.assertFalse(first["pageDataWritten"])
        self.assertTrue(self.cache.is_file())
        self.assertEqual(self.freeze(),prior)
    def test_repeated_scan_noops_and_native_head_change_needs_review(self):
        self.scan(self.fetch(HEAD0))
        self.baseline.parent.mkdir(parents=True,exist_ok=True)
        self.baseline.write_bytes(self.cache.read_bytes())
        prior=self.freeze()
        unchanged=self.scan(self.fetch(HEAD0))
        self.assertEqual(unchanged["monitorStatus"],"NO_CHANGE")
        self.assertEqual(unchanged["counts"]["NO_CHANGE"],1)
        changed=self.scan(self.fetch(HEAD1))
        self.assertEqual(changed["monitorStatus"],"SOURCE_CHANGE_REVIEW")
        self.assertEqual(changed["counts"]["SOURCE_CHANGED"],1)
        self.assertFalse(changed["nativeAcceptanceInferred"])
        self.assertEqual(self.freeze(),prior)
    def test_failed_retrieval_preserves_last_healthy_baseline(self):
        self.scan(self.fetch(HEAD0))
        old=self.cache.read_bytes()
        self.baseline.write_bytes(old)
        def failed(_):
            raise OSError("offline")
        result=self.scan(failed)
        self.assertEqual(result["monitorStatus"],"UNKNOWN")
        self.assertEqual(self.cache.read_bytes(),old)
        self.assertEqual(json.loads(self.report.read_text())["monitorStatus"],"UNKNOWN")
    def test_truncation_is_not_a_fresh_or_noop_claim(self):
        (self.data/"ciifr"/"cards.json").write_text(json.dumps({
            "one":{"src":PR},"two":{"src":"https://github.com/acme/sample/issues/42"}}))
        prior=self.freeze()
        result=J.check(self.data,"ciifr",self.baseline,self.report,self.cache,
                       limit=1,fetch=self.fetch(HEAD0))
        self.assertEqual(result["monitorStatus"],"UNKNOWN")
        self.assertEqual(result["omitted"],1)
        self.assertFalse(self.cache.exists())
        self.assertEqual(self.freeze(),prior)
    def test_broken_prior_baseline_fails_closed(self):
        self.baseline.parent.mkdir(parents=True,exist_ok=True)
        self.baseline.write_text("{broken")
        with self.assertRaises(json.JSONDecodeError):
            self.scan(self.fetch(HEAD0))
        self.assertFalse(self.cache.exists())

    def test_workflow_is_read_only_single_scope_and_restores_exact_baseline_path(self):
        wf=(Path(__file__).resolve().parents[1]/".github/workflows/native-source-watch.yml").read_text()
        self.assertIn("contents: read",wf)
        self.assertNotIn("contents: write",wf)
        self.assertNotIn("pull_request:",wf)
        self.assertIn("workflow_dispatch:",wf)
        self.assertIn("schedule:",wf)
        self.assertIn("--project ciifr",wf)
        self.assertIn("--limit 100",wf)
        self.assertEqual(wf.count("path: .pp-watch/ciifr-baseline.json"),2)
        self.assertIn("--baseline .pp-watch/ciifr-baseline.json",wf)
        self.assertIn("--cache .pp-watch/ciifr-baseline.json",wf)
        self.assertNotIn("pp_batch",wf)

if __name__=="__main__":
    unittest.main()
