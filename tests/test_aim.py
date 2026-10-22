"""The aim of a project (Lesson 1, 22 Oct 2026), milestone-only block moves, and OneDrive or SharePoint links."""
import json
import unittest
from pathlib import Path

import helpers as H
from helpers import KEY, P, WS, WW, card, doc, events


class Aim(H.OpsCase):
    def test_project_aim_writes_the_aim_its_source_and_one_entry(self):
        n = len(events(self.d))
        H.ok(self.d, "project", "aim", "--key", KEY, "--text", "Teach one learner well", *WW)
        pr = doc(self.d, "index")["project"]
        self.assertEqual((pr["aim"], pr["aimSrc"]), ("Teach one learner well", H.SRC))
        self.assertEqual(len(events(self.d)), n + 1)
        self.assertEqual(events(self.d)[-1]["scope"], "aim")

    def test_an_active_project_without_an_aim_fails_the_check(self):
        p = Path(self.d) / KEY / "index.json"
        d = json.loads(p.read_text(encoding="utf-8"))
        del d["project"]["aim"]
        p.write_text(json.dumps(d), encoding="utf-8")
        self.assertTrue(any("aim is required" in e for e in H.errors_of(self.d)))

    def test_project_add_needs_an_aim_and_an_overlong_aim_is_refused(self):
        self.assertIn("--aim", H.refused(self.d, "project", "add", "--key", "third", "--title", "T", "--owner-words", "w", *WW))
        self.refuse("project", "aim", "--key", KEY, "--text", "x" * 401, *WW, says="longer than 400")

    def test_a_blank_aim_is_refused(self):
        self.refuse("project", "aim", "--key", KEY, "--text", "   ", *WW, says="aim is required")

    def test_an_archived_project_needs_no_aim(self):
        H.ok(self.d, "project", "archive", "--key", H.OTHER, *WW)
        p = Path(self.d) / H.OTHER / "index.json"
        d = json.loads(p.read_text(encoding="utf-8"))
        del d["project"]["aim"]
        p.write_text(json.dumps(d), encoding="utf-8")
        self.assertFalse(any("aim is required" in e for e in H.errors_of(self.d)))


class MilestoneOnly(H.OpsCase):
    def test_moving_a_block_to_a_milestone_keeps_its_evidence_time_and_source(self):
        before = doc(self.d, "cards")["a1"]
        H.ok(self.d, "card", "set", *P, "--card", "a1", "--milestone", "M5", "--actor", "Oracle O9", "--src", H.SRC2, "--summary", "placed")
        after = doc(self.d, "cards")["a1"]
        self.assertEqual(after["milestone"], "M5")
        self.assertEqual((after["updatedAt"], after["src"]), (before["updatedAt"], before["src"]))
        self.assertEqual(events(self.d)[-1]["source"], H.SRC2)   # the Timeline still records who placed it, with its source

    def test_a_group_only_move_is_scoped_to_the_group(self):
        H.ok(self.d, "card", "set", *P, "--card", "a1", "--order", "7", *WS)
        self.assertEqual(events(self.d)[-1]["scope"], "order")

    def test_a_real_update_still_stamps_the_block(self):
        before = doc(self.d, "cards")["a1"]
        card(self.d, "a1", "--now", "Something new happened", "--at", "2026-01-02T00:00:00Z")
        self.assertEqual(doc(self.d, "cards")["a1"]["updatedAt"], "2026-01-02T00:00:00Z")


class PrivateLinks(H.OpsCase):
    def test_a_link_hidden_by_json_escapes_or_invisible_characters_is_caught(self):
        import pp_check as K
        bs = chr(92)
        for raw in ('"drive' + bs + 'u002egoogle.com/x"', '"t.share' + bs + 'u0070oint.com/x"', '"1drv%25252Ems/x"', '"a.share​point.com/x"'):
            self.assertTrue(any(p.search(K._plain(raw)) for p, _ in K.SECRETS[:2]), raw)
        for raw in ('"sharepoint.company"', '"onedrive.committee"', '"docs.google.commentary"', '"SharePoint and OneDrive"'):
            self.assertFalse(any(p.search(raw) or p.search(K._plain(raw)) for p, _ in K.SECRETS[:2]), raw)

    def test_a_drive_link_in_capitals_is_refused(self):
        self.refuse("fixture", "add", *P, "--list", "inputs", "--text", "see https://Drive.Google.com/x", *WS, says="Google Drive link")

    def test_onedrive_and_sharepoint_links_are_refused(self):
        for url in ("https://1drv.ms/f/s!abc", "https://onedrive.live.com/?id=x", "https://acme.sharepoint.com/x",
                    "https://onedrive.com/x", "https://a.sharepoint.us/x", "https://d.docs.live.net/x",
                    "https://1drv%2Ems/x", "https://a.sharepoint%2Ecom/x", "https://ONEDRIVE.LIVE.COM/x"):
            self.refuse("fixture", "add", *P, "--list", "inputs", "--text", "see " + url, *WS, says="OneDrive or SharePoint link")


if __name__ == "__main__":
    unittest.main()
