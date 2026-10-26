import { test,expect } from "@playwright/test";
import { expectAuthenticatedRoute,expectNoHorizontalOverflow,loginBrowserPilot } from "./browser-actions.mjs";

test("login shell is usable without horizontal overflow",async({page})=>{
  await page.goto("/login");
  await expect(page.getByRole("heading",{name:"FlyTally"})).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  const submit=page.getByRole("button",{name:"Sign in"});
  await expect(submit).toBeVisible();
  const box=await submit.boundingBox();
  expect(box?.height??0).toBeGreaterThanOrEqual(40);
  await expectNoHorizontalOverflow(page);
});

test("protected routes redirect unauthenticated browsers to sign in",async({page})=>{
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading",{name:"FlyTally"})).toBeVisible();
});

test("login submission exposes a disabled pending state before the request completes",async({page})=>{
  let releaseRequest=()=>{};
  const requestGate=new Promise(resolve=>{releaseRequest=resolve});
  await page.route("**/login*",async route=>{
    if(route.request().method()==="POST"){
      await requestGate;
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("browser-smoke@example.test");
  await page.getByLabel("Password").fill("not-a-real-password");
  const submit=page.getByRole("button",{name:"Sign in"});
  const clicking=submit.click().catch(()=>undefined);

  const pending=page.getByRole("button",{name:"Signing in…"});
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy","true");
  await expect(pending).toHaveAttribute("data-loading","true");

  releaseRequest();
  await clicking;
});

const authenticatedBrowser=process.env.FLYTALLY_AUTH_BROWSER==="1";

async function navigateMain(page,label){
  const toggle=page.getByRole("button",{name:"Open navigation"});
  if(await toggle.isVisible())await toggle.click();
  const link=page.getByRole("link",{name:label,exact:true});
  await expect(link).toBeVisible();
  await link.click();
}

test("authenticated pilot can navigate the core product shell",async({page,context})=>{
  test.skip(!authenticatedBrowser,"Authenticated browser smoke requires the isolated CI database.");
  await loginBrowserPilot(page,"/dashboard");

  // V11 is the canonical default. Assert its real accessible heading and content
  // before also exercising the intentionally hidden Classic rollback route.
  await expectAuthenticatedRoute(page,"Flight overview.");
  await expect(page.getByRole("region",{name:"Flying summary"})).toBeVisible();
  await expect(page.locator('a.d1v11-recency-primary[href="/credentials"]')).toBeVisible();
  const credentials=page.getByRole("group",{name:"Recorded credentials overview"});
  await expect(credentials).toBeVisible();
  for(const label of ["LICENCES","RATINGS","DOCUMENTS","MEDICAL"]){
    await expect(credentials.getByRole("link",{name:new RegExp(label)})).toBeVisible();
  }
  const passenger=page.getByRole("group",{name:"Passenger recency, recorded flight evidence"});
  await expect(passenger).toBeVisible();
  await expect(passenger.getByRole("link",{name:/PASSENGER RECENCY/})).toHaveAttribute("href","/credentials?view=recency");
  const categoryLinks=credentials.locator("a.d1v11-credential-row");
  await expect(categoryLinks).toHaveCount(4);
  for(const [index,href] of ["/credentials?view=licences","/credentials?view=licences","/credentials?view=documents","/credentials?view=documents"].entries()){
    await expect(categoryLinks.nth(index)).toHaveAttribute("href",href);
  }

  // Real authenticated synthetic fixture: check touch/keyboard affordance and layout
  // at narrow mobile, phone, iPad and desktop sizes. No real pilot records or private screenshots.
  const originalViewport=page.viewportSize();
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    await expectNoHorizontalOverflow(page);
    await expect(categoryLinks).toHaveCount(4);
    await expect(passenger).toBeVisible();
    for(const row of await passenger.locator("a").all()){
      const box=await row.boundingBox();
      expect(box?.height??0).toBeGreaterThanOrEqual(44);
    }
    for(const row of await categoryLinks.all()){
      const size=await row.boundingBox();
      expect(size?.height??0).toBeGreaterThanOrEqual(44);
    }
    // The test fixture uses synthetic pilot records only. Attach the card crop to
    // the local Playwright report for real light/mobile/tablet/desktop visual review.
    await test.info().attach(`v11-credential-card-${width}px`,{
      body:await credentials.screenshot(),
      contentType:"image/png",
    });
    await test.info().attach(`v11-passenger-recency-${width}px`,{
      body:await passenger.screenshot(),contentType:"image/png",
    });
  }
  if(originalViewport)await page.setViewportSize(originalViewport);
  await categoryLinks.first().focus();
  await expect(categoryLinks.first()).toBeFocused();

  await page.goto("/dashboard?view=classic");
  await expectAuthenticatedRoute(page,"At a glance");
  await page.goto("/dashboard");
  await expectAuthenticatedRoute(page,"Flight overview.");

  const mobileToggle=page.getByRole("button",{name:"Open navigation"});
  if(await mobileToggle.isVisible()){
    const toggleBox=await mobileToggle.boundingBox();
    expect(toggleBox?.width??0).toBeGreaterThanOrEqual(44);
    const bellBox=await page.getByRole("link",{name:/^Notifications/}).boundingBox();
    expect(bellBox?.width??0).toBeGreaterThanOrEqual(44);
  }
  const session=(await context.cookies()).find(cookie=>cookie.name==="logbook_session");
  expect(session).toBeTruthy();
  expect(session?.httpOnly).toBeTruthy();

  await navigateMain(page,"Flights");
  await expect(page).toHaveURL(/\/flights$/);
  await expectAuthenticatedRoute(page,"Flights");
  const baselineFlightRow=page.locator("tr.flight-list-row").filter({hasText:"18/09/2026"}).filter({hasText:"OK-E2E"});
  await expect(baselineFlightRow).toHaveCount(1);
  await expect(baselineFlightRow).toBeVisible();
  const countryFlags=baselineFlightRow.locator(".flight-airport-flag");
  await expect(countryFlags).toHaveCount(2);
  for(const flag of await countryFlags.all()){
    await expect(flag).toHaveAttribute("data-country","CZ");
    const background=await flag.evaluate(element=>getComputedStyle(element).backgroundImage);
    expect(background).toContain("/flags/iso-atlas.png");
  }
  const flagSprite=await page.request.get("/flags/iso-atlas.png");
  expect(flagSprite.status()).toBe(200);
  const spritePng=await flagSprite.body();
  expect(spritePng.readUInt32BE(16)).toBe(936);
  expect(spritePng.readUInt32BE(20)).toBe(702);
  // Techlog-facing BLOCK and AIR remain independently labeled at desktop and mobile widths.
  await expect(baselineFlightRow.locator('td[data-label="BLOCK"] .flight-time-ledger')).toHaveCount(1);
  await expect(baselineFlightRow.locator('td[data-label="AIR"] .flight-time-ledger')).toHaveCount(1);
  // Mobile CSS visually hides <thead>; DOM assertions must not require an exposed columnheader role.
  await expect(page.locator(".flights-table thead th").filter({hasText:"BLOCK"})).toHaveCount(1);
  await expect(page.locator(".flights-table thead th").filter({hasText:"AIR"})).toHaveCount(1);

  // This is a viewport/crop acceptance probe, not a claim that the browser or
  // Windows flag glyphs have already been visually verified.
  const originalFlightsViewport=page.viewportSize();
  const blockLedger=baselineFlightRow.locator('td[data-label="BLOCK"] .flight-time-ledger');
  const airLedger=baselineFlightRow.locator('td[data-label="AIR"] .flight-time-ledger');
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    await expectNoHorizontalOverflow(page);
    await expect(blockLedger).toBeVisible();
    await expect(airLedger).toBeVisible();
    for(const ledger of [blockLedger,airLedger]){
      const duration=(await ledger.locator("strong").innerText()).trim();
      const originalClocks=(await ledger.locator("small").innerText()).trim();
      expect(duration).toMatch(/^(?:—|\d+:\d{2})$/);
      if(duration==="—"){
        expect(originalClocks).toMatch(/^(?:Needs review|Not recorded)$/);
      }else{
        expect(originalClocks).toMatch(/^(?:[01]\d|2[0-3]):[0-5]\d–(?:[01]\d|2[0-3]):[0-5]\d$/);
      }
    }
    const blockBox=await blockLedger.boundingBox(),airBox=await airLedger.boundingBox();
    expect(blockBox).not.toBeNull();
    expect(airBox).not.toBeNull();
    expect((blockBox?.x??0)+(blockBox?.width??0)).toBeLessThanOrEqual((airBox?.x??0)+2);
    // Synthetic seeded flight only; never capture private account records.
    await test.info().attach(`flights-techlog-row-${width}px`,{
      body:await baselineFlightRow.screenshot(),contentType:"image/png",
    });
  }
  if(originalFlightsViewport)await page.setViewportSize(originalFlightsViewport);

  await navigateMain(page,"Settings");
  await expect(page).toHaveURL(/\/profile(?:\?|$)/);
  await expectAuthenticatedRoute(page,"Settings");

  await navigateMain(page,"Connections");
  await expect(page).toHaveURL(/\/connections$/);
  await expectAuthenticatedRoute(page,"Connections");
});

test("protected shell shows and clears the offline connection banner",async({page,context})=>{
  test.skip(!authenticatedBrowser,"Authenticated browser smoke requires the isolated CI database.");
  await loginBrowserPilot(page,"/dashboard");

  const banner=page.getByRole("status").filter({hasText:"You're offline. FlyTally needs a connection to load or save logbook data."});
  await expect(banner).toHaveCount(0);

  await context.setOffline(true);
  await expect(banner).toBeVisible();

  await context.setOffline(false);
  await expect(banner).toHaveCount(0);
});
