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

        await page.goto("/flights/new",{waitUntil:"domcontentloaded"});
        const registration=page.locator('select[name="registration"]');
        await expect(registration).toBeVisible();
        const available=await registration.locator("option").evaluateAll(opts=>opts.map(o=>o.value).filter(Boolean));
        expect(available.length).toBeGreaterThan(0);
        await registration.selectOption(available.includes("OK-SP2E")?"OK-SP2E":available[0]);
        // The context note belongs to the native Flight experience disclosure.
        // The default collapsed state is valid UX, not a typography regression.
        // Expand the real pilot-facing sections before measuring visible copy.
        const experience=page.locator("form.flight-form details.entry-section-experience");
        const optionalDetails=page.locator("form.flight-form details.entry-section-optional");
        await expect(experience).toBeVisible();
        await ensureDetailsOpen(experience);
        await expect(page.locator(".entry-context-note")).toBeVisible();
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
