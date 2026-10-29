"""Execute a reviewed group of ordinary pp_cli commands as one staged audited update.
Default is dry-run. --apply replaces the data directory only after successful checks.

Manifest shape:
{"project":"ciifr","actor":"Oracle","source":"https://github.com/OWNER/REPO/issues/33",
 "changes":[{"command":"plan milestone","args":{"id":"M8","wbs":"5","summary":"Classify existing work"}}]}
Only pre-existing native write commands are allowed. Not an approval/auto-PASS mechanism.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from pp_reconcile import source_target, observe
from pp_occurrence import occurrence_id, exact_events, legacy_events

ALLOWED = {
    ("plan","milestone"), ("plan","group"), ("plan","chat"),
    ("card","set"), ("fixture","add"), ("action","add"),
}
FORBIDDEN = {"data","project","actor","src","source","sub","cmd","private","base","json","apply"}
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def files(folder):
    return {str(p.relative_to(folder)):sha(p) for p in folder.rglob("*") if p.is_file()}
def commands(manifest):
    if not isinstance(manifest,dict): raise ValueError("manifest must be a JSON object")
    for field in ("project","actor","source"):
        if not isinstance(manifest.get(field),str) or not manifest[field].strip(): raise ValueError("missing "+field)
    source_target(manifest["source"])
    changes=manifest.get("changes")
    if not isinstance(changes,list) or not 1 <= len(changes) <= 30: raise ValueError("expected 1–30 scoped changes")
    out=[]
    for item in changes:
        if not isinstance(item,dict): raise ValueError("change must be an object")
        cmd=tuple(str(item.get("command","")).split())
        if cmd not in ALLOWED: raise ValueError("not a supported batch command: "+str(cmd))
        args=item.get("args")
        if not isinstance(args,dict): raise ValueError("args must be an object")
        if any(k in FORBIDDEN or not k.replace("-","").replace("_","").isalnum() for k in args):
            raise ValueError("cannot override project/actor/source or inject CLI options")
        flags=[]
        for k,v in args.items():
            key="--"+k.replace("_","-")
            if isinstance(v,bool):
                if v: flags.append(key)
                continue
            for value in v if isinstance(v,list) else [v]:
                if value is None or isinstance(value,(dict,list,bool)): raise ValueError("unsupported argument value for "+k)
                flags.extend([key,str(value)])
        if cmd in (("card","set"),("plan","milestone"),("plan","group"),("plan","chat"),("fixture","add")) and "summary" not in args:
            raise ValueError("every batch operation needs a distinct evidence-scoped summary")
        out.append([*cmd,"--project",manifest["project"],"--actor",manifest["actor"],"--src",manifest["source"],*flags])
    # Auto-proposed manifests can only append one evidence reference. They cannot
    # edit state, claim, actor, milestone, activity, or an Owner gate.
    if manifest.get("proposalVersion") is not None:
        if manifest["proposalVersion"] not in (1,2): raise ValueError("unsupported proposal version")
        fp=manifest.get("sourceObservation")
        if not isinstance(fp,dict) or fp.get("kind") not in ("pull","issue","issue-comment"):
            raise ValueError("proposal needs a native source identity")
        identity = "observedHead" if fp["kind"]=="pull" else "updatedAt"
        if not isinstance(fp.get(identity),str) or not fp[identity]:
            raise ValueError("proposal missing source fingerprint")
        if len(changes)!=1 or changes[0].get("command")!="card set":
            raise ValueError("automated proposals may only add one card source reference")
        props=changes[0]["args"]
        if set(props)!={"card","summary","ref"} or not isinstance(props["ref"],str):
            raise ValueError("proposal may only append an original native-source reference")
        if props["ref"].split("|")[2:3]!=[manifest["source"]]:
            raise ValueError("proposal reference must cite the exact observed source")
        if manifest["proposalVersion"] == 2:
            expected=occurrence_id(manifest["source"],fp)
            if manifest.get("nativeOccurrenceId")!=expected:
                raise ValueError("proposal occurrence identity does not match original native source")
            wbs=manifest.get("wbs")
            if not isinstance(wbs,str) or not wbs.strip() or len(wbs)>40:
                raise ValueError("proposal WBS must be explicitly scoped")
            review=manifest.get("legacyReview")
            if review is not None:
                if not isinstance(review,dict) or review.get("acknowledged") is not True or not isinstance(review.get("reason"),str) or not 20<=len(review["reason"].strip())<=300:
                    raise ValueError("legacy URL-only history needs explicit written review")
            out[0].extend(["--native-occurrence-id",expected,"--native-wbs",wbs])
    return out

def source_fresh(manifest, reader=observe):
    """On apply, fail closed if the source has drifted since proposal generation."""
    if manifest.get("proposalVersion") is None:return
    fp=manifest["sourceObservation"]
    current=reader(manifest["source"])
    if current.get("kind")!=fp["kind"]:
        raise ValueError("source identity changed: kind differs")
    key="observedHead" if fp["kind"]=="pull" else "updatedAt"
    if current.get(key)!=fp[key]:
        raise ValueError("source identity drifted after proposal; regenerate and review before apply")
    if fp["kind"]=="issue-comment" and current.get("commentId")!=fp.get("commentId"):
        raise ValueError("issue comment identity changed")

def run(data, manifest_path, apply=False, base=None, observe_source=observe):
    target=Path(data).resolve()
    if not target.is_dir(): raise ValueError("data directory does not exist")
    original=files(target)
    manifest=json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    cmdlist=commands(manifest)
    if not (target/manifest["project"]/"audit.json").is_file():raise ValueError("unknown project")
    old_events=json.loads((target/manifest["project"]/"audit.json").read_text(encoding="utf-8"))["events"]
    if manifest.get("proposalVersion")==2:
        source=manifest["source"];identity=manifest["nativeOccurrenceId"];wbs=manifest["wbs"]
        selected=manifest["changes"][0]["args"]["card"]
        cards=json.loads((target/manifest["project"]/"cards.json").read_text(encoding="utf-8"))
        index=json.loads((target/manifest["project"]/"index.json").read_text(encoding="utf-8"))
        card=cards.get(selected)
        if not card or card.get("closed"):
            raise ValueError("selected Page card missing or closed")
        if (index.get("milestones") or {}).get(card.get("milestone"),{}).get("wbs")!=wbs:
            raise ValueError("selected card WBS differs from reviewed proposal")
        existing=[e.get("id") for e in old_events if e.get("source")==source
                  and e.get("nativeOccurrenceId")==identity and e.get("wbs")==wbs]
        if existing:
            raise ValueError("same occurrence and WBS already recorded: "+", ".join(existing))
        legacy=legacy_events(old_events,source)
        legacy_ref=any(r.get("u")==source and not r.get("nativeOccurrenceId")
                       for r in card.get("refs",[]))
        if (legacy or legacy_ref) and not manifest.get("legacyReview"):
            raise ValueError("LEGACY_REVIEW_REQUIRED: URL-only historical evidence needs explicit writer review")
    else:
        existing=[e.get("id") for e in old_events if e.get("source")==manifest["source"]]
        if existing:raise ValueError("source already recorded: "+", ".join(existing)+"; review distinct evidence before another batch")
    with tempfile.TemporaryDirectory(prefix=".pp-batch-",dir=target.parent) as temp:
        stage=Path(temp)/"stage"
        shutil.copytree(target,stage)
        cli=Path(__file__).with_name("pp_cli.py")
        for n,args in enumerate(cmdlist,1):
            p=subprocess.run([sys.executable,str(cli),"--data",str(stage),*args],
                  text=True,capture_output=True,encoding="utf-8",timeout=180)
            if p.returncode:raise ValueError("operation "+str(n)+" failed without changing live data: "+(p.stdout+p.stderr)[-2800:])
        check=subprocess.run([sys.executable,str(cli),"--data",str(stage),"check"],
             capture_output=True,text=True,encoding="utf-8",timeout=180)
        if check.returncode:raise ValueError("staged check failed: "+check.stdout+check.stderr)
        current=files(stage)
        changed=sorted(p for p in set(original)|set(current) if original.get(p)!=current.get(p))
        new_events=json.loads((stage/manifest["project"]/"audit.json").read_text(encoding="utf-8"))["events"]
        if len(new_events)!=len(old_events)+len(cmdlist) or new_events[:len(old_events)]!=old_events:
            raise ValueError("history not append-only: expected one event per operation")
        if manifest.get("proposalVersion")==2:
            event=new_events[-1]
            if (event.get("nativeOccurrenceId")!=manifest["nativeOccurrenceId"] or
                event.get("wbs")!=manifest["wbs"] or
                event.get("card")!=selected or event.get("source")!=manifest["source"]):
                raise ValueError("staged audit does not preserve exact source occurrence and WBS/card")
            before_card=cards[selected]
            after_card=json.loads((stage/manifest["project"]/"cards.json").read_text(encoding="utf-8"))[selected]
            for field in ("state","now","next","milestone","who","closed","flags"):
                if before_card.get(field)!=after_card.get(field):
                    raise ValueError("source-only proposal must not change "+field)
            if len(after_card.get("refs",[]))!=len(before_card.get("refs",[]))+1:
                raise ValueError("new native occurrence needs exactly one appended card reference")
        report={"project":manifest["project"],"source":manifest["source"],"commands":len(cmdlist),
            "newEventIds":[e.get("id") for e in new_events[len(old_events):]],"changedFiles":changed,
            "applied":False,"checked":True,"baseChecked":False}
        if not apply:return report
        if files(target)!=original:raise ValueError("data changed during staging; nothing published")
        source_fresh(manifest, observe_source)
        backup=Path(temp)/"backup"
        target.rename(backup)
        try:
            stage.rename(target)
            if base:
                history=subprocess.run([sys.executable,str(cli),"--data",str(target),"check","--base",base],
                    capture_output=True,text=True,encoding="utf-8",timeout=180)
                if history.returncode:raise ValueError("base history check failed; restored original data: "+history.stdout+history.stderr)
                report["baseChecked"]=True
        except Exception:
            if target.exists():shutil.rmtree(target)
            backup.rename(target)
            raise
        report["applied"]=True
        return report

def main():
    import argparse
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("manifest",help="reviewed JSON manifest")
    p.add_argument("--data",default="data")
    p.add_argument("--apply",action="store_true",help="apply checked change (default: dry-run)")
    p.add_argument("--base",help="git ref for append-only comparison, checked after staging when --apply")
    a=p.parse_args()
    try: result=run(a.data,a.manifest,a.apply,a.base)
    except (ValueError,OSError,subprocess.SubprocessError) as e:
        print(json.dumps({"applied":False,"error":str(e)}));return 2
    print(json.dumps(result,indent=2));return 0

if __name__=="__main__":sys.exit(main())
