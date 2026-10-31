#!/usr/bin/env python3
"""Stamp GitHub Pages *packaged* asset URLs with the exact deployed commit SHA.

Source JS keeps one internally consistent ?v= version (test_build.py enforces
this). Only _site receives a unique commit fingerprint on each deployment.
The page remains read-only: no project data or source checkout is changed.
"""
import argparse
import re
from pathlib import Path

SHA = re.compile(r"^[0-9a-f]{40}$")
ASSET_VERSION = re.compile(r"(?P<extension>\.(?:js|css))\?v=[A-Za-z0-9._-]+")


def stamp_site(site: Path, sha: str) -> dict:
    site = Path(site)
    if not SHA.fullmatch(sha):
        raise ValueError("Expected exact lowercase 40-character Git commit SHA")
    index = site / "index.html"
    if not index.is_file() or not (site / "app.js").is_file():
        raise ValueError("Expected the already-packaged _site/index.html and _site/app.js")

    files = [index, *sorted(site.glob("*.js"))]
    if not ASSET_VERSION.search(index.read_text(encoding="utf-8")):
        raise ValueError("Missing versioned asset references in packaged index.html")

    rewritten = 0
    touched = 0
    for file in files:
        before = file.read_text(encoding="utf-8")
        after, count = ASSET_VERSION.subn(
            lambda m: m.group("extension") + "?v=" + sha, before
        )
        rewritten += count
        if after != before:
            file.write_text(after, encoding="utf-8", newline="\n")
            touched += 1

    # Verify the *entire* packaged import graph uses a single fresh version.
    actual = {
        match.group(0).split("?v=", 1)[1]
        for file in files
        for match in ASSET_VERSION.finditer(file.read_text(encoding="utf-8"))
    }
    if actual != {sha} or rewritten < 2:
        raise RuntimeError(f"Packaged assets have inconsistent version references: {actual}")
    return {"commit": sha, "files_scanned": len(files),
            "files_changed": touched, "asset_references": rewritten}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("site", type=Path, help="Packaged public site directory")
    p.add_argument("--sha", required=True, help="Exact SHA of deployed Git commit")
    args = p.parse_args()
    report = stamp_site(args.site, args.sha)
    print("Stamped public Pages assets:", report)


if __name__ == "__main__":
    main()
