#!/usr/bin/env python3
"""Build one self-contained HTML file from the page sources (standard library only).

Usage: python tools/build_local.py <out.html> [--links <links.private.json>] [--prerender <msedge.exe or chrome.exe>] [--data <folder>]

The file holds the page script and an embedded snapshot of the data folder. With scripts on, it shows the snapshot at once
and then reads the live data. With --prerender it also holds a static copy of every project and view (drawn by a headless
browser as plain <details> sections) that still shows when scripts are blocked, for example in a static HTML preview.
A file built with --links holds private chat links: keep it on your own machine and never commit it.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIEWER = ROOT if (ROOT / "app.js").exists() else ROOT / "viewer"
DATA_FILES = ("index", "cards", "actions", "fixtures", "nudges", "audit")
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


def bundle_order(entry="app.js"):
    """The page modules, each after the modules it imports (the entry module last)."""
    order, seen = [], set()

    def visit(name):
        if name in seen:
            return
        seen.add(name)
        for dep in re.findall(r"from\s+['\"]\./([\w.-]+\.js)", (VIEWER / name).read_text(encoding="utf-8")):
            visit(dep)
        order.append(name)

    visit(entry)
    return order


def snapshot(data):
    data = Path(data)
    files = {"projects.json": json.loads((data / "projects.json").read_text(encoding="utf-8"))}
    for p in files["projects.json"]["projects"]:
        for f in DATA_FILES:
            files[p["key"] + "/" + f + ".json"] = json.loads((data / p["key"] / (f + ".json")).read_text(encoding="utf-8"))
    return {"builtAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "files": files}


def js_json(obj):
    # Every "<" becomes \u003c, so no </script>, <!-- or <script in the data can change how the HTML parser reads the script.
    return json.dumps(obj, ensure_ascii=False).replace("<", "\\u003c")


def dump_root(browser, uri):
    """(the drawn <main>, or None; the browser's last error lines)."""
    profile = tempfile.mkdtemp()
    # a CI runner (Ubuntu) blocks the browser's sandbox; the page drawn is our own file, with no network
    ci = ["--no-sandbox"] if os.environ.get("CI") and sys.platform.startswith("linux") else []
    try:
        r = subprocess.run([browser, "--headless=new", "--disable-gpu", "--no-first-run", "--user-data-dir=" + profile, *ci,
                            "--virtual-time-budget=8000", "--dump-dom", uri], capture_output=True, timeout=120)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    m = re.search(r'<main id="root">(.*?)</main>', r.stdout.decode("utf-8", "replace"), re.S)
    return (m.group(1) if m else None), r.stderr.decode("utf-8", "replace").strip()[-400:]


def static_root(browser, html_path):
    """Draw every project and view once in a headless browser and keep the result as plain HTML.

    The page is told to read data from nowhere, so the static copy shows exactly the embedded snapshot.
    Ages such as "5m ago" are as at build time; the banner says so."""
    frag, err = dump_root(browser, Path(html_path).resolve().as_uri() + "?data=http://127.0.0.1:1/")
    if not frag or 'class="sp"' not in frag:
        raise SystemExit("prerender failed: the headless browser did not draw the static sections" + (f" ({err})" if err else ""))
    frag = re.sub(r"<button[^>]*>(?:Copy reply|\+)</button>", "", frag)
    built = datetime.now().astimezone().strftime("%d %b %H:%M UTC%z")
    banner = ('<p class="snapbar">Static copy made ' + built + '; times such as "5m ago" are as at that moment. '
              'Scripts are off in this view. <a href="' + LIVE_PAGE + '" target="_blank" rel="noopener">Open the live page</a>'
              ' for current data, the Nudge + dialogs and the Copy reply buttons.</p>')
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


def build(out, links_path=None, prerender=None, data=None):
    css = (VIEWER / "viewer.css").read_text(encoding="utf-8")
    bundle = "\n".join(strip_module((VIEWER / f).read_text(encoding="utf-8")) for f in bundle_order())
    links = json.loads(Path(links_path).read_text(encoding="utf-8")) if links_path else {}
    snap = snapshot(data or ROOT / "data")
    loading = '<p class="muted">Loading... If this stays blank, open <a href="' + LIVE_PAGE + '">the live page</a>.</p>'
    html = page(css, loading, snap, links, bundle)
    out = Path(out)
    if prerender:
        tmp = out.with_suffix(".build.html")
        extra = (Path(__file__).resolve().parent / "static_pass.js").read_text(encoding="utf-8")
        tmp.write_text(page(css, loading, snap, links, bundle + "\n" + extra), encoding="utf-8", newline="\n")
        try:
            html = page(css, static_root(prerender, tmp), snap, links, bundle)
        finally:
            tmp.unlink(missing_ok=True)
    out.write_text(html, encoding="utf-8", newline="\n")
    return f"wrote {out} ({len(html)} bytes; {len(links)} private links embedded; " + ("static copy included)" if prerender else "no static copy)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("out")
    ap.add_argument("--links", help="JSON map {chat id8: https url}; embedded for this private copy only")
    ap.add_argument("--prerender", help="path to msedge.exe or chrome.exe: adds a static copy that works without scripts")
    ap.add_argument("--data", help="data folder (default: data beside the page)")
    a = ap.parse_args()
    print(build(a.out, a.links, a.prerender, a.data))


if __name__ == "__main__":
    main()
