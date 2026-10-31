#!/usr/bin/env python3
"""Test shared project layout in a real Chromium browser against this PR's local code.
Screenshot evidence is limited to requested PC views; pass != human usability acceptance.
"""
import json
import os
import re
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.getenv("PROGRESS_PAGE_URL","http://127.0.0.1:8765/")
OUT=Path(os.getenv("PP_LAYOUT_OUTPUT","layout-output"))
OUT.mkdir(parents=True,exist_ok=True)
CASES=[]
SCREENSHOTS=[]
def check(value,message):
    if not value:raise AssertionError(message)
def run_case(name,fn):
    try:CASES.append({"name":name,"status":"PASS","details":fn() or {}})
    except Exception as exc:CASES.append({"name":name,"status":"FAIL","error":str(exc),"trace":traceback.format_exc()[-1100:]})
def picture(page,name):
    path=OUT/(name+".png")
    page.screenshot(path=str(path),full_page=True,animations="disabled",timeout=35000)
    SCREENSHOTS.append(str(path))
def load(page,route):
    page.goto(BASE.rstrip("/")+"/#/"+route,wait_until="domcontentloaded",timeout=60000)
    page.locator(".ptitle, .ll-page, .adhoc-heading").first.wait_for(timeout=30000)
    page.wait_for_timeout(120)
def geometry(page):
    return page.evaluate("""() => {
       const main=document.querySelector('main');
       const root=document.querySelector('#root');
       const body=document.querySelector('.body');
       const wbs=document.querySelector('.wbs-family-cards');
       const views=document.querySelector('nav.views:not(.home-subtabs):not(.lesson-subtabs)');
       const filters=document.querySelector('nav.wbs-family-nav');
       const rect=e=>e?({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,
           right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width}):null;
       return {windowWidth:window.innerWidth,documentWidth:document.documentElement.scrollWidth,
         main:rect(main),root:rect(root),body:rect(body),
         cards:wbs?Array.from(wbs.children).map(rect):[],nav:rect(views),
         wbsNav:rect(filters),grid:wbs?getComputedStyle(wbs).gridTemplateColumns:null};
    }""")
def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        errors=[]
        for width,height in ((1920,1080),(1440,900),(1118,840),(1024,768),(390,844)):
            baseline_shell = {}
            context=browser.new_context(viewport={"width":width,"height":height},
                                        is_mobile=width==390,has_touch=width==390,device_scale_factor=1)
            page=context.new_page()
            page.on("pageerror",lambda error:errors.append(str(error)))
            for project in ("doc2table","ciifr","g9v35"):
                for view in ("progress","home","home-roadmap","home-sources","home-risks","actions","fixtures","timeline","start","continuity","oracle-continuity"):
                    route=project+"/"+view
                    if view=="start":route=project+"/start"
                    def run_one():
                        load(page,route)
                        g=geometry(page)
                        if g["documentWidth"]>width+3:
                            offenders=page.evaluate("""() => Array.from(document.querySelectorAll('body *'))
                              .map(e=>({tag:e.tagName.toLowerCase(),cls:String(e.className).slice(0,90),
                                text:(e.textContent||'').trim().slice(0,75),
                                right:Math.round(e.getBoundingClientRect().right),
                                width:Math.round(e.getBoundingClientRect().width)}))
                              .filter(x=>x.right>window.innerWidth+3)
                              .sort((a,b)=>b.right-a.right).slice(0,8)""")
                            raise AssertionError(route+" horizontal document overflow "+
                                  str(g["documentWidth"])+" > "+str(width)+" culprits: "+json.dumps(offenders))
                        check(g["main"]["right"]<=width+3 and g["main"]["x"]>=-3,
                              route+" main outside viewport: "+str(g["main"]))
                        check(page.locator(".body").count()==1,
                              route+" content body missing")
                        if view=="home":
                            check(page.locator(".checkpoint").count()==1,"Home must show its source-backed project checkpoint")
                            check("UNMAPPED" in page.locator(".checkpoint").inner_text(),
                                  "No implicit Cycle binding permitted")
                        if view=="progress":
                            check(page.locator(".checkpoint-disclosure").count()==1,
                                  "WBS must offer evidence checkpoint without moving primary navigation")
                            check(page.locator(".ptitle .project-brief").count()==1,
                                  "non-home Owner brief should be collapsible")
                            check(not page.locator(".ptitle .project-brief").evaluate("(x)=>x.open"),
                                  "project brief must be collapsed by default")
                            check(g["nav"] and g["wbsNav"] and g["nav"]["y"] < g["wbsNav"]["y"],
                                  "primary navigation buried beneath WBS filters")
                            check(len(g["cards"])>=1,route+" WBS family choices missing; never invent WBS entries")
                            if width>=1280:
                                check(len(g["grid"].split())==4,"wide PC WBS family layout not 4 columns: "+str(g["grid"]))
                            if width in (1024,1118):
                                check(len(g["grid"].split())==3,"tablet / narrow desktop WBS grid not 3 columns")
                            if width==390:
                                check(len(g["grid"].split())==1,"phone WBS grid not one column")
                        if view=="continuity":
                            check(page.locator("nav.continuity-subtabs a").count()==5,
                                  "Continuity central must show its five local destinations")
                            check(page.locator(".continuity-central .home-tile").count()==4,
                                  "Continuity landing must link all four legacy sections")
                        if view in ("start","oracle-continuity","home-risks","fixtures"):
                            check(page.locator("nav.continuity-subtabs").count()==1,
                                  "Legacy continuity route must live under new Central tab")
                            check(page.locator("nav.views:not(.continuity-subtabs):not(.home-subtabs):not(.lesson-subtabs) a.on").count()==1,
                                  "Exactly one primary view must be active")
                        if view=="start" and project=="doc2table":
                            check(page.locator(".agent-start-choice-description").count()==7,
                                  "Doc to Table Agent Start must expose seven source-recorded WBS purposes")
                            check("Source hashes" in page.locator(".agent-start-choices").inner_text(),
                                  "WBS 1 recorded description not visible")
                        if view=="home":
                            check(page.locator(".ptitle .project-brief").count()==1,
                                  "Home overview must use the same compact header as every other route")
                            check(page.locator(".project-home .home-owner-aim").count()==1,
                                  "Full Owner aim must remain visible inside Project Home")
                        if view != "progress":
                            check(page.locator(".ptitle .project-brief").count()==1,
                                  "all project views must share one compact Owner-aim disclosure")
                            check(not page.locator(".ptitle .project-brief").evaluate("(x)=>x.open"),
                                  "project header must not expand unexpectedly by route")
                        if project=="doc2table":
                            check(g["nav"] is not None,route+" primary nav missing")
                            shell = (round(g["main"]["x"]), round(g["main"]["width"]), round(g["nav"]["y"]))
                            if view == "progress": baseline_shell[project] = shell
                            else: check(shell == baseline_shell.get(project),
                                  route+" shell shifted from WBS: "+str(shell)+" vs "+str(baseline_shell.get(project)))
                        if width==1118 and view=="progress":
                            check(len(g["grid"].split())==3,"narrow desktop WBS must have three columns")
                        if width==1440 and project=="doc2table" and view in ("progress","home","home-roadmap","fixtures","timeline"):
                            picture(page,"doc2table-"+view+"-pc")
                        if width==390 and project=="doc2table" and view in ("progress","home","actions"):
                            picture(page,"doc2table-"+view+"-mobile")
                        if width==1920 and view=="progress" and project=="ciifr":
                            picture(page,"ciifr-progress-wide")
                        return {"documentWidth":g["documentWidth"],
                                "mainWidth":round(g["main"]["width"]), "wbsCards":len(g["cards"])}
                    run_case(str(width)+"px "+route,run_one)
            # CT-5 is the same read-only bridge across all registered active
            # engineering/education projects, not a TOPO-only status page.
            if width in (1440,390):
                for ct5_project in ("ciifr","ciifr-node","g9v35","topofix","doc2table"):
                    def ct5_cross_project():
                        route=ct5_project+"/cycle-board"
                        load(page,route)
                        panel=page.locator(".ct5-continuation")
                        check(panel.count()==1,"Missing shared CT-5 on "+route)
                        check(panel.locator(".ct5-task").count()>=1,
                              "No scoped existing WBS tasks in "+route)
                        v2=panel.locator(".task-evidence-v2")
                        check(v2.count()==panel.locator(".ct5-task").count(),
                              "Task Evidence v2 must project each existing CT-5 task in "+route)
                        check(all(v2.nth(i).locator(".te-line").count()==5 for i in range(v2.count())),
                              "Every Task Evidence v2 card must have exactly 5 lines")
                        check(panel.locator(".ct5-owner-action").count()==v2.count(),
                              "Each Board task must expose one separate Action to Owner transaction")
                        check(all("Source status:" in v2.nth(i).inner_text() for i in range(v2.count())),
                              "Task Evidence v2 source freshness missing")
                        check("instruction delivery: NOT_VERIFIED" in panel.text_content(),
                              "Cannot mark an issue/URL as delivered")
                        check("ACK: NOT_VERIFIED" in panel.text_content(),
                              "Cannot infer acknowledgment from Page state")
                        check("Copy Cycle now" in panel.text_content(),
                              "Copy-only continuation instruction missing")
                        check(panel.locator("button").count()>=1,
                              "CT-5 has no enabled copy interaction")
                        check(panel.locator("button").filter(has_text="Send").count()==0,
                              "CT-5 falsely promises direct message delivery")
                        check(panel.locator('a[href*="chatgpt.com/c/"]').count()==0,
                              "Private chat link must not be bundled in the public Page")
                        g=geometry(page)
                        check(g["documentWidth"]<=width+3,route+" overflow: "+str(g["documentWidth"]))
                        return {"project":ct5_project,"ct5Tasks":panel.locator(".ct5-task").count(),
                                "documentWidth":g["documentWidth"]}
                    run_case(str(width)+"px CT-5 "+ct5_project,ct5_cross_project)
            # Adhoc is a top-level navigation workspace, never a project-data/WBS tab.
            for section in ("overview","cycle-board","contracts","delivery","tests"):
                def run_adhoc():
                    route="adhoc/progress-page/"+section
                    load(page,route)
                    check(page.locator("nav.tabs a.on").count()==1,
                          "one top-level Adhoc Projects tab must be selected")
                    check(page.locator("nav.tabs a.on").inner_text()=="Adhoc Projects",
                          "top-level Adhoc Projects tab not selected")
                    check(page.locator("nav.adhoc-project-subtabs a.on").count()==1,
                          "Progress Page second-level tab missing")
                    check(page.locator("nav.adhoc-section-subtabs a").count()==5,
                          "all Progress Page subtabs must be present")
                    check(page.locator("nav.adhoc-section-subtabs a.on").count()==1,
                          "exactly one Progress Page section selected")
                    check(page.locator(".adhoc-body").count()==1,
                          "Adhoc section missing its content body")
                    g=geometry(page)
                    check(g["documentWidth"]<=width+3,
                          route+" horizontal overflow "+str(g["documentWidth"])+" > "+str(width))
                    if section=="cycle-board" and width in (1440,390):
                        board_link=page.locator(".adhoc-body a",has_text="Open Cycle Board")
                        check(board_link.count()==1,"specific Adhoc Cycle Board link missing or duplicated")
                        check(board_link.get_attribute("href").endswith("#/ciifr-node/cycle-board"),
                              "Adhoc Cycle Board link opens wrong project")
                        board_link.click()
                        page.locator(".cb-context").wait_for(timeout=30000)
                        check("#/ciifr-node/cycle-board" in page.url,"Adhoc click did not navigate to native Board")
                        text=page.locator(".cb-context").inner_text()
                        check("ciifr-node" in text,"Board displayed wrong project")
                        check("WBS 2" in text,"CIIFR-Node mapped WBS2 missing after link click")
                        check("UNMAPPED" in text,"UI invented a standalone CIIFR-Node Cycle")
                    if width==1440 and section=="overview":picture(page,"adhoc-progress-page-overview")
                    if width==390 and section=="tests":picture(page,"adhoc-progress-page-tests-mobile")
                    return {"documentWidth":g["documentWidth"],"section":section}
                run_case(str(width)+"px adhoc/progress-page/"+section,run_adhoc)
            # Two independent TOPO Adhoc boards, never additional Page projects/WBS.
            # Native public GitHub may rate-limit; the Board must render UNKNOWN
            # without asserting complete source intake or engineering authority.
            if width in (1440,390):
                for topo in ("topo-a","topo-b"):
                    for section_name in ("overview","cycle-board","sources","continuity","tests"):
                        def topo_adhoc_case():
                            route="adhoc/"+topo+"/"+section_name
                            load(page,route)
                            check(page.locator("nav.tabs a.on").count()==1 and
                                  page.locator("nav.tabs a.on").inner_text()=="Adhoc Projects",
                                  "TOPO Adhoc left the governing navigation")
                            check(page.locator("nav.adhoc-project-subtabs a.on").count()==1,
                                  "TOPO did not select exactly one Adhoc project")
                            check(page.locator("nav.adhoc-section-subtabs a.on").count()==1,
                                  "TOPO did not select exactly one nested view")
                            check(page.locator(".adhoc-body").count()==1,
                                  "TOPO missing source-linked content")
                            check("Existing governing WBS" in page.locator(".adhoc-body").inner_text(),
                                  "No existing WBS scope or source disclaimer")
                            if section_name=="cycle-board":
                                check(page.locator(".topo-cycle-board").count()==1,
                                      "TOPO has no independent read-only Cycle Board")
                                check(page.locator(".topo-board-results").count()==1,
                                      "TOPO Board did not expose source observation")
                                check(page.locator(".topo-cycle-board > button").count()==1,
                                      "On-demand native-source recheck absent")
                                check(page.locator(".topo-cycle-board").get_attribute("aria-label")==
                                      "TOPO source-bound Cycle Board",
                                      "Wrong Board type")
                                # Reuse CIIFR writer's audited INFO-Auto presentation
                                # instead of the prior SHA-only GitHub source list.
                                check(page.locator(".topo-task-card").count()==1,
                                      "Task/Owner outcome missing from primary view")
                                check(page.locator(".topo-wbs-card").count()==2,
                                      "Must show exactly the two existing WBS milestones")
                                check(page.locator(".topo-page-grounding .ct-auto-section").count()==1,
                                      "Missing reused INFO-Auto section")
                                check(page.locator(".topo-ct5-slot .ct5-continuation").count()==1,
                                      "TOPO Board missing shared CT-5 continuation bridge")
                                check(page.locator(".topo-ct5-slot .ct5-task").count()==1,
                                      "TOPO bridge must scope to its one original native issue")
                                check(page.locator(".topo-ct5-slot .ct5-role-control button").count()==1,
                                      "Oracle role-owned Cycle now copy control missing")
                                check("Copy Oracle Cycle now" in page.locator(".topo-ct5-slot .ct5-role-control button").inner_text(),
                                      "TOPO Cycle now control could misattribute Agent work to Oracle")
                                check(page.locator(".topo-ct5-slot .task-evidence-v2").count()==1,
                                      "TOPO Board must show one native Task Evidence v2 card")
                                check(page.locator(".topo-ct5-slot .task-evidence-v2 .te-line").count()==5,
                                      "TOPO native Task Evidence v2 must have five information lines")
                                check(page.locator(".topo-ct5-slot .ct5-owner-action").count()==1,
                                      "TOPO native task must expose Action to Owner separately")
                                check("Action to Owner" in page.locator(".topo-ct5-slot .ct5-owner-action").inner_text(),
                                      "Owner transaction heading missing")
                                check("Engineering HOLD" in page.locator(".topo-ct5-slot .task-evidence-v2").inner_text(),
                                      "Native engineering HOLD must survive evidence projection")
                                check(page.locator(".topo-ct5-slot .ct5-actions button").count()==1,
                                      "Copy-only native continuation action missing")
                                check("ACK NOT_VERIFIED" in page.locator(".topo-ct5-slot").text_content(),
                                      "TOPO bridge promoted unknown recipient acknowledgment")
                                check(page.locator(".topo-page-grounding .ct-card.ct-auto").count()>=1,
                                      "No real published Page audit evidence rendered")
                                check(page.locator(".topo-page-grounding button").filter(
                                      has_text="Copy grounding / Page brief").count()>=1,
                                      "Shared CIIFR Page grounding brief was not reused")
                                check(page.locator(".topo-board-sources").count()==1 and
                                      page.locator(".topo-board-sources").get_attribute("open") is None,
                                      "Long raw SHA/source ledger must default collapsed")
                                check("NOT_VERIFIED" in page.locator(".topo-task-card").inner_text(),
                                      "Undispatched/unknown actual agent was falsely promoted")
                                check("WBS 3.2" in page.locator(".topo-page-grounding").inner_text()
                                      if topo=="topo-a" else
                                      "WBS 2.1" in page.locator(".topo-page-grounding").inner_text(),
                                      "Existing, task-specific WBS grouping missing")
                            if section_name=="sources":
                                check(page.locator(".adhoc-body a[href*='/issues/3']").count()>=1,
                                      "Governing original WBS source is missing")
                                check(page.locator(".adhoc-body a[href*='/pull/572']").count()>=1,
                                      "Common relay provenance missing")
                                check(page.locator(".adhoc-body a[href*='/pull/95']").count()>=1,
                                      "Page writer source missing")
                            if section_name=="continuity":
                                check("NOT_VERIFIED" in page.locator(".adhoc-body").inner_text(),
                                      "Agent / Oracle authority unknown was suppressed")
                            g=geometry(page)
                            check(g["documentWidth"]<=width+3,
                                  route+" horizontal overflow "+str(g["documentWidth"]))
                            if section_name=="cycle-board":
                                picture(page,"adhoc-"+topo+"-board-"+str(width))
                            return {"workspace":topo,"view":section_name,
                                    "documentWidth":g["documentWidth"]}
                        run_case(str(width)+"px adhoc/"+topo+"/"+section_name,topo_adhoc_case)
                def topo_unknown_route():
                    load(page,"adhoc/topo-a/unknown")
                    check(page.locator('[role="alert"]').count()==1,
                          "Unknown TOPO section must fail closed")
                    check(page.locator(".adhoc-body").count()==0,
                          "Wrong fallback Adhoc content shown")
                    return {"route":"adhoc/topo-a/unknown","failClosed":True}
                run_case(str(width)+"px invalid TOPO Adhoc route",topo_unknown_route)
            # Source-bound Board: rendered Page WBS and INFO-Auto must not need
            # a live comment feed or an activated Oracle Cycle.
            if width in (1440,390):
                def cycle_board_native_case():
                    load(page,"ciifr-node/cycle-board")
                    page.locator(".cb-context").wait_for(timeout=30000)
                    check(page.locator(".ct-auto-section").count()==1,
                          "Page audit INFO-Auto must be present without live intake")
                    check(page.locator(".ct5-continuation").count()==1,
                          "Shared CT-5 continuation must exist on canonical Board")
                    check(page.locator(".ct5-task").count()>=1,
                          "Existing Page card tasks are not reusable in CT-5")
                    check("ACK NOT_VERIFIED" in page.locator(".ct5-continuation").text_content(),
                          "A Page record must never invent agent acknowledgment")
                    check("Cycle Board" in page.locator(".body").inner_text(),
                          "Canonical Cycle Board route did not render")
                    check("UNMAPPED" in page.locator(".cb-context").inner_text(),
                          "CIIFR-Node must not infer an Oracle Cycle")
                    check("No optional live-comment intake configured" in page.locator(".body").inner_text(),
                          "Missing live comments must not suppress native/Page context")
                    check(page.locator(".cb-delta").count()==1,
                          "CT-2 delta advisory must be visible on the same Board URL")
                    check(page.locator(".cb-delta-fact").count()==3,
                          "Native, Page and Cycle axes must be independent")
                    check(page.locator(".cb-delta button").count()==1,
                          "Configured native source should expose on-demand recheck")
                    check(page.locator(".cb-writer").count()==1,
                          "CT-3 reviewed Page writer preview must render on same Board URL")
                    check("automatic Page write" in page.locator(".cb-writer").inner_text(),
                          "Page writer preview must warn against automatic publication")
                    check(page.locator(".cb-writer-commands").count()<=2,
                          "Only configured original sources can be writer candidates")
                    check("REVIEW_PAGE_DRIFT" in page.locator(".cb-delta").inner_text() or
                          "UNKNOWN_STOP" in page.locator(".cb-delta").inner_text(),
                          "Board may recommend only review or UNKNOWN when recipient authority absent")
                    check("UNMAPPED" in page.locator(".cb-delta").inner_text(),
                          "No canonical CIIFR-Node Cycle means no authorized continuation")
                    check("CONTINUE_AUTHORIZED" not in page.locator(".cb-delta").inner_text(),
                          "Read-only Board must not authorize agent continuation")
                    check("ALREADY_RECONCILED" not in page.locator(".cb-writer").inner_text(),
                          "Unpublished native occurrences must not look reconciled")
                    g=geometry(page)
                    check(g["documentWidth"]<=width+3,
                          "Cycle Board horizontal overflow")
                    picture(page,"ciifr-node-cycle-board-"+str(width))
                    return {"documentWidth":g["documentWidth"],
                            "autoEvidence":page.locator(".ct-auto-section .ct-auto").count()}
                run_case(str(width)+"px ciifr-node/cycle-board",cycle_board_native_case)
                def native_trial_case():
                    load(page,"ciifr-node/test")
                    lab=page.locator('[data-prototype-trial="ciifr-node"]')
                    lab.wait_for(timeout=30000)
                    check("Property Transfer" in lab.inner_text(),
                          "Native trial workspace is not first-class")
                    check("RUNTIME NOT VERIFIED" in lab.inner_text(),
                          "Unhosted native PR must not be described as runnable/accepted")
                    check(lab.locator("select").count()==5,
                          "Real native observation cases missing")
                    check(lab.locator("select").first.input_value()=="NOT_RUN",
                          "Unobserved trial must begin NOT_RUN")
                    check(lab.locator("a[aria-disabled='true']").count()==1,
                          "Local preview must not launch without source + operator")
                    check("0 / 5 OBSERVED" in lab.inner_text(),
                          "New trial console should show honest zero-observed progress")
                    check(lab.locator(".trial-case").count()==5,
                          "Compact test rows must represent all five scenarios")
                    check(lab.locator(".trial-case details").count()==5,
                          "Each test row must expose expandable expected behavior")
                    check(lab.locator('[data-trial-count="NOT_RUN"]').inner_text()=="5",
                          "Unobserved summary must count five NOT_RUN cases")
                    lab.locator(".trial-case details").first.locator("summary").click()
                    # Regression: expanded <details> is a direct grid child and
                    # must occupy a new full-width row, not the 76px Inspect
                    # column (which produced a very tall, one-word-wide panel).
                    panel_size=lab.locator(".trial-case").first.evaluate("""card => {
                        const rect=x=>x.getBoundingClientRect();
                        const body=card.querySelector(".trial-inspect-body");
                        const details=card.querySelector(".trial-inspect");
                        const name=card.querySelector(".trial-case-name");
                        return {cardWidth:rect(card).width,bodyWidth:rect(body).width,
                          bodyHeight:rect(body).height,cardHeight:rect(card).height,
                          detailsTop:rect(details).top,nameTop:rect(name).top};
                    }""")
                    check(panel_size["bodyWidth"]>=panel_size["cardWidth"]*0.70,
                          "Expanded Inspect must span scenario width, not a narrow column: "+
                          str(panel_size))
                    check(panel_size["detailsTop"]>panel_size["nameTop"]+5,
                          "Expanded Inspect must appear in a separate row: "+str(panel_size))
                    check(panel_size["cardHeight"]<650,
                          "Expanded Inspect produced excessive vertical height: "+str(panel_size))
                    lab.locator('[aria-label="PT-01 observed result"]').select_option("PASS")
                    check("1 / 5 OBSERVED" in lab.inner_text(),
                          "Observed results should update progress immediately")
                    check(lab.locator('[data-trial-count="PASS"]').inner_text()=="1",
                          "PASS must be marked as self-reported and counted exactly once")
                    lab.get_by_role("button",name="Reset observations").click()
                    check("0 / 5 OBSERVED" in lab.inner_text() and
                          lab.locator('[data-trial-count="NOT_RUN"]').inner_text()=="5",
                          "Reset must return the lab to NOT_RUN without writes")
                    check(lab.locator("a[href='#/ciifr-node/cycle-board']").count()==1,
                          "Testing workspace must provide direct evidence Board navigation")

                    demo=page.locator("details",has_text="Workflow demo · Action / Info simulator")
                    check(demo.count()==1 and demo.get_attribute("open") is None,
                          "Legacy Action/Info demo should be clearly separate and folded")
                    g=geometry(page)
                    check(g["documentWidth"]<=width+3,
                          "Prototype trial workspace horizontal overflow")
                    return {"documentWidth":g["documentWidth"],"cases":5,"status":"NOT_RUN"}
                run_case(str(width)+"px ciifr-node/test prototype trial",native_trial_case)
                def universal_trials_case():
                    for key,expected_title,count in (
                        ("ciifr","R3 native prototype launch qualification",3),
                        ("g9v35","QRT grid",3),
                        ("topofix","NO TRIAL CONFIGURED",0),
                    ):
                        load(page,key+"/test")
                        lab=page.locator('[data-trial-workspace="'+key+'"]')
                        lab.wait_for(timeout=30000)
                        check(expected_title in lab.inner_text(),
                              key+" is not showing its own trial template")
                        check(lab.locator(".trial-case").count()==count,
                              key+" trial cases are not project-scoped")
                        check(page.locator("#"+key+"-workflow-demo").count()==1,
                              key+" lost the old optional Workflow demo")
                        if key=="ciifr":
                            selector=lab.get_by_label("Select trial profile")
                            check(selector.count()==1,"CIIFR two distinct trial profiles missing")
                            lab.locator(".trial-case details").first.locator("summary").click()
                            review_size=lab.locator(".trial-case").first.evaluate("""card => ({
                                caseWidth:card.getBoundingClientRect().width,
                                bodyWidth:card.querySelector(".trial-inspect-body").getBoundingClientRect().width
                            })""")
                            check(review_size["bodyWidth"]>=review_size["caseWidth"]*0.70,
                                  "Shared V3 review Inspect must span scenario width: "+str(review_size))
                            lab.get_by_label("R3-01 observed result").select_option("FAIL")
                            check("1 / 3 OBSERVED" in lab.inner_text(),
                                  "First CIIFR profile must count local observations")
                            selector.select_option("1")
                            check("Geometry RCA source review" in lab.inner_text(),
                                  "CIIFR profile switch did not replace source and cases")
                            check(lab.locator(".trial-case").count()==2,
                                  "CIIFR geometry cases must be separately scoped")
                            check("0 / 2 OBSERVED" in lab.inner_text(),
                                  "New profile must begin with no inherited results")
                        if key=="g9v35":
                            check(lab.locator("a",has_text="Open source for review").count()==1,
                                  "Grade9 hosted review must open a real review link")
                        if key=="topofix":
                            check(lab.locator(".trial-launch").count()==0,
                                  "Unconfigured project must not fabricate launch or readiness")
                        g=geometry(page)
                        check(g["documentWidth"]<=width+3,
                              key+" Trials V3 has horizontal overflow")
                    return {"projects":["ciifr","g9v35","topofix"],"unconfiguredSafe":True}
                run_case(str(width)+"px universal Trials V3 profiles",universal_trials_case)

            context.close()
        # Explicitly exercise the archived-history-independent Lessons reading paths.
        ctx=browser.new_context(viewport={"width":1440,"height":900},device_scale_factor=1)
        page=ctx.new_page()
        for route in ("learned/progress","learned/L01","learned/L02"):
            def lesson():
                page.goto(BASE.rstrip("/")+"/#/"+route,wait_until="domcontentloaded",timeout=60000)
                page.locator(".ll-page").wait_for(timeout=30000)
                g=geometry(page)
                check(g["documentWidth"]<=1443,route+" overflow")
                check(g["main"]["right"]<=1443,route+" outside viewport")
                return {"documentWidth":g["documentWidth"],"readingPage":True}
            run_case("1440px "+route,lesson)
        ctx.close()
        # Owner screenshot was in dark mode; confirm contrast layout at the same PC
        # viewport and a phone, without relying only on the light browser default.
        for width,height in ((1440,900),(390,844)):
            dark=browser.new_context(viewport={"width":width,"height":height},
                        is_mobile=width==390,has_touch=width==390,color_scheme="dark")
            page=dark.new_page()
            for route in ("doc2table/progress","doc2table/home","ciifr/actions","ciifr/fixtures"):
                def dark_view():
                    load(page,route)
                    g=geometry(page)
                    check(g["documentWidth"]<=width+3,"dark overflow on "+route+" at "+str(width))
                    check(page.evaluate("matchMedia('(prefers-color-scheme:dark)').matches"),
                          "dark theme not active")
                    if width==1440 and route=="doc2table/progress":
                        picture(page,"doc2table-progress-pc-dark")
                    if width==390 and route=="doc2table/progress":
                        picture(page,"doc2table-progress-mobile-dark")
                    return {"dark":True,"documentWidth":g["documentWidth"]}
                run_case("Dark "+str(width)+"px "+route,dark_view)
            dark.close()
        run_case("No uncaught browser JavaScript errors",lambda:check(not errors,"; ".join(errors[:5])))
        report={"checked":"PR-local (not published site)","site":BASE,
                "pass":sum(x["status"]=="PASS" for x in CASES),
                "fail":sum(x["status"]=="FAIL" for x in CASES),
                "checks":CASES,"screenshots":SCREENSHOTS,
                "limits":"Automated geometry/navigation proof; not a human usability study or engineering acceptance."}
        (OUT/"report.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
        print(json.dumps({"pass":report["pass"],"fail":report["fail"],
            "failures":[r for r in CASES if r["status"]=="FAIL"]},indent=2))
        browser.close()
        if report["fail"]:raise SystemExit(1)
if __name__=="__main__":main()
