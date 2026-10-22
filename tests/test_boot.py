"""`pp_cli.py bootstrap` (tools/pp_boot.py) and `pp_cli.py inputs` (tools/pp_inputs.py: the Owner's replies that arrive as GitHub issues)."""
import json
import re
import shlex
import shutil
import unittest
from unittest import mock

import helpers as H  # first: it puts tools/ on sys.path
import build_local
import pp_boot
import pp_inputs


class Bootstrap(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dest = H.tmpdir("pp-boot-") / "newrepo"
        cls.r = H.run([H.TOOLS / "pp_cli.py", "bootstrap", cls.dest, "--repo", "acme/newrepo", "--page", "https://acme.github.io/newrepo/"], cwd=cls.dest.parent)
        cls.files = {p.relative_to(cls.dest).as_posix() for p in cls.dest.rglob("*") if p.is_file()} if cls.dest.exists() else set()

    def fresh(self):  # a private copy, so that tests that write do not disturb each other
        d = H.tmpdir("pp-boot-") / "copy"
        shutil.copytree(self.dest, d)
        return d

    def test_it_succeeds_and_says_what_to_do_next(self):
        self.assertEqual(self.r.returncode, 0, self.r.stdout + self.r.stderr)
        self.assertIn("project add", self.r.stdout)

    def test_copies_the_viewer_the_tools_the_workflow_and_an_empty_project_list(self):
        for want in ("index.html", "viewer.css", "tools/pp_cli.py", "tools/pp_check.py", "tools/pp_lib.py", "tools/page_triggers.py", "tools/build_local.py",
                     "tools/static_pass.js", ".github/workflows/check.yml", ".gitattributes", "README.md"):
            self.assertIn(want, self.files)
        self.assertEqual(H.load(self.dest / "data" / "projects.json"), {"schema": 3, "projects": [], "site": {
            "repo": "acme/newrepo", "page": "https://acme.github.io/newrepo/", "tools": "tools/", "guide": "https://github.com/acme/newrepo#readme"}})

    def test_every_viewer_module_the_one_file_build_needs_is_copied(self):
        needed = set(build_local.bundle_order()) | {"index.html", "viewer.css"}
        self.assertEqual(set(pp_boot.VIEWER), needed)
        self.assertLessEqual(needed, self.files)

    def test_copied_tools_are_identical_to_the_originals(self):
        for f in H.TOOLS.glob("*.py"):
            self.assertEqual((self.dest / "tools" / f.name).read_bytes(), f.read_bytes(), f.name)

    def test_the_workflow_checks_the_data_and_compares_pull_requests_with_their_base(self):
        text = (self.dest / ".github" / "workflows" / "check.yml").read_text(encoding="utf-8")
        self.assertIn("python tools/pp_check.py data\n", text)
        self.assertIn("python tools/pp_check.py data --base origin/${{ github.base_ref }}", text)
        self.assertIn("fetch-depth: 0", text)

    def test_the_empty_repository_passes_the_check_and_takes_a_first_project(self):
        d = self.fresh()
        run = lambda *a: H.run([d / "tools" / a[0], *a[1:]], cwd=d)  # noqa: E731
        r = run("pp_check.py", "data")
        self.assertEqual((r.returncode, r.stdout.strip()), (0, "OK"), r.stdout + r.stderr)
        r = run("pp_cli.py", "project", "add", "--key", "first", "--title", "First", "--owner-words", "go", "--aim", "test aim", "--why", "start", *H.S)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(run("pp_check.py", "data").stdout.strip(), "OK")
        r = run("pp_cli.py", "local", "page.html")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("function renderTimeline", (d / "page.html").read_text(encoding="utf-8"))

    def test_a_second_bootstrap_into_the_same_folder_is_refused_and_changes_nothing(self):
        d = self.fresh()
        before = H.tree(d)
        r = H.run([H.TOOLS / "pp_cli.py", "bootstrap", d, "--repo", "acme/other", "--page", "https://x.github.io/o/"], cwd=d.parent)
        self.assertEqual(r.returncode, 1)
        self.assertIn("already has data/projects.json", r.stdout + r.stderr)
        self.assertEqual(H.tree(d), before)


def form(project="demo", kind="NUDGE", text="a1: Check the edge cases", eol="\n"):
    body = f"### Project\n\n{project}\n\n### Target\n\nOracle\n\n### Input type\n\n{kind}\n\n### Your instruction or message\n\n{text}\n\n### Evidence link (optional)\n\n_No response_\n"
    return body.replace("\n", eol)


class Inputs(unittest.TestCase):
    URL = "https://github.com/acme/demo/issues/77"

    def setUp(self):
        self.d = H.copy_valid()

    def suggest(self, **kw):
        return pp_inputs.suggest(str(self.d), pp_inputs.parse_form(form(**kw)), self.URL, H.ACTOR)

    def test_parse_form_reads_the_issue_form_fields_with_either_line_ending(self):
        want = {"project": "demo", "target": "Oracle", "type": "NUDGE", "text": "a1: Check the edge cases", "evidence": "_No response_"}
        self.assertEqual(pp_inputs.parse_form(form()), want)
        self.assertEqual(pp_inputs.parse_form(form(eol="\r\n")), want)
        self.assertEqual((pp_inputs.parse_form(None), pp_inputs.parse_form("no form here")), ({}, {}))

    def test_a_nudge_becomes_a_nudge_add_command(self):
        cmd = self.suggest()
        self.assertIn("nudge add --project demo --card a1 --text 'Check the edge cases' --by Owner", cmd)
        self.assertIn(f"--actor '{H.ACTOR}' --src {self.URL}", cmd)

    def test_a_decision_reply_is_matched_to_the_open_decision_ignoring_spacing(self):
        self.assertIn("action answer --project demo --key d1 --text", self.suggest(kind="DECISION", text="Reply A"))
        self.assertIn("--key d1", self.suggest(kind="DECISION", text="Reply   A\n"))
        self.assertTrue(self.suggest(kind="DECISION", text="something else").startswith("NO MATCH"))
        H.ok(self.d, "action", "answer", *H.P, "--key", "d1", "--text", "Reply A", "--ref", H.SRC2, "--actor", H.ACTOR)
        self.assertTrue(self.suggest(kind="DECISION", text="Reply A").startswith("NO MATCH"), "an answered decision must not be offered again")

    def test_a_withdraw_request_names_the_nudge(self):
        self.assertIn("nudge withdraw --project demo --id N1 --by Owner", self.suggest(kind="NUDGE-WITHDRAW", text="withdraw N1 (a1): Check the edge cases"))
        self.assertTrue(self.suggest(kind="NUDGE-WITHDRAW", text="remove it").startswith("NOT RECORDED"))

    def test_unknown_projects_and_types_are_not_recorded(self):
        self.assertTrue(self.suggest(project="ghost").startswith("NOT RECORDED: no project"))
        self.assertTrue(self.suggest(kind="WISH").startswith("NOT RECORDED: unknown input type"))

    def test_the_suggested_command_really_records_the_input(self):
        cmd = pp_inputs.suggest(self.d.as_posix(), pp_inputs.parse_form(form()), self.URL, H.ACTOR)
        tokens = shlex.split(cmd)
        r = H.run([H.TOOLS / "pp_cli.py", *tokens[2:]], cwd=self.d.parent)
        self.assertEqual(r.returncode, 0, cmd + "\n" + r.stdout + r.stderr)
        n = H.doc(self.d, "nudges")["nudges"]["N2"]
        self.assertEqual((n["card"], n["text"], n["by"], n["src"]), ("a1", "Check the edge cases", "Owner", self.URL))
        self.assertEqual(tokens[:2], ["python", "tools/pp_cli.py"])

    def test_unrecorded_issues_are_listed_once_with_their_command(self):
        issue = lambda url, at, text: {"html_url": url, "created_at": at, "user": {"login": "owner"}, "body": form(text=text)}  # noqa: E731
        issues = [issue("https://github.com/acme/demo/issues/50", "2099-01-01T00:00:00Z", "a1: new line"),
                  issue(H.SRC, "2099-01-01T00:00:00Z", "a1: already recorded"), issue("https://github.com/acme/demo/issues/3", "2000-01-01T00:00:00Z", "a1: too old")]
        with mock.patch.object(pp_inputs, "fetch", lambda repo, token=None: issues):
            out = json.loads(pp_inputs.list_inputs(str(self.d), H.ACTOR, as_json=True))
            text = pp_inputs.list_inputs(str(self.d), H.ACTOR)
        self.assertEqual([i["issue"] for i in out], ["https://github.com/acme/demo/issues/50"])
        self.assertIn("nudge add --project demo --card a1 --text 'new line'", out[0]["record"])
        self.assertIn("issues/50", text)
        self.assertNotIn("already recorded", text)
        with mock.patch.object(pp_inputs, "fetch", lambda repo, token=None: []):
            self.assertEqual(pp_inputs.list_inputs(str(self.d), H.ACTOR), "No unrecorded Owner inputs.")

    # BUG: pp_inputs.quote() wraps the issue text in double quotes and only swaps " for '. Anyone who can submit the issue form controls that text,
    # and $(...), backticks and $VAR still expand inside double quotes in bash and PowerShell, so the printed "record:" command can run their code.
    def test_shell_syntax_in_an_issue_is_not_left_to_the_shell(self):
        for evil in ("$(echo pwned)", "`echo pwned`", "$HOME"):
            with self.subTest(evil=evil):
                cmd = self.suggest(text=f"a1: {evil}")
                self.assertIsNone(re.search(r'"[^"]*(?<!\\)[$`][^"]*"', cmd), cmd)

    def test_an_issue_without_a_listed_project_is_not_recorded(self):
        for key in ("", "..", "."):
            with self.subTest(key=key):
                self.assertTrue(pp_inputs.suggest(str(self.d), {"project": key, "type": "NUDGE", "text": "a1: x"}, self.URL, H.ACTOR).startswith("NOT RECORDED"))

    # BUG: the card in "<card>: <line>" is copied into the command unquoted and is not checked against the project's cards.
    def test_a_card_name_with_shell_syntax_is_not_copied_into_the_command(self):
        cmd = self.suggest(text="a1;echo pwned: line")
        lexer = shlex.shlex(cmd, posix=True, punctuation_chars=True)
        lexer.whitespace_split = False
        self.assertFalse({";", "&", "&&", "|", "||", "<", ">"} & set(lexer), cmd)  # an unquoted operator would end the command and start another


if __name__ == "__main__":
    unittest.main()
