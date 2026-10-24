import {test,expect} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {loginBrowserPilot} from "./browser-actions.mjs";

// A separate guarded local wrapper must first prove ownership of an EMPTY PG cluster.
const capture=process.env.FLYTALLY_D1_AUDIT_CAPTURE==="1";
const authenticated=process.env.FLYTALLY_AUTH_BROWSER==="1";
const localPg=process.env.FLYTALLY_LOCAL_POSTGRES==="1";
const viewports=[
  {name:"desktop",width:1440,height:900},
  {name:"ipad-landscape",width:1024,height:768},
  {name:"ipad-portrait",width:768,height:1024},
  {name:"phone",width:390,height:844},
  {name:"small-phone",width:320,height:720},
];
const themes=["light","dark"];
const root=path.join(process.cwd(),"test-results","d1-dashboard-audit");

function sourceSha(){
  return execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
}

async function inspect(page,{viewport,theme,stage}){
  return page.evaluate(({viewport,theme,stage})=>{
    const visible=element=>{
      if(!element)return false;
      const s=getComputedStyle(element),r=element.getBoundingClientRect();
      return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0;
    };
    const rect=element=>{
      if(!element)return null;
      const r=element.getBoundingClientRect();
      return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};
    };
    const style=element=>{
      if(!element)return null;
      const s=getComputedStyle(element);
      return {background:s.backgroundColor,color:s.color,border:s.borderColor,fontSize:s.fontSize,
        lineHeight:s.lineHeight,outline:s.outline,visibility:s.visibility};
    };
    const q=selector=>document.querySelector(selector);
    const move=[...document.querySelectorAll(".dashboard-move-controls button")].filter(visible);
    const offenders=[...document.querySelectorAll(".dashboard-home-layout, .dashboard-editor, .dashboard-editor-row, .dashboard-layout-grid, .dashboard-widget")]
      .filter(visible).filter(el=>el.getBoundingClientRect().right>document.documentElement.clientWidth+1)
      .slice(0,8).map(el=>({tag:el.tagName.toLowerCase(),className:String(el.className).slice(0,100),rect:rect(el)}));
    const editor=q("details.dashboard-editor");
    const hero=q(".dashboard-widget[data-dashboard-widget='total-time'] .hero-metric");
    const rail=q(".dashboard-home-layout > .dashboard-quick-actions-panel");
    const main=q(".dashboard-main-column");
    const widgetIds=[...document.querySelectorAll("[data-dashboard-widget]")]
      .map(el=>el.getAttribute("data-dashboard-widget"));
    return {
      viewport,theme,stage,actualTheme:document.documentElement.dataset.theme||null,
      documentWidth:document.documentElement.clientWidth,
      pageScrollWidth:document.documentElement.scrollWidth,
      overflowPx:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
      offenders,widgets:widgetIds,editorOpen:Boolean(editor?.open),
      layout:{main:rect(main),rail:rect(rail),hero:rect(hero)},
      surfaces:{main:style(main),rail:style(rail),hero:style(hero),editorRow:style(q(".dashboard-editor-row"))},
      editorToggle:{rect:rect(editor?.querySelector("summary")),style:style(editor?.querySelector("summary"))},
      moveTargets:move.map(el=>({label:el.getAttribute("aria-label"),disabled:el.disabled,rect:rect(el),style:style(el)})),
      smallMoveTargets:move.filter(el=>{const r=el.getBoundingClientRect();return r.width<44||r.height<44})
        .map(el=>el.getAttribute("aria-label")),
      recencyPresent:Boolean(q(".dashboard-recency-status")),
      addFlightActionCount:[...document.querySelectorAll('a[href="/flights/new"]')].filter(visible).length,
      savePendingAnnounced:Boolean(q(".dashboard-editor [aria-busy='true']")),
      saveLiveRegionPresent:Boolean(q(".dashboard-editor [role='status'],.dashboard-editor [aria-live]")),
    };
  },{viewport,theme,stage});
}

async function take(page,viewport,theme,stage,metrics){
  await page.evaluate(()=>document.fonts.ready);
  const name="dashboard-"+stage+"__"+viewport.name+"__"+theme;
  await page.screenshot({path:path.join(root,name+".png"),fullPage:true,animations:"disabled"});
  metrics.push(await inspect(page,{viewport,theme,stage}));
}

test("D1-A capture authenticated Dashboard and editor across five viewports and two themes @self-managed-presentation",
  async({browser},testInfo)=>{
    test.skip(!capture,"Opt in with FLYTALLY_D1_AUDIT_CAPTURE=1.");
    test.skip(!authenticated||!localPg,"Requires guarded isolated synthetic browser fixture.");
    test.skip(testInfo.project.name!=="desktop-chromium","Manages its own viewports.");
    const database=process.env.DATABASE_URL||"";
    const parsed=(()=>{try{return new URL(database)}catch{return null}})();
    test.skip(!parsed||parsed.hostname!=="127.0.0.1"||parsed.pathname!=="/flytally_currency_test",
      "Never capture against a remote, production or unknown database.");
    test.setTimeout(8*60*1000);
    fs.mkdirSync(root,{recursive:true});
    const metrics=[];
    for(const viewport of viewports){
      for(const theme of themes){
        const context=await browser.newContext({
          viewport:{width:viewport.width,height:viewport.height},
          colorScheme:theme,
          reducedMotion:"reduce",
        });
        try{
          const page=await context.newPage();
          await loginBrowserPilot(page,"/dashboard");
          await expect(page.getByRole("heading",{name:"At a glance",level:1})).toBeVisible();
          await page.evaluate(value=>{document.documentElement.dataset.theme=value},theme);
          await take(page,viewport,theme,"overview",metrics);
          const editor=page.locator("details.dashboard-editor");
          await expect(editor.locator("summary")).toBeVisible();
          await editor.locator("summary").click();
          await expect(editor).toHaveAttribute("open","");
          await take(page,viewport,theme,"editor-open",metrics);
          const activeMove=editor.locator(".dashboard-move-controls button:not([disabled])").first();
          if(await activeMove.count()){
            await activeMove.focus();
            await expect(activeMove).toBeFocused();
          }
          await editor.getByRole("button",{name:"Instructor",exact:true}).click();
          await take(page,viewport,theme,"preset-unsaved",metrics);
        }finally{
          await context.close();
        }
      }
    }
    const report={
      schemaVersion:1,sourceSha:sourceSha(),capturedAt:new Date().toISOString(),
      fixture:"physically-owned disposable local PG, synthetic browser pilot",
      browser:"Chromium (iPad dimensions are emulation, NOT native Safari)",
      testResult:"CAPTURED_WITH_FINDINGS_POSSIBLE (not a design-quality PASS)",
      screenshotCount:metrics.length,viewports,themes,
      findings:{
        horizontalOverflow:metrics.filter(row=>row.overflowPx>1).map(row=>({viewport:row.viewport.name,theme:row.theme,stage:row.stage,pixels:row.overflowPx,offenders:row.offenders})),
        undersizedMoveControls:metrics.filter(row=>row.smallMoveTargets.length)
          .map(row=>({viewport:row.viewport.name,theme:row.theme,stage:row.stage,targets:row.moveTargets})),
        absentStatusAnnouncements:metrics.filter(row=>row.stage==="editor-open"&&!row.saveLiveRegionPresent)
          .map(row=>({viewport:row.viewport.name,theme:row.theme})),
      },
      metrics,
      notRun:["Native Safari/iPad hardware","VoiceOver","Real pilot data","Save race-condition server delay","Empty-account synthetic fixture"],
    };
    fs.writeFileSync(path.join(root,"dashboard-audit.json"),JSON.stringify(report,null,2));
    expect(metrics).toHaveLength(viewports.length*themes.length*3);
  });
