#!/usr/bin/env python3
"""Edit a Progress page data folder safely (standard library only).

Every command that writes needs --actor (who), --src (a public GitHub link, or OWNER_PRIVATE_REF:<id>) and a
reason (--summary or --why). It records one Timeline entry, runs the checker and, if the check fails, leaves
every file as it was. Nothing is ever deleted: use supersede, cancel or archive.

Run from the repository root:  python tools/pp_cli.py [--data data] <command> ...   (plain python, not python -I)

  project add|archive|restore|supersede|cancel|transfer     a whole project (a tab)
  revision add                                              a new plan revision (only when an Owner decision changes direction)
  plan milestone|group|chat                                 the project's milestones, groups and chat ids
  card set|supersede|cancel|transfer                        agent blocks
  action add|answer                                         decisions for the Owner ('My actions')
  fixture add|remove                                        grounding fixtures
  nudge add|done|withdraw                                   instructions queued for the coordinator ('Nudge +')
  reconcile --project KEY --source GITHUB_URL [--expected-head SHA] [--card ID]  source facts and drift triggers (read-only)
  propose --project KEY --source GITHUB_URL --actor NAME [--card ID] [--expected-head SHA] [--output proposal.json]  reviewable source reference proposal (no data write)
  watch --project KEY [--baseline prior.json] [--limit 25]   read-only native source delta scan (no Page/event writes)
  cycle-preflight --project PAGE_KEY --cycle COMMON_CYCLE_ID --wbs N   read-only source-verified Cycle/WBS binding readiness
  inputs --actor WHO                                        the Owner's replies and nudges that arrived as GitHub issues, with the command that records each
  check [--private] [--base REF]    triggers [--json]    local OUT [--links F] [--prerender BROWSER]    links FILE
  bootstrap DIR --repo OWNER/NAME --page URL                copy the page and these tools into a new repository
"""
import argparse
import sys

import pp_cards as C
import pp_lib as L
import pp_ops as O


def W(p, why="--why", why_help="why (one sentence)"):
    p.add_argument("--actor", required=True, help="who is doing this, for example 'Oracle O2'")
    p.add_argument("--src", required=True, help="public GitHub link of the event or decision, or OWNER_PRIVATE_REF:<id>")
    if why:
        p.add_argument(why, required=True, dest="why", help=why_help)
    return p


def build():
    ap = argparse.ArgumentParser(prog="pp_cli.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default="data", help="data folder (default: data)")
    top = ap.add_subparsers(dest="cmd", required=True)

    def kind(name):
        return top.add_parser(name).add_subparsers(dest="sub", required=True)

    pj = kind("project")
    p = W(pj.add_parser("add"), "--why", "why this project starts (the Owner decision that creates it)")
    p.add_argument("--key", required=True)
    p.add_argument("--title", required=True)
    p.add_argument("--label")
    p.add_argument("--subtitle")
    p.add_argument("--aim", required=True, help="the Owner's aim for the project (at most 400 characters; --src is its source)")
    p.add_argument("--mode", choices=("otm", "standalone"), default="standalone")
    p.add_argument("--coordinator", default="Oracle", help="who 'owes' replies on this project (OTM, or the Oracle's name)")
    p.add_argument("--owner-words", required=True, help="the Owner's words that start it (a short quote)")
    p.add_argument("--reply-repo", help="OWNER/REPO whose issue form receives the Owner's replies")
    p.add_argument("--reply-template", default="owner-reply.yml")
    p.add_argument("--reply-target", default="Oracle")
    p.add_argument("--reply-site", help="published page URL, used in reply links")
    p = W(pj.add_parser("aim"))
    p.add_argument("--key", required=True)
    p.add_argument("--text", required=True, help="the aim, at most 400 characters")
    for name in ("archive", "restore", "cancel", "supersede"):
        p = W(pj.add_parser(name))
        p.add_argument("--key", required=True)
        if name == "supersede":
            p.add_argument("--by", required=True, help="key of the project that replaces it")
    p = W(pj.add_parser("transfer"))
    p.add_argument("--key", required=True)
    p.add_argument("--to-coordinator", required=True)
    p.add_argument("--to-mode", choices=("otm", "standalone"))
    p.add_argument("--reply-target")

    p = W(kind("revision").add_parser("add"), "--why", "what changed in direction")
    p.add_argument("--project", required=True)
    p.add_argument("--owner-words", required=True, help="the Owner's words that changed direction (a short quote)")

    pl = kind("plan")
    for what in ("milestone", "group", "chat"):
        p = W(pl.add_parser(what), "--summary", "what you changed")
        p.add_argument("--project", required=True)
        p.add_argument("--id", required=True)
        for f in ("--name", "--full", "--title", "--about", "--label", "--id8", "--engine"):
            p.add_argument(f)
        p.add_argument("--order", type=int)
        if what == "milestone":
            p.add_argument("--wbs", help="WBS number, for example 1.1")
            p.add_argument("--bench", help="the benchmark this step adds, for example B1")
            p.add_argument("--keeps", help="earlier benchmarks it must still pass, for example B1")
            p.add_argument("--cap", choices=L.CAPABILITY, help="what the user can do: the evidence step")
            p.add_argument("--can-do", help="one line on what the user can actually do today")
            p.add_argument("--cap-src", help="public GitHub link of the capability evidence")
            p.add_argument("--repo", help="repo state bar: the step's repository, owner/name")
            p.add_argument("--branch", help="repo state bar: the step's branch")
            p.add_argument("--commit", help="repo state bar: the step's current commit (7 to 40 hex)")
            p.add_argument("--activity", help="repo state bar: one line on the step's activity now")

    cd = kind("card")
    p = W(cd.add_parser("set"), "--summary", "what changed on this card")
    p.add_argument("--project", required=True)
    p.add_argument("--card", required=True)
    for f in ("--label", "--group", "--milestone", "--now", "--next-actor", "--next-text", "--chat", "--role", "--at"):
        p.add_argument(f)
    p.add_argument("--state", choices=("NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "VERIFIED", "BLOCKED", "STALE", "UNKNOWN", "NOT_APPLICABLE"))
    p.add_argument("--flag", action="append", dest="flags", help="paused or needs-you (repeat); --no-flags clears")
    p.add_argument("--no-flags", action="store_true")
    p.add_argument("--ref", action="append", help="kind|label|https-url[|status]; kind is issue, comment or pr")
    p.add_argument("--edge", action="append", help="otherCardId:to|back|both")
    p.add_argument("--order", type=int)
    for name in ("supersede", "cancel"):
        p = W(cd.add_parser(name))
        p.add_argument("--project", required=True)
        p.add_argument("--card", required=True)
        if name == "supersede":
            p.add_argument("--by", required=True, help="card that replaces it")
    p = W(cd.add_parser("transfer"))
    p.add_argument("--project", required=True)
    p.add_argument("--card", required=True)
    p.add_argument("--to-chat", required=True)
    p.add_argument("--role")

    ac = kind("action")
    p = W(ac.add_parser("add"), None)
    p.add_argument("--project", required=True)
    p.add_argument("--key", required=True)
    p.add_argument("--title", required=True)
    p.add_argument("--lead", required=True)
    p.add_argument("--option", action="append", required=True, help="KEY|label|body|reply (the reply is what the Owner sends)")
    p.add_argument("--suggested", required=True, help="KEY of the suggested option")
    p.add_argument("--link", action="append", help="label|https-url")
    p.add_argument("--milestone", help="the WBS step (milestone id) this decision belongs to; omit for the whole project")
    p = ac.add_parser("answer")
    p.add_argument("--project", required=True)
    p.add_argument("--key", required=True)
    p.add_argument("--text", required=True)
    p.add_argument("--ref", required=True, help="public record of the Owner's words")
    p.add_argument("--actor", required=True)
    p.add_argument("--at")

    fx = kind("fixture")
    for op in ("add", "remove"):
        p = W(fx.add_parser(op), "--summary", "why")
        p.add_argument("--project", required=True)
        p.add_argument("--list", required=True)
        p.add_argument("--text", required=True)
        for f in ("--url", "--status", "--note"):
            p.add_argument(f)
        p.add_argument("--milestone", help="the WBS step (milestone id) this item belongs to; omit for the whole project")

    nd = kind("nudge")
    p = W(nd.add_parser("add"), None)
    p.add_argument("--project", required=True)
    p.add_argument("--card", required=True)
    p.add_argument("--text", required=True, help="one instruction line for the coordinator")
    p.add_argument("--by", default="Owner", help="who asked (default Owner)")
    p.add_argument("--at")
    for op in ("done", "withdraw"):
        p = W(nd.add_parser(op), None)
        p.add_argument("--project", required=True)
        p.add_argument("--id", required=True, help="nudge id, for example N1")
        p.add_argument("--by", required=True, help="who incorporated it (done) or took it back (withdraw)")

    p = top.add_parser("reconcile")
    p.add_argument("--project", required=True)
    p.add_argument("--source", required=True)
    p.add_argument("--expected-head")
    p.add_argument("--card")
    p.add_argument("--json", action="store_true")
    p = top.add_parser("watch")
    p.add_argument("--project", required=True)
    p.add_argument("--baseline", help="prior scan JSON for material-delta comparison; not Page project data")
    p.add_argument("--limit", type=int, default=25, help="max distinct recorded native source URLs to examine (1..100)")
    p = top.add_parser("cycle-preflight")
    p.add_argument("--project", required=True, help="existing Page project key")
    p.add_argument("--cycle", required=True, help="canonical Common oracle-cycles project slug")
    p.add_argument("--wbs", required=True, help="exact Page WBS family number (e.g. 3)")
    p = top.add_parser("propose")
    p.add_argument("--project", required=True)
    p.add_argument("--source", required=True)
    p.add_argument("--actor", required=True)
    p.add_argument("--card", help="existing card ID; required if source is unmatched or ambiguous")
    p.add_argument("--expected-head", help="expected PR candidate head SHA, if pinned")
    p.add_argument("--output", help="write reviewed pp_batch manifest to NEW file; never touches Page data")
    p = top.add_parser("inputs")
    p.add_argument("--actor", required=True, help="who will record the inputs (printed into the commands)")
    p.add_argument("--since", help="ignore issues created before this UTC time (default: when the Timeline began)")
    p.add_argument("--json", action="store_true")
    p = top.add_parser("check")
    p.add_argument("--private", action="store_true")
    p.add_argument("--base")
    p = top.add_parser("triggers")
    p.add_argument("--json", action="store_true")
    p.add_argument("--now")
    p = top.add_parser("local")
    p.add_argument("out")
    p.add_argument("--links")
    p.add_argument("--prerender")
    p = top.add_parser("links")
    p.add_argument("file")
    p.add_argument("--page")
    p = top.add_parser("bootstrap")
    p.add_argument("dest")
    p.add_argument("--repo", required=True)
    p.add_argument("--page", required=True)
    return ap


def run(a):
    d, c, s = a.data, a.cmd, getattr(a, "sub", None)
    if c == "project" and s == "add":
        reply = {"kind": "github-issue", "repo": a.reply_repo, "template": a.reply_template, "target": a.reply_target, "site": a.reply_site or ""} if a.reply_repo else None
        return O.add_project(d, a.key, a.title, a.label, a.mode, a.coordinator, a.subtitle, a.actor, a.src, a.owner_words, a.why, reply, a.aim)
    if c == "project" and s == "aim":
        return O.set_aim(d, a.key, a.text, a.actor, a.why, a.src)
    if c == "project" and s == "transfer":
        return O.transfer(d, a.key, a.to_coordinator, a.to_mode, a.reply_target, a.why, a.actor, a.src)
    if c == "project":
        return O.lifecycle(d, a.key, s.upper(), a.why, a.actor, a.src, getattr(a, "by", None))
    if c == "revision":
        return O.revision_add(d, a.project, a.why, a.owner_words, a.src, a.actor)
    if c == "plan":
        g = lambda f: getattr(a, f, None)  # the WBS options exist on 'plan milestone' only
        fields = {"milestone": {"name": a.name, "full": a.full, "order": a.order, "wbs": g("wbs"), "bench": g("bench"), "keeps": g("keeps"),
                                "cap": g("cap"), "canDo": g("can_do"), "capSrc": g("cap_src"),
                                "repo": g("repo"), "branch": g("branch"), "commit": g("commit"), "activity": g("activity")}, "group": {"title": a.title, "sub": a.about, "order": a.order},
                  "chat": {"label": a.label, "id8": a.id8, "engine": a.engine}}[s]
        return O.plan(d, a.project, s, a.id, fields, a.actor, a.why, a.src)
    if c == "card" and s == "set":
        flags = [] if a.no_flags else a.flags
        return C.card_set(d, a.project, a.card, a.actor, a.src, a.why, a.at, a.label, a.group, a.milestone, a.state, a.now, a.next_actor,
                          a.next_text, a.chat, a.role, flags, a.ref, a.edge, a.order)
    if c == "card" and s in ("supersede", "cancel"):
        return C.card_close(d, a.project, a.card, s.upper(), a.why, a.actor, a.src, getattr(a, "by", None))
    if c == "card":
        return C.card_transfer(d, a.project, a.card, a.to_chat, a.role, a.why, a.actor, a.src)
    if c == "action" and s == "add":
        return C.action_add(d, a.project, a.key, a.title, a.lead, a.option, a.suggested, a.actor, a.src, a.link, a.milestone)
    if c == "action":
        return C.action_answer(d, a.project, a.key, a.text, a.ref, a.actor, a.at)
    if c == "fixture":
        return C.fixture_edit(d, a.project, a.list, s, a.text, a.actor, a.src, a.why, a.url, a.status, a.note, a.milestone)
    if c == "nudge" and s == "add":
        return C.nudge_add(d, a.project, a.card, a.text, a.by, a.actor, a.src, a.at)
    if c == "nudge":
        return C.nudge_close(d, a.project, a.id, s, a.by, a.actor, a.src)
    if c == "reconcile":
        import pp_reconcile
        return sys.exit(pp_reconcile.run(d, a.project, a.source, a.expected_head, a.card, a.json))
    if c == "watch":
        import pp_watch
        return sys.exit(pp_watch.run(d, a.project, a.limit, a.baseline))
    if c == "cycle-preflight":
        import pp_cycle_preflight
        return sys.exit(pp_cycle_preflight.run(d, a.project, a.cycle, a.wbs))
    if c == "propose":
        import pp_propose
        return sys.exit(pp_propose.run(d, a.project, a.source, a.actor, a.card, a.expected_head, a.output))
    if c == "inputs":
        import pp_inputs
        return pp_inputs.list_inputs(d, a.actor, a.since, a.json)
    if c == "check":
        import pp_check
        return sys.exit(pp_check.main_for(d, a.private, a.base))
    if c == "triggers":
        import page_triggers
        return page_triggers.run(d, a.now, a.json)
    if c == "local":
        import build_local
        return build_local.build(a.out, a.links, a.prerender, data=d)
    if c == "links":
        import pp_links
        return pp_links.setup_url(a.file, a.page)
    import pp_boot
    return pp_boot.bootstrap(a.dest, a.repo, a.page)


def main():
    out = run(build().parse_args())
    if out:
        print(out)


if __name__ == "__main__":
    main()
