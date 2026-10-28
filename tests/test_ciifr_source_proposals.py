"""CIIFR WBS3 source proposal: exercised through the existing batch dry-run, never a data write."""
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
import pp_batch as B

PROPOSALS=ROOT/"proposals"/"ciifr-wbs3-pr191"
SRC={
 "issue-180.json":"https://github.com/reallakshman19/XML_Compare_Utilities/issues/180",
 "pr-191.json":"https://github.com/reallakshman19/XML_Compare_Utilities/pull/191",
}

class CIIFRProjectionHandoff(unittest.TestCase):
    def test_exact_native_sources_validate_as_reference_only_dry_runs(self):
        cards_path=ROOT/"data"/"ciifr"/"cards.json"
        audit_path=ROOT/"data"/"ciifr"/"audit.json"
        cards_before=cards_path.read_bytes()
        audit_before=audit_path.read_bytes()
        for filename,source in SRC.items():
            with self.subTest(source=source):
                path=PROPOSALS/filename
                manifest=json.loads(path.read_text(encoding="utf-8"))
                self.assertEqual((manifest["project"],manifest["source"]),("ciifr",source))
                self.assertEqual(manifest["proposalVersion"],1)
                self.assertEqual(len(manifest["changes"]),1)
                change=manifest["changes"][0]
                self.assertEqual(change["command"],"card set")
                self.assertEqual(set(change["args"]),{"card","ref","summary"})
                self.assertEqual(change["args"]["card"],"geo-g1")
                self.assertNotIn("VERIFIED",change["args"]["summary"])
                self.assertIn("|"+source+"|",change["args"]["ref"])
                self.assertIn("not verified",change["args"]["ref"])
                commands=B.commands(manifest)
                self.assertEqual(len(commands),1)
                self.assertEqual(commands[0][:2],["card","set"])
                self.assertIn("--ref",commands[0])
                # Existing tool prepares and contract-checks an ephemeral data copy.
                # It MUST NOT apply the proposal as a side-effect of CI.
                report=B.run(ROOT/"data",path,apply=False)
                self.assertFalse(report["applied"])
                self.assertTrue(report["checked"])
                self.assertEqual(report["newEventIds"] and len(report["newEventIds"]),1)
                self.assertFalse(report["baseChecked"])
        self.assertEqual(cards_path.read_bytes(),cards_before)
        self.assertEqual(audit_path.read_bytes(),audit_before)

if __name__=="__main__":
    unittest.main()
