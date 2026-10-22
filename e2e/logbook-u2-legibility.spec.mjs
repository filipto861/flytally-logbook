import {test,expect} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {ensureDetailsOpen} from "./browser-actions.mjs";

const fixturesEnabled=process.env.FLYTALLY_U2_LEGIBILITY_BROWSER==="1"
  &&process.env.FLYTALLY_AUTH_BROWSER==="1"
  &&process.env.FLYTALLY_LOCAL_POSTGRES==="1"
  &&process.env.VERCEL===undefined&&process.env.VERCEL_ENV===undefined;

const viewports=[
  {name:"desktop",width:1440,height:1100},
  {name:"ipad-landscape",width:1024,height:768,touch:true},
  {name:"ipad-portrait",width:768,height:1024,touch:true},
  {name:"mobile",width:390,height:844,touch:true},
  {name:"mobile-narrow",width:320,height:720,touch:true},
];
const themes=["light","dark"];
const outputDir=path.join(process.cwd(),"test-results","u2-legibility");

function isExactIsolatedDatabase(){
  try{
    const u=new URL(process.env.DATABASE_URL||"");
    return u.protocol==="postgresql:"
      &&u.hostname==="127.0.0.1"
      &&u.port==="5433"
      &&u.username==="flytally_ui_u0_20261021"
      &&u.password.length>0
      &&u.pathname==="/flytally_ui_u0_20261021"
      &&u.search===""&&u.hash==="";
  }catch{return false;}
}

async function login(page){
  await page.goto("/login?returnTo=%2Fprofile",{waitUntil:"domcontentloaded"});
  await page.getByLabel("Email").fill("browser-auth@example.test");
  await page.getByLabel("Password").fill(process.env.FLYTALLY_BROWSER_PASSWORD||"FlyTally-Browser-2026!");
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect.poll(()=>new URL(page.url()).pathname,{timeout:15_000}).toBe("/profile");
}

async function checkLegibility(page,selector,{required=true}={}){
  const readings=await page.locator(selector).evaluateAll(elements=>elements
    .filter(el=>{
      const style=getComputedStyle(el);
      const rect=el.getBoundingClientRect();
      return style.display!=="none"&&style.visibility!=="hidden"&&rect.width>0&&rect.height>0;
    })
    .map(el=>({
      size:Number.parseFloat(getComputedStyle(el).fontSize),
      lineHeight:getComputedStyle(el).lineHeight,
    })));
  if(required)expect(readings.length,`Missing rendered typography sample: ${selector}`).toBeGreaterThan(0);
  for(const reading of readings){
    expect(reading.size,`${selector}: font size ${reading.size}px`).toBeGreaterThanOrEqual(12);
  }
  return {selector,count:readings.length,minPx:readings.length?Math.min(...readings.map(x=>x.size)):null};
}

async function checkRootWidth(page){
  const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
  expect(overflow,"document root overflow must remain absent").toBeLessThanOrEqual(1);
  return overflow;
}

test("Logbook U2 text sizes remain legible in 5 viewport × 2 theme matrix",async({browser},info)=>{
  test.skip(!fixturesEnabled||!isExactIsolatedDatabase(),"U2 requires explicit opt-in and exact verified disposable local DB.");
  test.skip(info.project.name!=="desktop-chromium","U2 self-manages Chromium presentation matrix.");
  test.setTimeout(10*60_000);

  fs.mkdirSync(outputDir,{recursive:true});
  const results=[];
  for(const viewport of viewports){
    for(const theme of themes){
      const context=await browser.newContext({
        viewport:{width:viewport.width,height:viewport.height},
        colorScheme:theme,
        hasTouch:viewport.touch===true,
        isMobile:viewport.touch===true,
      });
      try{
        const page=await context.newPage();
        await login(page);

        const settings={
          page:"settings",viewport:viewport.name,theme,
          styles:[await checkLegibility(page,".u33-settings-workspace .field-hint")],
          overflow:await checkRootWidth(page),
        };
        await page.screenshot({path:path.join(outputDir,`settings__${viewport.name}__${theme}.jpg`),type:"jpeg",quality:80,fullPage:true});
        results.push(settings);

        await page.goto("/flights/new?mode=manual",{waitUntil:"domcontentloaded"});
        // A DOMContentLoaded navigation is not a React hydration barrier. Exercise
        // both real mode handlers and await their aria-pressed state before any
        // controlled select change. This prevents pre-hydration input changes
        // being overwritten when the client finishes attaching React handlers.
        const gpsMode=page.locator(".flight-entry-workspace .entry-choice button",{hasText:"Import GPS track"});
        const manualMode=page.locator(".flight-entry-workspace .entry-choice button",{hasText:"Manual entry"});
        await gpsMode.click();
        await expect(gpsMode).toHaveAttribute("aria-pressed","true",{timeout:10_000});
        await manualMode.click();
        await expect(manualMode).toHaveAttribute("aria-pressed","true",{timeout:10_000});

        const form=page.locator("form.flight-form");
        const registration=form.locator('select[name="registration"]');
        await expect(registration).toBeVisible();
        const available=await registration.locator("option").evaluateAll(opts=>opts.map(o=>o.value).filter(Boolean));
        // Fixture must provide the exact expected aircraft. Do not silently
        // switch to an arbitrary first option with unknown applicability.
        expect(available,"Missing canonical synthetic OK-SP2E aircraft").toContain("OK-SP2E");
        await registration.selectOption("OK-SP2E");
        await expect(registration).toHaveValue("OK-SP2E");
        await expect(form).toHaveAttribute("data-aircraft-category",/^(?!unselected$).+/);
        // Native Flight experience is initially collapsed for SEP. Open
        // it explicitly instead of interpreting a hidden note as a font bug.
        const experience=form.locator("details.entry-section-experience");
        const optionalDetails=form.locator("details.entry-section-optional");
        await expect(experience).toBeVisible();
        await ensureDetailsOpen(experience);
        try{
          await expect(experience.locator(".entry-context-note")).toBeVisible();
        }catch(error){
          // On failure report only synthetic UI state: no tokens, cookies,
          // URLs, user records or request headers are included in diagnostics.
          const state=await page.evaluate(()=>{
            const form=document.querySelector("form.flight-form");
            const choice=form?.querySelector('select[name="registration"]');
            const details=form?.querySelector("details.entry-section-experience");
            return{
              selectedRegistration:choice?.value||"",
              aircraftCategory:form?.getAttribute("data-aircraft-category")||"",
              experienceOpen:details instanceof HTMLDetailsElement?details.open:null,
              noteCount:details?.querySelectorAll(".entry-context-note").length??0,
              manualPressed:document.querySelector(".flight-entry-workspace .entry-choice button:first-child")?.getAttribute("aria-pressed"),
            };
          });
          throw new Error(`U2 ${viewport.name}/${theme}: selected-aircraft context missing after hydration and disclosure. ${JSON.stringify(state)}`,{cause:error});
        }
        await expect(optionalDetails).toBeVisible();
        await ensureDetailsOpen(optionalDetails);
        const flight={
          page:"new-flight",viewport:viewport.name,theme,
          styles:[
            await checkLegibility(page,".flight-entry-workspace .field-hint"),
            await checkLegibility(page,".flight-entry-workspace .entry-context-note"),
            await checkLegibility(page,".flight-entry-workspace .optional-detail-heading small"),
            await checkLegibility(page,".flight-entry-workspace .entry-certification-grid > div > span"),
            await checkLegibility(page,".flight-entry-workspace .entry-certification-grid > div > small",{required:false}),
          ],
          overflow:await checkRootWidth(page),
        };
        await page.screenshot({path:path.join(outputDir,`new-flight__${viewport.name}__${theme}.jpg`),type:"jpeg",quality:80,fullPage:true});
        results.push(flight);
      }finally{
        await context.close();
      }
    }
  }
  fs.writeFileSync(path.join(outputDir,"u2-legibility-metrics.json"),
    JSON.stringify({
      capturedAt:new Date().toISOString(),
      browser:"Chromium viewport/touch emulation, NOT native Safari/iPadOS",
      scope:"Only named disposable local browser test fixture",
      styles:results,
    },null,2));
  expect(results).toHaveLength(20);
});
