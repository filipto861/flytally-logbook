import { test,expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const captureEnabled=
  process.env.FLYTALLY_UI_AUDIT_CAPTURE==="1"||
  process.env.GITHUB_HEAD_REF==="docs/ui-ux-simplicity-audit-2026";
const authenticatedBrowser=process.env.FLYTALLY_AUTH_BROWSER==="1";
const outputDir=path.join(process.cwd(),"test-results","ui-audit");

const viewports=[
  {name:"desktop",width:1440,height:1100},
  {name:"ipad-landscape",width:1024,height:768},
  {name:"ipad-portrait",width:768,height:1024},
  {name:"mobile",width:390,height:844},
];
const themes=["light","dark"];

const routes=[
  // Keep this deterministic core matrix on routes fully represented by the
  // isolated browser fixture. Secondary routes remain part of the source audit
  // and can gain screenshot fixtures independently without weakening this gate.
  {name:"dashboard",path:"/dashboard"},
  {name:"flights",path:"/flights"},
  {name:"connections",path:"/connections"},
  {name:"settings",path:"/profile"},
];

function clean(value){
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

async function login(page,returnTo="/dashboard"){
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`,{waitUntil:"domcontentloaded"});
  await page.getByLabel("Email").fill("browser-auth@example.test");
  await page.getByLabel("Password").fill(process.env.FLYTALLY_BROWSER_PASSWORD||"FlyTally-Browser-2026!");
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page).toHaveURL(new RegExp(`${returnTo.replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&")}(?:\\?|$)`));
}

async function measure(page,label,viewport,theme){
  return page.evaluate(({label,viewport,theme})=>{
    const visible=element=>{
      const style=getComputedStyle(element);
      const rect=element.getBoundingClientRect();
      return style.display!=="none"&&style.visibility!=="hidden"&&Number(style.opacity)!==0&&rect.width>0&&rect.height>0;
    };
    const all=selector=>[...document.querySelectorAll(selector)].filter(visible);
    const controls=all("input:not([type=hidden]), select, textarea, button, summary, a[href]");
    const formControls=all("input:not([type=hidden]), select, textarea");
    const labels=all("label");
    const helperTexts=all("small");
    const details=all("details");
    const requiredHints=all(".field-hint").filter(element=>/required/i.test(element.textContent||""));
    const primaryActions=all(".primary-button, button[type=submit]").map(element=>(element.textContent||element.getAttribute("aria-label")||"").trim()).filter(Boolean);
    return{
      label,
      path:location.pathname+location.search,
      viewport,
      theme,
      title:document.title,
      documentHeight:Math.round(document.documentElement.scrollHeight),
      interactiveCount:controls.length,
      formControlCount:formControls.length,
      labelCount:labels.length,
      helperTextCount:helperTexts.length,
      detailsCount:details.length,
      openDetailsCount:details.filter(element=>element.open).length,
      requiredHintCount:requiredHints.length,
      primaryActions,
      h1:(document.querySelector("h1")?.textContent||"").trim(),
    };
  },{label,viewport,theme});
}

async function snap(page,label,viewport,theme,metrics){
  await page.waitForTimeout(180);
  const name=`${clean(label)}__${viewport.name}__${theme}`;
  await page.screenshot({
    path:path.join(outputDir,`${name}.jpg`),
    fullPage:true,
    type:"jpeg",
    quality:82,
  });
  metrics.push(await measure(page,label,viewport,theme));
}

async function selectAuditAircraft(page){
  const registration=page.locator('select[name="registration"]');
  await expect(registration).toBeVisible();
  const values=await registration.locator("option").evaluateAll(options=>options.map(option=>option.value).filter(Boolean));
  const preferred=values.includes("OK-SP2E")?"OK-SP2E":values[0];
  if(preferred)await registration.selectOption(preferred);
}

async function captureNewFlightStates(page,viewport,theme,metrics){
  await page.goto("/flights/new",{waitUntil:"domcontentloaded"});
  await snap(page,"new-flight--blank",viewport,theme,metrics);

  await selectAuditAircraft(page);
  await snap(page,"new-flight--aircraft-selected",viewport,theme,metrics);

  const role=page.locator('select[name="role"]');
  if(await role.isVisible()){
    await role.selectOption("PIC");
    await snap(page,"new-flight--pic",viewport,theme,metrics);

    await role.selectOption("DUAL");
    await snap(page,"new-flight--dual",viewport,theme,metrics);

    await role.selectOption("SAFETY PILOT");
    await snap(page,"new-flight--safety-pilot",viewport,theme,metrics);

    await role.selectOption("PIC");
  }

  const closed=page.locator("form.flight-form details:not([open]) > summary");
  for(let i=0;i<await closed.count();i++){
    const summary=closed.nth(i);
    if(await summary.isVisible())await summary.click().catch(()=>undefined);
  }
  await snap(page,"new-flight--all-disclosures",viewport,theme,metrics);
}

test("capture deterministic UI UX audit screenshots",{annotation:{type:"flytally-na",description:"UI audit capture runs only for the dedicated audit branch or explicit local opt-in."}},async({browser},testInfo)=>{
  test.skip(!captureEnabled,"UI audit capture runs only for the dedicated audit branch or explicit local opt-in.");
  test.skip(!authenticatedBrowser,"Authenticated UI audit capture requires the isolated browser fixture.");
  test.skip(testInfo.project.name!=="desktop-chromium","The audit test manages its own viewport matrix.");
  test.setTimeout(12*60*1000);
  fs.mkdirSync(outputDir,{recursive:true});

  const metrics=[];
  for(const viewport of viewports){
    for(const theme of themes){
      const context=await browser.newContext({
        viewport:{width:viewport.width,height:viewport.height},
        colorScheme:theme,
      });
      const page=await context.newPage();

      await page.goto("/login",{waitUntil:"domcontentloaded"});
      await snap(page,"login",viewport,theme,metrics);

      await login(page,"/dashboard");

      for(const route of routes){
        const response=await page.goto(route.path,{waitUntil:"domcontentloaded"});
        expect(response?.status()??200,`${route.path} should render for the audit fixture`).toBeLessThan(500);
        await snap(page,route.name,viewport,theme,metrics);
      }

      await captureNewFlightStates(page,viewport,theme,metrics);
      await context.close();
    }
  }

  fs.writeFileSync(
    path.join(outputDir,"ui-audit-metrics.json"),
    JSON.stringify({
      capturedAt:new Date().toISOString(),
      commit:process.env.GITHUB_SHA||"local",
      viewports,
      themes,
      screenshots:metrics.length,
      metrics,
    },null,2),
  );
  expect(metrics.length).toBeGreaterThanOrEqual(80);
});
