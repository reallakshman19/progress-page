"""Read-only scheduled adapter for pp_watch. Never publishes Page or Cycle state."""
import argparse
import json
import os
from pathlib import Path
from pp_watch import collect

COVERAGE_GAP_REVIEW = "COVERAGE_GAP_REVIEW"

def scoped_cycle_coverage(data,project,cycle,wbs,probe=None):
    """Observe a named Cycle scope without activating its Page binding.

    The reference workflow selects the scope explicitly. A native source missing
    from Page JSON can therefore be reported without editing the Page or asking
    an agent for another receipt.
    """
    from pp_cycle_preflight import preflight, key, WBS_RE
    key(cycle,"cycle"); key(project,"project")
    if not isinstance(wbs,str) or not WBS_RE.fullmatch(wbs):
        raise ValueError("invalid explicit Cycle WBS scope")
    result=(probe or preflight)(data,project,cycle,wbs)
    if (not isinstance(result,dict) or
        result.get("pageProject")!=project or result.get("cycleProject")!=cycle or
        result.get("wbs")!="wbs:"+wbs or
        result.get("result") not in ("READY_FOR_REVIEW","INSUFFICIENT_EVIDENCE","SCOPE_MISMATCH")):
        raise ValueError("Cycle preflight identity or result could not be verified")
    source=result.get("source") or {}
    states=result.get("nativeObservation") or {}
    if (not isinstance(source.get("cycleBlobSha"),str) or
        set(states)!={"WBS","TASK","CANDIDATE"} or
        any(v!="OK" for v in states.values())):
        raise ValueError("canonical Cycle or native WBS/task/PR source was unavailable")
    gaps=sorted(set(result.get("gaps") or []))
    conflicts=sorted(set(result.get("conflicts") or []))
    fingerprint={"cycleBlobSha":source["cycleBlobSha"],
                 "result":result["result"],"gaps":gaps,"conflicts":conflicts,
                 "candidate":result.get("candidate"),
                 "nativeState":result.get("nativeState") or {}}
    return {"cycleProject":cycle,"wbs":"wbs:"+wbs,"status":result["result"],
            "gaps":gaps,"conflicts":conflicts,"verified":result.get("verified") or [],
            "source":source.get("cycleUrl"),"fingerprint":fingerprint,
            "bindingActivated":False,"pageDataWritten":False,
            "cycleModified":False,"nativeAcceptanceInferred":False}

def reconciliation_health(coverage):
    """Outstanding source discrepancies persist independently of a NO_CHANGE fingerprint.

    READY_FOR_REVIEW is only a checked source boundary, never acceptance,
    binding activation or permission to dispatch an agent.
    """
    if coverage is None:
        return "UNSCOPED"
    if coverage.get("status")=="UNKNOWN":
        return "UNKNOWN"
    if (coverage.get("status")!="READY_FOR_REVIEW" or
        coverage.get("gaps") or coverage.get("conflicts")):
        return "NEEDS_RECONCILIATION"
    return "READY_FOR_REVIEW"

def classify(result,has_baseline):
    if not result.get("complete"):
        return "UNKNOWN"
    if not has_baseline:
        return "BASELINE_ESTABLISHED"
    if result.get("meaningfulSourceDelta"):
        return "SOURCE_CHANGE_REVIEW"
    return "NO_CHANGE"

def check(data,project,baseline_path,report_path,cache_path,limit=100,fetch=None,
          cycle=None,wbs=None,cycle_probe=None):
    if (cycle is None)!=(wbs is None):
        raise ValueError("Cycle monitoring requires both explicit --cycle and --wbs")
    prior=Path(baseline_path)
    old=json.loads(prior.read_text(encoding="utf-8")) if prior.is_file() else None
    options={"limit":limit,"baseline":old}
    if fetch is not None:
        options["fetch"]=fetch
    observation=collect(data,project,**options)
    status=classify(observation,old is not None)
    coverage=None
    if cycle is not None:
        try:
            coverage=scoped_cycle_coverage(data,project,cycle,wbs,cycle_probe)
            previous=(old or {}).get("cycleCoverage") or {}
            prev_fp=previous.get("fingerprint")
            changed=prev_fp is not None and prev_fp!=coverage["fingerprint"]
            gaps=bool(coverage["gaps"] or coverage["conflicts"])
            if observation["complete"] and status not in ("UNKNOWN","SOURCE_CHANGE_REVIEW"):
                if changed:
                    status="SOURCE_CHANGE_REVIEW"
                elif prev_fp is None and gaps:
                    status=COVERAGE_GAP_REVIEW
                # An unchanged, known gap is quiet on every later scan.
        except (OSError,ValueError,KeyError,TypeError,UnicodeError) as exc:
            coverage={"cycleProject":cycle,"wbs":"wbs:"+str(wbs),
                      "status":"UNKNOWN","reason":"CANONICAL_OR_NATIVE_SOURCE_UNAVAILABLE",
                      "detail":str(exc)[:240]}
            status="UNKNOWN"
    health=reconciliation_health(coverage)
    result={**observation,"monitorStatus":status,"sourceOnly":True,
        "complete":observation["complete"] and health!="UNKNOWN",
        "reconciliationHealth":health,
        "reconciliationRequired":health=="NEEDS_RECONCILIATION",
        "pageDataWritten":False,"pagePublication":"NOT_RUN",
        "canonicalCycleChanged":False,"nativeAcceptanceInferred":False}
    if coverage is not None:
        result["cycleCoverage"]=coverage
    out=Path(report_path)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    if result["complete"]:
        latest=Path(cache_path)
        latest.parent.mkdir(parents=True,exist_ok=True)
        latest.write_text(json.dumps(result,sort_keys=True,ensure_ascii=False)+"\n",encoding="utf-8")
    return result

def run():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data",default="data")
    parser.add_argument("--project",required=True)
    parser.add_argument("--baseline",required=True)
    parser.add_argument("--report",required=True)
    parser.add_argument("--cache",required=True)
    parser.add_argument("--limit",type=int,default=100)
    parser.add_argument("--cycle",help="explicit canonical Cycle project (read-only)")
    parser.add_argument("--wbs",help="explicit WBS major from that Cycle, e.g. 3")
    args=parser.parse_args()
    try:
        result=check(args.data,args.project,args.baseline,args.report,args.cache,args.limit,
                     cycle=args.cycle,wbs=args.wbs)
        status=result["monitorStatus"]
    except (ValueError,OSError,TypeError,KeyError,json.JSONDecodeError) as exc:
        status="UNKNOWN"
        result={"monitorStatus":status,"project":args.project,
            "reason":"SOURCE_OR_BASELINE_UNAVAILABLE","detail":str(exc)[:240],
            "reconciliationHealth":"UNKNOWN","reconciliationRequired":False,
            "pageDataWritten":False,"canonicalCycleChanged":False,
            "nativeAcceptanceInferred":False}
        path=Path(args.report)
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    output=os.getenv("GITHUB_OUTPUT")
    if output:
        with open(output,"a",encoding="utf-8") as f:
            for label,value in {
                "status":status,"complete":str(status!="UNKNOWN").lower(),
                "needs_review":str(status in ("SOURCE_CHANGE_REVIEW",COVERAGE_GAP_REVIEW)).lower(),
                "health_unknown":str(status=="UNKNOWN").lower(),
                "open_gap":str(result.get("reconciliationRequired",False)).lower(),
            }.items():
                f.write(label+"="+value+"\n")
    # An unresolved gap stays visibly unresolved on every run, including when
    # its source fingerprint has not changed. Avoid duplicate review artifacts.
    if (status in ("SOURCE_CHANGE_REVIEW",COVERAGE_GAP_REVIEW,"UNKNOWN")
            or result.get("reconciliationRequired")):
        summary=os.getenv("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary,"a",encoding="utf-8") as f:
                f.write("### Native source monitor: "+status+"\n\n")
                f.write("Reconciliation health: **"+result.get("reconciliationHealth","UNKNOWN")+"**\n\n")
                f.write("Page-linked sources plus explicitly scoped canonical Cycle if requested. No verdict or Page write.\n\n")
                if "cycleCoverage" in result:
                    f.write("Cycle coverage: "+json.dumps({
                        k:v for k,v in result["cycleCoverage"].items()
                        if k in ("cycleProject","wbs","status","gaps","conflicts","source","reason")
                    })+"\n\n")
                if "counts" in result:
                    f.write("Source counts: "+json.dumps(result["counts"])+"\n\n")
                if result.get("reconciliationRequired") and status=="NO_CHANGE":
                    f.write("**Unresolved source gap persists.** No new source delta or duplicate artifact; existing Oracle/Page writer must reconcile the original records.\n")
                else:
                    f.write("Review the short-lived artifact and original native records; unavailable evidence is UNKNOWN.\n")
    print("Native source monitor:",args.project,status,
          "reconciliation="+str(result.get("reconciliationHealth","UNKNOWN")),
          json.dumps(result.get("counts") or {}))
    if status=="UNKNOWN":
        print("::warning::Native source retrieval incomplete; previous baseline preserved, Page untouched")
    return 0

if __name__=="__main__":
    raise SystemExit(run())
