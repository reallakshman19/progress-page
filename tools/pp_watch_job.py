"""Read-only scheduled adapter for pp_watch. Never publishes Page or Cycle state."""
import argparse
import json
import os
from pathlib import Path
from pp_watch import collect

def classify(result,has_baseline):
    if not result.get("complete"):
        return "UNKNOWN"
    if not has_baseline:
        return "BASELINE_ESTABLISHED"
    if result.get("meaningfulSourceDelta"):
        return "SOURCE_CHANGE_REVIEW"
    return "NO_CHANGE"

def check(data,project,baseline_path,report_path,cache_path,limit=100,fetch=None):
    prior=Path(baseline_path)
    old=json.loads(prior.read_text(encoding="utf-8")) if prior.is_file() else None
    options={"limit":limit,"baseline":old}
    if fetch is not None:
        options["fetch"]=fetch
    observation=collect(data,project,**options)
    status=classify(observation,old is not None)
    result={**observation,"monitorStatus":status,"sourceOnly":True,
        "pageDataWritten":False,"pagePublication":"NOT_RUN",
        "canonicalCycleChanged":False,"nativeAcceptanceInferred":False}
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
    args=parser.parse_args()
    try:
        result=check(args.data,args.project,args.baseline,args.report,args.cache,args.limit)
        status=result["monitorStatus"]
    except (ValueError,OSError,TypeError,KeyError,json.JSONDecodeError) as exc:
        status="UNKNOWN"
        result={"monitorStatus":status,"project":args.project,
            "reason":"SOURCE_OR_BASELINE_UNAVAILABLE","detail":str(exc)[:240],
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
                "needs_review":str(status=="SOURCE_CHANGE_REVIEW").lower(),
                "health_unknown":str(status=="UNKNOWN").lower(),
            }.items():
                f.write(label+"="+value+"\n")
    if status in ("SOURCE_CHANGE_REVIEW","UNKNOWN"):
        summary=os.getenv("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary,"a",encoding="utf-8") as f:
                f.write("### Native source monitor: "+status+"\n\n")
                f.write("Public CIIFR Page sources only. No status verdict or Page write.\n\n")
                if "counts" in result:
                    f.write("Source counts: "+json.dumps(result["counts"])+"\n\n")
                f.write("Review the short-lived artifact and original native records; unavailable evidence is UNKNOWN.\n")
    print("Native source monitor:",args.project,status,json.dumps(result.get("counts") or {}))
    if status=="UNKNOWN":
        print("::warning::Native source retrieval incomplete; previous baseline preserved, Page untouched")
    return 0

if __name__=="__main__":
    raise SystemExit(run())
