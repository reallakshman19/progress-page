"""Proposal-only PR merges are never publication evidence."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"ci"))
from pp_publication_scope import classify,diff_paths

class PublicationBoundary(unittest.TestCase):
    def test_proposal_only_does_not_publish(self):
        p=classify(["proposals/ciifr-wbs3-pr191/pr-191.json","tests/test_ciifr_source_proposals.py"])
        self.assertEqual(p["status"],"PROPOSAL_ONLY_NOT_PUBLISHED")
        self.assertFalse(p["pageDataModified"])
        self.assertFalse(p["pagePublicationVerified"])
        self.assertFalse(p["cyclePublicationVerified"])
    def test_checked_page_data_is_only_candidate(self):
        p=classify(["data/ciifr/cards.json","data/ciifr/audit.json",
                    "proposals/ciifr-wbs3-pr191/pr-191.json"])
        self.assertEqual(p["status"],"PAGE_DATA_CHANGE_REQUIRES_HISTORY_CHECK")
        self.assertTrue(p["pageDataModified"])
        self.assertFalse(p["pagePublicationVerified"])
        self.assertFalse(p["ownerAcceptanceInferred"])
    def test_code_does_not_advance_publication(self):
        self.assertEqual(classify(["tools/pp_watch_job.py","README.md"])["status"],
                         "NO_PAGE_DATA_PUBLICATION")
    def test_malformed_base_ref_fails_closed(self):
        for v in ["","main","origin/../../etc","origin/main;echo","origin/main --option"]:
            with self.subTest(v=v),self.assertRaises(ValueError):
                diff_paths(v)

if __name__=="__main__":
    unittest.main()
