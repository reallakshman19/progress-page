"""Regression for source-unchanged but browser-cached old Adhoc navigation."""
import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from stamp_site_assets import stamp_site  # noqa: E402

A = "a" * 40
B = "b" * 40


class PagesAssetVersioning(unittest.TestCase):
    def stage(self, root):
        out = Path(root) / "_site"
        out.mkdir()
        for path in [ROOT / "index.html", *sorted(ROOT.glob("*.js"))]:
            shutil.copy2(path, out / path.name)
        return out

    def test_packaged_current_adhoc_navigation_receives_a_new_version(self):
        with tempfile.TemporaryDirectory() as t:
            out = self.stage(t)
            source = (ROOT / "adhoc-projects.js").read_text(encoding="utf-8")
            self.assertIn("key:'topo-a'", source)
            self.assertIn("key:'topo-b'", source)
            self.assertIn("'./adhoc-projects.js?v=34'", (out / "app.js").read_text())
            result = stamp_site(out, A)
            self.assertGreater(result["asset_references"], 25)
            self.assertIn("app.js?v=" + A, (out / "index.html").read_text())
            self.assertIn("viewer.css?v=" + A, (out / "index.html").read_text())
            self.assertIn("adhoc-projects.js?v=" + A, (out / "app.js").read_text())
            self.assertIn("cycle-board-context.js?v=" + A,
                          (out / "topo-adhoc-board.js").read_text())
            self.assertEqual((ROOT / "index.html").read_text(encoding="utf-8")
                             .count("app.js?v=34"), 1,
                             "Stamping must not touch checked-in sources")
            for path in [out / "index.html", *out.glob("*.js")]:
                text = path.read_text(encoding="utf-8")
                self.assertNotRegex(text, r"\.(?:js|css)\?v=34")
                for value in re.findall(r"\.(?:js|css)\?v=([0-9a-z_-]+)", text):
                    self.assertEqual(value, A, path.name)

    def test_new_commit_always_forces_new_browser_module_urls(self):
        with tempfile.TemporaryDirectory() as t:
            site = self.stage(t)
            stamp_site(site, A)
            first = (site / "app.js").read_bytes()
            stamp_site(site, B)
            self.assertNotEqual((site / "app.js").read_bytes(), first)
            self.assertIn("app.js?v=" + B, (site / "index.html").read_text())
            self.assertNotIn("app.js?v=" + A, (site / "index.html").read_text())

    def test_invalid_sha_or_missing_public_site_fails_closed(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            site = self.stage(root)
            original = (site / "index.html").read_bytes()
            for value in ("", "short", "../../unsafe", "A" * 40, "z" * 40):
                with self.subTest(sha=value):
                    with self.assertRaises(ValueError):
                        stamp_site(site, value)
                    self.assertEqual((site / "index.html").read_bytes(), original)
            (site / "app.js").unlink()
            with self.assertRaises(ValueError):
                stamp_site(site, A)


if __name__ == "__main__":
    unittest.main()
