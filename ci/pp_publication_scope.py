"""PR publication boundary check. Read-only; PR metadata is not source evidence."""
import argparse
import json
import os
import re
import subprocess

def classify(paths):
    changed=sorted(set(str(p).strip() for p in paths if str(p).strip()))
    data=[p for p in changed if p.startswith("data/") and p.endswith(".json")]
    proposals=[p for p in changed if p.startswith("proposals/")]
    status=("PAGE_DATA_CHANGE_REQUIRES_HISTORY_CHECK" if data else
            "PROPOSAL_ONLY_NOT_PUBLISHED" if proposals else "NO_PAGE_DATA_PUBLICATION")
    return {"schema":"progress-page-pr-publication-scope/v1",
            "status":status,"dataPaths":data,"proposalPaths":proposals,
            "pageDataModified":bool(data),"pagePublicationVerified":False,
            "cyclePublicationVerified":False,"ownerAcceptanceInferred":False}

def diff_paths(base):
    if not isinstance(base,str) or not re.fullmatch(r"origin/[A-Za-z0-9][A-Za-z0-9/_-]*",base) or ".." in base:
        raise ValueError("invalid origin branch reference")
    result=subprocess.run(["git","diff","--name-only","--diff-filter=ACDMRT",base+"...HEAD"],
                          text=True,capture_output=True,check=False)
    if result.returncode:
        raise ValueError("git diff unavailable; cannot infer Page publication")
    return result.stdout.splitlines()

def run(base):
    result=classify(diff_paths(base))
    print(json.dumps(result,sort_keys=True))
    summary=os.getenv("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary,"a",encoding="utf-8") as f:
            f.write("### Page publication boundary: **"+result["status"]+"**\n\n")
            if result["status"]=="PROPOSAL_ONLY_NOT_PUBLISHED":
                f.write("A review/proposal-only PR changes no Page JSON. **Merging it does not publish WBS sources or audit events**. "
                        "The designated writer must separately apply the original evidence through the checked Page update route.\n")
            elif result["status"]=="PAGE_DATA_CHANGE_REQUIRES_HISTORY_CHECK":
                f.write("Page data is modified, but this is only a publication candidate. "
                        "Contract and append-only history checks must still pass; live merge, Cycle receipt and Owner acceptance are separate.\n")
            else:
                f.write("No Page JSON change: this PR cannot publish new Page evidence.\n")
    return 0

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base",required=True)
    raise SystemExit(run(parser.parse_args().base))
