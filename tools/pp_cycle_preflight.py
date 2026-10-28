"""Source-only Cycle ↔ Progress Page WBS binding preflight.

python tools/pp_cli.py cycle-preflight --project ciifr --cycle ciifr --wbs 3

Fetches CURRENT.json at an *observed Common/main SHA*, never a draft/cache;
checks exact project and WBS identity, recorded native lineage, source candidate
and Page publication revision. Does NOT create or activate a binding.
No Page data, Cycle files, receipts, assignments or Timeline entries are written.
"""
import base64
import hashlib
import json
import re
from pathlib import Path

from pp_reconcile import github_json, observe, source_target

KEY_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
WBS_RE = re.compile(r"^[1-9][0-9]*$")
SHA_RE = re.compile(r"^[0-9a-fA-F]{40}$")
COMMON = "https://api.github.com/repos/reallakshman19/Common"
PAGE_REPO = "reallakshman19/progress-page"
SCHEMA = "progress-page-cycle-binding-preflight/v1"

def key(value, what):
    if not isinstance(value,str) or not KEY_RE.fullmatch(value):
        raise ValueError("invalid "+what+": expected simple lower-case slug")
    return value

def native(url):
    """Exact native issue/PR identity, ignoring only an approved issue comment."""
    try:
        owner,repo,kind,number,_ = source_target(url)
        return "https://github.com/"+owner+"/"+repo+"/"+kind+"/"+number
    except (ValueError,TypeError,AttributeError):
        return None

def fetch_cycle(cycle,fetch=github_json):
    """Pin both requests to same Common main commit to avoid split-read races."""
    cycle=key(cycle,"cycle")
    reference=fetch(COMMON+"/git/ref/heads/main")
    sha=(reference.get("object") or {}).get("sha") if isinstance(reference,dict) else None
    if not isinstance(sha,str) or not SHA_RE.fullmatch(sha):
        raise ValueError("Common main commit identity unavailable")
    filename="oracle-cycles/"+cycle+"/CURRENT.json"
    response=fetch(COMMON+"/contents/"+filename+"?ref="+sha)
    if not isinstance(response,dict) or response.get("path")!=filename or response.get("encoding")!="base64":
        raise ValueError("canonical contents metadata could not be verified")
    raw=base64.b64decode(str(response.get("content") or ""),validate=False)
    if len(raw)>2_000_000 or not raw:
        raise ValueError("canonical Cycle content size unavailable or excessive")
    blob="blob "+str(len(raw))+"\x00"
    digest=hashlib.sha1(blob.encode("ascii")+raw).hexdigest()
    if response.get("sha")!=digest:
        raise ValueError("canonical Cycle Git blob identity does not match content")
    obj=json.loads(raw.decode("utf-8"))
    if not isinstance(obj,dict):
        raise ValueError("canonical Cycle record must be an object")
    return obj,{"commonCommit":sha,"cycleBlobSha":digest,
                "cycleUrl":"https://github.com/reallakshman19/Common/blob/"+sha+"/"+filename}

def page_scope(data,project,wbs):
    project=key(project,"project"); wbs=str(wbs)
    if not WBS_RE.fullmatch(wbs):
        raise ValueError("WBS major must be a positive integer (e.g. 3)")
    root=Path(data)
    index=json.loads((root/project/"index.json").read_text(encoding="utf-8"))
    cards=json.loads((root/project/"cards.json").read_text(encoding="utf-8"))
    catalogue=json.loads((root/"projects.json").read_text(encoding="utf-8"))
    if (index.get("project") or {}).get("key")!=project:raise ValueError("Page project identity inconsistent")
    if not isinstance(cards,dict):raise ValueError("Page cards invalid")
    entries=[x for x in catalogue.get("projects",[]) if x.get("key")==project]
    if len(entries)!=1:raise ValueError("Page registry entry missing or ambiguous")
    family={key:rec for key,rec in (index.get("milestones") or {}).items()
            if rec.get("wbs")==wbs or str(rec.get("wbs") or "").startswith(wbs+".")}
    roots=[rec for rec in family.values() if rec.get("wbs")==wbs]
    records=[c for c in cards.values() if isinstance(c,dict) and c.get("milestone") in family and not c.get("closed")]
    ids=set()
    for c in records:
        ids.update(filter(None,[native(c.get("src"))]))
        for ref in c.get("refs",[]) or []:
            if isinstance(ref,dict):
                source=native(ref.get("u"))
                if source:ids.add(source)
    for rec in family.values():
        source=native(rec.get("capSrc"))
        if source:ids.add(source)
    current=[x for x in index.get("revisions",[]) if x.get("status")=="current"]
    return {"project":project,"major":wbs,"active":entries[0].get("status")!="archived",
            "milestones":len(family),"hasParent":len(roots)==1,
            "sourceLinks":ids,"revision":current[0].get("id") if len(current)==1 else None,
            "recordedCards":len(records),"rootRepos":set(r.get("repo") for r in roots if r.get("repo"))}

def evaluate(page,cycle,cycleKey,observations=None):
    """Pure decision function: cannot grant task or publication authority."""
    problems=[]; gaps=[]; verified=[]
    def violation(code):problems.append(code)
    def missing(code):gaps.append(code)
    if cycle.get("schema")!="oracle-cycle-current/v1" or cycle.get("mode")!="standalone":
        violation("CANONICAL_SCHEMA_OR_MODE_MISMATCH")
    if cycle.get("project")!=cycleKey:
        violation("CANONICAL_PROJECT_ID_MISMATCH")
    projection=cycle.get("progress_projection") or {}
    if projection.get("project_key")!=page["project"]:
        violation("PAGE_PROJECT_PROJECTION_MISMATCH")
    repo=projection.get("repository")
    if repo is not None and repo!=PAGE_REPO:
        violation("PAGE_REPOSITORY_MISMATCH")
    if not page["active"]:
        violation("PAGE_PROJECT_ARCHIVED")
    if not page["milestones"] or not page["hasParent"]:
        violation("WBS_PARENT_NOT_UNIQUELY_RECORDED")
    if not page["rootRepos"] or not page["recordedCards"]:
        missing("WBS_NATIVE_REPOSITORY_OR_ACTIVE_CARD_UNRECORDED")
    if cycle.get("activation")!="ACTIVE":
        missing("CYCLE_NOT_ACTIVE")
    boundary=cycle.get("source_boundary") or {}
    ancestor=native(boundary.get("wbs"))
    task=native(boundary.get("canonical_task"))
    if not ancestor or not task:
        missing("NATIVE_WBS_OR_TASK_IDENTITY_UNRECORDED")
    else:
        if ancestor not in page["sourceLinks"]: missing("WBS_ANCESTRY_NOT_LINKED_IN_PAGE")
        else:verified.append("WBS_ANCESTRY_SOURCE_LINK_MATCH")
        if task not in page["sourceLinks"]:missing("CURRENT_NATIVE_TASK_NOT_LINKED_IN_WBS")
        else:verified.append("CURRENT_TASK_SOURCE_LINK_MATCH")
        if page["rootRepos"] and not any(ancestor.startswith("https://github.com/"+repo+"/")
                                          for repo in page["rootRepos"]):
            violation("NATIVE_WBS_REPOSITORY_CONFLICT")
    if projection.get("publication_status")!="PUBLISHED":
        missing("PAGE_PROJECTION_NOT_PUBLISHED_CURRENT")
    if projection.get("published_revision")!=page["revision"] or not page["revision"]:
        missing("PAGE_REVISION_NOT_MATCHING_PUBLISHED_CYCLE")
    nextrec=cycle.get("next") or {}
    if not nextrec.get("status") or not nextrec.get("recipient_role"):
        missing("CANONICAL_NEXT_ROLE_OR_STATUS_NOT_RECORDED")
    pull=native(nextrec.get("pull_request"))
    nextsrc=nextrec.get("source")
    if not pull or not isinstance(nextsrc,str) or not SHA_RE.fullmatch(nextsrc):
        missing("CURRENT_CANDIDATE_PR_OR_SHA_UNRECORDED")
    else:
        if pull not in page["sourceLinks"]:
            missing("CURRENT_CANDIDATE_NOT_LINKED_IN_WBS")
        else:verified.append("CURRENT_CANDIDATE_PR_LINK_MATCH")
    if observations is None:
        missing("CURRENT_NATIVE_SOURCES_NOT_INDEPENDENTLY_CHECKED")
    else:
        for label,url in (("WBS",ancestor),("TASK",task),("CANDIDATE",pull)):
            if not url:continue
            obs=observations.get(label)
            if not isinstance(obs,dict) or obs.get("url")!=url or not isinstance(obs.get("data"),dict):
                missing("NATIVE_"+label+"_NOT_VERIFIED")
                continue
            data=obs["data"]
            expected="pull" if label=="CANDIDATE" else "issue"
            if data.get("kind")!=expected and not (label!="CANDIDATE" and data.get("kind")=="issue-comment"):
                violation("NATIVE_"+label+"_KIND_CONFLICT")
                continue
            if label=="CANDIDATE":
                if data.get("observedHead")!=nextsrc:violation("CANDIDATE_HEAD_DRIFT")
                else:verified.append("CURRENT_NATIVE_CANDIDATE_HEAD_MATCH")
                if not isinstance(data.get("merged"),bool) or data.get("state") not in ("open","closed"):
                    missing("CANDIDATE_NATIVE_MERGE_STATE_UNVERIFIED")
                elif data["merged"] and "MERGE_DECISION" in str(nextrec.get("status") or ""):
                    missing("CYCLE_MERGE_DECISION_OUTDATED_BY_NATIVE_MERGE")
            else:verified.append("CURRENT_NATIVE_"+label+"_RETRIEVED")
    result="SCOPE_MISMATCH" if problems else "INSUFFICIENT_EVIDENCE" if gaps else "READY_FOR_REVIEW"
    return {"schema":SCHEMA,"result":result,"pageProject":page["project"],
      "wbs":"wbs:"+page["major"],"cycleProject":cycleKey,
      "pageRevision":page["revision"],"cycleRevision":cycle.get("revision"),
      "candidate":nextsrc if isinstance(nextsrc,str) and SHA_RE.fullmatch(nextsrc) else "UNKNOWN",
      "nativeWbs":ancestor,"nativeTask":task,"nativeCandidate":pull,
      "verified":verified,"conflicts":problems,"gaps":gaps,
      "eligibleForReviewedBinding":result=="READY_FOR_REVIEW",
      "bindingActivated":False,"pageDataWritten":False,"cycleModified":False,
      "assignmentDispatched":False,"next":"Owner/coordinator reviews actual WBS/current candidate and source custody. Only a separately authorized Page change can activate an exact binding."}

def preflight(data,page_key,cycle_key,major,fetch=github_json):
    page=page_scope(data,page_key,major)
    cycle,provenance=fetch_cycle(cycle_key,fetch)
    boundary=cycle.get("source_boundary") or {}
    nextrec=cycle.get("next") or {}
    urls={"WBS":native(boundary.get("wbs")),"TASK":native(boundary.get("canonical_task")),
          "CANDIDATE":native(nextrec.get("pull_request"))}
    observed={}
    for label,url in urls.items():
        if not url:continue
        try:
            ob=observe(url,fetch)
            observed[label]={"url":url,"data":ob}
        except (OSError,ValueError,TypeError,KeyError) as exc:
            observed[label]={"url":url,"error":str(exc)[:160]}
    result=evaluate(page,cycle,cycle_key,observed)
    result["source"] = provenance
    result["nativeObservation"]={k:("OK" if "data" in v else "UNKNOWN") for k,v in observed.items()}
    # Stable source facts for a read-only monitoring delta, not a qualification
    # claim. PR merge/head changes are visible even when Cycle has not caught up.
    result["nativeState"]={k:{field:v["data"].get(field) for field in
                             ("kind","observedHead","state","merged","updatedAt")}
                           for k,v in observed.items() if "data" in v}
    return result

def run(data,page,cycle,wbs):
    try:
        result=preflight(data,page,cycle,wbs)
    except (OSError,ValueError,TypeError,KeyError,UnicodeError,json.JSONDecodeError) as exc:
        result={"schema":SCHEMA,"result":"INSUFFICIENT_EVIDENCE",
            "pageProject":page,"cycleProject":cycle,"wbs":"wbs:"+str(wbs),
            "gaps":["CANONICAL_OR_PAGE_SOURCE_UNAVAILABLE"],"detail":str(exc)[:250],
            "eligibleForReviewedBinding":False,"bindingActivated":False,
            "pageDataWritten":False,"cycleModified":False,"assignmentDispatched":False}
    print(json.dumps(result,indent=2,sort_keys=True))
    return {"READY_FOR_REVIEW":0,"SCOPE_MISMATCH":1,"INSUFFICIENT_EVIDENCE":2}[result["result"]]
