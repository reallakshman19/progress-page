"""End-to-end tests of the editing CLI (tools/pp_cli.py), always run as a subprocess on a private copy of the valid folder.
Projects, revisions and the --base history checks are in test_projects.py."""
import unittest

import helpers as H
from helpers import ACTOR, ISO, KEY, P, S, SRC, SRC2, WS, WW, card, doc, events

Base = H.OpsCase


class Cards(Base):
    def test_built_card_history_is_baseline_state_update(self):
        kinds = [(e["kind"], e.get("before"), e["after"]) for e in events(self.d) if e.get("card") == "a1"]
        self.assertEqual(kinds, [("BASELINE", None, "IN_PROGRESS"), ("STATE", "IN_PROGRESS", "SUBMITTED"), ("UPDATE", "SUBMITTED", "SUBMITTED")])

    def test_baseline_then_state_then_update_with_before_and_after(self):
        n = len(events(self.d))
        card(self.d, "n1", "--label", "New", "--state", "IN_PROGRESS", "--now", "first")
        card(self.d, "n1", "--state", "SUBMITTED", "--now", "second")
        card(self.d, "n1", "--now", "third")
        new = events(self.d)[n:]
        self.assertEqual([(e["kind"], e.get("before"), e["after"]) for e in new],
                         [("BASELINE", None, "IN_PROGRESS"), ("STATE", "IN_PROGRESS", "SUBMITTED"), ("UPDATE", "SUBMITTED", "SUBMITTED")])
        self.assertTrue(all((e["card"], e["actor"], e["source"], e["rev"]) == ("n1", ACTOR, SRC, "R1") for e in new))
        c = doc(self.d, "cards")["n1"]
        self.assertEqual((c["state"], c["now"], c["src"]), ("SUBMITTED", "third", SRC))
        self.assertRegex(c["updatedAt"], ISO)
        self.assertEqual(H.errors_of(self.d), [])

    # BUG: pp_ops.record() drops every field whose value is None, so a BASELINE entry written by the CLI has no "before" key. The contract says
    # before = null (hand-made baselines have it) and timeline.js draws "new -> STATE" only when e.before !== undefined.
    def test_baseline_entry_has_before_null_not_a_missing_key(self):
        card(self.d, "n1", "--label", "New", "--now", "first")
        e = events(self.d)[-1]
        self.assertIn("before", e, "the BASELINE entry has no before key")
        self.assertEqual((e["kind"], e["before"], e["after"]), ("BASELINE", None, "NOT_STARTED"))

    def test_every_write_adds_one_chained_entry_and_moves_the_project_time(self):
        n = len(events(self.d))
        card(self.d, "a1", "--now", "x")
        ev = events(self.d)
        self.assertEqual((len(ev), ev[-1]["seq"], ev[-1]["id"], ev[-1]["previous_id"]), (n + 1, n + 1, f"DEMO-R-{n + 1:04d}", ev[-2]["id"]))
        self.assertEqual(doc(self.d, "index")["project"]["updatedAt"], ev[-1]["at"])
        self.assertEqual(doc(self.d, "index")["project"]["updatedBy"], ACTOR)

    def test_not_started_card_has_no_time_or_source_until_it_starts(self):
        b1 = doc(self.d, "cards")["b1"]
        self.assertNotIn("updatedAt", b1)
        self.assertNotIn("src", b1)
        card(self.d, "b1", "--state", "IN_PROGRESS", "--now", "started")
        self.assertEqual((events(self.d)[-1]["kind"], events(self.d)[-1]["before"]), ("STATE", "NOT_STARTED"))
        self.assertIn("updatedAt", doc(self.d, "cards")["b1"])

    def test_flags_refs_edges_and_non_ascii_text(self):
        card(self.d, "a1", "--flag", "paused", "--flag", "needs-you", "--edge", "x1:both", "--now", "Schön ✓ 日本語",
             "--ref", "comment|Comment|https://github.com/acme/demo/issues/1#issuecomment-5")
        c = doc(self.d, "cards")["a1"]
        self.assertEqual((c["flags"], len(c["refs"]), c["now"]), (["paused", "needs-you"], 3, "Schön ✓ 日本語"))
        self.assertIn({"to": "x1", "k": "both"}, c["edges"])
        card(self.d, "a1", "--no-flags")
        self.assertEqual(doc(self.d, "cards")["a1"]["flags"], [])

    def test_at_sets_the_card_time_while_the_entry_is_stamped_now(self):
        card(self.d, "a1", "--now", "late news", "--at", "2020-01-01T00:00:00Z")
        self.assertEqual(doc(self.d, "cards")["a1"]["updatedAt"], "2020-01-01T00:00:00Z")
        self.assertNotEqual(events(self.d)[-1]["at"], "2020-01-01T00:00:00Z")

    def test_supersede(self):
        H.ok(self.d, "card", "supersede", *P, "--card", "x1", "--by", "a1", *WW)
        x1 = doc(self.d, "cards")["x1"]
        self.assertEqual((x1["state"], x1["closed"]["kind"], x1["closed"]["by"], x1["closed"]["src"], x1["next"]["actor"]), ("NOT_APPLICABLE", "superseded", "a1", SRC, "-"))
        e = events(self.d)[-1]
        self.assertEqual((e["kind"], e["card"], e["before"], e["after"], e["to"]), ("SUPERSEDE", "x1", "IN_PROGRESS", "NOT_APPLICABLE", "a1"))
        self.assertEqual(H.errors_of(self.d), [])

    def test_cancel(self):
        H.ok(self.d, "card", "cancel", *P, "--card", "a1", *WW)
        a1 = doc(self.d, "cards")["a1"]
        self.assertEqual((a1["state"], a1["closed"]["kind"], "by" in a1["closed"], a1["flags"]), ("NOT_APPLICABLE", "cancelled", False, []))
        e = events(self.d)[-1]
        self.assertEqual((e["kind"], e["before"], e["after"]), ("CANCEL", "SUBMITTED", "NOT_APPLICABLE"))
        self.assertEqual(H.errors_of(self.d), [])

    def test_closed_cards_refuse_further_edits(self):
        H.ok(self.d, "card", "cancel", *P, "--card", "x1", *WW)
        self.refuse("card", "set", *P, "--card", "x1", "--now", "again", *WS, says="final")
        self.refuse("card", "transfer", *P, "--card", "x1", "--to-chat", "c2", *WW, says="closed")
        self.refuse("card", "cancel", *P, "--card", "x1", *WW, says="already cancelled")
        self.refuse("card", "supersede", *P, "--card", "x1", "--by", "a1", *WW, says="already cancelled")

    def test_supersede_needs_another_card_of_the_project(self):
        for by in ("x1", "ghost"):
            self.refuse("card", "supersede", *P, "--card", "x1", "--by", by, *WW, says="--by must name another card")
        self.refuse("card", "cancel", *P, "--card", "ghost", *WW, says="No card")

    def test_transfer_moves_the_card_and_remembers_the_old_chat(self):
        H.ok(self.d, "card", "transfer", *P, "--card", "a1", "--to-chat", "c2", "--role", "second coder", *WW)
        a1 = doc(self.d, "cards")["a1"]
        self.assertEqual(a1["who"], {"chat": "c2", "role": "second coder", "from": "c1"})
        e = events(self.d)[-1]
        self.assertEqual((e["kind"], e["before"], e["after"], e["from"], e["to"]), ("TRANSFER", "SUBMITTED", "SUBMITTED", "c1", "c2"))
        self.assertEqual(H.errors_of(self.d), [])

    def test_transfer_needs_the_target_chat_in_the_index_chats(self):
        self.refuse("card", "transfer", *P, "--card", "a1", "--to-chat", "c3", *WW, says="must be in the project's chats")
        H.ok(self.d, "plan", "chat", *P, "--id", "c3", "--label", "Agent three", "--id8", "cccc3333", *WS)
        H.ok(self.d, "card", "transfer", *P, "--card", "a1", "--to-chat", "c3", *WW)
        self.assertEqual(doc(self.d, "cards")["a1"]["who"]["chat"], "c3")

    def test_transfer_needs_a_card_that_has_a_chat(self):
        card(self.d, "q1", "--label", "No chat", "--now", "n")
        self.refuse("card", "transfer", *P, "--card", "q1", "--to-chat", "c1", *WW, says="needs a current chat")


class Nudges(Base):
    def test_add_done_and_withdraw_record_who_when_and_where_from(self):
        H.ok(self.d, "nudge", "add", *P, "--card", "x1", "--text", "Ping the coder", *S)
        H.ok(self.d, "nudge", "done", *P, "--id", "N1", "--by", "Oracle O2", "--actor", ACTOR, "--src", SRC2)
        H.ok(self.d, "nudge", "withdraw", *P, "--id", "N2", "--by", "Owner", "--actor", ACTOR, "--src", SRC2)
        n = doc(self.d, "nudges")["nudges"]
        self.assertEqual((n["N2"]["card"], n["N2"]["by"], n["N2"]["src"]), ("x1", "Owner", SRC))
        self.assertEqual((n["N1"]["status"], n["N1"]["doneBy"], n["N1"]["doneSrc"]), ("done", "Oracle O2", SRC2))
        self.assertEqual((n["N2"]["status"], n["N2"]["withdrawnBy"], n["N2"]["withdrawnSrc"]), ("withdrawn", "Owner", SRC2))
        self.assertRegex(n["N1"]["doneAt"], ISO)
        self.assertRegex(n["N2"]["withdrawnAt"], ISO)
        ops = [(e["nudge"], e["op"], e["target"]) for e in events(self.d) if e["kind"] == "NUDGE"]
        self.assertEqual(ops, [("N1", "add", "a1"), ("N2", "add", "x1"), ("N1", "done", "a1"), ("N2", "withdraw", "x1")])
        self.assertEqual(H.errors_of(self.d), [])

    def test_a_nudge_is_closed_once(self):
        close = ("--id", "N1", "--by", "Oracle O2", *S)
        H.ok(self.d, "nudge", "done", *P, *close)
        self.refuse("nudge", "done", *P, *close, says="No open nudge")
        self.refuse("nudge", "withdraw", *P, *close, says="No open nudge")

    def test_unknown_nudge_or_card_is_refused(self):
        self.refuse("nudge", "done", *P, "--id", "N9", "--by", "x", *S, says="No open nudge")
        self.refuse("nudge", "add", *P, "--card", "ghost", "--text", "t", *S, says="No card")


class Decisions(Base):
    def add(self, key="d2", suggested="B"):
        return ("action", "add", *P, "--key", key, "--title", "Second", "--lead", "Which?", "--option", "A|A|a|reply a", "--option", "B|B|b|reply b", "--suggested", suggested, *S)

    def test_add_then_answer(self):
        H.ok(self.d, *self.add())
        a = doc(self.d, "actions")["d2"]
        self.assertEqual((a["status"], a["order"], [o["suggested"] for o in a["options"]]), ("open", 2, [False, True]))
        self.assertTrue(a["options"][1]["label"].endswith("(suggested)"))
        H.ok(self.d, "action", "answer", *P, "--key", "d2", "--text", "reply b", "--ref", SRC2, "--actor", ACTOR)
        a = doc(self.d, "actions")["d2"]
        self.assertEqual((a["status"], a["answer"]["text"], a["answer"]["ref"]), ("done", "reply b", SRC2))
        self.assertRegex(a["answer"]["at"], ISO)
        last = [(e["kind"], e["source"]) for e in events(self.d)[-2:]]
        self.assertEqual(last, [("ACTION", SRC), ("ANSWER", SRC2)])
        self.assertEqual(H.errors_of(self.d), [])

    def test_answering_needs_an_open_decision(self):
        H.ok(self.d, "action", "answer", *P, "--key", "d1", "--text", "A", "--ref", SRC2, "--actor", ACTOR)
        self.refuse("action", "answer", *P, "--key", "d1", "--text", "A", "--ref", SRC2, "--actor", ACTOR, says="No open decision")
        self.refuse("action", "answer", *P, "--key", "ghost", "--text", "A", "--ref", SRC2, "--actor", ACTOR, says="No open decision")

    # BUG: pp_cards.action_add cuts "KEY|label|body|reply" with split("|")[:4], so text after a fourth "|" is dropped without a word.
    def test_an_option_with_a_pipe_in_its_reply_is_refused_or_kept_whole(self):
        r = H.cli(self.d, "action", "add", *P, "--key", "d3", "--title", "T", "--lead", "L", "--option", "A|label|body|reply | and more", "--option", "B|b|b|b",
                  "--suggested", "A", *S)
        if r.returncode == 0:
            option = doc(self.d, "actions")["d3"]["options"][0]
            self.assertIn("and more", option["body"] + option["reply"], "the reply was cut at the pipe")

    def test_a_decision_key_is_used_once(self):
        self.refuse(*self.add("d1"), says="exists")

    def test_add_with_a_suggested_key_that_matches_no_option_is_rolled_back(self):
        self.refuse(*self.add(suggested="Z"), says="exactly one suggested option")


class Fixtures(Base):
    def test_add_and_remove(self):
        H.ok(self.d, "fixture", "add", *P, "--list", "issues", "--text", "Issue one", "--url", "https://github.com/acme/demo/issues/1", "--status", "open", *WS)
        self.assertEqual(doc(self.d, "fixtures")["issues"], [{"t": "Issue one", "u": "https://github.com/acme/demo/issues/1", "s": "open"}])
        H.ok(self.d, "fixture", "remove", *P, "--list", "issues", "--text", "Issue one", *WS)
        self.assertEqual(doc(self.d, "fixtures")["issues"], [])
        self.assertEqual([(e["op"], e["list"]) for e in events(self.d) if e["kind"] == "FIXTURE"], [("add", "repository"), ("add", "issues"), ("remove", "issues")])

    def test_remove_of_a_missing_line_and_add_to_an_unknown_list_are_refused(self):
        self.refuse("fixture", "remove", *P, "--list", "issues", "--text", "nothing", *WS, says="No item")
        self.refuse("fixture", "add", *P, "--list", "nolist", "--text", "t", *WS, says="unknown list 'nolist'")


class Plan(Base):
    def test_edit_a_milestone_and_add_a_group(self):
        H.ok(self.d, "plan", "milestone", *P, "--id", "M1", "--name", "Planning", *WS)
        m1 = doc(self.d, "index")["milestones"]["M1"]
        self.assertEqual((m1["name"], m1["order"]), ("Planning", 1))
        H.ok(self.d, "plan", "group", *P, "--id", "g3", "--title", "Third", "--order", "3", *WS)
        self.assertEqual(doc(self.d, "index")["groups"]["g3"], {"title": "Third", "order": 3})
        self.assertEqual([e["scope"] for e in events(self.d) if e["kind"] == "PLAN"][-2:], ["milestone:M1", "group:g3"])

    def test_a_chat_id8_may_not_be_a_link(self):
        self.refuse("plan", "chat", *P, "--id", "c9", "--label", "L", "--id8", "https://example.com/x", *WS, says="id8 must be the short chat id")


class Rollback(Base):
    def test_unknown_edge_target_leaves_every_file_identical(self):  # the example from the contract
        self.refuse("card", "set", *P, "--card", "a1", "--edge", "nosuchcard:to", *WS, says="Nothing was written")

    def test_every_kind_of_bad_input_is_rolled_back(self):
        cases = {
            "edge kind": (("card", "set", *P, "--card", "a1", "--edge", "x1:sideways", *WS), "k 'sideways' is not one of"),
            "source not GitHub": (("card", "set", *P, "--card", "a1", "--now", "x", "--actor", "A", "--src", "http://example.com/x", "--summary", "s"), "src must be"),
            "unknown group": (("card", "set", *P, "--card", "a1", "--group", "nogroup", *WS), "group 'nogroup'"),
            "unknown milestone": (("card", "set", *P, "--card", "a1", "--milestone", "M9", *WS), "milestone 'M9'"),
            "unknown chat": (("card", "set", *P, "--card", "a1", "--chat", "c9", *WS), "who.chat 'c9'"),
            "unknown flag": (("card", "set", *P, "--card", "a1", "--flag", "urgent", *WS), "flag 'urgent'"),
            "ref not https": (("card", "set", *P, "--card", "a1", "--ref", "issue|Bad|http://example.com/1", *WS), "u must be an https link"),
            "time in the future": (("card", "set", *P, "--card", "a1", "--at", "2099-01-01T00:00:00Z", *WS), "updatedAt is later than"),
            "time not a stamp": (("card", "set", *P, "--card", "a1", "--at", "yesterday", *WS), "updatedAt must be a UTC time"),
            "label too long": (("card", "set", *P, "--card", "a1", "--label", "L" * 41, *WS), "label is longer than 40"),
            "card id with a space": (("card", "set", *P, "--card", "bad id", "--label", "B", "--now", "n", *WS), "card id must be letters"),
            "milestone without order": (("plan", "milestone", *P, "--id", "M9", "--name", "Nine", *WS), "order is required"),
            "fixture list unknown": (("fixture", "add", *P, "--list", "nolist", "--text", "t", *WS), "unknown list"),
            "answer ref not GitHub": (("action", "answer", *P, "--key", "d1", "--text", "A", "--ref", "http://example.com/x", "--actor", ACTOR), "must be a public GitHub link"),
            "nudge text too long": (("nudge", "add", *P, "--card", "a1", "--text", "t" * 401, *S), "text is longer than 400"),
            "actor too long": (("card", "set", *P, "--card", "a1", "--now", "x", "--actor", "A" * 61, "--src", SRC, "--summary", "s"), "actor is longer than 60"),
            "summary too long": (("card", "set", *P, "--card", "a1", "--now", "x", "--actor", ACTOR, "--src", SRC, "--summary", "s" * 401), "summary is longer than 400"),
            "archive with a bad source": (("project", "archive", "--key", KEY, "--actor", "A", "--src", "http://example.com/x", "--why", "w"), "must be a public GitHub link"),
        }
        for name, (args, says) in cases.items():
            with self.subTest(name):
                out = self.refuse(*args, says=says)
                self.assertIn("Nothing was written", out)

    # BUG: pp_lib.Txn saves the old text with read_text() (CRLF becomes LF) and writes it back as LF, so a refused command rewrites
    # a file that had Windows line endings; it is not byte-identical afterwards.
    def test_refused_command_keeps_crlf_files_byte_identical(self):
        p = self.d / KEY / "cards.json"
        p.write_bytes(p.read_bytes().replace(b"\n", b"\r\n"))
        self.before = H.tree(self.d)
        self.refuse("card", "set", *P, "--card", "a1", "--edge", "nosuchcard:to", *WS, says="Nothing was written")


class CheckCommand(Base):
    def test_check_command_uses_the_checker(self):
        r = H.cli(self.d, "check")
        self.assertEqual((r.returncode, r.stdout.strip()), (0, "OK"))
        H.edit(self.d, f"{KEY}/cards.json", H.put("a1.state", "DONE"))
        r = H.cli(self.d, "check")
        self.assertEqual(r.returncode, 1)
        self.assertIn("state 'DONE' is not one of", r.stdout)


if __name__ == "__main__":
    unittest.main()
