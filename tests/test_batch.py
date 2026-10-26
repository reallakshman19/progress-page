import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
import pp_batch as B
from helpers import copy_valid, load, save, SRC

class Batch(unittest.TestCase):
    def manifest(self,root,source=SRC):
        obj={"project":"demo","actor":"Batch reviewer","source":source,
             "changes":[{"command":"plan milestone","args":{"id":"M1","wbs":"7","summary":"Evidence-backed classification"}},
                        {"command":"plan milestone","args":{"id":"M2","wbs":"7.1","summary":"Evidence-backed classification 2"}}]}
        path=Path(root).parent/"batch.json";path.write_text(json.dumps(obj));return path
    def test_dry_run_never_writes_and_apply_is_audited(self):
        data=copy_valid()
        index=Path(data)/"demo"/"index.json"
        audit=Path(data)/"demo"/"audit.json"
        before=index.read_bytes();prev=load(audit)["events"]
        path=self.manifest(data,"https://github.com/example/demo/issues/999")
        out=B.run(data,path)
        self.assertFalse(out["applied"])
        self.assertEqual(len(out["newEventIds"]),2)
        self.assertEqual(index.read_bytes(),before)
        self.assertEqual(load(audit)["events"],prev)
        applied=B.run(data,path,apply=True)
        self.assertTrue(applied["applied"]);self.assertEqual(len(applied["newEventIds"]),2)
        self.assertEqual(len(load(audit)["events"]),len(prev)+2)
        self.assertEqual(load(index)["milestones"]["M1"]["wbs"],"7")
        with self.assertRaisesRegex(ValueError,"already recorded"): B.run(data,path)
    def test_invalid_operation_does_not_change_live_data(self):
        data=copy_valid();audit=Path(data)/"demo"/"audit.json";before=audit.read_bytes()
        m={"project":"demo","actor":"X","source":"https://github.com/example/demo/issues/999",
           "changes":[{"command":"revision add","args":{"why":"oops"}}]}
        with self.assertRaises(ValueError): B.commands(m)
        self.assertEqual(audit.read_bytes(),before)
    def test_no_claim_promotion_implicit(self):
        m={"project":"demo","actor":"X","source":"https://github.com/example/demo/pull/123",
           "changes":[{"command":"card set","args":{"card":"coder","now":"PR observed; review pending","summary":"Observed PR only"}}]}
        cmds=B.commands(m)
        self.assertNotIn("--state",cmds[0])
        self.assertEqual(cmds[0][0:2],["card","set"])

if __name__=="__main__":unittest.main()
