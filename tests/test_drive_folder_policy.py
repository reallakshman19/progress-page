"""Negative-policy tests for Owner-authorized public Drive folder fixture links.

A public folder locator is not an approval to publish customer files, a claim
that a recipient can read them, or a substitute for hash verification.
"""
import unittest

import helpers as H

FOLDER = "https://drive.google.com/drive/folders/zzTEST_only_no_real_folder_A1B2C3D4E5"
FLAG = "OWNER_APPROVED_PUBLIC_FOLDER"


class DriveFolderPolicy(H.OpsCase):
    def _add(self, url=FOLDER, status=FLAG):
        return H.ok(self.d, "fixture", "add", "--project", H.KEY,
                    "--list", "inputs", "--text", "Owner-approved handoff folder",
                    "--url", url, "--status", status, "--actor", "Oracle",
                    "--src", "OWNER_PRIVATE_REF:owner-drive-approval",
                    "--summary", "Owner allowed publishing the folder locator")

    def test_exact_owner_approved_folder_passes(self):
        self._add()
        self.assertFalse(H.errors_of(self.d))
        self.assertEqual(H.doc(self.d, "fixtures")["inputs"][-1]["u"], FOLDER)
        self.assertTrue(H.events(self.d)[-1]["kind"] == "FIXTURE")

    def test_explicit_share_suffix_passes(self):
        self._add(FOLDER + "?usp=drive_link")
        self.assertFalse(H.errors_of(self.d))

    def test_unmarked_folder_still_blocked_and_transaction_rolled_back(self):
        self.refuse("fixture", "add", "--project", H.KEY,
                    "--list", "inputs", "--text", "unapproved folder",
                    "--url", FOLDER, "--actor", "Oracle", "--src", H.PRIVATE,
                    "--summary", "not Owner approved",
                    says="contains a Google Drive link not approved")

    def test_drive_file_url_not_exempted(self):
        self.refuse("fixture", "add", "--project", H.KEY,
                    "--list", "inputs", "--text", "private file",
                    "--url", "https://drive.google.com/file/d/1aabbccddEEFF00112233445566778899/view",
                    "--status", FLAG, "--actor", "Oracle", "--src", H.PRIVATE,
                    "--summary", "not a folder",
                    says="contains a Google Drive link not approved")

    def test_folder_subpath_not_exempted(self):
        self.refuse("fixture", "add", "--project", H.KEY,
                    "--list", "inputs", "--text", "private subpath",
                    "--url", FOLDER + "/file.txt",
                    "--status", FLAG, "--actor", "Oracle", "--src", H.PRIVATE,
                    "--summary", "not an exact folder link",
                    says="contains a Google Drive link not approved")

    def test_unapproved_query_not_exempted(self):
        self.refuse("fixture", "add", "--project", H.KEY,
                    "--list", "inputs", "--text", "unapproved query",
                    "--url", FOLDER + "?other=value",
                    "--status", FLAG, "--actor", "Oracle", "--src", H.PRIVATE,
                    "--summary", "not canonical folder",
                    says="contains a Google Drive link not approved")

    def test_approved_in_fixtures_does_not_allow_elsewhere(self):
        self._add()
        H.edit(self.d, "demo/cards.json",
               lambda c: c["a1"].update(now=FOLDER))
        self.assertTrue(any("contains a Google Drive link not approved" in e
                            for e in H.errors_of(self.d)))

    def test_encoded_host_does_not_bypass_scan(self):
        H.edit(self.d, "demo/cards.json",
               lambda c: c["a1"].update(now="https://drive%2Egoogle.com/drive/folders/abc"))
        self.assertTrue(any("Google Drive link not approved" in e
                            for e in H.errors_of(self.d)))

    def test_docs_google_link_still_blocked(self):
        self.refuse("fixture", "add", "--project", H.KEY,
                    "--list", "inputs", "--text", "private Google Doc",
                    "--url", "https://docs.google.com/document/d/1aabbccddEEFF00112233445566778899/edit",
                    "--status", FLAG, "--actor", "Oracle", "--src", H.PRIVATE,
                    "--summary", "not a folder",
                    says="contains a Google Drive link not approved")


if __name__ == "__main__":
    unittest.main()
