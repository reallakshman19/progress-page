"""Immutable native occurrence IDs shared by the Board and reviewed Page writer.

Never infer a historical occurrence from a mutable URL or human summary text.
"""
import re
from pp_reconcile import source_target

SHA40 = re.compile(r"^[a-fA-F0-9]{40}$")
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$")


def occurrence_id(source, observation):
    """Return a Board-compatible identity for one freshly verified native record."""
    owner, repo, kind, number, comment = source_target(source)
    if not isinstance(observation, dict):
        raise ValueError("verified native observation required")
    prefix = "github:" + owner + "/" + repo + ":"
    if kind == "pull" and not comment and observation.get("kind") == "pull":
        head = observation.get("observedHead")
        if not isinstance(head, str) or not SHA40.fullmatch(head):
            raise ValueError("PR occurrence needs exact 40-hex head")
        return prefix + "pull-head:" + number + ":" + head.lower()
    if kind == "issues" and comment is None and observation.get("kind") == "issue":
        when = observation.get("updatedAt")
        if not isinstance(when, str) or not ISO.fullmatch(when):
            raise ValueError("issue occurrence needs observed updatedAt timestamp")
        return prefix + "issue-revision:" + number + ":" + when
    if kind == "issues" and comment is not None and observation.get("kind") == "issue-comment":
        when = observation.get("updatedAt")
        if str(observation.get("commentId")) != comment or not isinstance(when, str) or not ISO.fullmatch(when):
            raise ValueError("comment occurrence needs exact comment ID and updatedAt")
        return prefix + "comment-revision:" + comment + ":" + when
    raise ValueError("unsupported or mismatched source/occurrence kind")


def valid_identity(source, identity):
    """Validate source/id correspondence, without claiming an external source read."""
    if not isinstance(identity, str):
        return False
    try:
        owner, repo, kind, number, comment = source_target(source)
    except (ValueError, TypeError):
        return False
    stem = "github:" + owner + "/" + repo + ":"
    if kind == "pull" and comment is None:
        prefix = stem + "pull-head:" + number + ":"
        return identity.startswith(prefix) and bool(SHA40.fullmatch(identity[len(prefix):]))
    if kind == "issues" and comment is None:
        prefix = stem + "issue-revision:" + number + ":"
        return identity.startswith(prefix) and bool(ISO.fullmatch(identity[len(prefix):]))
    if kind == "issues" and comment is not None:
        prefix = stem + "comment-revision:" + comment + ":"
        return identity.startswith(prefix) and bool(ISO.fullmatch(identity[len(prefix):]))
    return False


def exact_events(events, source, occurrence, wbs, card):
    return [e for e in events if e.get("source") == source
            and e.get("nativeOccurrenceId") == occurrence
            and e.get("wbs") == wbs and e.get("card") == card]


def legacy_events(events, source):
    return [e for e in events if e.get("source") == source and not e.get("nativeOccurrenceId")]
