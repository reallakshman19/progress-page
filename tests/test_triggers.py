"""Trigger rules (tools/page_triggers.py, mirrored from triggers.js): each rule on small hand-made data, plus a parity run against node."""
import json
import os
import shutil
import subprocess
import unittest
from datetime import datetime, timedelta, timezone

import helpers as H
import page_triggers as T

NOW = datetime(2026, 10, 22, 12, 0, 0, tzinfo=timezone.utc)


def ago(minutes=0, seconds=0):
    return (NOW - timedelta(minutes=minutes, seconds=seconds)).strftime("%Y-%m-%dT%H:%M:%SZ")


def mk(state="IN_PROGRESS", age=60, actor="-", flags=None, order=1, **extra):
    c = {"order": order, "label": "Card", "state": state, "next": {"actor": actor, "text": "do it"}}
    if age is not None:
        c["updatedAt"] = ago(age)
    if flags:
        c["flags"] = flags
    c.update(extra)
    return c


def nudge(card="c", age=0, status="open"):
    return {"card": card, "text": "t", "by": "Owner", "at": ago(age), "src": H.SRC, "status": status}


def folder(*projects):
    """A data folder with projects.json and, per project, index.json, cards.json and nudges.json built from dicts."""
    root = H.tmpdir("pp-trig-") / "data"
    root.mkdir()
    listed = []
    for i, p in enumerate(projects, 1):
        key = p.get("key", "p1")
        listed.append({"key": key, "label": key.upper(), "order": i, **({"status": p["status"]} if "status" in p else {})})
        (root / key).mkdir()
        index = {"project": {"key": key, "updatedAt": ago(p.get("tab", 0)), **p.get("project", {})}, "rules": p.get("rules", {})}
        if p.get("hold"):
            index["hold"] = {"active": True}
        H.save(root / key / "index.json", index)
        H.save(root / key / "cards.json", p.get("cards", {}))
        H.save(root / key / "nudges.json", {"schema": 3, "nudges": p.get("nudges", {})})
    H.save(root / "projects.json", {"schema": 3, "projects": listed})
    return root


def rec(cards, **kw):
    """The trigger record of one project that holds these cards."""
    return T.evaluate(folder({"cards": cards, **kw}), NOW)[0]


def counts(r):
    return {k: r[k] for k in ("needsYou", "owes", "quiet", "waiting", "nudges")}


def tag(r, card="c"):
    return [(i["tag"], i["text"], i["sev"]) for i in r["items"] if i["card"] == card]


class NeedsYou(unittest.TestCase):
    def test_next_actor_you_or_the_flag(self):
        r = rec({"c": mk("SUBMITTED", 5, "YOU"), "d": mk("IN_PROGRESS", 0, "-", ["needs-you"], order=2)})
        self.assertEqual(counts(r), dict(needsYou=2, owes=0, quiet=0, waiting=0, nudges=0))
        self.assertEqual(tag(r), [("needs-you", "needs you · 5m", 2)])

    def test_beats_paused_and_still_shows_on_hold(self):
        r = rec({"c": mk("IN_PROGRESS", 90, "-", ["paused", "needs-you"])}, hold=True)
        self.assertEqual((r["needsYou"], tag(r)[0][0]), (1, "needs-you"))

    def test_blocked_card_waiting_for_you_shows_needs_you_and_nothing_for_other_agents(self):
        r = rec({"c": mk("BLOCKED", 500, "Reviewer"), "d": mk("BLOCKED", 500, "YOU", order=2)})
        self.assertEqual((counts(r), [i["card"] for i in r["items"]]), (dict(needsYou=1, owes=0, quiet=0, waiting=0, nudges=0), ["d"]))

    # BUG (rule and code disagree, in triggers.js and page_triggers.py alike): the rule list in triggers.js says BLOCKED cards "only ever show
    # needs you", but a BLOCKED card whose next actor is the coordinator gets an "owes" tag.
    def test_blocked_card_owed_by_the_coordinator_shows_only_needs_you(self):
        r = rec({"c": mk("BLOCKED", 500, "OTM")})
        self.assertEqual((r["owes"], r["items"]), (0, []))


class CoordinatorOwes(unittest.TestCase):
    def test_default_coordinator_otm_after_15_minutes(self):
        self.assertEqual(rec({"c": mk(age=14, actor="OTM")})["owes"], 0)
        self.assertEqual(tag(rec({"c": mk(age=15, actor="OTM")})), [("owes", "OTM owes · 15m", 1)])
        self.assertEqual(tag(rec({"c": mk("SUBMITTED", age=60, actor="OTM")})), [("owes", "OTM owes · 1h 0m", 2)])

    def test_custom_coordinator_is_compared_case_insensitively(self):
        for actor in ("Oracle", "oracle", "ORACLE"):
            with self.subTest(actor=actor):
                r = rec({"c": mk("SUBMITTED", 20, actor)}, rules={"coordinator": "Oracle"})
                self.assertEqual((r["owes"], r["waiting"], r["coordinator"], tag(r)), (1, 0, "Oracle", [("owes", "Oracle owes · 20m", 1)]))

    def test_with_a_custom_coordinator_otm_is_just_another_waiter(self):
        r = rec({"c": mk("SUBMITTED", 20, "OTM")}, rules={"coordinator": "Oracle"})
        self.assertEqual((r["owes"], r["waiting"], tag(r)), (0, 1, [("waiting", "waiting for OTM · 20m", 1)]))

    def test_the_limit_comes_from_the_rules(self):
        self.assertEqual(rec({"c": mk(age=5, actor="OTM")}, rules={"owesAfterMin": 5})["owes"], 1)
        self.assertEqual(rec({"c": mk(age=14, actor="OTM")}, rules={"owesAfterMin": 20})["owes"], 0)

    def test_owes_wins_over_quiet_and_there_is_one_tag_per_card(self):
        self.assertEqual([t[0] for t in tag(rec({"c": mk("IN_PROGRESS", 40, "OTM")}))], ["owes"])


class QuietAndWaiting(unittest.TestCase):
    def test_quiet_after_30_minutes_in_progress(self):
        self.assertEqual(rec({"c": mk(age=29)})["quiet"], 0)
        self.assertEqual(tag(rec({"c": mk(age=30)})), [("quiet", "quiet 30m: ping it", 1)])
        self.assertEqual(tag(rec({"c": mk(age=60)})), [("quiet", "quiet 1h 0m: ping it", 2)])
        self.assertEqual(rec({"c": mk(age=10)}, rules={"quietAfterMin": 10})["quiet"], 1)

    def test_quiet_is_for_in_progress_only(self):
        r = rec({"c": mk("SUBMITTED", 500), "d": mk("STALE", 500, order=2), "e": mk("UNKNOWN", 500, order=3)})
        self.assertEqual(r["items"], [])

    def test_waiting_for_someone_else_after_15_minutes_submitted(self):
        self.assertEqual(rec({"c": mk("SUBMITTED", 14, "Reviewer")})["waiting"], 0)
        self.assertEqual(tag(rec({"c": mk("SUBMITTED", 15, "Reviewer")})), [("waiting", "waiting for Reviewer · 15m", 1)])
        self.assertEqual(tag(rec({"c": mk("SUBMITTED", 60, "Reviewer")}))[0][2], 2)
        self.assertEqual(rec({"c": mk("SUBMITTED", 500, "-")})["waiting"], 0)

    def test_seconds_are_floored_to_whole_minutes(self):
        self.assertEqual(rec({"c": mk(age=0)}, rules={})["quiet"], 0)
        self.assertEqual(T.minutes_since(ago(29, 59), NOW), 29)
        self.assertEqual(T.minutes_since(ago(30, 1), NOW), 30)


class PausedAndHold(unittest.TestCase):
    def test_paused_flag_silences_every_other_card_trigger(self):
        r = rec({"c": mk("IN_PROGRESS", 500, "OTM", ["paused"])})
        self.assertEqual((counts(r), tag(r)), (dict(needsYou=0, owes=0, quiet=0, waiting=0, nudges=0), [("paused", "paused", 0)]))

    def test_project_hold_pauses_every_card_and_the_stale_tab(self):
        r = rec({"c": mk("IN_PROGRESS", 500), "d": mk("SUBMITTED", 500, "Reviewer", order=2)}, hold=True, tab=900)
        self.assertEqual((counts(r), [i["tag"] for i in r["items"]], r["stale"]), (dict(needsYou=0, owes=0, quiet=0, waiting=0, nudges=0), ["paused", "paused"], False))


class StaleTab(unittest.TestCase):
    def test_stale_after_120_minutes(self):
        self.assertEqual((rec({}, tab=119)["stale"], rec({}, tab=121)["stale"], rec({}, tab=121)["staleFor"]), (False, True, 121))

    def test_limit_from_the_project_block_or_the_rules(self):
        self.assertTrue(rec({}, tab=11, project={"staleAfterMin": 10})["stale"])
        self.assertTrue(rec({}, tab=11, project={"staleAfterMin": 500}, rules={"staleAfterMin": 10})["stale"])


class Nudges(unittest.TestCase):
    def test_open_nudges_are_counted_per_card_with_the_oldest_age(self):
        r = rec({"c": mk("VERIFIED", 1), "d": mk("VERIFIED", 1, order=2)}, nudges={"N1": nudge("c", 20), "N2": nudge("c", 5), "N3": nudge("d", 3)})
        self.assertEqual(r["nudges"], 3)
        self.assertEqual(tag(r), [("nudge", "2 nudges for OTM · 20m", 1)])
        self.assertEqual(tag(r, "d"), [("nudge", "1 nudge for OTM · 3m", 0)])

    def test_severity_rises_at_15_and_60_minutes(self):
        sev = lambda age: tag(rec({"c": mk("VERIFIED")}, nudges={"N1": nudge("c", age)}))[0][2]  # noqa: E731
        self.assertEqual([sev(14), sev(15), sev(59), sev(60)], [0, 1, 1, 2])

    def test_done_and_withdrawn_nudges_do_not_count(self):
        r = rec({"c": mk("VERIFIED")}, nudges={"N1": nudge("c", 99, "done"), "N2": nudge("c", 99, "withdrawn")})
        self.assertEqual((r["nudges"], r["items"]), (0, []))

    def test_fires_on_a_paused_card_and_on_a_project_on_hold(self):
        r = rec({"c": mk("IN_PROGRESS", 500, "-", ["paused"])}, nudges={"N1": nudge("c", 30)})
        self.assertEqual((r["nudges"], [t[0] for t in tag(r)]), (1, ["paused", "nudge"]))
        r = rec({"c": mk("IN_PROGRESS", 500)}, nudges={"N1": nudge("c", 30)}, hold=True)
        self.assertEqual((r["nudges"], [t[0] for t in tag(r)]), (1, ["paused", "nudge"]))

    def test_the_text_names_the_projects_coordinator(self):
        r = rec({"c": mk("VERIFIED")}, nudges={"N1": nudge("c", 1)}, rules={"coordinator": "Oracle"})
        self.assertEqual(tag(r)[0][1], "1 nudge for Oracle · 1m")


class NeverTrigger(unittest.TestCase):
    def test_finished_unstarted_and_closed_cards(self):
        cards = {f"c{i}": mk(state, 999, "YOU", ["needs-you"], order=i) for i, state in enumerate(("VERIFIED", "NOT_STARTED", "NOT_APPLICABLE"), 1)}
        cards["gone"] = mk("NOT_APPLICABLE", 999, "OTM", closed={"kind": "cancelled", "why": "w", "at": ago(1), "src": H.SRC}, order=9)
        r = rec(cards)
        self.assertEqual((counts(r), r["items"]), (dict(needsYou=0, owes=0, quiet=0, waiting=0, nudges=0), []))

    # BUG: page_triggers.evaluate adds the nudge tag (and counts the nudge) for a superseded or cancelled card, although the page never shows
    # one on a closed card (progress.js skips closed cards) and the rules say closed cards never trigger: the Nudges count has no card behind it.
    def test_an_open_nudge_on_a_closed_card_does_not_trigger(self):
        closed = {"kind": "cancelled", "why": "w", "at": ago(1), "src": H.SRC}
        r = rec({"c": mk("NOT_APPLICABLE", 10, closed=closed)}, nudges={"N1": nudge("c", 30)})
        self.assertEqual((r["nudges"], r["items"]), (0, []))


class Projects(unittest.TestCase):
    def test_only_active_projects_are_evaluated_in_order(self):
        d = folder({"key": "a", "cards": {"c": mk(age=40)}}, {"key": "b", "status": "archived"}, {"key": "c", "status": "superseded"},
                   {"key": "d", "status": "cancelled"}, {"key": "e", "status": "active"})
        self.assertEqual([r["project"] for r in T.evaluate(d, NOW)], ["a", "e"])

    def test_items_follow_the_card_order(self):
        r = rec({"late": mk(age=40, order=2), "early": mk(age=40, order=1)})
        self.assertEqual([i["card"] for i in r["items"]], ["early", "late"])

    def test_the_real_data_folder_evaluates(self):
        recs = T.evaluate(H.ROOT / "data", NOW)
        self.assertTrue(recs and all({"project", "stale", "needsYou", "owes", "quiet", "waiting", "nudges", "items"} <= set(r) for r in recs))


class Formatting(unittest.TestCase):
    def test_fmt(self):
        got = [T.fmt(m) for m in (0, 59, 60, 125, 47 * 60 + 59, 48 * 60, 3 * 1440 + 5 * 60)]
        self.assertEqual(got, ["0m", "59m", "1h 0m", "2h 5m", "47h 59m", "2d 0h", "3d 5h"])

    def test_minutes_since_ignores_missing_or_unreadable_times(self):
        self.assertEqual((T.minutes_since(None, NOW), T.minutes_since("", NOW), T.minutes_since("soon", NOW)), (None, None, None))


class Command(unittest.TestCase):
    def test_triggers_json_matches_evaluate(self):
        d = folder({"cards": {"c": mk(age=40, actor="OTM")}, "nudges": {"N1": nudge("c", 20)}})
        r = H.cli(d, "triggers", "--json", "--now", "2026-10-22T12:00:00Z")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout), T.evaluate(d, NOW))

    def test_triggers_text_lists_a_line_per_project_and_card(self):
        d = folder({"cards": {"c": mk(age=40, actor="OTM")}})
        out = H.cli(d, "triggers", "--now", "2026-10-22T12:00:00Z").stdout
        self.assertIn("P1: tab fresh | needs you 0 | OTM owes 1 | nudges 0 | quiet 0 | waiting 0", out)
        self.assertIn("Card: OTM owes · 40m -> do it", out)


STATES = ("NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "VERIFIED", "BLOCKED", "STALE", "UNKNOWN", "NOT_APPLICABLE")
ACTORS = ("-", "YOU", "OTM", "oracle", "Reviewer")
AGES = (None, 0, 14, 15, 29, 30, 59, 60, 61, 119, 120, 5000)
FLAGS = (None, ["paused"], ["needs-you"], ["paused", "needs-you"])
JS = """
import fs from 'node:fs';
import { cardTags, nudgeTag, rulesOf, holdOf, summary } from %r;
const input = JSON.parse(fs.readFileSync(process.env.PP_PARITY, 'utf8'));
const out = input.projects.map((p) => {
  const rules = rulesOf(p.index), hold = holdOf(p.index);
  const tags = {};
  Object.entries(p.cards).forEach(([id, c]) => {
    const t = cardTags(c, rules, input.now, hold);
    const open = Object.values(p.nudges).filter((n) => n.card === id && n.status === 'open');
    const nt = nudgeTag(open, rules, input.now);
    if (nt) t.push(nt);
    tags[id] = t.map((x) => [x.k, x.t, x.sev]);
  });
  return { key: p.key, sum: summary(p.cards, p.index, input.now, p.nudges), tags };
});
console.log(JSON.stringify(out));
"""


def grid(prefix=""):
    cards, n = {}, 0
    for state in STATES:
        for actor in ACTORS:
            for age in AGES:
                n += 1
                cards[f"{prefix}{n}"] = mk(state, age, actor, FLAGS[n % 4], order=n)
    return cards


@unittest.skipUnless(shutil.which("node"), "node is not installed")
class ParityWithTriggersJs(unittest.TestCase):
    def test_same_counts_and_tags_as_triggers_js(self):
        base = grid()
        small = {k: v for k, v in list(base.items())[::7]}
        specs = [
            {"key": "default", "cards": base, "nudges": {f"N{i}": nudge(k, a, s) for i, (k, a, s) in enumerate([("1", 5, "open"), ("2", 15, "open"), ("2", 70, "open"), ("9", 99, "done"), ("12", 30, "withdrawn")], 1)}},
            {"key": "oracle", "cards": small, "rules": {"coordinator": "Oracle", "owesAfterMin": 5, "quietAfterMin": 10, "waitingAfterMin": 20, "staleAfterMin": 30, "nudgeAfterMin": 25},
             "nudges": {"N1": nudge("8", 24), "N2": nudge("8", 26), "N3": nudge("22", 100)}, "tab": 45},
            {"key": "hold", "cards": small, "hold": True, "tab": 5000, "nudges": {"N1": nudge("8", 30)}},
            {"key": "stale", "cards": {}, "tab": 121},
        ]
        d = folder(*specs)
        data = {"now": int(NOW.timestamp() * 1000), "projects": [{"key": s["key"], "index": H.load(d / s["key"] / "index.json"), "cards": s["cards"],
                                                                    "nudges": s.get("nudges", {})} for s in specs]}
        f = H.tmpdir() / "parity.json"
        f.write_text(json.dumps(data), encoding="utf-8")
        r = subprocess.run(["node", "--input-type=module", "-e", JS % (H.ROOT / "triggers.js").as_uri()], capture_output=True, text=True, encoding="utf-8",
                           env=dict(os.environ, PP_PARITY=str(f)), timeout=120)
        self.assertEqual(r.returncode, 0, r.stderr)
        js = {x["key"]: x for x in json.loads(r.stdout)}
        for p in T.evaluate(d, NOW):
            with self.subTest(project=p["project"]):
                s = js[p["project"]]["sum"]
                self.assertEqual({k: p[k] for k in ("needsYou", "owes", "quiet", "waiting", "nudges", "stale")}, {k: s[k] for k in ("needsYou", "owes", "quiet", "waiting", "nudges", "stale")})
                if p["stale"]:
                    self.assertEqual(p["staleFor"], s["staleFor"])
                for cid in js[p["project"]]["tags"]:
                    mine = [[i["tag"], i["text"], i["sev"]] for i in p["items"] if i["card"] == cid]
                    self.assertEqual(mine, js[p["project"]]["tags"][cid], f"card {cid}")
        self.assertGreater(sum(r["needsYou"] + r["owes"] + r["quiet"] + r["waiting"] for r in T.evaluate(d, NOW)), 50, "the parity data should exercise every rule")


if __name__ == "__main__":
    unittest.main()
