"""CT-4 effort arithmetic on self-reported inputs, NEVER independent acceptance.

Offline input can be forged, even when its strings resemble real GitHub URLs,
commit SHAs and trial receipts. The tool does not authenticate an actor, query
GitHub for a head, or examine an Owner trial. It *always* withholds a trusted
optimization / Owner acceptance claim; issue #80 carries separate verification.
Read-only: no input or source data is mutated.
"""
import argparse
import json
import math
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

SCHEMA = "cycle-board.effort/v1"
ROLES = ("coder", "ir", "oracle_otm", "owner", "page_writer")
SHA = re.compile(r"^[a-f0-9]{40}$", re.I)
KEY = re.compile(r"^[a-z][a-z0-9-]{0,50}$")
PUBLIC_GITHUB = re.compile(
    r"^/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/"
    r"(?:issues/[1-9]\d*|pull/[1-9]\d*|commit/[a-fA-F0-9]{40}|actions/runs/[1-9]\d*)"
    r"(?:/.*)?$")
PR_PATH = re.compile(r"^/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[1-9]\d*$")
UNSAFE = re.compile(
    r"(?:chatgpt\.com/(?:c|share)/|claude\.ai/chat/|"
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b|"
    r"\b(?:gh[pousr]_[A-Za-z0-9_]{6,}|github_pat_[A-Za-z0-9_]+|"
    r"sk-[A-Za-z0-9_-]{12,}|Bearer\s+\S+))",
    re.I,
)
SCOPE_KEYS = ("project", "workflow", "work_unit", "sample_count")
# Explicit unit contract: the five role inputs and recurring maintenance are
# PER-RUN MEANS across scope.sample_count comparable cases, whereas setup is
# ONE-TIME (amortized once over the declared future-run horizon).
INPUT_BASIS = {
    "role_minutes": "PER_RUN_MEAN",
    "maintenance_minutes_per_run": "PER_RUN_MEAN",
    "setup_minutes": "ONE_TIME",
}


def _check_confidential(value):
    """Reject leaking user supplied secrets into a public receipt or diagnostics."""
    if isinstance(value, str) and UNSAFE.search(value):
        raise ValueError("private link, identifier or credential marker in input")
    if isinstance(value, dict):
        for k, v in value.items():
            _check_confidential(k)
            _check_confidential(v)
    if isinstance(value, list):
        for v in value:
            _check_confidential(v)


def _url(raw, label, *, github_evidence=False, github_pr=False):
    if not isinstance(raw, str) or not raw or any(c.isspace() for c in raw):
        raise ValueError(label + " must be a well-formed public URL")
    try:
        u = urlsplit(raw)
        _ = u.port
    except ValueError as exc:
        raise ValueError(label + " has an invalid URL") from exc
    if not u.hostname or u.username or u.password or u.query or u.netloc.endswith("."):
        raise ValueError(label + " must be a well-formed public URL (invalid host, credentials or query)")
    if github_evidence or github_pr:
        if u.scheme != "https" or u.hostname.lower() != "github.com" or u.port is not None:
            raise ValueError(label + " requires a public github.com HTTPS reference")
        if github_pr and (not PR_PATH.fullmatch(u.path) or u.fragment):
            raise ValueError(label + " must point to an exact GitHub pull request")
        if github_evidence and not PUBLIC_GITHUB.fullmatch(u.path):
            raise ValueError(label + " must reference a public GitHub source")
    elif u.scheme not in ("https", "http"):
        raise ValueError(label + " requires http(s)")
    elif u.scheme == "http" and u.hostname not in ("localhost", "127.0.0.1", "::1"):
        raise ValueError(label + " requires HTTPS except for local trial URLs")
    if u.fragment and (github_evidence or github_pr):
        if not re.fullmatch(r"(?:issuecomment-|pullrequestreview-|discussion_r|L)\d+", u.fragment):
            raise ValueError(label + " contains an unsupported source anchor")
    return raw


def _evidence(value, label):
    if not isinstance(value, list) or not value:
        raise ValueError(label + " requires referenced evidence, not free text")
    for item in value:
        _url(item, label, github_evidence=True)
    return value


def _number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError(label + " must be an observed nonnegative finite number")
    return float(value)


def _count(value, label, *, positive=False):
    if isinstance(value, bool) or not isinstance(value, int) or value < (1 if positive else 0):
        raise ValueError(label + " must be an observed nonnegative integer" if not positive
                         else label + " must be an observed positive integer")
    return value


def _scope(value, label, project):
    if not isinstance(value, dict) or set(value) != set(SCOPE_KEYS):
        raise ValueError(label + " must include exact project/workflow/work_unit/sample_count")
    if value["project"] != project:
        raise ValueError(label + ".project must match selected Page project")
    for k in ("workflow", "work_unit"):
        if not isinstance(value[k], str) or not KEY.fullmatch(value[k]):
            raise ValueError(label + "." + k + " requires a stable explicit workflow key")
    _count(value["sample_count"], label + ".sample_count", positive=True)
    return {k: value[k] for k in SCOPE_KEYS}


def _cohort(value, name, horizon, project):
    if not isinstance(value, dict):
        raise ValueError(name + " must be an object")
    if value.get("status") == "NOT_RUN":
        return {"status": "NOT_RUN", "scope": None, "total_minutes_per_run": None,
                "active_role_minutes": None, "maintenance_minutes_per_run": None,
                "amortized_setup_minutes_per_run": None, "extra_mandatory_board_reports": None}
    if value.get("status") != "OBSERVED":
        raise ValueError(name + ".status must be NOT_RUN or OBSERVED")
    scope = _scope(value.get("scope"), name + ".scope", project)
    # Explicit declaration prevents silently treating three-case aggregate
    # totals as per-case means. This remains an unverified self-attestation;
    # cross-check original timings independently under CT-4 Issue #80.
    if value.get("input_basis") != INPUT_BASIS:
        raise ValueError(name + ".input_basis must declare role and maintenance "
                         "as PER_RUN_MEAN and setup as ONE_TIME; divide measured "
                         "three-case totals by scope.sample_count before entry")
    roles = value.get("role_minutes")
    if not isinstance(roles, dict) or set(roles) != set(ROLES):
        raise ValueError(name + ".role_minutes must contain exactly " + ", ".join(ROLES))
    active = sum(_number(roles[r], name + ".role_minutes." + r) for r in ROLES)
    maintenance = _number(value.get("maintenance_minutes_per_run"), name + ".maintenance_minutes_per_run")
    setup = _number(value.get("setup_minutes"), name + ".setup_minutes")
    posts = _count(value.get("extra_mandatory_board_reports"), name + ".extra_mandatory_board_reports")
    _evidence(value.get("evidence"), name + ".evidence")
    for name_of_field in ("time_to_first_runnable_minutes", "continuation_recovery_minutes"):
        if name_of_field in value and value[name_of_field] is not None:
            _number(value[name_of_field], name + "." + name_of_field)
    return {"status": "SELF_REPORTED", "scope": scope,
            "input_basis": dict(INPUT_BASIS),
            "total_minutes_per_run": round(active + maintenance + setup / horizon, 6),
            "active_role_minutes": round(active, 6),
            "maintenance_minutes_per_run": maintenance,
            "amortized_setup_minutes_per_run": round(setup / horizon, 6),
            "extra_mandatory_board_reports": posts}


def evaluate(payload):
    """A provisional arithmetic result; no user-controlled evidence can turn it into verified PASS."""
    _check_confidential(payload)
    if not isinstance(payload, dict) or payload.get("schema") != SCHEMA:
        raise ValueError("unsupported or missing CT-4 effort schema")
    project = payload.get("project")
    if not isinstance(project, str) or not KEY.fullmatch(project):
        raise ValueError("project must be a valid Page project key")
    horizon = _count(payload.get("amortization_runs"), "amortization_runs", positive=True)
    if horizon > 1000000:
        raise ValueError("amortization_runs exceeds permitted horizon")
    baseline = _cohort(payload.get("baseline"), "baseline", horizon, project)
    pilot = _cohort(payload.get("pilot"), "pilot", horizon, project)
    comparable = baseline["status"] == pilot["status"] == "SELF_REPORTED"
    if comparable and baseline["scope"] != pilot["scope"]:
        raise ValueError("baseline and pilot scope differ: workflow, unit, cohort or sample count")
    trial = payload.get("owner_trial")
    if not isinstance(trial, dict) or trial.get("status") not in ("NOT_RUN", "PASS", "FAIL"):
        raise ValueError("owner_trial.status must be NOT_RUN, PASS or FAIL")
    candidate = payload.get("candidate")
    if candidate is not None:
        if not isinstance(candidate, dict):
            raise ValueError("candidate must be an object")
        if candidate.get("source_pr") is not None:
            _url(candidate["source_pr"], "candidate.source_pr", github_pr=True)
        if candidate.get("head_sha") is not None and not SHA.fullmatch(candidate["head_sha"]):
            raise ValueError("candidate.head_sha must be exactly 40 hexadecimal digits")
    if trial["status"] != "NOT_RUN":
        if not isinstance(candidate, dict) or not candidate.get("source_pr") or not candidate.get("head_sha"):
            raise ValueError("reported Owner trial requires PR locator and exact candidate SHA")
        _url(trial.get("runnable_url"), "owner_trial.runnable_url")
        _evidence(trial.get("evidence"), "owner_trial.evidence")
    difference = (round(baseline["total_minutes_per_run"] - pilot["total_minutes_per_run"], 6)
                  if comparable else None)
    fraction = (round(difference / baseline["total_minutes_per_run"], 6)
                if comparable and baseline["total_minutes_per_run"] > 0 else None)
    # Offline user inputs are unauthenticated. GitHub-looking links, a 40-char SHA,
    # evidence arrays, "owner_trial.status: PASS", or verification flags in the
    # same input NEVER establish independent proof.
    return {
        "schema": SCHEMA, "project": project, "amortization_runs": horizon,
        "comparison_scope": baseline["scope"] if comparable else None,
        "comparable_scope_reported": comparable,
        "baseline": baseline, "pilot": pilot,
        "owner_trial_self_reported_status": trial["status"],
        "owner_trial_independently_verified": False,
        "candidate_head_independently_verified": False,
        "independent_non_author_review_verified": False,
        "provisional_self_reported_minutes_difference_per_run": difference,
        "provisional_self_reported_fractional_difference": fraction,
        "no_extra_mandatory_board_reports_self_reported":
            pilot["extra_mandatory_board_reports"] == 0 if comparable else None,
        "optimized_claim_allowed": False,
        "disposition": "UNVERIFIED_SELF_REPORTED_COMPARISON" if comparable else "NOT_RUN",
        "method": "Inputs for all five roles and maintenance are observed PER_RUN_MEAN "
                  "of scope.sample_count matched cases (three for CIIFR-Node). "
                  "Setup is ONE_TIME, counted only as setup/amortization_runs. "
                  "Never add case totals directly or double-count role setup, "
                  "idle time or descriptive timings.",
        "limits": "This is unauthenticated arithmetic, NOT an accepted savings claim. "
                  "Independent exact-head source/measurement comparison, real Owner trial, "
                  "and authority must be verified externally under CT-4 issue #80. "
                  "No input field can self-certify those gates."
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="local JSON receipt; never modified")
    args = parser.parse_args(argv)
    try:
        payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
        report = evaluate(payload)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "INVALID", "error": str(exc)}))
        return 2
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
