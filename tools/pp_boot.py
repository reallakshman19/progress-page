"""Copy the Progress page and these tools into a new repository folder (used by pp_cli.py bootstrap)."""
import shutil
from pathlib import Path

import pp_lib as L

VIEWER = ("index.html", "app.js", "checkpoint.js", "agent-start.js", "progress.js", "onboarding.js", "actions.js", "roi.js", "triggers.js", "util.js", "reply.js", "popup.js", "briefs.js",
          "nudge.js", "timeline.js", "lifecycle.js", "links.js", "lessons.js", "search.js", "oracle-continuity.js", "viewer.css")

WORKFLOW = """name: Check progress data
on:
  pull_request:
    paths: ['data/**', 'tools/**']
  push:
    branches: [main]
    paths: ['data/**', 'tools/**']
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Contract check
        run: python tools/pp_check.py data
      - name: The Timeline only grew and nothing was deleted
        if: github.event_name == 'pull_request'
        run: python tools/pp_check.py data --base origin/${{ github.base_ref }}
"""

README = """# Progress page

A static page that shows each project's milestones, agent blocks, decisions for the Owner, grounding fixtures, Timeline,
plan revisions and Nudge + queues. The data is plain JSON in data/. Everything is edited through tools/pp_cli.py, which records
who changed what, why and from which GitHub source, and runs the checker.

    python tools/pp_cli.py --help
    python tools/pp_cli.py check

Published at {page}. Read the guide first: the module README in Common, skills/agent-work/progress-page.
"""


def bootstrap(dest, repo, page):
    here = Path(__file__).resolve().parent
    root = here.parent
    viewer = root / "viewer" if (root / "viewer").is_dir() else root
    dest = Path(dest)
    if (dest / "data" / "projects.json").exists():
        raise SystemExit(f"{dest} already has data/projects.json; nothing was changed.")
    (dest / "tools").mkdir(parents=True, exist_ok=True)
    (dest / "data").mkdir(exist_ok=True)
    (dest / ".github" / "workflows").mkdir(parents=True, exist_ok=True)
    for name in VIEWER:
        shutil.copy2(viewer / name, dest / name)
    for f in list(here.glob("*.py")) + list(here.glob("*.js")):
        shutil.copy2(f, dest / "tools" / f.name)
    site = {"repo": repo, "page": page, "tools": "tools/", "guide": "https://github.com/" + repo + "#readme"}
    L.write_json(dest / "data" / "projects.json", {"schema": 3, "site": site, "projects": []})
    (dest / ".gitattributes").write_text("* text=auto eol=lf\n", encoding="utf-8", newline="\n")
    (dest / ".github" / "workflows" / "check.yml").write_text(WORKFLOW, encoding="utf-8", newline="\n")
    (dest / "README.md").write_text(README.format(page=page), encoding="utf-8", newline="\n")
    return (f"Bootstrapped {dest}. Next, inside it: python tools/pp_cli.py project add --key <key> --title \"<title>\" --mode standalone "
            "--aim \"<the Owner's aim>\" --owner-words \"<the Owner's words>\" --why \"<why>\" --actor \"<you>\" --src <GitHub link>")
