"""CT-4 effort instrument: self reports can be computed, NEVER treated as verified."""
import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("ct4_effort", ROOT / "tools/ct4_effort.py")
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)
ROLES = ("coder", "ir", "oracle_otm", "owner", "page_writer")
PR = "https://github.com/reallakshman19/progress-page/pull/83"
RECEIPT = "https://github.com/reallakshman19/progress-page/issues/80#issuecomment-6494637221"


def blank():
    return json.loads((ROOT/"tests/fixtures/ct4_effort_blank.json").read_text(encoding="utf-8"))


def observed(values=(14, 9, 6, 5, 4), maintenance=2, setup=30, posts=0,
             workflow="native-evidence-reconciliation", work_unit="one-native-occurrence",
             sample_count=3):
    return {"status": "OBSERVED",
            "scope": {"project": "ciifr-node", "workflow": workflow,
                      "work_unit": work_unit, "sample_count": sample_count},
            "input_basis": dict(tool.INPUT_BASIS),
            "role_minutes": dict(zip(ROLES, values)),
            "maintenance_minutes_per_run": maintenance, "setup_minutes": setup,
            "extra_mandatory_board_reports": posts,
            "time_to_first_runnable_minutes": 12, "continuation_recovery_minutes": 3,
            "evidence": [RECEIPT]}


def claimed_trial():
    return {"status": "PASS",
            "runnable_url": "http://127.0.0.1:8765/#/ciifr-node/cycle-board",
            "evidence": [RECEIPT]}


class EffortPilot(unittest.TestCase):
    def test_blank_fixture_is_not_run_without_fabricated_zero_or_claim(self):
        x = blank()
        output = tool.evaluate(x)
        self.assertEqual(output["disposition"], "NOT_RUN")
        self.assertIsNone(output["provisional_self_reported_minutes_difference_per_run"])
        self.assertFalse(output["optimized_claim_allowed"])
        self.assertIsNone(output["pilot"]["total_minutes_per_run"])
        self.assertEqual(x, blank())

    def test_self_reported_arithmetic_is_correct_but_not_certified(self):
        x = blank()
        x["baseline"] = observed()
        x["pilot"] = observed((10, 5, 4, 3, 2), maintenance=1, setup=20)
        x["candidate"] = {"source_pr": PR, "head_sha": "a"*40}
        x["owner_trial"] = claimed_trial()
        output = tool.evaluate(x)
        self.assertEqual(output["baseline"]["total_minutes_per_run"], 43)
        self.assertEqual(output["pilot"]["total_minutes_per_run"], 27)
        self.assertEqual(output["provisional_self_reported_minutes_difference_per_run"], 16)
        self.assertAlmostEqual(output["provisional_self_reported_fractional_difference"], 16/43)
        self.assertEqual(output["disposition"], "UNVERIFIED_SELF_REPORTED_COMPARISON")
        self.assertEqual(output["owner_trial_self_reported_status"], "PASS")
        self.assertFalse(output["candidate_head_independently_verified"])
        self.assertFalse(output["owner_trial_independently_verified"])
        self.assertFalse(output["independent_non_author_review_verified"])
        self.assertFalse(output["optimized_claim_allowed"])

    def test_fake_sha_and_synthetic_trial_cannot_certify_savings(self):
        x = blank()
        x["baseline"] = observed()
        x["pilot"] = observed((1, 1, 1, 1, 1))
        x["candidate"] = {"source_pr": PR, "head_sha": "f"*40,
                           "verified": True, "independent_review_passed": True}
        x["owner_trial"] = {**claimed_trial(), "independent_verified": True}
        x["independent_verified"] = True
        result = tool.evaluate(x)
        self.assertGreater(result["provisional_self_reported_minutes_difference_per_run"], 0)
        self.assertFalse(result["optimized_claim_allowed"])
        self.assertFalse(result["candidate_head_independently_verified"])

    def test_owner_not_run_and_fail_do_not_certify_even_with_positive_difference(self):
        x = blank()
        x["baseline"] = observed()
        x["pilot"] = observed((1, 1, 1, 1, 1))
        self.assertFalse(tool.evaluate(x)["optimized_claim_allowed"])
        x["candidate"] = {"source_pr": PR, "head_sha": "a"*40}
        x["owner_trial"] = {**claimed_trial(), "status": "FAIL"}
        result = tool.evaluate(x)
        self.assertFalse(result["optimized_claim_allowed"])
        self.assertEqual(result["owner_trial_self_reported_status"], "FAIL")

    def test_extra_mandatory_report_prevents_even_provisional_no_reports_result(self):
        x = blank()
        x["baseline"] = observed()
        x["pilot"] = observed((1, 1, 1, 1, 1), posts=1)
        output = tool.evaluate(x)
        self.assertFalse(output["no_extra_mandatory_board_reports_self_reported"])
        self.assertFalse(output["optimized_claim_allowed"])

    def test_missing_role_and_missing_minutes_not_zero(self):
        x = blank()
        x["baseline"] = observed()
        x["baseline"]["role_minutes"].pop("ir")
        with self.assertRaisesRegex(ValueError, "exactly"):
            tool.evaluate(x)
        x["baseline"]["role_minutes"]["ir"] = None
        with self.assertRaisesRegex(ValueError, "nonnegative"):
            tool.evaluate(x)

    def test_scope_project_workflow_work_unit_and_sample_count_must_match(self):
        x = blank()
        x["baseline"] = observed()
        for tweak in [{"workflow": "different-task"}, {"work_unit": "different-work"},
                      {"sample_count": 4}, {"project": "ciifr"}]:
            y = json.loads(json.dumps(x))
            y["pilot"] = observed()
            y["pilot"]["scope"].update(tweak)
            with self.subTest(tweak=tweak), self.assertRaises(ValueError):
                tool.evaluate(y)
        x["pilot"] = observed()
        result = tool.evaluate(x)
        self.assertTrue(result["comparable_scope_reported"])
        self.assertEqual(result["amortization_runs"], 10)

    def test_three_case_aggregates_must_be_normalized_before_per_run_entry(self):
        # These are entirely synthetic unit-test times, not human trial data.
        x = blank()
        sample_count = 3
        raw_roles = {
            "coder": [12, 15, 15], "ir": [8, 10, 9],
            "oracle_otm": [5, 6, 7], "owner": [4, 5, 6],
            "page_writer": [3, 4, 5],
        }
        means = tuple(sum(raw_roles[role]) / sample_count for role in ROLES)
        x["baseline"] = observed(values=means, maintenance=3, setup=20, sample_count=3)
        x["pilot"] = observed(values=(10, 7, 5, 4, 3),
                              maintenance=2, setup=10, sample_count=3)
        result = tool.evaluate(x)
        # 14+9+6+5+4 = 38 minutes PER CASE, not 114 minutes/run.
        self.assertEqual(result["baseline"]["active_role_minutes"], 38)
        self.assertEqual(result["baseline"]["total_minutes_per_run"], 43)
        self.assertEqual(result["baseline"]["input_basis"]["role_minutes"], "PER_RUN_MEAN")
        self.assertEqual(result["pilot"]["total_minutes_per_run"], 32)
        self.assertFalse(result["optimized_claim_allowed"])
        # A user supplying three-case totals with a TOTAL basis fails closed.
        bad = json.loads(json.dumps(x))
        bad["baseline"]["role_minutes"] = {
            k: sum(v) for k, v in raw_roles.items()
        }
        bad["baseline"]["input_basis"]["role_minutes"] = "THREE_CASE_TOTAL"
        with self.assertRaisesRegex(ValueError, "PER_RUN_MEAN"):
            tool.evaluate(bad)
        # Missing basis is also invalid; no implicit guess from sample_count=3.
        del bad["baseline"]["input_basis"]
        with self.assertRaisesRegex(ValueError, "PER_RUN_MEAN"):
            tool.evaluate(bad)

    def test_per_run_mean_is_not_inadvertently_divided_by_sample_count(self):
        x = blank()
        x["baseline"] = observed(sample_count=3)
        x["pilot"] = observed(sample_count=3)
        three = tool.evaluate(x)
        self.assertEqual(three["baseline"]["active_role_minutes"], 38)
        self.assertEqual(three["baseline"]["total_minutes_per_run"], 43)
        self.assertEqual(three["provisional_self_reported_minutes_difference_per_run"], 0)
        # Same per-run means and same setup horizon do not change if the
        # number of matched observations changes (after both cohorts match).
        x["baseline"]["scope"]["sample_count"] = 6
        x["pilot"]["scope"]["sample_count"] = 6
        six = tool.evaluate(x)
        self.assertEqual(six["baseline"]["total_minutes_per_run"], 43)

    def test_bad_observation_types_are_rejected(self):
        for k,v in (("setup_minutes", -1),
                    ("maintenance_minutes_per_run", float("nan")),
                    ("setup_minutes", True),
                    ("extra_mandatory_board_reports", True)):
            x = blank()
            x["baseline"] = observed()
            x["baseline"][k] = v
            with self.subTest(k=k), self.assertRaises(ValueError):
                tool.evaluate(x)

    def test_free_text_source_is_not_valid_evidence(self):
        x = blank()
        x["baseline"] = observed()
        x["baseline"]["evidence"] = ["source"]
        with self.assertRaisesRegex(ValueError, "public"):
            tool.evaluate(x)

    def test_http_not_a_url_rejected_for_owner_trial(self):
        x = blank()
        x["candidate"] = {"source_pr": PR, "head_sha": "a"*40}
        x["owner_trial"] = {"status": "PASS", "runnable_url": "http-not-a-url",
                            "evidence": [RECEIPT]}
        with self.assertRaisesRegex(ValueError, "URL|http"):
            tool.evaluate(x)

    def test_source_pr_and_sha_are_checked_syntactically_not_attested(self):
        x = blank()
        x["candidate"] = {"source_pr": "https://example.com/pull/83", "head_sha": "a"*40}
        with self.assertRaisesRegex(ValueError, "github"):
            tool.evaluate(x)
        x["candidate"] = {"source_pr": PR, "head_sha": "not-a-real-sha"}
        with self.assertRaisesRegex(ValueError, "40 hexadecimal"):
            tool.evaluate(x)

    def test_private_links_and_tokens_are_rejected_anywhere_in_receipt(self):
        for secret in (
            "https://chatgpt.com/c/private",
            "https://claude.ai/chat/private",
            "ghp_ABCDEFGHIJKLMNOPQRST1234",
            "github_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ12345",
            "sk-ABCdef1234567890123456789",
            "123e4567-e89b-42d3-a456-426614174000",
        ):
            x = blank()
            x["owner_trial"]["notes"] = secret
            with self.subTest(secret=secret[:8]), self.assertRaisesRegex(ValueError, "private"):
                tool.evaluate(x)

    def test_public_source_refs_reject_query_credential_and_unsafe_http(self):
        x = blank()
        x["baseline"] = observed()
        for ref in (
            "https://github.com/reallakshman19/progress-page/issues/80?token=fake",
            "https://username:password@github.com/reallakshman19/progress-page/issues/80",
            "http://github.com/reallakshman19/progress-page/issues/80",
        ):
            y = json.loads(json.dumps(x))
            y["baseline"]["evidence"] = [ref]
            with self.subTest(ref=ref.split("?")[0][:24]), self.assertRaises(ValueError):
                tool.evaluate(y)
        x = blank()
        x["candidate"] = {"source_pr": PR, "head_sha": "a"*40}
        x["owner_trial"] = {**claimed_trial(), "runnable_url": "http://some-external-host.example/"}
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            tool.evaluate(x)

    def test_trial_requires_candidate_pr_sha_and_evidence(self):
        x = blank()
        x["owner_trial"] = claimed_trial()
        with self.assertRaisesRegex(ValueError, "PR locator"):
            tool.evaluate(x)
        x["candidate"] = {"source_pr": PR, "head_sha": "a"*40}
        x["owner_trial"]["evidence"] = []
        with self.assertRaisesRegex(ValueError, "referenced evidence"):
            tool.evaluate(x)

    def test_cli_blank_fixture_is_read_only_and_not_run(self):
        path = ROOT/"tests/fixtures/ct4_effort_blank.json"
        before = path.read_bytes()
        p = subprocess.run([sys.executable, str(ROOT/"tools/ct4_effort.py"),"--input",str(path)],
                           capture_output=True,text=True,check=False,timeout=15)
        self.assertEqual(p.returncode,0,p.stderr)
        self.assertEqual(json.loads(p.stdout)["disposition"],"NOT_RUN")
        self.assertEqual(path.read_bytes(),before)


if __name__ == "__main__":
    unittest.main()
