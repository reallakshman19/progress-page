"""Shared helpers for the Progress page tool tests (standard library only).

build_valid() runs the real CLI (tools/pp_cli.py) as a subprocess to make a small valid data folder. It is built once per
test run and cached; each test then works on a cheap copy (copy_valid / copy_repo), so the suite stays fast.
Nothing here touches the repository's own data/ folder."""
import atexit
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

KEY = "demo"
OTHER = "other"
SRC = "https://github.com/acme/demo/issues/1#issuecomment-100"
SRC2 = "https://github.com/acme/demo/pull/2#issuecomment-200"
PRIVATE = "OWNER_PRIVATE_REF:r-001"
ACTOR = "Oracle O2"
S = ["--actor", ACTOR, "--src", SRC]
WS = S + ["--summary", "recorded in a test"]   # commands that take --summary
WW = S + ["--why", "recorded in a test"]        # commands that take --why
P = ["--project", KEY]
ISO = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")

_dirs = []
_template = []


def _remove(path):
    def fix(func, p, _info):  # git writes read-only object files; Windows refuses to delete them
        os.chmod(p, stat.S_IWRITE)
        func(p)
    try:
        shutil.rmtree(path, onexc=fix)
    except TypeError:  # Python before 3.12
        shutil.rmtree(path, onerror=fix)


atexit.register(lambda: [_remove(d) for d in _dirs if d.exists()])


def tmpdir(prefix="pp-"):
    d = Path(tempfile.mkdtemp(prefix=prefix))
    _dirs.append(d)
    return d


def run(args, cwd=None):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8")
    return subprocess.run([sys.executable, "-B", *map(str, args)], cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8", timeout=120)


def cli(data, *args):
    """Run tools/pp_cli.py --data <data> <args> from the data folder's parent; returns the CompletedProcess."""
    return run([TOOLS / "pp_cli.py", "--data", data, *args], cwd=Path(data).parent)


def ok(data, *args):
    r = cli(data, *args)
    if r.returncode != 0:
        raise AssertionError(f"pp_cli {' '.join(map(str, args))} failed ({r.returncode}):\n{r.stdout}{r.stderr}")
    return r.stdout.strip()


def refused(data, *args):
    """Run a command that must be refused (exit code 1); returns what it said."""
    r = cli(data, *args)
    if r.returncode == 0:
        raise AssertionError(f"pp_cli {' '.join(map(str, args))} was accepted but must be refused:\n{r.stdout}")
    return r.stdout + r.stderr


def check_cli(data, *args, cwd=None):
    return run([TOOLS / "pp_check.py", data, *args], cwd=cwd or Path(data).parent)


def errors_of(data, private=False):
    """The checker's problem lines for a folder (in process)."""
    import pp_check
    return pp_check.check_tree(str(data), private)


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save(path, obj):
    Path(path).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def edit(folder, rel, fn):
    """Load folder/rel, let fn change it in place (its return value is ignored), write it back."""
    path = Path(folder) / rel
    doc = load(path)
    fn(doc)
    save(path, doc)


def _walk(doc, path):
    *parents, last = path.split(".")
    for p in parents:
        doc = doc[int(p)] if isinstance(doc, list) else doc[p]
    return doc, (int(last) if isinstance(doc, list) else last)


def put(path, value):
    """A mutator for edit(): set the value at a dotted path ('cards' style keys, list positions as numbers)."""
    def mutate(doc):
        node, k = _walk(doc, path)
        node[k] = value
    return mutate


def drop(path):
    """A mutator for edit(): delete the key or list item at a dotted path."""
    def mutate(doc):
        node, k = _walk(doc, path)
        del node[k]
    return mutate


def rechain(doc, key=KEY):
    """Renumber seq, id and previous_id so the Timeline chain is whole again after events were removed or added."""
    prev = None
    for i, e in enumerate(doc["events"], 1):
        e.update(seq=i, id=f"{key.upper()}-R-{i:04d}", previous_id=prev)
        prev = e["id"]


def add_event(doc, key=KEY, **fields):
    """Append a well-chained Timeline event stamped now; the caller gives kind and the other fields."""
    import pp_lib
    n = len(doc["events"]) + 1
    ev = {"seq": n, "id": f"{key.upper()}-R-{n:04d}", "previous_id": doc["events"][-1]["id"], "at": pp_lib.now_iso(), "actor": ACTOR,
          "summary": "added by a test", "source": SRC, "rev": "R1"}
    ev.update(fields)
    doc["events"].append(ev)
    return ev


def find(doc, **match):
    """First Timeline event whose fields equal match."""
    return next(e for e in doc["events"] if all(e.get(k) == v for k, v in match.items()))


def tree(folder):
    """Every file (bytes) and every folder (None) under folder, to prove nothing changed."""
    root = Path(folder)
    return {p.relative_to(root).as_posix(): (p.read_bytes() if p.is_file() else None) for p in sorted(root.rglob("*")) if ".git" not in p.parts}


def git(repo, *args):
    r = subprocess.run(["git", "-C", str(repo), "-c", "commit.gpgsign=false", *args], capture_output=True, text=True, encoding="utf-8", timeout=60)
    if r.returncode != 0:
        raise AssertionError(f"git {' '.join(args)} failed: {r.stdout}{r.stderr}")
    return r.stdout.strip()


def make_repo(repo, message="base"):
    """git init (empty template) and commit everything under repo."""
    subprocess.run(["git", "init", "-q", "--template=", str(repo)], check=True, capture_output=True)
    for k, v in (("user.name", "Test"), ("user.email", "test@example.invalid"), ("core.autocrlf", "false")):
        git(repo, "config", k, v)
    return commit_all(repo, message)


def commit_all(repo, message):
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", message)
    return git(repo, "rev-parse", "HEAD")


def build_valid(root):
    """Build root/data with the projects 'demo' and 'other' by running the CLI. Returns the data folder."""
    data = Path(root) / "data"
    data.mkdir(parents=True)
    go = lambda *a: ok(data, *a)  # noqa: E731
    go("project", "add", "--key", KEY, "--title", "Demo project", "--label", "Demo", "--subtitle", "A small project for tests",
       "--mode", "standalone", "--coordinator", "Oracle", "--owner-words", "Start the demo project", "--aim", "Ship a small demo", *WW)
    go("project", "add", "--key", OTHER, "--title", "Other project", "--mode", "otm", "--coordinator", "OTM", "--owner-words", "Another project", "--aim", "Run another project",
       "--reply-repo", "acme/demo", "--reply-site", "https://acme.github.io/demo/", *WW)
    go("plan", "chat", *P, "--id", "c1", "--label", "Agent one", "--id8", "aaaa1111", "--engine", "ChatGPT", *WS)
    go("plan", "chat", *P, "--id", "c2", "--label", "Agent two", "--id8", "bbbb2222", "--engine", "Antigravity", *WS)
    go("plan", "milestone", *P, "--id", "M5", "--name", "Ship", "--full", "Ship it", "--order", "5", *WS)
    go("plan", "group", *P, "--id", "g2", "--title", "Second group", "--about", "Follow-up work", "--order", "2", *WS)
    card = lambda cid, *a: go("card", "set", *P, "--card", cid, *a)  # noqa: E731
    card("a1", "--label", "Coder", "--group", "main", "--milestone", "M2", "--state", "IN_PROGRESS", "--now", "Writing the code",
         "--next-actor", "Oracle", "--next-text", "Review the PR", "--chat", "c1", "--role", "coder",
         "--ref", "issue|Issue 1|https://github.com/acme/demo/issues/1", "--ref", "pr|PR 2|https://github.com/acme/demo/pull/2|draft", *WS)
    card("a1", "--state", "SUBMITTED", "--now", "Submitted for review", *WS)
    card("a1", "--now", "Waiting for the review", *WS)
    card("b1", "--label", "Reviewer", "--group", "g2", "--milestone", "M3", "--now", "Not started yet", "--chat", "c2", "--role", "reviewer", "--edge", "a1:to", *WS)
    card("x1", "--label", "Spare", "--state", "IN_PROGRESS", "--now", "A card the tests may close", "--chat", "c1", *WS)
    go("action", "add", *P, "--key", "d1", "--title", "Pick one", "--lead", "Which option?", "--option", "A|Option A|Do A|Reply A",
       "--option", "B|Option B|Do B|Reply B", "--suggested", "A", "--link", "Spec|https://github.com/acme/demo/blob/main/SPEC.md", *S)
    go("fixture", "add", *P, "--list", "repository", "--text", "Main repository", "--url", "https://github.com/acme/demo", "--status", "ok",
       "--note", "default branch main", *WS)
    go("nudge", "add", *P, "--card", "a1", "--text", "Check the edge cases", "--actor", "Owner", "--src", PRIVATE)
    return data


def template():
    """The cached valid data folder's parent: <root>/data holds the projects demo and other (no git)."""
    if not _template:
        root = tmpdir("pp-template-")
        errs = errors_of(build_valid(root))
        if errs:
            raise AssertionError("the data built by the CLI is not valid:\n" + "\n".join(errs))
        _template.append(root)
    return _template[0]


def repo_template():
    """The same data committed in a git repository (built on first use, so tests without git do not need it)."""
    if len(_template) < 2:
        root = tmpdir("pp-template-git-")
        shutil.copytree(template() / "data", root / "data")
        make_repo(root)
        _template.append(root)
    return _template[1]


def copy_valid():
    """A private copy of the valid data folder (no git). Returns the data folder path."""
    dest = tmpdir()
    shutil.copytree(template() / "data", dest / "data")
    return dest / "data"


def copy_repo():
    """A private copy of the valid data folder inside a git repository whose HEAD holds exactly that data. Returns (repo, data)."""
    dest = tmpdir()
    shutil.copytree(repo_template(), dest / "repo")
    return dest / "repo", dest / "repo" / "data"


def card(d, cid, *args):
    """card set on the demo project (with actor, source and summary)."""
    return ok(d, "card", "set", *P, "--card", cid, *args, *WS)


def doc(d, name, key=KEY):
    return load(Path(d) / key / f"{name}.json")


def events(d, key=KEY):
    return doc(d, "audit", key)["events"]


def entries(d):
    """projects.json entries by key."""
    return {p["key"]: p for p in load(Path(d) / "projects.json")["projects"]}


class OpsCase(unittest.TestCase):
    """A test that works on a private copy of the valid folder (self.d)."""

    def setUp(self):
        self.d = copy_valid()

    def refuse(self, *args, says=""):
        """The command is refused (exit 1, message contains `says`) and every file and folder is exactly as before."""
        before = tree(self.d)
        out = refused(self.d, *args)
        self.assertIn(says, out)
        self.assertEqual(tree(self.d), before, "a refused command changed the data folder")
        return out
