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


    @staticmethod
    def coverage(blob="a"*40,head=HEAD0,gaps=None,merged=True,available=True):
        def run(data,project,cycle,wbs):
            assert project==cycle=="ciifr" and wbs=="3"
            if not available:
                raise OSError("canonical source unavailable")
            missing=(["CURRENT_NATIVE_TASK_NOT_LINKED_IN_WBS",
                      "CURRENT_CANDIDATE_NOT_LINKED_IN_WBS",
                      "CYCLE_MERGE_DECISION_OUTDATED_BY_NATIVE_MERGE"]
                     if gaps is None else gaps)
            return {"pageProject":project,"cycleProject":cycle,"wbs":"wbs:3",
                    "result":"INSUFFICIENT_EVIDENCE" if missing else "READY_FOR_REVIEW",
                    "gaps":missing,"conflicts":[],"candidate":head,
                    "source":{"cycleBlobSha":blob,"cycleUrl":"https://github.com/example/Cycle"},
                    "nativeObservation":{"WBS":"OK","TASK":"OK","CANDIDATE":"OK"},
                    "nativeState":{"CANDIDATE":{"kind":"pull","observedHead":head,
                                                 "state":"closed" if merged else "open",
                                                 "merged":merged}},
                    "verified":["CURRENT_NATIVE_CANDIDATE_HEAD_MATCH"]}
        return run
    def cycle_scan(self,probe):
        return J.check(self.data,"ciifr",self.baseline,self.report,self.cache,
                       fetch=self.fetch(HEAD0),cycle="ciifr",wbs="3",cycle_probe=probe)
    def test_unlinked_canonical_sources_flag_once_then_noop(self):
        original=self.freeze()
        first=self.cycle_scan(self.coverage())
        self.assertEqual(first["monitorStatus"],"COVERAGE_GAP_REVIEW")
        self.assertIn("CURRENT_NATIVE_TASK_NOT_LINKED_IN_WBS",first["cycleCoverage"]["gaps"])
        self.assertTrue(first["complete"])
        self.assertFalse(first["pageDataWritten"])
        self.assertFalse(first["cycleCoverage"]["bindingActivated"])
        self.baseline.parent.mkdir(parents=True,exist_ok=True)
        self.baseline.write_bytes(self.cache.read_bytes())
        same=self.cycle_scan(self.coverage())
        self.assertEqual(same["monitorStatus"],"NO_CHANGE")
        self.assertEqual(first["reconciliationHealth"],"NEEDS_RECONCILIATION")
        self.assertEqual(same["reconciliationHealth"],"NEEDS_RECONCILIATION")
        self.assertTrue(same["reconciliationRequired"])
        changed=self.cycle_scan(self.coverage(blob="b"*40,gaps=[]))
        self.assertEqual(changed["monitorStatus"],"SOURCE_CHANGE_REVIEW")
        self.assertEqual(changed["reconciliationHealth"],"READY_FOR_REVIEW")
        self.assertFalse(changed["reconciliationRequired"])
        self.assertEqual(self.freeze(),original)
    def test_canonical_native_merge_change_is_a_delta_not_acceptance(self):
        self.cycle_scan(self.coverage(merged=False))
        self.baseline.parent.mkdir(parents=True,exist_ok=True)
        self.baseline.write_bytes(self.cache.read_bytes())
        changed=self.cycle_scan(self.coverage(merged=True))
        self.assertEqual(changed["monitorStatus"],"SOURCE_CHANGE_REVIEW")
        self.assertFalse(changed["nativeAcceptanceInferred"])
        self.assertEqual(changed["cycleCoverage"]["fingerprint"]["nativeState"]["CANDIDATE"]["merged"],True)
    def test_unavailable_cycle_preserves_healthy_baseline_and_is_unknown(self):
        self.cycle_scan(self.coverage())
        old=self.cache.read_bytes()
        self.baseline.parent.mkdir(parents=True,exist_ok=True)
        self.baseline.write_bytes(old)
        result=self.cycle_scan(self.coverage(available=False))
        self.assertEqual(result["monitorStatus"],"UNKNOWN")
        self.assertFalse(result["complete"])
        self.assertEqual(result["reconciliationHealth"],"UNKNOWN")
        self.assertEqual(self.cache.read_bytes(),old)
    def test_same_gap_stays_visible_without_repeat_artifact(self):
        from unittest.mock import patch
        original=self.cycle_scan(self.coverage())
        self.baseline.parent.mkdir(parents=True,exist_ok=True)
        self.baseline.write_bytes(self.cache.read_bytes())
        output=Path(self.temp.name)/"github-output.txt"
        summary=Path(self.temp.name)/"github-summary.txt"
        argv=["watch","--data",str(self.data),"--project","ciifr",
              "--cycle","ciifr","--wbs","3","--baseline",str(self.baseline),
              "--report",str(self.report),"--cache",str(self.cache)]
        # The runner uses the same check result as the pure source fixture, no API.
        unchanged=self.cycle_scan(self.coverage())
        self.assertEqual(unchanged["monitorStatus"],"NO_CHANGE")
        with patch.object(J,"check",return_value=unchanged),patch.object(sys,"argv",argv),patch.dict("os.environ",{"GITHUB_OUTPUT":str(output),"GITHUB_STEP_SUMMARY":str(summary)}):
            self.assertEqual(J.run(),0)
        self.assertIn("open_gap=true",output.read_text())
        self.assertIn("needs_review=false",output.read_text())
        self.assertIn("Unresolved source gap persists",summary.read_text())
        self.assertIn("NEEDS_RECONCILIATION",summary.read_text())
        self.assertFalse(original["pageDataWritten"])
    def test_scoped_monitor_rejects_missing_explicit_wbs(self):
        with self.assertRaises(ValueError):
            J.check(self.data,"ciifr",self.baseline,self.report,self.cache,
                    fetch=self.fetch(HEAD0),cycle="ciifr")
    def test_workflow_is_read_only_single_scope_and_restores_exact_baseline_path(self):
        wf=(Path(__file__).resolve().parents[1]/".github/workflows/native-source-watch.yml").read_text()
        self.assertIn("contents: read",wf)
        self.assertNotIn("contents: write",wf)
        self.assertNotIn("pull_request:",wf)
        self.assertIn("push:",wf)
        self.assertIn("branches: [main]",wf)
        self.assertIn("'data/ciifr/**'",wf)
        self.assertIn("'tools/pp_cycle_preflight.py'",wf)
        self.assertIn("17 5,11,17,23 * * *",wf)
        self.assertIn("workflow_dispatch:",wf)
        self.assertIn("schedule:",wf)
        self.assertIn("--project ciifr",wf)
        self.assertIn("--cycle ciifr",wf)
        self.assertIn("--wbs 3",wf)
        self.assertIn("--limit 100",wf)
        self.assertEqual(wf.count("path: .pp-watch/ciifr-baseline.json"),2)
        self.assertIn("--baseline .pp-watch/ciifr-baseline.json",wf)
        self.assertIn("--cache .pp-watch/ciifr-baseline.json",wf)
        self.assertNotIn("pp_batch",wf)

if __name__=="__main__":
    unittest.main()
