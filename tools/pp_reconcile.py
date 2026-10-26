"""Read-only native GitHub evidence reconciliation; never assigns or upgrades a verdict.
python tools/pp_cli.py reconcile --project ciifr --source https://github.com/OWNER/REPO/pull/185 --card ID --json
If a PR candidate SHA is already bound by the handoff, pass --expected-head SHA.
Requires network to GitHub; a missing source returns UNKNOWN, never PASS.
"""
import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

SOURCE_RE = re.compile(r"^/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)/(pull|issues|commit)/([a-fA-F0-9]{7,40}|[0-9]+)$")
SHA_RE = re.compile(r"^[a-fA-F0-9]{7,40}$")

def source_target(source):
    url = urlparse(source)
    if url.scheme != "https" or url.netloc != "github.com" or url.username or url.password or url.query:
        raise ValueError("only explicit, public https://github.com native record URLs are accepted")
    m = SOURCE_RE.fullmatch(url.path.rstrip("/"))
    if not m:
        raise ValueError("source must be a specific GitHub pull, issue or commit")
    owner, repo, kind, ident = m.groups()
    if kind != "issues" and url.fragment:
        raise ValueError("fragments are only allowed for issue comments")
    comment = None
    if url.fragment:
        c = re.fullmatch(r"issuecomment-([0-9]+)", url.fragment)
        if not c: raise ValueError("unsupported issue comment fragment")
        comment = c.group(1)
    if kind == "commit" and not SHA_RE.fullmatch(ident):
        raise ValueError("invalid commit SHA")
    if kind in ("pull", "issues") and not ident.isdecimal():
        raise ValueError("invalid issue or pull number")
    return owner, repo, kind, ident, comment

def github_json(url):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "progress-page-read-only-reconcile", "X-GitHub-Api-Version": "2022-11-28"}
    if os.getenv("GITHUB_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
    with urlopen(Request(url, headers=headers), timeout=12) as r:
        return json.load(r)

def observe(source, fetch=github_json):
    owner, repo, kind, ident, comment = source_target(source)
    root = "https://api.github.com/repos/" + owner + "/" + repo
    route = "/pulls/" + ident if kind == "pull" else ("/issues/" + ident if kind == "issues" else "/commits/" + ident)
    record = fetch(root + route)
    if not isinstance(record,dict): raise ValueError("unexpected GitHub record")
    if kind == "pull":
        sha = str((record.get("head") or {}).get("sha") or "")
        if not re.fullmatch(r"[a-fA-F0-9]{40}",sha): raise ValueError("PR head identity missing")
        return {"kind": "pull", "title":str(record.get("title") or "")[:200],
                "observedHead":sha, "state":str(record.get("state") or "unknown"),
                "merged":bool(record.get("merged")), "updatedAt":record.get("updated_at")}
    if kind == "commit":
        sha = str(record.get("sha") or "")
        if not re.fullmatch(r"[a-fA-F0-9]{40}",sha): raise ValueError("commit identity missing")
        return {"kind":"commit","observedHead":sha,"title":str((record.get("commit") or {}).get("message") or "")[:200]}
    if comment:
        evidence = fetch(root+"/issues/comments/"+comment)
        if str(evidence.get("html_url") or "") != source:
            raise ValueError("issue comment URL differs from requested source")
        return {"kind":"issue-comment","title":str(record.get("title") or "")[:200],
                "updatedAt":evidence.get("updated_at"),"commentId":comment}
    return {"kind":"issue","title":str(record.get("title") or "")[:200],
            "state":str(record.get("state") or "unknown"),"updatedAt":record.get("updated_at")}

def reconcile(data, project, source, expected_head=None, card_id=None, fetch=github_json):
    # Validate the URL before network access; do not let arbitrary URLs drive fetch.
    source_target(source)
    root=Path(data)/project
    index=json.loads((root/"index.json").read_text(encoding="utf-8"))
    cards=json.loads((root/"cards.json").read_text(encoding="utf-8"))
    audit=json.loads((root/"audit.json").read_text(encoding="utf-8"))
    if (index.get("project") or {}).get("key") != project: raise ValueError("project mismatch")
    if card_id and card_id not in cards: raise ValueError("unrecognized card")
    if expected_head and not SHA_RE.fullmatch(expected_head): raise ValueError("invalid expected head")
    observation=observe(source,fetch)
    head=observation.get("observedHead")
    if expected_head and not head: raise ValueError("expected SHA requires a commit or PR source")
    hits=[e.get("id") for e in audit.get("events",[]) if e.get("source")==source]
    alerts=[]
    if expected_head and not head.lower().startswith(expected_head.lower()):
        alerts.append({"code":"CANDIDATE_DRIFT","severity":"requires-revalidation","next":"Verify exact current PR head and re-run applicable checks; historical PASS remains bound to old candidate."})
    if not expected_head and observation["kind"]=="pull":
        alerts.append({"code":"CANDIDATE_IDENTITY_UNBOUND","severity":"information","next":"Record and verify expected exact candidate head before a consequential verdict."})
    if not hits:
        alerts.append({"code":"SOURCE_NOT_RECORDED","severity":"reconcile","next":"Read original claim and map it to native WBS/cards with audited CLI; do not auto-promote status."})
    if hits and not alerts: alerts.append({"code":"ALREADY_RECORDED","severity":"information","next":"Do not duplicate a previously recorded source without a distinct new observation."})
    return {"project":project,"source":source,"observation":observation,
        "card":card_id, "existingCardState":cards.get(card_id,{}).get("state") if card_id else None,
        "recordedEventIds":hits,"expectedHead":expected_head,"alerts":alerts,
        "automatedStatusPromotion":False,"written":False}

def run(data, project, source, expected_head, card_id, json_output=True):
    try:
        result=reconcile(data,project,source,expected_head,card_id)
    except Exception as e:
        result={"project":project,"source":source,"written":False,"automatedStatusPromotion":False,
            "alerts":[{"code":"SOURCE_UNAVAILABLE_OR_INVALID","severity":"unknown","next":"Do not publish or infer PASS. Inspect GitHub and the error.", "error":str(e)}]}
        print(json.dumps(result,indent=2))
        return 2
    print(json.dumps(result,indent=2))
    return 1 if any(x["code"]=="CANDIDATE_DRIFT" for x in result["alerts"]) else 0
