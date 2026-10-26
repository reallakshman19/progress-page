"""Deterministic native-source -> reviewable Page manifest; no source-claim interpretation.

Usage:
  python tools/pp_cli.py propose --project ciifr --source https://github.com/O/R/pull/185 --actor Oracle --card geo-g1
  python tools/pp_cli.py propose ... --output proposal.json
  python tools/pp_batch.py proposal.json --data data                  # reviewed dry run
  python tools/pp_batch.py proposal.json --data data --apply --base origin/main

This prepares exactly one non-verdict source reference on an existing card.
It never changes card state, next actor/action, capability, or Owner approval.
No new status is inferred from GitHub text. No implicit card creation.
"""
import argparse
import json
import re
from pathlib import Path
from pp_reconcile import github_json, reconcile, source_target

def _iso(value):
    return isinstance(value,str) and bool(re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ",value))
def _sanitize(value,limit=100):
    return " ".join(str(value or "").replace("|"," ").split())[:limit]

def propose(data,project,source,actor,card_id=None,expected_head=None,fetch=github_json):
    """Observe once, match by exact native URL only, construct a reviewed pp_batch manifest."""
    if not isinstance(actor,str) or not actor.strip() or len(actor)>60:
        raise ValueError("actor is required (<=60 characters)")
    root=Path(data)/project
    result=reconcile(data,project,source,expected_head,card_id,fetch=fetch)
    cards=json.loads((root/"cards.json").read_text(encoding="utf-8"))
    current=result["observation"]
    heads=[x for x in result["alerts"] if x["code"]=="CANDIDATE_DRIFT"]
    issues=[]
    if heads:issues.append("HEAD_DRIFT: expected exact candidate differs; verify and re-run before proposing")
    if result["recordedEventIds"]:issues.append("ALREADY_RECORDED: event already cites this exact source; no duplicate proposal")
    if current["kind"] in ("pull","commit"):
        head=current.get("observedHead")
        if not isinstance(head,str) or not re.fullmatch(r"[a-fA-F0-9]{40}",head):
            issues.append("MISSING_IDENTITY: PR/commit lacks an exact 40-hex SHA")
        fingerprint={"kind":current["kind"],"observedHead":head}
    else:
        updated=current.get("updatedAt")
        if not _iso(updated):issues.append("MISSING_IDENTITY: issue/comment has no auditable updatedAt")
        fingerprint={"kind":current["kind"],"updatedAt":updated}
        if current["kind"]=="issue-comment":
            fingerprint["commentId"]=current.get("commentId")
    # Native source matches are byte-exact. Broad #123 searches would invent attribution.
    matching=sorted(cid for cid,c in cards.items() if not c.get("closed") and (
        c.get("src")==source or any(r.get("u")==source for r in c.get("refs",[]))))
    if card_id:
        selected=card_id
        if cards[card_id].get("closed"): issues.append("CLOSED_CARD: cannot alter a closed historical card")
    elif len(matching)==1:
        selected=matching[0]
    else:
        selected=None
        issues.append("CARD_SELECTION_REQUIRED: select an existing native-evidence owner with --card; no task inferred")
    if current["kind"]=="commit": issues.append("COMMIT_CARD_REF_UNSUPPORTED: a commit is not an issue/comment/PR reference kind; use an appropriate native PR or issue")
    if selected and any(r.get("u")==source for r in cards[selected].get("refs",[])):
        issues.append("REF_ALREADY_PRESENT: this card already contains the evidence URL")
    source_kind="pr" if current["kind"]=="pull" else "comment" if current["kind"]=="issue-comment" else "issue" if current["kind"]=="issue" else "commit"
    record_tag=(("head "+fingerprint["observedHead"][:12]) if fingerprint.get("observedHead") else
                ("edited "+fingerprint.get("updatedAt","unknown")))
    ref_label=_sanitize(current.get("title") or (source_kind+" native source"),60)
    summary="Source observed: "+_sanitize(ref_label,80)+"; no claim status, actor or approval changed"
    # Deliberately do not ingest untrusted issue/PR body as a Page verdict.
    manifest=None
    if not issues:
        manifest={"project":project,"actor":actor.strip(),"source":source,
            "proposalVersion":1,"sourceObservation":fingerprint,
            "changes":[{"command":"card set","args":{"card":selected,"summary":summary,
                "ref":source_kind+"|"+ref_label+"|"+source+"|observed "+record_tag+"; not verified"}}]}
    return {"project":project,"source":source,"observed":current,
        "matchingCards":matching,"selectedCard":selected,
        "selectedCardExistingState":cards[selected].get("state") if selected else None,
        "expectedHead":expected_head,"alerts":result["alerts"],"blockers":issues,
        "reviewRequired":True,"automaticStatusPromotion":False,"dataWritten":False,
        "proposal":manifest,
        "reviewChecklist":["Check native record, exact head/updatedAt and scope before recording.",
            "Confirm card association, not just matching title or an agent label.",
            "Inspect --data dry-run diff. Keep current state, next actor/action and capability unchanged.",
            "Only authorized coordinator may apply audited batch and publish through a reviewed PR."]}

def run(data,project,source,actor,card,expected_head,output=None):
    try:
        result=propose(data,project,source,actor,card,expected_head)
        if output and result["proposal"]:
            path=Path(output)
            if path.exists():raise ValueError("output already exists; refuse overwrite")
            if not path.parent.is_dir():raise ValueError("output parent directory missing")
            path.write_text(json.dumps(result["proposal"],indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
            result["savedManifest"]=str(path)
        elif output:result["savedManifest"]=None
        print(json.dumps(result,indent=2,ensure_ascii=False))
        return 0 if result["proposal"] else 1
    except (ValueError,OSError,KeyError,json.JSONDecodeError) as e:
        print(json.dumps({"dataWritten":False,"proposal":None,"error":str(e)},indent=2))
        return 2
