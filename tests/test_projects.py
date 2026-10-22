"""Project lifecycle, plan revisions (git) and the --base history checks of tools/pp_cli.py and tools/pp_check.py."""
import unittest

import helpers as H
from helpers import ACTOR, ISO, KEY, OTHER, P, S, SRC, WS, WW, card, doc, entries, events

Base = H.OpsCase


class Projects(Base):
    def test_the_built_projects_have_their_mode_and_reply_route(self):
        p = entries(self.d)
        self.assertEqual((p[KEY]["mode"], p[KEY]["replyTo"]), ("standalone", {"kind": "none"}))
        self.assertEqual((p[OTHER]["mode"], p[OTHER]["replyTo"]["repo"], p[OTHER]["replyTo"]["site"]), ("otm", "acme/demo", "https://acme.github.io/demo/"))
        self.assertEqual(doc(self.d, "index")["rules"]["coordinator"], "Oracle")

    def test_archive_sets_the_status_fields_and_records_the_entry(self):
        H.ok(self.d, "project", "archive", "--key", KEY, *WW)
        p = entries(self.d)[KEY]
        self.assertEqual((p["status"], p["statusBy"], p["statusSrc"], p["statusWhy"]), ("archived", ACTOR, SRC, "recorded in a test"))
        self.assertRegex(p["statusAt"], ISO)
        self.assertEqual((events(self.d)[-1]["kind"], events(self.d)[-1]["scope"]), ("ARCHIVE", "project"))
        self.assertEqual(H.errors_of(self.d), [])

    def test_archived_project_accepts_no_new_card_edits(self):
        H.ok(self.d, "project", "archive", "--key", KEY, *WW)
        self.refuse("card", "set", *P, "--card", "a1", "--now", "x", *WS, says="only RESTORE is allowed")
        self.refuse("nudge", "add", *P, "--card", "a1", "--text", "x", *S, says="only RESTORE is allowed")
        self.refuse("project", "archive", "--key", KEY, *WW, says="already archived")

    # BUG: pp_ops.lifecycle pops statusWhy/statusAt/statusBy/statusSrc for RESTORE but never resets or removes `status`, so the project
    # stays "archived" without its reason and the check refuses every restore. An archived project can never be brought back.
    def test_restore_makes_the_project_active_and_editable_again(self):
        H.ok(self.d, "project", "archive", "--key", KEY, *WW)
        H.ok(self.d, "project", "restore", "--key", KEY, *WW)
        self.assertEqual(entries(self.d)[KEY].get("status", "active"), "active")
        card(self.d, "a1", "--now", "back again")
        self.assertEqual(H.errors_of(self.d), [])

    def test_restore_of_an_active_project_is_refused(self):
        self.refuse("project", "restore", "--key", KEY, *WW, says="RESTORE on a project that is active")

    def test_supersede_names_the_replacing_project(self):
        self.refuse("project", "supersede", "--key", KEY, "--by", "ghost", *WW, says="--by must name another existing project")
        self.refuse("project", "supersede", "--key", KEY, "--by", KEY, *WW, says="--by must name another existing project")
        H.ok(self.d, "project", "supersede", "--key", KEY, "--by", OTHER, *WW)
        p = entries(self.d)[KEY]
        self.assertEqual((p["status"], p["supersededBy"]), ("superseded", OTHER))
        self.assertEqual((events(self.d)[-1]["kind"], events(self.d)[-1]["to"]), ("SUPERSEDE", OTHER))
        self.assertEqual(H.errors_of(self.d), [])

    def test_cancel(self):
        H.ok(self.d, "project", "cancel", "--key", OTHER, *WW)
        self.assertEqual(entries(self.d)[OTHER]["status"], "cancelled")
        self.refuse("project", "archive", "--key", OTHER, *WW, says="already cancelled")

    def test_transfer_changes_the_coordinator_the_mode_and_the_reply_target(self):
        H.ok(self.d, "project", "transfer", "--key", OTHER, "--to-coordinator", "Oracle O9", "--to-mode", "standalone", "--reply-target", "Oracle O9", *WW)
        self.assertEqual(doc(self.d, "index", OTHER)["rules"]["coordinator"], "Oracle O9")
        self.assertEqual((entries(self.d)[OTHER]["mode"], entries(self.d)[OTHER]["replyTo"]["target"]), ("standalone", "Oracle O9"))
        e = events(self.d, OTHER)[-1]
        self.assertEqual((e["kind"], e["to"]), ("TRANSFER", "standalone:Oracle O9"))
        self.assertEqual(H.errors_of(self.d), [])

    def test_add_refuses_a_used_or_malformed_key(self):
        new = ("--title", "T", "--owner-words", "w", *WW)
        self.refuse("project", "add", "--key", KEY, *new, says="already exists")
        self.refuse("project", "add", "--key", "Bad_Key", *new, says="key must be lower-case")

    def test_add_starts_a_project_with_revision_r1_and_one_entry(self):
        H.ok(self.d, "project", "add", "--key", "third", "--title", "Third", "--owner-words", "go", "--subtitle", "sub", *WW)
        idx = doc(self.d, "index", "third")
        self.assertEqual([(r["id"], r["status"], r["ownerWords"]) for r in idx["revisions"]], [("R1", "current", "go")])
        self.assertEqual([(e["kind"], e["revision"], e["rev"]) for e in events(self.d, "third")], [("REVISION", "R1", "R1")])
        self.assertEqual(entries(self.d)["third"]["order"], 3)
        self.assertEqual(H.errors_of(self.d), [])

    # BUG: pp_ops.add_project creates data/<key>/ before the check and Txn.rollback removes only files, so a refused `project add`
    # leaves an empty folder behind (here: after a source that is not a GitHub link).
    def test_refused_project_add_leaves_nothing_behind(self):
        self.refuse("project", "add", "--key", "third", "--title", "T", "--owner-words", "w", "--actor", "A", "--src", "http://example.com/x", "--why", "w",
                    says="Nothing was written")

    # BUG: the leftover folder of a refused `project add` makes the retry fail with "Project 'third' already exists".
    def test_project_add_can_be_retried_after_a_refusal(self):
        H.refused(self.d, "project", "add", "--key", "third", "--title", "T", "--owner-words", "w", "--actor", "A", "--src", "http://example.com/x", "--why", "w")
        H.ok(self.d, "project", "add", "--key", "third", "--title", "T", "--owner-words", "w", *WW)
        self.assertIn("third", entries(self.d))


class Revisions(unittest.TestCase):
    def setUp(self):
        self.repo, self.d = H.copy_repo()
        self.first = H.git(self.repo, "rev-parse", "HEAD")

    def add(self, words="Change direction"):
        return ("revision", "add", *P, "--owner-words", words, "--why", "direction changed", *S)

    def test_old_revision_is_superseded_with_a_commit_and_the_new_one_is_current(self):
        H.ok(self.d, *self.add())
        r1, r2 = doc(self.d, "index")["revisions"]
        self.assertEqual((r1["status"], r2["status"], r2["supersedes"], r2["ownerWords"]), ("superseded", "current", "R1", "Change direction"))
        self.assertTrue(self.first.startswith(r1["commit"]) and len(r1["commit"]) >= 7)
        e = events(self.d)[-1]
        self.assertEqual((e["kind"], e["revision"], e["supersedes"], e["rev"]), ("REVISION", "R2", "R1", "R2"))
        r = H.check_cli(self.d, "--base", self.first, cwd=self.repo)
        self.assertEqual((r.returncode, r.stdout.strip()), (0, "OK"), r.stdout)

    def test_refused_while_data_has_uncommitted_changes(self):
        card(self.d, "a1", "--now", "not committed yet")
        before = H.tree(self.d)
        self.assertIn("Commit the current data first", H.refused(self.d, *self.add()))
        self.assertEqual(H.tree(self.d), before)

    def test_a_second_revision_keeps_the_first_ones_commit(self):
        H.ok(self.d, *self.add())
        c1 = doc(self.d, "index")["revisions"][0]["commit"]
        H.commit_all(self.repo, "r2")
        H.ok(self.d, *self.add("Third words"))
        revs = doc(self.d, "index")["revisions"]
        self.assertEqual([(r["id"], r["status"]) for r in revs], [("R1", "superseded"), ("R2", "superseded"), ("R3", "current")])
        self.assertEqual((revs[0]["commit"], revs[2]["supersedes"]), (c1, "R2"))
        self.assertNotEqual(revs[1]["commit"], c1)
        self.assertEqual(H.errors_of(self.d), [])

    def test_later_entries_belong_to_the_new_revision(self):
        H.ok(self.d, *self.add())
        card(self.d, "a1", "--now", "after")
        self.assertEqual((events(self.d)[-1]["rev"], events(self.d)[0]["rev"]), ("R2", "R1"))
        self.assertEqual(H.errors_of(self.d), [])

    def test_without_a_git_repository_the_revision_has_no_commit(self):
        d = H.copy_valid()
        H.ok(d, *self.add())
        self.assertFalse(doc(d, "index")["revisions"][0].get("commit"))
        self.assertEqual(H.errors_of(d), [])


class History(unittest.TestCase):
    """`check --base HEAD` catches edits that pass the plain check but rewrite or hide history."""

    def setUp(self):
        self.repo, self.d = H.copy_repo()

    def base(self, ref="HEAD"):
        r = H.check_cli(self.d, "--base", ref, cwd=self.repo)
        return r.returncode, r.stdout

    def caught(self, *needles):
        self.assertEqual(H.errors_of(self.d), [], "the edit must pass the plain check, so that only --base can catch it")
        code, out = self.base()
        self.assertEqual(code, 1, out)
        for n in needles:
            self.assertIn(n, out)

    def edit(self, name, fn):
        H.edit(self.d, "projects.json" if name == "projects" else f"{KEY}/{name}.json", fn)

    def hide(self, **match):  # remove the matching Timeline entries and renumber, as somebody covering a deletion would
        def mutate(a):
            a["events"] = [e for e in a["events"] if not all(e.get(k) == v for k, v in match.items())]
            H.rechain(a)
        self.edit("audit", mutate)

    def test_unchanged_data_passes(self):
        self.assertEqual(self.base(), (0, "OK\n"))

    def test_edits_made_through_the_cli_pass_against_an_older_commit(self):
        first = H.git(self.repo, "rev-parse", "HEAD")
        card(self.d, "a1", "--now", "one")
        H.commit_all(self.repo, "one")
        card(self.d, "a1", "--now", "two")
        self.assertEqual(self.base(first), (0, "OK\n"))

    def test_deleting_a_card(self):
        self.edit("cards", H.drop("b1"))
        self.hide(card="b1")
        self.caught("card 'b1' was deleted; supersede or cancel it instead")

    def test_deleting_a_decision(self):
        self.edit("actions", H.drop("d1"))
        self.hide(action="d1")
        self.caught("decision 'd1' was deleted")

    def test_deleting_a_nudge(self):
        self.edit("nudges", lambda d: d["nudges"].clear())
        self.hide(kind="NUDGE")
        self.caught("nudge 'N1' was deleted; withdraw it instead")

    def test_editing_an_old_timeline_entry(self):
        self.edit("audit", lambda a: a["events"][1].update(summary="rewritten history"))
        self.caught("an earlier Timeline entry was changed or removed")

    def test_changing_cards_without_a_new_timeline_entry(self):
        self.edit("cards", H.put("a1.now", "changed quietly"))
        self.caught("data changed but the Timeline gained no entry")

    def test_editing_a_revisions_words(self):
        self.edit("index", H.put("revisions.0.ownerWords", "different words"))
        self.caught("revision R1 was changed; a revision keeps its words")

    def test_removing_a_project(self):
        self.edit("projects", H.drop("projects.1"))
        self.caught("project 'other' was removed; archive it instead")

    # BUG: pp_history compares index, cards, actions, fixtures, nudges and audit only, so a hand edit of projects.json (reply route, mode, label)
    # needs no Timeline entry: the Owner's replies could be pointed at another repository and `check --base` still says OK.
    def test_changing_a_projects_reply_route_needs_a_timeline_entry(self):
        self.edit("projects", lambda d: d["projects"][1]["replyTo"].update(repo="attacker/evil"))
        code, out = self.base()
        self.assertEqual(code, 1, out)

    # BUG: pp_history._at_base returns None for any failed `git show`, and check_against_base then returns "no problems", so a base ref
    # that does not exist (a typo, a missing origin/main) makes `--base` pass without comparing anything.
    def test_a_base_ref_that_does_not_exist_is_an_error(self):
        code, out = self.base("no-such-ref")
        self.assertEqual(code, 1, out)

    def test_base_outside_a_git_repository_is_reported(self):
        r = H.check_cli(H.copy_valid(), "--base", "HEAD")
        self.assertEqual(r.returncode, 1)
        self.assertIn("not inside a git repository", r.stdout)


if __name__ == "__main__":
    unittest.main()
