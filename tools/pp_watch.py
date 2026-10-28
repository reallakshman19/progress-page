"""Bounded, read-only native evidence delta scan. Does not record Page events or dispatch agents.

python tools/pp_cli.py watch --project KEY [--baseline prior-scan.json] [--limit 25]
Redirect JSON to an ephemeral coordinator artifact if comparison is desired.
Only exact public native GitHub URLs already present on active Page cards are read.
"""
import json
from pathlib import Path
from pp_reconcile import source_target, observe, github_json

def fingerprint(observed):
    """Only stable native identity/status; no untrusted issue body or presentation timestamp."""
    kind=observed["kind"]
    if kind in ("pull","commit"):
        return {"kind":kind,"head":observed["observedHead"],
                **({"merged":observed["merged"],"state":observed["state"]}
                   if kind=="pull" else {})}
    if kind in ("issue","issue-comment"):
        return {"kind":kind,"updatedAt":observed.get("updatedAt"),
                **({"state":observed.get("state")} if kind=="issue" else
                   {"commentId":observed.get("commentId")})}
    raise ValueError("unsupported native observation")

def collect(data,project,limit=25,baseline=None,fetch=github_json):
    if not isinstance(project,str) or not project or "/" in project or "\\" in project or project in (".",".."):
        raise ValueError("invalid project key")
    if not isinstance(limit,int) or not 1<=limit<=100:raise ValueError("limit must be 1..100")
    root=Path(data)/project
    index=json.loads((root/"index.json").read_text(encoding="utf-8"))
    cards=json.loads((root/"cards.json").read_text(encoding="utf-8"))
    if index.get("project",{}).get("key")!=project: raise ValueError("Page project identity mismatch")
    if baseline is not None and (not isinstance(baseline,dict) or baseline.get("project")!=project
                                  or baseline.get("schema")!="progress-page-source-watch/v1"):
        raise ValueError("baseline identity or schema mismatch")
    previous={r["source"]:r["fingerprint"] for r in baseline.get("results",[])
              if isinstance(r,dict) and r.get("fingerprint") and isinstance(r.get("source"),str)} if baseline else {}
    seen={}
    for card_id,card in sorted(cards.items()):
        if card.get("closed"):continue
        candidates=[card.get("src")] + [r.get("u") for r in card.get("refs",[]) if isinstance(r,dict)]
        for url in candidates:
            if not isinstance(url,str) or url in seen:continue
            try:source_target(url)
            except ValueError:continue
            seen[url]=card_id
    selected=list(sorted(seen))[:limit]
    # A removed public link is also a material projection change, even if all
    # remaining sources are unchanged. Never infer a deletion from a truncated
    # scan: that scan is already UNKNOWN.
    removed=sorted(set(previous)-set(seen)) if baseline is not None and len(seen)<=limit else []
    results=[]
    for source in selected:
        item={"source":source,"card":seen[source],"status":"UNKNOWN","fingerprint":None}
        try:
            fp=fingerprint(observe(source,fetch))
            item["fingerprint"]=fp
            item["status"]=("BASELINE_REQUIRED" if baseline is None else
                "NEW_SOURCE" if source not in previous else
                "NO_CHANGE" if previous[source]==fp else "SOURCE_CHANGED")
        except (ValueError,OSError,KeyError,TypeError) as ex:
            item["reason"]="NATIVE_SOURCE_UNAVAILABLE_OR_INVALID"
            item["error"]=str(ex)[:260]
        results.append(item)
    counts={s:sum(item["status"]==s for item in results) for s in
        ("SOURCE_CHANGED","NEW_SOURCE","NO_CHANGE","BASELINE_REQUIRED","UNKNOWN")}
    counts["REMOVED_SOURCE"]=len(removed)
    return {"schema":"progress-page-source-watch/v1","project":project,"examined":len(selected),
      "availableSources":len(seen),"omitted":max(0,len(seen)-len(selected)),
      "baselineCompared":baseline is not None,"counts":counts,"results":results,
      "removedSources":removed,
      "meaningfulSourceDelta":bool(counts["SOURCE_CHANGED"] or counts["NEW_SOURCE"] or removed),
      "complete":counts["UNKNOWN"]==0 and len(seen)==len(selected),
      "nativeClaimsQualified":False,"dataWritten":False,"assignmentDispatched":False,
      "next":"Coordinator checks actual source, candidate and WBS; prepare an authorized reviewed proposal only for real changes. No Page write on NO_CHANGE."}

def run(data,project,limit=25,baseline_path=None):
    try:
        baseline=json.loads(Path(baseline_path).read_text(encoding="utf-8")) if baseline_path else None
        result=collect(data,project,limit,baseline)
    except (ValueError,OSError,KeyError,TypeError,json.JSONDecodeError) as ex:
        print(json.dumps({"project":project,"status":"UNKNOWN","dataWritten":False,"error":str(ex)}))
        return 2
    print(json.dumps(result,indent=2))
    return 2 if not result["complete"] else 1 if result["meaningfulSourceDelta"] else 0
