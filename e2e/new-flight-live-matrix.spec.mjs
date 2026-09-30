import { test,expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { runBrowserSql,resetAppearanceFixture } from "./browser-db.mjs";

const enabled=
  process.env.FLYTALLY_NEW_FLIGHT_MATRIX==="1"||
  process.env.GITHUB_HEAD_REF==="test/new-flight-live-matrix";
const authenticatedBrowser=process.env.FLYTALLY_AUTH_BROWSER==="1";
const outputDir=path.join(process.cwd(),"test-results","new-flight-live-matrix");

const viewports=[
  {name:"desktop",width:1440,height:1100},
  {name:"ipad-landscape",width:1024,height:768},
  {name:"ipad-portrait",width:768,height:1024},
  {name:"mobile",width:390,height:844},
  {name:"mobile-320",width:320,height:720},
  {name:"desktop-200pct-equivalent",width:720,height:550,note:"1440x1100 at 200% CSS viewport equivalent"},
];
const themes=["light","dark"];

const clean=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

async function login(page,returnTo="/flights/new"){
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`,{waitUntil:"domcontentloaded"});
  await page.getByLabel("Email").fill("browser-auth@example.test");
  await page.getByLabel("Password").fill(process.env.FLYTALLY_BROWSER_PASSWORD||"FlyTally-Browser-2026!");
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page).toHaveURL(new RegExp(`${returnTo.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g,"\\\\$&")}(?:\\?|$)`));
}

async function expectNoHorizontalOverflow(page,label){
  const metrics=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth,`${label}: horizontal overflow ${metrics.scrollWidth} > ${metrics.clientWidth}`).toBeLessThanOrEqual(metrics.clientWidth+1);
  return metrics;
}

async function snap(page,label,viewport,theme,records,extra={}){
  await page.waitForTimeout(120);
  const overflow=await expectNoHorizontalOverflow(page,label);
  const name=`${clean(label)}__${viewport.name}__${theme}`;
  await page.screenshot({
    path:path.join(outputDir,`${name}.jpg`),
    fullPage:true,
    type:"jpeg",
    quality:84,
  });
  const summary=await page.evaluate(()=>({
    path:location.pathname+location.search,
    height:document.documentElement.scrollHeight,
    details:[...document.querySelectorAll("form.flight-form details")].map(node=>({
      label:(node.querySelector("summary span")?.textContent||"").trim(),
      summary:(node.querySelector("summary small")?.textContent||"").trim(),
      open:node.open,
    })),
    activeName:document.activeElement?.getAttribute("name")||"",
    activeText:(document.activeElement?.textContent||"").trim(),
  }));
  records.push({label,viewport,theme,overflow,...summary,...extra});
}

async function openOptional(page){
  const details=page.locator("details.entry-section-optional");
  if(!await details.getAttribute("open"))await details.locator("summary").click();
  await expect(details).toHaveAttribute("open","");
  return details;
}

async function setConnectedFixture(accepted){
  runBrowserSql(`
    UPDATE pilot_connections
    SET status='${accepted?"accepted":"pending"}',
        accepted_at=${accepted?"NOW()":"NULL"},
        updated_at=NOW()
    WHERE id=7001;
  `);
}

async function captureNewFlight(page,viewport,theme,records){
  await page.goto("/flights/new",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"Flight details"})).toBeVisible();
  await expect(page.getByText("Required before save.")).toHaveCount(0);
  await snap(page,"blank",viewport,theme,records);

  await page.getByRole("button",{name:"Save & review"}).click();
  await expect(page.getByText("Complete before save")).toBeVisible();
  const aircraftBlocker=page.getByRole("button",{name:"Aircraft",exact:true});
  await expect(aircraftBlocker).toBeVisible();
  await aircraftBlocker.click();
  await expect(page.locator('select[name="registration"]')).toBeFocused();
  await snap(page,"blank-save-attempt-focus",viewport,theme,records);

  await page.locator('select[name="registration"]').selectOption("OK-E2E");
  await page.locator('select[name="role"]').selectOption("PIC");
  await expect(page.locator('select[name="registration"]')).toHaveValue("OK-E2E");
  await snap(page,"valid-aircraft-pic",viewport,theme,records);

  await page.locator('select[name="role"]').selectOption("DUAL");
  await expect(page.locator("details.entry-section-role-context")).toHaveAttribute("open","");
  await snap(page,"dual-required-context",viewport,theme,records);

  await page.locator('select[name="role"]').selectOption("SAFETY PILOT");
  await expect(page.locator("details.entry-section-role-context")).toHaveAttribute("open","");
  await page.locator('select[name="actualPicMode"]').selectOption("manual");
  await page.locator('input[name="commander"]').fill("Manual Captain");
  await snap(page,"safety-pilot-manual",viewport,theme,records);

  await page.locator('select[name="actualPicMode"]').selectOption("connected");
  const connected=page.locator('select[name="connectedPicUserId"]');
  await expect(connected.locator('option[value="9002"]')).toContainText("Browser Friend");
  await connected.selectOption("9002");
  await snap(page,"safety-pilot-connected",viewport,theme,records);

  await page.locator('select[name="role"]').selectOption("SPIC");
  await expect(page.locator('input[name="verificationName"]')).toBeVisible();
  await expect(page.locator('input[name="verificationReference"]')).toBeVisible();
  await snap(page,"spic-supervision",viewport,theme,records);

  await page.locator('select[name="role"]').selectOption("PICUS");
  await expect(page.locator('input[name="verificationName"]')).toBeVisible();
  await snap(page,"picus-supervision",viewport,theme,records);

  await page.locator('select[name="role"]').selectOption("PIC");
  const optional=await openOptional(page);
  await optional.locator('input[name="task"]').fill("Matrix optional task");
  const night=optional.locator('input[name="nightTime"]');
  if(await night.isVisible())await night.fill("0:20");
  const ifr=optional.locator('input[name="ifrTime"]');
  if(await ifr.isVisible())await ifr.fill("0:15");
  const operator=optional.locator('input[name="operatorName"]');
  if(await operator.isVisible())await operator.fill("Matrix Operator");
  const billing=optional.locator('select[name="billingBasis"]');
  if(await billing.isVisible())await billing.selectOption("AIR");
  await optional.locator('textarea[name="note"]').fill("Matrix note");
  await snap(page,"populated-optional-details",viewport,theme,records);

  await page.locator('select[name="registration"]').selectOption("OK-BAD1");
  await expect(page.getByText(/Needs configuration/).first()).toBeVisible();
  await snap(page,"invalid-aircraft-profile",viewport,theme,records);

  const response=await page.goto("/flights/9910?tab=logbook",{waitUntil:"domcontentloaded"});
  expect(response?.status()??200,"populated edit fixture should render").toBeLessThan(500);
  const editOptional=page.locator("details.entry-section-optional");
  await expect(editOptional).toHaveAttribute("open","");
  await expect(editOptional.locator('input[name="task"]')).toHaveValue("Night circuits and instrument practice");
  await expect(editOptional.locator('textarea[name="note"]')).toHaveValue("Deterministic populated optional-details fixture.");
  await snap(page,"populated-edit-flight",viewport,theme,records);
}

test("capture cumulative New Flight authenticated live matrix",async({browser},testInfo)=>{
  test.skip(!enabled,"Dedicated New Flight matrix runs only on its audit branch or explicit opt-in.");
  test.skip(!authenticatedBrowser,"New Flight matrix requires the isolated authenticated browser database.");
  test.skip(testInfo.project.name!=="desktop-chromium","The matrix manages its own viewport contexts.");
  test.setTimeout(14*60*1000);

  fs.mkdirSync(outputDir,{recursive:true});
  resetAppearanceFixture();
  setConnectedFixture(true);
  const records=[];

  try{
    for(const viewport of viewports){
      for(const theme of themes){
        const context=await browser.newContext({
          viewport:{width:viewport.width,height:viewport.height},
          colorScheme:theme,
        });
        const page=await context.newPage();
        await login(page,"/flights/new");
        await captureNewFlight(page,viewport,theme,records);
        await context.close();
      }
    }
  }finally{
    setConnectedFixture(false);
  }

  const report={
    capturedAt:new Date().toISOString(),
    commit:process.env.GITHUB_SHA||"local",
    branch:process.env.GITHUB_HEAD_REF||"local",
    viewports,
    themes,
    screenshots:records.length,
    records,
  };
  fs.writeFileSync(path.join(outputDir,"matrix.json"),JSON.stringify(report,null,2));
  expect(records.length).toBe(viewports.length*themes.length*11);
});
