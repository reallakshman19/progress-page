"""Fail-closed Common Cycle to Page WBS preflight; all tests are offline."""
import base64,hashlib,json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
import pp_cycle_preflight as P

ISSUE="https://github.com/acme/work/issues/166"
TASK="https://github.com/acme/work/issues/180"
PR="https://github.com/acme/work/pull/191"
SHA="a"*40

class Preflight(unittest.TestCase):
    def fixture(self,linkTask=True,linkPR=True,publication="PUBLISHED",archive=False):
        t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup)
        data=Path(t.name)/"data";(data/"demo").mkdir(parents=True)
        index={"project":{"key":"demo"},"revisions":[{"id":"R4","status":"current"}],
               "milestones":{"M12":{"wbs":"3","repo":"acme/work"},
                             "M13":{"wbs":"3.1","repo":"acme/work"},
                             "M40":{"wbs":"4","repo":"acme/work"}}}
        refs=[{"u":ISSUE+"#issuecomment-7"}]
        if linkTask:refs.append({"u":TASK})
        if linkPR:refs.append({"u":PR})
        cards={"a":{"milestone":"M13","src":ISSUE,"refs":refs},
               "b":{"milestone":"M40","src":"https://github.com/acme/work/issues/181"}}
        (data/"demo"/"index.json").write_text(json.dumps(index))
        (data/"demo"/"cards.json").write_text(json.dumps(cards))
        (data/"projects.json").write_text(json.dumps({"projects":[{"key":"demo",**({"status":"archived"} if archive else {})}]}))
        cycle={"schema":"oracle-cycle-current/v1","project":"cycle-demo","mode":"standalone",
               "activation":"ACTIVE","revision":6,
               "source_boundary":{"wbs":ISSUE,"canonical_task":TASK},
               "progress_projection":{"repository":"reallakshman19/progress-page","project_key":"demo",
                                     "publication_status":publication,"published_revision":"R4"},
               "next":{"status":"AWAIT_OWNER","recipient_role":"owner","pull_request":PR,"source":SHA}}
        ob={"WBS":{"url":ISSUE,"data":{"kind":"issue"}},
            "TASK":{"url":TASK,"data":{"kind":"issue"}},
            "CANDIDATE":{"url":PR,"data":{"kind":"pull","observedHead":SHA,"state":"open","merged":False}}}
        return data,cycle,ob
    def test_ready_requires_explicit_page_wbs_source_and_live_candidate(self):
        data,c,o=self.fixture()
        before={str(p):p.read_bytes() for p in data.rglob("*.json")}
        r=P.evaluate(P.page_scope(data,"demo","3"),c,"cycle-demo",o)
        self.assertEqual(r["result"],"READY_FOR_REVIEW")
        self.assertFalse(r["bindingActivated"])
        self.assertFalse(r["assignmentDispatched"])
        self.assertEqual(before,{str(p):p.read_bytes() for p in data.rglob("*.json")})
    def test_missing_task_candidate_publication_all_fail_closed(self):
        for k in ("task","pr","pending","native"):
            data,c,o=self.fixture(linkTask=k!="task",linkPR=k!="pr",
                                    publication="PROGRESS_UPDATE_PENDING" if k=="pending" else "PUBLISHED")
            if k=="native":o.pop("TASK")
            r=P.evaluate(P.page_scope(data,"demo","3"),c,"cycle-demo",o)
            self.assertEqual(r["result"],"INSUFFICIENT_EVIDENCE",k)
            self.assertFalse(r["eligibleForReviewedBinding"])
    def test_unknown_publication_state_does_not_authorize_a_binding(self):
        data,c,o=self.fixture(publication="UNCONFIRMED")
        result=P.evaluate(P.page_scope(data,"demo","3"),c,"cycle-demo",o)
        self.assertEqual(result["result"],"INSUFFICIENT_EVIDENCE")
        self.assertIn("PAGE_PROJECTION_NOT_PUBLISHED_CURRENT",result["gaps"])
    def test_proven_scope_conflicts_do_not_degrade_into_soft_unknown(self):
        for variant in ("project","wbs","archive","head","repo"):
            data,c,o=self.fixture(archive=variant=="archive")
            if variant=="project":c["progress_projection"]["project_key"]="other"
            if variant=="repo":c["progress_projection"]["repository"]="elsewhere/page"
            if variant=="head":o["CANDIDATE"]["data"]["observedHead"]="b"*40
            r=P.evaluate(P.page_scope(data,"demo","5" if variant=="wbs" else "3"),c,"cycle-demo",o)
            self.assertEqual(r["result"],"SCOPE_MISMATCH",variant)
    def test_merge_decision_checkpoint_cannot_survive_native_pr_merge(self):
        data,c,o=self.fixture()
        c["next"]["status"]="AWAIT_OWNER_MERGE_DECISION"
        o["CANDIDATE"]["data"].update(state="closed",merged=True)
        r=P.evaluate(P.page_scope(data,"demo","3"),c,"cycle-demo",o)
        self.assertEqual(r["result"],"INSUFFICIENT_EVIDENCE")
        self.assertIn("CYCLE_MERGE_DECISION_OUTDATED_BY_NATIVE_MERGE",r["gaps"])
        self.assertFalse(r["bindingActivated"])
    def test_cycle_main_and_content_pinned_to_one_sha(self):
        raw=json.dumps({"schema":"oracle-cycle-current/v1"}).encode()
        blob=hashlib.sha1(("blob "+str(len(raw))+"\0").encode()+raw).hexdigest()
        ref="b"*40
        calls=[]
        def fetch(url):
            calls.append(url)
            if url.endswith("/git/ref/heads/main"):return {"object":{"sha":ref}}
            if url.endswith("?ref="+ref):
                return {"path":"oracle-cycles/cycle-demo/CURRENT.json",
                        "encoding":"base64","content":base64.b64encode(raw).decode(),
                        "sha":blob}
            raise ValueError("unapproved URL")
        record,origin=P.fetch_cycle("cycle-demo",fetch)
        self.assertEqual(origin["commonCommit"],ref)
        self.assertEqual(len(calls),2)
        self.assertTrue(calls[1].endswith("?ref="+ref))
        with self.assertRaises(ValueError):P.fetch_cycle("../cycle-demo",fetch)
    def test_live_read_errors_are_unknown_and_never_bind(self):
        data,c,o=self.fixture()
        def failed(_):raise OSError("GitHub unavailable")
        with self.assertRaises(OSError):P.preflight(data,"demo","cycle-demo",3,failed)
        with self.assertRaises(ValueError):P.page_scope(data,"../demo","3")
        with self.assertRaises(ValueError):P.page_scope(data,"demo","03")

if __name__=="__main__":unittest.main()
