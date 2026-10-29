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
                    if width==1440 and section=="overview":picture(page,"adhoc-progress-page-overview")
                    if width==390 and section=="tests":picture(page,"adhoc-progress-page-tests-mobile")
                    return {"documentWidth":g["documentWidth"],"section":section}
                run_case(str(width)+"px adhoc/progress-page/"+section,run_adhoc)
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
