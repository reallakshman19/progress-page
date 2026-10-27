#!/usr/bin/env python3
"""Live browser acceptance of the deployed Progress Page; never mutates site data.
Runs desktop and mobile Chromium from a clean, anonymous context, and preserves screenshots.
No human/Owner acceptance is inferred by a green automated run.
"""
import json
import os
import re
import time
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("PROGRESS_PAGE_URL","https://reallakshman19.github.io/progress-page/")
EXPECTED_VIEWER_VERSION = re.search(r'app\.js\?v=(\d+)', (Path(__file__).resolve().parents[1]/"index.html").read_text(encoding="utf-8")).group(1)
OUT = Path(os.environ.get("PP_E2E_OUTPUT","e2e-output"))
OUT.mkdir(parents=True,exist_ok=True)
cases=[]
photos=[]
errors=[]
def case(name,fn):
    started=time.monotonic()
    try:
        details=fn() or {}
        cases.append({"step":len(cases)+1,"name":name,"status":"PASS","elapsedSeconds":round(time.monotonic()-started,2),"details":details})
    except Exception as e:
        cases.append({"step":len(cases)+1,"name":name,"status":"FAIL","elapsedSeconds":round(time.monotonic()-started,2),"error":str(e)})
        errors.append(traceback.format_exc()[-7000:])
def check(condition,message):
    if not condition: raise AssertionError(message)
def capture(page,name):
    path=OUT/(name+".png")
    page.screenshot(path=str(path),full_page=True,animations="disabled",timeout=30000)
    photos.append(str(path))
def load(page,route):
    url=BASE.rstrip("/")+"/#/"+route
    page.goto(url,wait_until="domcontentloaded",timeout=65000)
    page.locator(".agent-start").wait_for(timeout=45000)
    return page.locator(".agent-start").inner_text(timeout=25000)
def source_urls(page):
    return page.locator(".agent-start-sources a[href]").evaluate_all("(xs)=>xs.map(x=>x.href)")
def viewport(page):
    return page.evaluate("""() => ({width:window.innerWidth,height:window.innerHeight,
      scroll:document.documentElement.scrollWidth,root:document.querySelector('#root')?.scrollWidth})""")
def main():
    report={"site":BASE,"timeUTC":__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            "mode":"anonymous headless Chromium testing real public GitHub Pages deployment","checks":cases,
            "screenshots":photos,"consoleErrors":errors,"limitations":[
                "Automated browser run is not a human cold-start trial or Owner acceptance.",
                "Desktop and mobile emulation check browser layout, not a physical device.",
                "GitHub source links are displayed by the Page, but engineering claims require independent verification of their scope."]}
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        desktop=browser.new_context(viewport={"width":1440,"height":900},device_scale_factor=1,
                    permissions=["clipboard-read","clipboard-write"])
        page=desktop.new_page()
        js_errors=[]
        page.on("pageerror",lambda error: js_errors.append(str(error)))
        def step1():
            txt=load(page,"ciifr/start/R4/wbs%3A3/M13")
            capture(page,"01-wbs3-agent-start-desktop")
            check("Geometry" in txt or "WBS 3.1" in txt,"G1 title/scope missing")
            check("Owner outcome" in txt,"Owner outcome disclosure not exposed")
            check("Authority and evidence rules" in txt,"authority rules disclosure missing")
            check("CANDIDATE" in txt or "not demonstrated" in txt.lower(),"candidate boundary missing")
            # Cold-start acceptance: exact scope, recorded evidence and permission
            # boundary must be discoverable without an Oracle-written summary.
            check(page.locator(".checkpoint-disclosure").count()==1,
                  "WBS-scoped Agent Start needs a source-backed checkpoint")
            page.locator(".checkpoint-disclosure > summary").click()
            panel=page.locator(".checkpoint-disclosure .checkpoint")
            check("New-agent source checklist" in panel.inner_text(),
                  "New agent lacks a source/return checklist")
            check("OUT_OF_SCOPE" in panel.inner_text() or "UNMAPPED" in panel.inner_text(),
                  "Unbound Cycle may not impersonate a task assignment")
            check("NOT an assignment" in panel.inner_text() or "do not transfer" in panel.inner_text().lower(),
                  "Checkpoint must preserve the native permission boundary")
            urls=source_urls(page)
            check(any("github.com" in u for u in urls),"No authoritative GitHub source links")
            check(all(u.startswith("https://github.com/") for u in urls),"Non-native URL in starting sources")
            check(not js_errors,"JavaScript uncaught errors: "+str(js_errors))
            check("v="+EXPECTED_VIEWER_VERSION in (page.locator('script[type="module"]').get_attribute("src") or ""),"Deployed viewer is not the checked-out source version")
            main_box=page.locator(".agent-start-primary").bounding_box()
            aside_box=page.locator(".agent-start-aside").bounding_box()
            check(main_box and aside_box and aside_box["x"]>main_box["x"]+main_box["width"]-1,
                  "Desktop action and evidence panels are not side-by-side")
            check(main_box["width"]>500,"Desktop action column remains phone-width")
            return {"sourceCount":len(urls),"sourceSamples":urls[:5],"viewport":viewport(page),
                    "taskCards":page.locator(".agent-start-item").count()}
        def choose_workstream():
            txt=load(page,"ciifr/start")
            check(page.locator(".agent-start").get_attribute("data-agent-start-mode")=="choose",
                "Project entry is not an explicit workstream chooser")
            check(page.locator(".agent-start-item").count()==0,
                "Unscoped entry must not show arbitrary unfinished tasks")
            check(page.locator(".agent-start-choice-link").filter(has_text="WBS 3").count()==1,
                "Geometry choice missing")
            check(page.locator(".agent-start-choice-link").filter(has_text="WBS4").count()==1,
                "Element choice missing")
            check(page.locator(".agent-start-choice-link").filter(has_text="WBS 5").count()==1,
                "Mapping choice missing")
            check("25 more" not in txt,"Hidden backlog leak")
            check(page.locator(".agent-start-choice").count()==3,"Exactly three active WBS families should be primary")
            check(page.locator(".agent-start-other a").count()==1,"Legacy milestones should remain reachable but secondary")
            capture(page,"00-workstream-chooser")
            return {"choices":page.locator(".agent-start-choice").count(),"arbitrarilySelectedTasks":0}
        case("Unscoped Agent Start chooses workstream rather than dumping backlog",choose_workstream)
        def focused_m8():
            txt=load(page,"ciifr/start/R4/wbs%3A5/M8")
            check(page.locator(".agent-start-item").count()==6,
                "M8 must show all six recorded items without silent first-three clipping")
            check("Not recorded / unassigned" in txt,"Unassigned actor must not appear as dash")
            check(page.locator(".agent-start-item .agent-start-detail").count()==6,
                "Full evidence must remain available in disclosures")
            check(page.locator(".agent-start-item .agent-start-detail[open]").count()==0,
                "Raw audit prose should be collapsed initially")
            capture(page,"00a-wbs5-m8-scoped")
            return {"scopedRecords":6,"fullyRetainedEvidence":True}
        case("M8 displays scoped action summaries without silently hiding records",focused_m8)
        def one_exact_task():
            load(page,"ciifr/start/R4/wbs%3A4/M18")
            links=page.locator(".agent-start-item .agent-start-task-link")
            check(links.count()>=2,"M18 needs two independently selectable cards")
            first=links.nth(0).get_attribute("href")
            second=links.nth(1).get_attribute("href")
            check(first!=second and "/M18/" in first,"Task URLs must be distinct under one milestone")
            page.goto(BASE.rstrip("/")+"/"+first,wait_until="domcontentloaded",timeout=65000)
            page.locator(".agent-start-brief").wait_for(timeout=30000)
            check(page.locator(".agent-start-brief").count()==1,"Selected task brief missing")
            check(page.locator(".agent-start-item").count()>=2,"Related milestone records lost")
            button=page.get_by_role("button",name="Copy this task")
            button.click()
            packet=page.evaluate("navigator.clipboard.readText()")
            selected=page.locator(".agent-start-selected").get_attribute("class")
            check("Task ID:" in packet and "Full recorded status / surviving limitations:" in packet,
                  "Selected task export loses identity or limitations")
            check("WORK ITEM " not in packet,"A single task export contains milestone bodies")
            check("not an acknowledged assignment" in packet,"Assignment incorrectly implied")
            check(page.locator(".agent-start-packet-preview").first.text_content()==packet,
                  "Preview and clipboard bytes differ")
            check("agent-start-selected" in selected,"Task selection not visible")
            capture(page,"00b-selected-m18-task")
            page.goto(BASE.rstrip("/")+"/#/ciifr/start/R4/wbs%3A4/M18/not-a-task",wait_until="domcontentloaded",timeout=65000)
            page.locator(".agent-start-selection-error").wait_for(timeout=30000)
            check(page.get_by_role("button",name="Copy this task").count()==0,
                  "Invalid task silently selected a different assignment")
            return {"twoDistinctLinks":True,"taskPacketCharacters":len(packet),"invalidTaskFailsClosed":True}
        case("Selected task copies only its own evidence and invalid cards fail visibly",one_exact_task)
        case("Open WBS 3.1 G1 Agent Start directly from a clean browser",step1)
        def step2():
            button=page.get_by_role("button",name="Copy milestone evidence")
            check(button.count()==1,"Copy handoff button not unique")
            button.click()
            page.wait_for_timeout(250)
            copied=page.evaluate("navigator.clipboard.readText()")
            check("AGENT START" in copied,"No handoff copied")
            check("WBS 3.1" in copied,"Incorrect WBS scope in handoff")
            check("verify native evidence" in copied,"Native-source warning missing")
            check("BOUNDARY:" in copied,"Authority boundary absent from copied handoff")
            check("Exact candidate SHA: NOT_RECORDED" in copied,"Missing explicit candidate identity warning")
            check("Sources (open and verify):" in copied,"No source section")
            check("Recorded next action:" in copied,"No next action in copied handoff")
            capture(page,"02-wbs3-copy-handoff")
            (OUT/"handoff-wbs3.txt").write_text(copied,encoding="utf-8")
            return {"chars":len(copied),"nativeSources":copied.count("https://github.com/"),"copyButtonText":button.inner_text()}
        case("Copy and independently read the handoff from the system clipboard",step2)
        def step2b():
            load(page,"ciifr/start/R4/wbs%3A3/M13")
            a=page.locator(".agent-start-gate a[href]").first
            check(a.count()==1,"No starting-source link")
            target=a.get_attribute("href")
            with page.expect_popup(timeout=15000) as opened:
                a.click()
            popup=opened.value
            popup.wait_for_load_state("domcontentloaded",timeout=30000)
            check(popup.url.startswith("https://github.com/"),"Native evidence does not open GitHub")
            check(popup.url.split("#")[0]==target.split("#")[0],"Link opened a different original source")
            url=popup.url
            popup.close()
            return {"opened":url,"source":target}
        case("Click a native source from the live webpage and verify its destination",step2b)
        def step3():
            txt=load(page,"ciifr/start/R4/wbs%3A4/M20")
            capture(page,"03-wbs4-agent-start-desktop")
            check("WBS 4" in txt,"Element WBS4 context missing")
            check("Authority and evidence rules" in txt,"No authority boundary disclosure")
            check(len(source_urls(page))>=1,"WBS4 native source missing")
            return {"taskCards":page.locator(".agent-start-item").count(),"sources":len(source_urls(page))}
        case("Open WBS 4 Element directly without carrying stale G1 context",step3)
        def step4():
            txt=load(page,"ciifr/start/R4/wbs%3A5/M11")
            capture(page,"04-wbs5-agent-start-desktop")
            check("WBS 5.3" in txt or "Authorized mapped transfer" in txt,"Mapped transfer milestone missing")
            check("NOT_DEMONSTRATED" in txt,"Transfer HOLD capability absent")
            check("Authority and evidence rules" in txt,"No authority boundary for transfer")
            check(page.locator(".agent-start-rules summary").count()==1,"No release restriction disclosure")
            return {"taskCards":page.locator(".agent-start-item").count(),"sources":len(source_urls(page))}
        case("Open WBS 5.3 M11 HOLD without false transfer authorization",step4)
        def step5():
            load(page,"ciifr/start")
            check(page.locator(".agent-start").get_attribute("data-agent-start-mode")=="choose","Unscoped Page chose a task")
            check(page.locator(".agent-start-item").count()==0,"Unscoped Page emitted arbitrary tasks")
            g=page.locator(".agent-start-choice-link").filter(has_text="WBS 5 CIIFR-MAP")
            check(g.count()==1,"Workstream choice missing")
            g.click()
            check("wbs%3A5" in page.url or "wbs:5" in page.url,"WBS 5 family route did not update")
            check(page.locator(".agent-start-step").count()==4,"Family must show four steps")
            child=page.locator(".agent-start-step-link").filter(has_text="5.3")
            check(child.count()==1,"WBS 5.3 step link missing")
            child.click()
            check("/M11" in page.url,"WBS 5.3 not deep-linked")
            txt=page.locator(".agent-start").inner_text()
            check("NOT_DEMONSTRATED" in txt,"M11 HOLD disappeared on navigation")
            page.go_back(wait_until="domcontentloaded")
            page.locator(".agent-start").wait_for(timeout=20000)
            check("M11" not in page.url,"Back did not restore family route")
            capture(page,"05-wbs-nav-back")
            return {"afterBackUrl":page.url}
        case("Navigate WBS family and step, then restore route via Back",step5)
        def step6():
            page.goto(BASE.rstrip("/")+"/#/ciifr/progress/R4/wbs%3A3/M12",wait_until="domcontentloaded",timeout=60000)
            page.locator(".body").wait_for(timeout=30000)
            page.wait_for_timeout(700)
            accordion=page.locator("details.onb-accordion")
            capture(page,"06-wbs3-onboarding-real-route")
            if accordion.count():
                check(not accordion.first.evaluate("(e)=>e.open"),"Onboarding expanded without user request")
                accordion.first.locator("summary.onb-summary").click()
                check(accordion.first.evaluate("(e)=>e.open"),"Onboarding disclosure did not expand")
                check(accordion.first.locator(".onb-panel").count()==1,"Expected one embedded onboarding panel")
                check(accordion.first.locator(".card").count()>=1,"Original onboarding card missing")
                capture(page,"07-wbs3-onboarding-expanded")
                return {"accordion":"present and functional","stage":accordion.first.locator(".onb-phase").first.inner_text()}
            raise AssertionError("No onboarding disclosure in the live WBS 3.0 rendered route; verify group/recipient state before treating this as a regression")
        case("G0 onboarding actually appears and expands on the routed Progress page",step6)
        mobile=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=1,is_mobile=True,
                   has_touch=True,permissions=["clipboard-read","clipboard-write"])
        mpage=mobile.new_page()
        def step7():
            txt=load(mpage,"ciifr/start/R4/wbs%3A3/M13")
            capture(mpage,"08-wbs3-agent-start-mobile")
            mb=mpage.locator(".agent-start-primary").bounding_box()
            sb=mpage.locator(".agent-start-aside").bounding_box()
            check(mb and sb and sb["y"] >= mb["y"]+mb["height"]-1,
                  "Mobile evidence sidebar must stack after primary task")
            width=viewport(mpage)
            check(width["scroll"]<=width["width"]+3,"Horizontal page overflow at 390px: "+str(width))
            check(mpage.get_by_role("button",name="Copy milestone evidence").is_visible(),"Copy action inaccessible on mobile")
            check("Authority and evidence rules" in txt,"Mobile hides authority rules")
            return {"viewport":width,"taskCards":mpage.locator(".agent-start-item").count()}
        case("Mobile 390px layout, source visibility and no horizontal overflow",step7)
        def step7b():
            action=mpage.locator(".agent-start-item").first.bounding_box()
            check(bool(action),"No task card for G1")
            check(action["y"] < 750,"Action begins outside first 844px viewport: "+str(action))
            check(mpage.locator(".hintbar").count()==0,"Nonessential private chat setup obscures Agent Start")
            check(mpage.locator(".agent-start-aim summary").count()==1,"Original Owner aim is not independently expandable")
            check("NOT_RECORDED" in mpage.locator(".agent-start-gate").inner_text(),
                  "Missing exact candidate must be explicitly UNKNOWN")
            return {"taskTopPx":round(action["y"]),"viewportHeightPx":844,
                    "candidateIdentity":"NOT_RECORDED","privateChatSetupHidden":True}
        case("Mobile first screen contains the actionable task and explicit missing-candidate warning",step7b)
        def step8():
            mpage.get_by_role("button",name="Copy milestone evidence").click()
            mpage.wait_for_timeout(200)
            copied=mpage.evaluate("navigator.clipboard.readText()")
            check("BOUNDARY:" in copied,"Mobile clipboard omits authority boundary")
            g=mpage.locator(".agent-start-breadcrumb a").filter(has_text="All workstreams")
            check(g.count()==1,"Mobile workstream selector missing")
            g.click()
            check(mpage.locator(".agent-start").get_attribute("data-agent-start-mode")=="choose","Mobile did not return to workstream chooser")
            capture(mpage,"09-mobile-family-navigation")
            return {"handoffChars":len(copied),"wbs5Url":mpage.url}
        case("Mobile handoff copy and family navigation",step8)
        def step9():
            t=load(page,"ciifr/start/R4/wbs%3A3/M13")
            text=page.locator(".agent-start").inner_text()
            links=source_urls(page)
            check("Recorded next:" in text,"Incoming agent cannot locate next action")
            check("Owner outcome" in text,"Incoming agent cannot locate Owner aim disclosure")
            check(len(links)>=1,"Incoming agent has no source to open")
            check("Authority and evidence rules" in text,"Incoming agent has no prohibited-actions warning")
            candidate_unrecorded=("NOT_RECORDED" in text)
            check(candidate_unrecorded,"Unbound exact candidate must be explicitly identified")
            return {"structuralColdStart":"enough displayed categories for orientation","exactCandidateSHAVisible":not candidate_unrecorded,
                    "candidateDisclosure":"NOT_RECORDED",
                    "note":"No human comprehension/time measurement; candidate identity not inferred."}
        case("Synthetic cold-agent read from one deep link, without previous chat",step9)
        report["checks"]=cases
        report["screenshots"]=photos
        report["consoleErrors"]=js_errors
        report["passed"]=sum(c["status"]=="PASS" for c in cases)
        report["failed"]=sum(c["status"]=="FAIL" for c in cases)
        (OUT/"report.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
        (OUT/"tracebacks.txt").write_text("\n\n".join(errors),encoding="utf-8")
        browser.close()
    print(json.dumps({"passed":report["passed"],"failed":report["failed"],"checks":cases},indent=2))
    if report["failed"]:raise SystemExit(1)

if __name__=="__main__":main()
