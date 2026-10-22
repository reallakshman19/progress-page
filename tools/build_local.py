#!/usr/bin/env python3
"""Build one self-contained HTML file from the page sources, with an offline snapshot of data/ (standard library only).

Usage: python tools/build_local.py <out.html> [--links <links.private.json>]

The local file reads the live data when it is online and shows the embedded snapshot when it is not.
A file built with --links holds private chat links: keep it on your own machine and never commit it.
"""
import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORDER = ["util.js", "triggers.js", "progress.js", "actions.js", "app.js"]


def strip_module(src):
    """Turn an ES module into plain script text: drop the imports and the export keywords."""
    lines = []
    for line in src.splitlines():
        if re.match(r"\s*import\s.+\sfrom\s+['\"].+['\"];?\s*$", line):
            continue
        line = re.sub(r"^export\s+(async\s+function|function|const|let|class)\s", lambda m: m.group(1) + " ", line)
        lines.append(line)
    return "\n".join(lines)


def snapshot():
    data = ROOT / "data"
    files = {"projects.json": json.loads((data / "projects.json").read_text(encoding="utf-8"))}
    for p in files["projects.json"]["projects"]:
        for f in ("index", "cards", "actions", "fixtures"):
            files[p["key"] + "/" + f + ".json"] = json.loads((data / p["key"] / (f + ".json")).read_text(encoding="utf-8"))
    return {"builtAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "files": files}


def js_json(obj):
    return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("out")
    ap.add_argument("--links", help="JSON map {chat id8: https url}; embedded for this private copy only")
    a = ap.parse_args()
    css = (ROOT / "viewer.css").read_text(encoding="utf-8")
    bundle = "\n".join(strip_module((ROOT / f).read_text(encoding="utf-8")) for f in ORDER)
    links = json.loads(Path(a.links).read_text(encoding="utf-8")) if a.links else {}
    html = (
        '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Progress page (local)</title>\n'
        "<style>\n" + css + "\n</style></head><body>\n"
        '<main id="root"><p class="muted">Loading...</p></main>\n'
        "<script>window.__PP_LOCAL__ = true; window.__PP_SNAPSHOT__ = " + js_json(snapshot())
        + "; window.__PP_LINKS__ = " + js_json(links) + ";</script>\n"
        "<script>\n(function () {\n'use strict';\n" + bundle + "\n})();\n</script>\n</body></html>\n"
    )
    Path(a.out).write_text(html, encoding="utf-8", newline="\n")
    print("wrote", a.out, len(html), "bytes;", len(links), "private links embedded")


if __name__ == "__main__":
    main()
