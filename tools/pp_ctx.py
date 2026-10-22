"""Collects problems as 'where: why' lines and offers small typed field checks (used by the checkers)."""
import pp_lib as L


class Ctx:
    """Collects problems as 'where: why' lines and offers small typed field checks."""

    def __init__(self):
        self.errors = []

    def err(self, where, why):
        self.errors.append(f"{where}: {why}")

    def text(self, where, obj, field, opt=False, limit=None):
        v = obj.get(field)
        if v is None or (isinstance(v, str) and not v.strip()):
            if not opt:
                self.err(where, f"{field} is required")
            return None
        if not isinstance(v, str):
            self.err(where, f"{field} must be text")
            return None
        if limit and len(v) > limit:
            self.err(where, f"{field} is longer than {limit} characters")
        return v

    def integer(self, where, obj, field, opt=False, low=0):
        v = obj.get(field)
        if v is None:
            if not opt:
                self.err(where, f"{field} is required")
            return None
        if not isinstance(v, int) or isinstance(v, bool) or v < low:
            self.err(where, f"{field} must be a whole number of at least {low}")
            return None
        return v

    def stamp(self, where, obj, field, opt=False):
        v = obj.get(field)
        if v is None:
            if not opt:
                self.err(where, f"{field} is required")
            return None
        if L.parse_iso(v) is None:
            self.err(where, f"{field} must be a UTC time like 2026-10-22T02:01:25Z")
            return None
        return v

    def link(self, where, obj, field, opt=False, source=False):
        v = obj.get(field)
        if v is None or v == "":
            if not opt:
                self.err(where, f"{field} is required")
            return None
        if not (L.public_source(v) if source else L.https(v)):
            self.err(where, f"{field} must be " + ("a public GitHub link or OWNER_PRIVATE_REF:<id>" if source else "an https link"))
            return None
        return v

    def member(self, where, obj, field, allowed, opt=False):
        v = obj.get(field)
        if v is None:
            if not opt:
                self.err(where, f"{field} is required")
            return None
        if v not in allowed:
            self.err(where, f"{field} {v!r} is not one of " + ", ".join(sorted(map(str, allowed))))
            return None
        return v
