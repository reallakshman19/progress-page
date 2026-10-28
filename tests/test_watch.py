"""Bounded native-source watch: no-op suppressor and fail-closed source retrieval."""
import json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
import pp_watch as W

P="https://github.com/acme/demo/pull/42"
I="https://github.com/acme/demo/issues/7"
A="a"*40;B="b"*40

class Watch(unittest.TestCase):
    def data(self):
        t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup)
        path=Path(t.name)/"data"/"demo";path.mkdir(parents=True)
        (path/"index.json").write_text(json.dumps({"project":{"key":"demo"}}))
        (path/"cards.json").write_text(json.dumps({
          "a":{"src":P,"refs":[{"u":P},{"u":I}]},
          "b":{"src":I,"closed":True},
          "private":{"src":"OWNER_PRIVATE_REF:abc"}
        }))
        (path/"audit.json").write_text(json.dumps({"events":[{"source":P}]}))
        return path.parent
    def api(self,head=A,issue="2026-10-26T17:00:00Z"):
        def get(url):
            if url.endswith("/pulls/42"):return {"head":{"sha":head},"state":"open","merged":False}
            if url.endswith("/issues/7"):return {"state":"open","updated_at":issue}
            raise ValueError("wrong API "+url)
        return get
    def test_no_initial_guess_and_second_identical_scan_is_noop(self):
        data=self.data()
        original={f.name:f.read_bytes() for f in (data/"demo").iterdir()}
        first=W.collect(data,"demo",fetch=self.api())
        self.assertEqual(first["examined"],2)
        self.assertFalse(first["baselineCompared"])
        self.assertEqual(first["counts"]["BASELINE_REQUIRED"],2)
        self.assertFalse(first["meaningfulSourceDelta"])
        second=W.collect(data,"demo",baseline=first,fetch=self.api())
        self.assertEqual(second["counts"]["NO_CHANGE"],2)
        self.assertFalse(second["meaningfulSourceDelta"])
        self.assertEqual(original,{f.name:f.read_bytes() for f in (data/"demo").iterdir()})
        self.assertFalse(second["dataWritten"]);self.assertFalse(second["assignmentDispatched"])
    def test_head_change_and_issue_change_are_source_deltas_not_verified_pass(self):
        data=self.data()
        prior=W.collect(data,"demo",fetch=self.api())
        changed=W.collect(data,"demo",baseline=prior,fetch=self.api(B,"2026-10-27T18:00:00Z"))
        self.assertEqual(changed["counts"]["SOURCE_CHANGED"],2)
        self.assertTrue(changed["meaningfulSourceDelta"])
        self.assertFalse(changed["nativeClaimsQualified"])
    def test_source_removed_from_page_still_requires_review(self):
        data=self.data()
        prior=W.collect(data,"demo",fetch=self.api())
        cards=data/"demo"/"cards.json"
        obj=json.loads(cards.read_text())
        obj["a"]["refs"]=[{"u":P}]
        cards.write_text(json.dumps(obj))
        after=W.collect(data,"demo",baseline=prior,fetch=self.api())
        self.assertEqual(after["counts"]["REMOVED_SOURCE"],1)
        self.assertEqual(after["removedSources"],[I])
        self.assertTrue(after["meaningfulSourceDelta"])
        self.assertTrue(after["complete"])
        # This is a source linkage change, not a new native engineering verdict.
        self.assertFalse(after["nativeClaimsQualified"])
        self.assertFalse(after["dataWritten"])
        # When extra sources exceed the cap, missing-link claims are unknown:
        # do not mistake an unexamined link for a removed one.
        obj["c"]={"src":"https://github.com/acme/demo/issues/8"}
        cards.write_text(json.dumps(obj))
        incomplete=W.collect(data,"demo",limit=1,baseline=prior,fetch=self.api())
        self.assertEqual(incomplete["counts"]["REMOVED_SOURCE"],0)
        self.assertFalse(incomplete["complete"])
    def test_failure_never_advertises_fresh_or_noop(self):
        data=self.data()
        prior=W.collect(data,"demo",fetch=self.api())
        def failed(_):raise OSError("offline")
        result=W.collect(data,"demo",baseline=prior,fetch=failed)
        self.assertEqual(result["counts"]["UNKNOWN"],2)
        self.assertFalse(result["complete"])
        self.assertFalse(result["meaningfulSourceDelta"])
    def test_scope_and_bounded_truncation_are_explicit(self):
        data=self.data();result=W.collect(data,"demo",limit=1,fetch=self.api())
        self.assertEqual((result["examined"],result["omitted"]),(1,1))
        self.assertFalse(result["complete"])
        with self.assertRaises(ValueError):W.collect(data,"../demo")
        with self.assertRaises(ValueError):W.collect(data,"demo",baseline={"project":"other"})
        with self.assertRaises(ValueError):W.collect(data,"demo",limit=0)

if __name__=="__main__":unittest.main()
