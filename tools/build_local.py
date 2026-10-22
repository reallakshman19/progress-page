#!/usr/bin/env python3
"""Build one self-contained HTML file from the page sources (standard library only).

Usage: python tools/build_local.py <out.html> [--links <links.private.json>] [--prerender <msedge.exe or chrome.exe>]

The file holds the page script and an embedded snapshot of data/. With scripts on, it shows the snapshot at once and
then reads the live data. With --prerender it also holds a static copy of every project and view (drawn by a headless
browser as plain <details> sections) that still shows when scripts are blocked, for example in a static HTML preview.
A file built with --links holds private chat links: keep it on your own machine and never commit it.
"""
import argparse
import json
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORDER = ["util.js", "triggers.js", "progress.js", "actions.js", "app.js"]
LIVE_PAGE = "https://reallakshman19.github.io/progress-page/"
STATIC_CSS = """
.sp{border:1px solid var(--bd);border-radius:10px;margin:0 0 12px;padding:0 14px 12px}
.sp>summary{cursor:pointer;font-weight:600;font-size:16px;padding:10px 0}
.sv{margin:10px 0 0;border-top:1px solid var(--bd);padding-top:8px}
.sv>summary{cursor:pointer;font-weight:600}
.snapbar{font-size:12px;color:var(--mut);margin:4px 0 12px}
"""


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


def dump_root(browser, uri):
    profile = tempfile.mkdtemp()
    try:
        r = subprocess.run([browser, "--headless=new", "--disable-gpu", "--no-first-run", "--user-data-dir=" + profile,
                            "--virtual-time-budget=8000", "--dump-dom", uri], capture_output=True, timeout=120)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    m = re.search(r'<main id="root">(.*?)</main>', r.stdout.decode("utf-8", "replace"), re.S)
    return m.group(1) if m else None


def static_root(browser, html_path):
    """Draw every project and view once in a headless browser and keep the result as plain HTML.

    The page is told to read data from nowhere, so the static copy shows exactly the embedded snapshot.
    Ages such as "5m ago" are as at build time; the banner says so."""
    frag = dump_root(browser, Path(html_path).resolve().as_uri() + "?data=http://127.0.0.1:1/")
    if not frag or 'class="sp"' not in frag:
        raise SystemExit("prerender failed: the headless browser did not draw the static sections")
    frag = re.sub(r"<button[^>]*>Copy reply</button>", "", frag)
    built = datetime.now().astimezone().strftime("%d %b %H:%M UTC%z")
    banner = ('<p class="snapbar">Static copy made ' + built + '; times such as "5m ago" are as at that moment. '
              'Scripts are off in this view. <a href="' + LIVE_PAGE + '" target="_blank" rel="noopener">Open the live page</a>'
              ' for current data and the Copy reply buttons.</p>')
    return frag.replace('<p class="snapbar" id="snapbar"></p>', banner)


def page(css, root_html, snap, links, bundle):
    return (
        '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Progress page (local)</title>\n'
        "<style>\n" + css + STATIC_CSS + "\n</style></head><body>\n"
        '<main id="root">' + root_html + "</main>\n"
        "<script>window.__PP_LOCAL__ = true; window.__PP_SNAPSHOT__ = " + js_json(snap)
        + "; window.__PP_LINKS__ = " + js_json(links) + ";</script>\n"
        "<script>\n(function () {\n'use strict';\n" + bundle + "\n})();\n</script>\n</body></html>\n"
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("out")
    ap.add_argument("--links", help="JSON map {chat id8: https url}; embedded for this private copy only")
    ap.add_argument("--prerender", help="path to msedge.exe or chrome.exe: adds a static copy that works without scripts")
    a = ap.parse_args()
    css = (ROOT / "viewer.css").read_text(encoding="utf-8")
    bundle = "\n".join(strip_module((ROOT / f).read_text(encoding="utf-8")) for f in ORDER)
    links = json.loads(Path(a.links).read_text(encoding="utf-8")) if a.links else {}
    snap = snapshot()
    loading = '<p class="muted">Loading... If this stays blank, open <a href="' + LIVE_PAGE + '">the live page</a>.</p>'
    html = page(css, loading, snap, links, bundle)
    out = Path(a.out)
    if a.prerender:
        tmp = out.with_suffix(".build.html")
        tmp.write_text(page(css, loading, snap, links, bundle + "\n" + (ROOT / "tools" / "static_pass.js").read_text(encoding="utf-8")),
                       encoding="utf-8", newline="\n")
        try:
            html = page(css, static_root(a.prerender, tmp), snap, links, bundle)
        finally:
            tmp.unlink(missing_ok=True)
    out.write_text(html, encoding="utf-8", newline="\n")
    print("wrote", out, len(html), "bytes;", len(links), "private links embedded;", "static copy included" if a.prerender else "no static copy")


if __name__ == "__main__":
    main()
