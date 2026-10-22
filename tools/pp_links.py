#!/usr/bin/env python3
"""Make a private setup link that saves chat links in one browser (standard library only).

Usage: python tools/pp_links.py links.private.json [--page https://<owner>.github.io/<repo>/]
links.private.json is {"<chat id8>": "https://..."}. The printed link carries the map after the # sign, which a
browser never sends to a server; the page saves it in that browser and removes it from the address.
Keep the file and the link private. Never commit either."""
import argparse
import base64
import json
from pathlib import Path


def setup_url(file, page=None):
    links = json.loads(Path(file).read_text(encoding="utf-8"))
    bad = [k for k, v in links.items() if not str(v).startswith("https://")]
    if bad:
        raise SystemExit("Every link must be https: " + ", ".join(bad))
    blob = base64.urlsafe_b64encode(json.dumps(links, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).decode("ascii").rstrip("=")
    return (page or "https://<your page>/").rstrip("/") + "/#links=" + blob


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    ap.add_argument("--page")
    a = ap.parse_args()
    print(setup_url(a.file, a.page))


if __name__ == "__main__":
    main()
