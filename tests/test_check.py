"""The contract checker (tools/pp_check.py and friends): valid data passes, and each seeded defect is reported.

Every defect test copies the valid folder (built by the real CLI), checks that the copy is clean, applies ONE mutation
and asserts that the checker names the problem. Rows with a fifth item first run a CLI command to set the scene."""
import unittest

import helpers as H
from helpers import KEY, SRC, WW, drop, put

P = H.P
PATHS = {"projects": "projects.json", **{f: f"{KEY}/{f}.json" for f in ("index", "cards", "actions", "fixtures", "nudges", "audit")}}
FAR = "2099-01-01T00:00:00Z"
TOKEN = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2"
CHAT = "see https://chatgpt.com/c/68f7a1b2-aaaa-4bbb-8ccc-0123456789ab"


def ev(match, **changes):
    """Mutator: change fields of the first Timeline event that matches."""
    return lambda d: H.find(d, **match).update(changes)


def project0(**fields):
    return lambda d: d["projects"][0].update(fields)


def second_revision(d):  # R2 in index.json but no REVISION event for it
    d["revisions"][0]["status"] = "superseded"
    d["revisions"].append(dict(d["revisions"][0], id="R2", status="current", supersedes="R1"))


def revision_r3(d):  # R1, R3: the ids skip R2
    d["revisions"][0]["status"] = "superseded"
    d["revisions"].append(dict(d["revisions"][0], id="R3", status="current", supersedes="R1"))


def hand_answer(d):  # d1 is open and has an ACTION event; somebody marks it answered by hand
    d["d1"].update(status="done", answer={"text": "Option A", "at": FAR, "ref": SRC})


def unrecorded_answer(d):  # a decision that never had a Timeline entry, answered after the Timeline began
    d["d2"] = dict(d["d1"], order=2, status="done", answer={"text": "Option B", "at": FAR, "ref": SRC})


CANCEL_X1 = ("card", "cancel", *P, "--card", "x1", *WW)
ARCHIVE = ("project", "archive", "--key", KEY, *WW)
CASES = [
    # (name, file, mutation, expected substring(s), optional CLI command to run first)
    ("projects_duplicate_key", "projects", lambda d: d["projects"].append(dict(d["projects"][0])), "key must be unique"),
    ("projects_bad_mode", "projects", put("projects.0.mode", "hybrid"), "mode 'hybrid' is not one of"),
    ("projects_github_issue_reply_without_repo", "projects", put("projects.0.replyTo", {"kind": "github-issue", "template": "t", "target": "x", "site": "https://x/"}),
     "replyTo: repo is required"),
    ("projects_archived_without_why_or_source", "projects", put("projects.0.status", "archived"), ("statusWhy is required", "statusSrc is required")),
    ("projects_superseded_by_unknown", "projects", project0(status="superseded", statusWhy="w", statusAt=FAR, statusSrc=SRC, supersededBy="ghost"),
     "supersededBy must name another project key"),
    ("projects_schema", "projects", put("schema", 2), "schema must be 3"),
    ("index_id8_is_a_url", "index", put("chats.c1.id8", "https://example.com/c/abcdef"), "id8 must be the short chat id"),
    ("index_milestone_without_order", "index", drop("milestones.M1.order"), "milestones 'M1': order is required"),
    ("index_group_without_order", "index", drop("groups.main.order"), "groups 'main': order is required"),
    ("index_wbs_not_a_number", "index", put("milestones.M1.wbs", "1.a"), "wbs must be a WBS number"),
    ("index_wbs_used_twice", "index", lambda d: (d["milestones"]["M1"].update(wbs="1.1"), d["milestones"]["M2"].update(wbs="1.1")),
     "wbs 1.1 is also used by milestone"),
    ("index_cap_unknown", "index", lambda d: d["milestones"]["M1"].update(cap="DONE", canDo="x"), "cap 'DONE' is not one of"),
    ("index_cap_without_can_do", "index", put("milestones.M1.cap", "NOT_DEMONSTRATED"), "cap needs canDo"),
    ("index_cap_claimed_without_evidence", "index", lambda d: d["milestones"]["M1"].update(cap="BENCHMARK_SUPPORTED", canDo="answers one question"),
     "cap BENCHMARK_SUPPORTED needs capSrc"),
    ("index_cap_evidence_not_public", "index", lambda d: d["milestones"]["M1"].update(cap="CANDIDATE", canDo="x", capSrc="https://drive.google.com/x"),
     "capSrc must be a public GitHub link"),
    ("index_can_do_without_cap", "index", put("milestones.M1.canDo", "x"), "canDo and capSrc need cap"),
    ("index_repo_local_path", "index", put("milestones.M1.repo", "C:/t/progress-page"), "repo must be owner/name"),
    ("index_repo_link", "index", put("milestones.M1.repo", "https://github.com/o/r"), "repo must be owner/name"),
    ("index_commit_not_hex", "index", put("milestones.M1.commit", "HEAD~1"), "commit must be 7 to 40 hex"),
    ("index_commit_too_short", "index", put("milestones.M1.commit", "4cf89"), "commit must be 7 to 40 hex"),
    ("index_wbs_trailing_newline", "index", put("milestones.M1.wbs", "1.1" + chr(10)), "wbs must be a WBS number"),
    ("index_cap_evidence_private_ref", "index", lambda d: d["milestones"]["M1"].update(cap="CANDIDATE", canDo="x", capSrc="OWNER_PRIVATE_REF:abc"),
     "capSrc must be a public GitHub link"),
    ("actions_unknown_step", "actions", lambda d: next(iter(d.values())).update(milestone="M9"), "milestone 'M9' is not one of"),
    ("fixtures_unknown_step", "fixtures", lambda d: next(i for v in d.values() for i in v).update(milestone="M9"), "milestone 'M9' is not one of"),
    ("index_revisions_missing", "index", drop("revisions"), "revisions must list at least R1"),
    ("index_revision_ids_out_of_order", "index", revision_r3, "id must be R2, in order"),
    ("index_two_current_revisions", "index", lambda d: d["revisions"].append(dict(d["revisions"][0], id="R2", supersedes="R1")), "only the last revision can be current"),
    ("index_revision_without_owner_words", "index", drop("revisions.0.ownerWords"), "ownerWords is required"),
    ("index_project_key_differs", "index", put("project.key", "zzz"), "project.key must be 'demo'"),
    ("index_hold_not_a_boolean", "index", put("hold", {"active": "yes"}), "hold.active must be true or false"),
    ("cards_bad_state", "cards", put("a1.state", "DONE"), "state 'DONE' is not one of"),
    ("cards_unknown_group", "cards", put("a1.group", "nogroup"), "group 'nogroup' is not one of"),
    ("cards_unknown_milestone", "cards", put("a1.milestone", "M9"), "milestone 'M9' is not one of"),
    ("cards_edge_to_unknown_card", "cards", put("b1.edges", [{"to": "nosuch", "k": "to"}]), "edge to 'nosuch' must name another card"),
    ("cards_ref_url_not_https", "cards", put("a1.refs.0.u", "http://github.com/acme/demo/issues/1"), "u must be an https link"),
    ("cards_started_without_src", "cards", drop("a1.src"), "src is required"),
    ("cards_started_without_updatedAt", "cards", drop("a1.updatedAt"), "updatedAt is required"),
    ("cards_closed_but_state_not_not_applicable", "cards", put("a1.closed", {"kind": "cancelled", "why": "w", "at": FAR, "src": SRC}), "must have state NOT_APPLICABLE"),
    ("cards_unknown_chat", "cards", put("a1.who.chat", "c9"), "who.chat 'c9' is not in chats"),
    ("cards_unknown_flag", "cards", put("a1.flags", ["urgent"]), "flag 'urgent' is not one of"),
    ("actions_two_suggested_options", "actions", put("d1.options.1.suggested", True), "exactly one suggested option"),
    ("actions_no_suggested_option", "actions", put("d1.options.0.suggested", False), "exactly one suggested option"),
    ("actions_done_without_answer", "actions", put("d1.status", "done"), "answer: text is required"),
    ("actions_open_without_options", "actions", put("d1.options", []), "needs at least one option"),
    ("actions_table_row_wider_than_columns", "actions", put("d1.tables", [{"cols": ["a", "b"], "rows": [["x"]]}]), "as many cells as columns"),
    ("fixtures_unknown_list", "fixtures", lambda d: d.update(bogus=[]), "unknown list 'bogus'"),
    ("fixtures_item_url_not_https", "fixtures", put("repository.0.u", "ftp://example.com/x"), "u must be an https link"),
    ("fixtures_item_without_text", "fixtures", drop("repository.0.t"), "t is required"),
    ("nudges_unknown_card", "nudges", put("nudges.N1.card", "ghost"), "card 'ghost' is not one of"),
    ("nudges_id_not_n1_in_order", "nudges", lambda d: d["nudges"].update(N2=d["nudges"].pop("N1")), "id must be N1, in order"),
    ("nudges_done_without_doneBy", "nudges", put("nudges.N1.status", "done"), "doneBy is required"),
    ("nudges_wrong_schema", "nudges", put("schema", 2), "expected schema 3"),
    ("privacy_chat_link", "cards", put("a1.now", CHAT), "contains a chat link"),
    ("privacy_email_address", "cards", put("a1.now", "write to someone@example.com"), "contains an email address"),
    ("privacy_drive_link", "cards", put("a1.now", "https://drive.google.com/file/d/1AbC/view"), "contains a Google Drive link"),
    ("privacy_access_token", "cards", put("a1.now", TOKEN), "what looks like an access token"),
    ("timeline_broken_previous_id", "audit", lambda d: d["events"][3].update(previous_id="DEMO-R-0099"), "the chain is broken"),
    ("timeline_seq_gap", "audit", lambda d: d["events"][5].update(seq=9), "the chain is broken"),
    ("timeline_before_is_not_the_previous_state", "audit", ev({"kind": "STATE", "card": "a1"}, before="VERIFIED"), "before is 'VERIFIED' but the card was 'IN_PROGRESS'"),
    ("timeline_last_state_differs_from_card", "cards", put("a1.state", "VERIFIED"), "the Timeline ends at SUBMITTED but the card says VERIFIED"),
    ("timeline_event_without_source", "audit", drop("events.1.source"), "source is required"),
    ("timeline_card_without_event", "cards", lambda d: d.update(zz=dict(d["x1"])), "card 'zz' has no event"),
    ("timeline_event_after_card_cancelled", "audit", lambda d: H.add_event(d, kind="UPDATE", card="x1", before="NOT_APPLICABLE", after="NOT_APPLICABLE"),
     "nothing may follow", CANCEL_X1),
    ("timeline_cancelled_card_lost_its_closed_marking", "cards", drop("x1.closed"), "the closed marking and the Timeline disagree", CANCEL_X1),
    ("timeline_project_status_differs", "projects", project0(status="archived", statusWhy="w", statusAt=FAR, statusSrc=SRC), "status is archived but the Timeline says active"),
    ("timeline_nudge_op_order_wrong", "audit", ev({"kind": "NUDGE"}, op="done"), "cannot take op"),
    ("timeline_nudge_done_twice", "audit", lambda d: H.add_event(d, kind="NUDGE", nudge="N1", op="done", target="a1"), "cannot take op",
     ("nudge", "done", *P, "--id", "N1", "--by", "Oracle O2", *H.S)),
    ("timeline_revision_event_missing", "index", second_revision, "every revision needs exactly one REVISION event"),
    ("timeline_project_updatedAt_older_than_newest_event", "index", put("project.updatedAt", "2020-01-01T00:00:00Z"), "project.updatedAt is older than the newest Timeline entry"),
    ("timeline_answer_without_answer_event", "actions", unrecorded_answer, "answered after the Timeline began but has no ANSWER event"),
    ("timeline_event_for_unknown_card", "audit", ev({"kind": "UPDATE"}, card="ghost"), "card 'ghost' is not in cards.json"),
    ("timeline_state_event_without_change", "audit", ev({"kind": "STATE"}, after="IN_PROGRESS"), "STATE must change the state"),
    ("timeline_update_event_changes_state", "audit", ev({"kind": "UPDATE"}, after="VERIFIED"), "UPDATE keeps the state"),
    ("timeline_first_event_of_card_not_baseline", "audit", ev({"kind": "BASELINE", "card": "b1"}, kind="UPDATE", before="NOT_STARTED"), "must be BASELINE"),
    ("timeline_unknown_revision", "audit", lambda d: d["events"][3].update(rev="R7"), "rev must be one of R1"),
    ("timeline_card_source_differs_from_latest_event", "cards", put("a1.src", "https://github.com/acme/demo/issues/9"), "src differs from the source of its latest Timeline entry"),
    ("timeline_card_updatedAt_after_its_event", "cards", put("a1.updatedAt", FAR), "updatedAt is later than the Timeline entry that records it"),
    ("timeline_nudge_status_differs", "nudges", lambda d: d["nudges"]["N1"].update(status="withdrawn", withdrawnBy="x", withdrawnAt=FAR, withdrawnSrc=SRC),
     "the Timeline ends at open but nudges.json says withdrawn"),
    ("timeline_nudge_source_differs", "nudges", put("nudges.N1.src", "https://github.com/acme/demo/issues/9"), "src differs from the source of its Timeline entry"),
    ("timeline_event_after_project_archived", "audit", lambda d: H.add_event(d, kind="UPDATE", card="a1", before="SUBMITTED", after="SUBMITTED"),
     "only RESTORE is allowed", ARCHIVE),
    ("timeline_transfer_chat_mismatch", "cards", put("a1.who.chat", "c1"), "who.chat is not the chat its latest TRANSFER names",
     ("card", "transfer", *P, "--card", "a1", "--to-chat", "c2", *WW)),
    ("timeline_supersede_event_names_unknown_card", "audit", ev({"kind": "SUPERSEDE"}, to="ghost"), "SUPERSEDE needs to = the card that replaces it",
     ("card", "supersede", *P, "--card", "x1", "--by", "a1", *WW)),
]


class Defects(unittest.TestCase):
    """One generated test per row of CASES."""


def _make(rel, mutate, expect, pre):
    def test(self):
        d = H.copy_valid()
        if pre:
            H.ok(d, *pre)
        self.assertEqual(H.errors_of(d), [], "the folder must be clean before the defect is seeded")
        H.edit(d, PATHS[rel], mutate)
        errors = H.errors_of(d)
        for want in [expect] if isinstance(expect, str) else expect:
            self.assertTrue(any(want in e for e in errors), f"no problem containing {want!r}; the checker said:\n" + "\n".join(errors))
    return test


for _name, _rel, _mutate, _expect, *_pre in CASES:
    setattr(Defects, "test_" + _name, _make(_rel, _mutate, _expect, _pre[0] if _pre else None))


class Valid(unittest.TestCase):
    def test_folder_built_by_the_cli_is_clean(self):
        self.assertEqual(H.errors_of(H.copy_valid()), [])

    def test_command_prints_ok_for_the_built_folder(self):
        r = H.check_cli(H.copy_valid())
        self.assertEqual((r.returncode, r.stdout.strip()), (0, "OK"), r.stdout + r.stderr)

    def test_real_data_folder_prints_ok(self):
        r = H.run([H.TOOLS / "pp_check.py", "data"], cwd=H.ROOT)
        self.assertEqual((r.returncode, r.stdout.strip()), (0, "OK"), r.stdout + r.stderr)

    def test_command_exits_1_and_counts_problems(self):
        d = H.copy_valid()
        H.edit(d, PATHS["cards"], put("a1.state", "DONE"))
        r = H.check_cli(d)
        self.assertEqual(r.returncode, 1)
        self.assertIn("state 'DONE' is not one of", r.stdout)
        self.assertRegex(r.stdout.strip().splitlines()[-1], r"^\d+ problem\(s\)$")

    def test_many_defects_are_listed_one_per_line(self):
        d = H.copy_valid()
        H.edit(d, PATHS["cards"], lambda c: c["a1"].update(state="DONE", group="nogroup"))
        self.assertGreaterEqual(len(H.errors_of(d)), 2)

    def test_restoring_a_project_by_hand_is_accepted(self):  # the Timeline rules for ARCHIVE then RESTORE
        d = H.copy_valid()
        H.ok(d, *ARCHIVE)
        H.edit(d, PATHS["projects"], lambda p: [p["projects"][0].pop(f) for f in ("status", "statusWhy", "statusAt", "statusBy", "statusSrc")])
        H.edit(d, PATHS["audit"], lambda a: H.add_event(a, kind="RESTORE", scope="project"))
        H.edit(d, PATHS["index"], lambda i: i["project"].update(updatedAt=H.load(d / PATHS["audit"])["events"][-1]["at"]))
        self.assertEqual(H.errors_of(d), [])


class Loopholes(unittest.TestCase):
    """Hand edits the checker should refuse (and the matching CLI paths it must accept)."""

    # BUG: pp_ledger_check._events adds the action to `answered` for ACTION events as well as ANSWER events. A decision made through the CLI
    # has an ACTION event, so somebody can set it to done by hand (no ANSWER event) and the checker still says OK.
    def test_decision_answered_by_hand_still_needs_an_answer_event(self):
        d = H.copy_valid()
        H.edit(d, PATHS["actions"], hand_answer)
        self.assertTrue(any("has no ANSWER event" in e for e in H.errors_of(d)), "the hand-made answer was accepted")

    # BUG: check_projects requires statusWhy, statusAt and statusSrc for a closed project but not statusBy, which lifecycle.js shows ("by undefined").
    def test_a_closed_project_needs_the_name_of_who_closed_it(self):
        d = H.copy_valid()
        H.ok(d, *ARCHIVE)
        H.edit(d, PATHS["projects"], drop("projects.0.statusBy"))
        self.assertTrue(any("statusBy is required" in e for e in H.errors_of(d)), "an archived project without statusBy was accepted")

    def test_decision_answered_through_the_cli_is_accepted(self):
        d = H.copy_valid()
        H.ok(d, "action", "answer", *P, "--key", "d1", "--text", "Option A", "--ref", SRC, "--actor", H.ACTOR)
        self.assertEqual(H.errors_of(d), [])


class Privacy(unittest.TestCase):
    CHAT_LINKS = ["https://chatgpt.com/c/68f7a1b2-aaaa-4bbb-8ccc-0123456789ab", "https://chat.openai.com/share/abc", "https://antigravity.google.com/x",
                  "https://claude.ai/chat/abc", "https://claude.ai/code/abc"]
    OTHERS = [("email address", "write to someone@example.com"), ("Google Drive link", "https://drive.google.com/file/d/1/view"),
              ("Google Drive link", "https://docs.google.com/document/d/1"), ("access token", TOKEN), ("access token", "github_pat_" + "A" * 22),
              ("access token", "sk-" + "A" * 24)]

    def folder_with(self, text):
        d = H.copy_valid()
        H.edit(d, PATHS["fixtures"], put("repository.0.t", text))  # every JSON file is scanned, wherever the text is
        return d

    def test_chat_links_fail_publicly_and_pass_with_private(self):
        for link in self.CHAT_LINKS:
            with self.subTest(link=link):
                d = self.folder_with(link)
                self.assertTrue(any("contains a chat link" in e for e in H.errors_of(d)))
                self.assertEqual(H.errors_of(d, private=True), [])

    def test_private_allows_only_the_chat_link(self):
        for what, text in self.OTHERS:
            with self.subTest(text=text):
                d = self.folder_with(text)
                for private in (False, True):
                    self.assertTrue(any(what in e for e in H.errors_of(d, private)), (what, private))

    def test_private_flag_on_the_command_line(self):
        d = self.folder_with(self.CHAT_LINKS[0])
        self.assertEqual(H.check_cli(d).returncode, 1)
        r = H.check_cli(d, "--private")
        self.assertEqual((r.returncode, r.stdout.strip()), (0, "OK"))

    def test_the_cli_refuses_to_write_a_chat_link(self):  # public data keeps the 8-character chat id only
        d = H.copy_valid()
        before = H.tree(d)
        out = H.refused(d, "card", "set", *P, "--card", "a1", "--now", CHAT, *H.WS)
        self.assertIn("contains a chat link", out)
        self.assertEqual(H.tree(d), before)


class Robustness(unittest.TestCase):
    """Broken files are reported as problems, never as a crash."""

    def report(self, d, *needles):
        r = H.check_cli(d)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertNotIn("Traceback", r.stderr)
        for n in needles:
            self.assertIn(n, r.stdout)

    def test_invalid_json(self):
        d = H.copy_valid()
        (d / KEY / "cards.json").write_text("{not json", encoding="utf-8")
        self.report(d, "cannot read JSON")

    def test_utf8_bom(self):
        d = H.copy_valid()
        p = d / KEY / "cards.json"
        p.write_bytes(b"\xef\xbb\xbf" + p.read_bytes())
        self.report(d, "cannot read JSON")

    def test_missing_project_folder(self):
        d = H.copy_valid()
        H._remove(d / "other")
        self.report(d, "folder data/other/ is missing")

    def test_cards_file_is_a_list(self):
        d = H.copy_valid()
        (d / KEY / "cards.json").write_text("[]", encoding="utf-8")
        self.report(d, "unexpected structure")

    def test_missing_projects_file(self):
        d = H.copy_valid()
        (d / "projects.json").unlink()
        self.report(d, "cannot read JSON")

    # BUG: pp_check.scan_text reads every *.json with read_text(encoding="utf-8") and does not catch UnicodeDecodeError, so one UTF-16
    # file (what Windows PowerShell 5.1 writes with > or Out-File) makes the checker crash with a traceback instead of listing the problem.
    def test_utf16_file_is_reported_not_a_crash(self):
        d = H.copy_valid()
        p = d / KEY / "fixtures.json"
        p.write_bytes(p.read_text(encoding="utf-8").encode("utf-16"))
        self.report(d, "cannot read JSON")


if __name__ == "__main__":
    unittest.main()
