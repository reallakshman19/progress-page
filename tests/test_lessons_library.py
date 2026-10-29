"""Tests for source-grounded vertical Lessons library."""
import json
import subprocess
import shutil
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))

class LessonsTest(unittest.TestCase):
    def test_archive_and_ledger(self):
        p = {x["key"]: x for x in read("data/projects.json")["projects"]}
        self.assertEqual(p["lessons"]["status"], "archived")
        self.assertEqual(p["learned"]["label"], "Lessons")
        self.assertNotIn("status", p["learned"])
        self.assertEqual(p["lessons"]["label"], "Lessons (legacy R1)")
        events = read("data/lessons/audit.json")["events"]
        self.assertEqual(len(events), 23)
        self.assertEqual([e["seq"] for e in events], list(range(1, 24)))
        self.assertEqual(events[-1]["kind"], "ARCHIVE")
        self.assertEqual(events[-2]["id"], "LESSONS-R-0022")

    def test_content_and_evidence(self):
        a, b, c = read("data/learned/lessons.json")["items"]
        self.assertEqual([a["id"], b["id"], c["id"]], ["L01", "L02", "L03"])
        self.assertEqual((len(a["issues"]), len(a["actions"]), len(a["open"])), (7, 8, 3))
        self.assertEqual((b["status"], len(b["cases"]), len(b["rules"])), ("DRAFT", 9, 8))
        ids = {x["id"] for x in a["actions"]}
        self.assertTrue(all(set(x["actions"]) <= ids for x in a["issues"]))
        self.assertTrue(all(x["source"].startswith("https://github.com/") for x in a["issues"] + a["actions"] + a["open"]))
        self.assertTrue(all(x["state"] == "RECORDED_DONE" for x in a["actions"]))
        self.assertTrue(all(x["discriminating_test"] and x["evidence_limit"] for x in b["cases"]))
        self.assertEqual((c["status"], len(c["recoveries"]), len(c["stages"])), ("DRAFT", 5, 5))
        self.assertTrue(all(x["problem"] and x["correction"] for x in c["recoveries"]))
        self.assertTrue(all(x["action"] and x["evidence"] for x in c["stages"]))

    def test_vertical_view(self):
        js = (ROOT / "lessons.js").read_text(encoding="utf-8")
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn("llSection(page, '03", js)
        self.assertIn("llSection(page, '05", js)
        self.assertIn("const lessonIds =", app)
        self.assertIn("Lessons subtabs", app)
        self.assertIn("'Overview'", app)
        self.assertIn("'Lesson ' + (i + 1)", app)
        self.assertIn("aria-current", app)
        self.assertIn("navLink('#/learned/' + id", app)
        self.assertIn("renderLessons(page, p.lessons", app)
        self.assertNotIn("milestoneState", js)

    def test_local_snapshot(self):
        from tools.build_local import snapshot
        out = snapshot(ROOT / "data")
        self.assertEqual([x["id"] for x in out["files"]["learned/lessons.json"]["items"]], ["L01", "L02", "L03"])

    def test_syntax(self):
        if not shutil.which("node"):
            self.skipTest("node not installed")
        for name in ("app.js", "lessons.js"):
            p = subprocess.run(["node", "--input-type=module", "--check"], input=(ROOT / name).read_text(encoding="utf-8"), text=True, capture_output=True)
            self.assertEqual(p.returncode, 0, p.stderr)

