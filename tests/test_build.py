"""tools/build_local.py (the one-file build) and tools/pp_links.py (the private chat-link setup URL)."""
import base64
import json
import re
import shutil
import unittest
from pathlib import Path

import helpers as H  # first: it puts tools/ on sys.path
import build_local
import pp_check
import pp_links

FUNCTIONS = {  # viewer module -> declarations the bundle must still contain
    "util.js": ("whenText", "copyText", "link", "md"), "triggers.js": ("cardTags", "nudgeTag", "summary", "fmt"), "popup.js": ("dialog",),
    "reply.js": ("issueUrl",), "nudge.js": ("openNudge", "nudgeRow"), "progress.js": ("renderProgress", "milestoneState"),
    "onboarding.js": ("renderOnboarding", "onboardingModel"), "actions.js": ("renderActions", "renderFixtures", "renderProjectHome", "projectHomeModel"), "timeline.js": ("renderTimeline",), "lifecycle.js": ("tabsRow", "archivedPanel", "projectHead", "revisionRow"),
    "search.js": ("buildSearchIndex", "searchProgress"), "oracle-continuity.js": ("oracleContinuityModel", "renderOracleContinuity"),
    "briefs.js": ("addProjectDialog", "addRevisionDialog", "projectBrief"), "links.js": ("loadLinks", "takeLinksFromHash", "linksPanel"), "lessons.js": ("renderLessons",), "app.js": ("loadAll", "render", "route"),
}


def snapshot_of(html):
    m = re.search(r"window\.__PP_SNAPSHOT__ = (.*?); window\.__PP_LINKS__ = (.*?);</script>", html, re.S)
    return json.loads(m.group(1)), json.loads(m.group(2))


class BuildLocal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = H.copy_valid()
        cls.out = H.tmpdir() / "progress-local.html"
        cls.msg = build_local.build(cls.out, None, None, data=cls.data)
        cls.html = cls.out.read_text(encoding="utf-8")

    def test_the_message_names_the_file_and_the_missing_extras(self):
        self.assertIn(f"wrote {self.out}", self.msg)
        self.assertIn("0 private links embedded", self.msg)
        self.assertIn("no static copy", self.msg)

    def test_every_viewer_module_is_in_the_bundle(self):
        self.assertEqual(set(FUNCTIONS), set(build_local.bundle_order()))
        for module, names in FUNCTIONS.items():
            for name in names:
                with self.subTest(module=module, name=name):
                    self.assertRegex(self.html, rf"\b(?:function|const)\s+{name}\b")

    def test_modules_are_turned_into_one_plain_script(self):
        self.assertIsNone(re.search(r"^\s*(?:import|export)\b", self.html, re.M))
        self.assertEqual((self.html.count("<script"), self.html.count("</script>")), (2, 2))
        self.assertNotRegex(self.html, r"<script[^>]*\ssrc=")
        self.assertNotRegex(self.html, r"<link\s+rel=")

    def test_modules_come_after_the_modules_they_import(self):
        order = build_local.bundle_order()
        self.assertEqual(order[-1], "app.js")
        for i, name in enumerate(order):
            for dep in re.findall(r"from\s+['\"]\./([\w.-]+\.js)", (H.ROOT / name).read_text(encoding="utf-8")):
                self.assertLess(order.index(dep), i, f"{name} is bundled before {dep}")

    def test_snapshot_holds_every_file_of_every_project_including_nudges_and_audit(self):
        snap, _ = snapshot_of(self.html)
        want = {"projects.json"} | {f"{k}/{f}.json" for k in (H.KEY, H.OTHER) for f in ("index", "cards", "actions", "fixtures", "nudges", "audit")}
        self.assertEqual(set(snap["files"]), want)
        self.assertEqual(snap["files"][f"{H.KEY}/nudges.json"]["nudges"]["N1"]["status"], "open")
        self.assertEqual(len(snap["files"][f"{H.KEY}/audit.json"]["events"]), len(H.events(self.data)))
        self.assertRegex(snap["builtAt"], H.ISO)

    def test_snapshot_equals_the_files_on_disk(self):
        snap, _ = snapshot_of(self.html)
        for path, content in snap["files"].items():
            with self.subTest(path=path):
                self.assertEqual(content, H.load(self.data / path))

    def test_no_chat_link_and_nothing_the_checker_would_refuse(self):
        self.assertNotIn("chatgpt.com/c/", self.html)
        self.assertIsNone(pp_check.CHAT.search(self.html))
        for pattern, why in pp_check.SECRETS:
            self.assertIsNone(pattern.search(self.html), why)

    def test_no_private_links_unless_a_links_file_is_given(self):
        self.assertEqual(snapshot_of(self.html)[1], {})
        links = H.tmpdir() / "links.private.json"
        links.write_text(json.dumps({"aaaa1111": "https://chatgpt.com/c/abc"}), encoding="utf-8")
        out = H.tmpdir() / "with-links.html"
        self.assertIn("1 private links embedded", build_local.build(out, links, None, data=self.data))
        self.assertEqual(snapshot_of(out.read_text(encoding="utf-8"))[1], {"aaaa1111": "https://chatgpt.com/c/abc"})

    def build_with(self, text):
        d = H.copy_valid()
        H.edit(d, f"{H.KEY}/cards.json", H.put("a1.now", text))
        out = H.tmpdir() / "text.html"
        build_local.build(out, None, None, data=d)
        return out.read_text(encoding="utf-8")

    def test_a_closing_script_tag_in_the_data_cannot_end_the_script(self):
        evil = "</script><b>x</b></SCRIPT>"
        html = self.build_with(evil)
        self.assertEqual((html.count("<script"), html.count("</script>")), (2, 2))
        self.assertEqual(snapshot_of(html)[0]["files"][f"{H.KEY}/cards.json"]["a1"]["now"], evil)

    # BUG: build_local.js_json escapes only "</", but text such as "<!--<script>" in a card puts the HTML parser into its double-escaped script
    # state, where the real </script> no longer ends the block: the built file then stays on "Loading..." (checked in headless Edge).
    def test_comment_and_script_openers_in_the_data_cannot_break_the_script(self):
        html = self.build_with("<!--<script>")
        block = html.split("<script>")[1].split("</script>")[0]
        self.assertFalse("<!--" in block or re.search(r"(?i)<script", block), "the snapshot script contains <!-- or <script, which the HTML parser treats specially")

    def test_the_local_command_writes_the_same_kind_of_file(self):
        out = H.tmpdir() / "via-cli.html"
        r = H.cli(self.data, "local", out)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("function renderTimeline", out.read_text(encoding="utf-8"))

    def test_the_real_data_folder_builds(self):
        out = H.tmpdir() / "real.html"
        build_local.build(out, None, None, data=H.ROOT / "data")
        snap, _ = snapshot_of(out.read_text(encoding="utf-8"))
        self.assertIn("projects.json", snap["files"])

    def test_strip_module_drops_imports_and_export_keywords(self):
        src = "import { a } from './a.js?v=8';\nexport function f() {}\nexport async function g() {}\nexport const x = 1;\nconst y = 2;"
        self.assertEqual(build_local.strip_module(src), "function f() {}\nasync function g() {}\nconst x = 1;\nconst y = 2;")


BROWSER = next((p for p in (r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                            r"C:\Program Files\Google\Chrome\Application\chrome.exe", shutil.which("msedge"), shutil.which("chrome"), shutil.which("chromium"))
                if p and Path(p).exists()), None)


@unittest.skipUnless(BROWSER, "no Edge or Chrome found for --prerender")
class Prerender(unittest.TestCase):
    def test_static_copy_shows_the_projects_the_archive_and_the_nudges_without_scripts(self):
        d = H.copy_valid()
        H.ok(d, "project", "archive", "--key", H.OTHER, *H.WW)
        out = H.tmpdir() / "static.html"
        self.assertIn("static copy included", build_local.build(out, None, BROWSER, data=d))
        static = out.read_text(encoding="utf-8").split("<script>")[0]  # what a viewer with scripts blocked sees
        for want in ("Static copy made", "Archived (1)", "Other project", "Check the edge cases", "Grounding fixtures", "Timeline"):
            self.assertIn(want, static)
        self.assertNotIn("Loading...", static)
        self.assertNotIn(">Copy reply<", static)


class SetupUrl(unittest.TestCase):
    LINKS ={"6ad8c352": "https://chatgpt.com/c/68f7a1b2-0000-4000-8000-123456789abc", "c3917ee8": "https://antigravity.google.com/x?y=1&z=2"}

    def make(self, links, page=None):
        f = H.tmpdir() / "links.private.json"
        f.write_text(json.dumps(links, ensure_ascii=False), encoding="utf-8")
        return pp_links.setup_url(f, page)

    def test_the_fragment_decodes_back_to_the_same_json(self):
        url = self.make(self.LINKS, "https://acme.github.io/progress-page/")
        page, frag = url.split("#links=")
        self.assertEqual(page, "https://acme.github.io/progress-page/")
        self.assertRegex(frag, r"^[A-Za-z0-9_-]+$")  # the pattern links.js accepts: no padding, no + or /
        self.assertEqual(json.loads(base64.urlsafe_b64decode(frag + "=" * (-len(frag) % 4)).decode("utf-8")), self.LINKS)

    def test_round_trip_for_every_padding_length_and_non_ascii_text(self):
        for n in range(1, 8):
            links = {"abcd1234": "https://example.com/" + "é" * n}
            frag = self.make(links).split("#links=")[1]
            self.assertEqual(json.loads(base64.urlsafe_b64decode(frag + "=" * (-len(frag) % 4)).decode("utf-8")), links)

    def test_without_a_page_the_url_is_a_template(self):
        self.assertTrue(self.make(self.LINKS).startswith("https://<your page>/#links="))

    def test_a_link_that_is_not_https_is_refused_and_named(self):
        for bad in ("http://example.com/x", "javascript:alert(1)", "ftp://example.com/x", "", "example.com"):
            with self.subTest(bad=bad):
                with self.assertRaises(SystemExit) as cm:
                    self.make({"good0000": "https://example.com/ok", "bad00000": bad})
                self.assertIn("bad00000", str(cm.exception))
                self.assertNotIn("good0000", str(cm.exception))

    def test_the_links_command_prints_the_url(self):
        f = H.tmpdir() / "links.private.json"
        f.write_text(json.dumps(self.LINKS), encoding="utf-8")
        r = H.run([H.TOOLS / "pp_links.py", f, "--page", "https://acme.github.io/p/"])
        self.assertEqual(r.stdout.strip(), pp_links.setup_url(f, "https://acme.github.io/p/"))
        r = H.cli(H.copy_valid(), "links", f, "--page", "https://acme.github.io/p/")
        self.assertEqual(r.stdout.strip(), pp_links.setup_url(f, "https://acme.github.io/p/"))


if __name__ == "__main__":
    unittest.main()


class ModuleVersion(unittest.TestCase):
    def test_every_viewer_module_url_carries_the_same_version(self):
        """A mixed ?v= bump loads two copies of a module, so the page shares no state between them."""
        found = {}
        for f in sorted(H.ROOT.glob("*.js")) + [H.ROOT / "index.html"]:
            for v in re.findall(r"\.js\?v=(\d+)", f.read_text(encoding="utf-8")):
                found.setdefault(v, []).append(f.name)
        self.assertEqual(len(found), 1, found)
