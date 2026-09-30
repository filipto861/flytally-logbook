import { test,expect } from "@playwright/test";
import { resetAppearanceFixture,resetConnectionFixture,resetAccountSettingsFixture,resetConnectionManagerFixture,resetIntelligentReviewFormScopeFixture,resetSafetyPilotPicFixture,resetSafetyPilotPicInviteFixture,revokeSafetyPilotPicInviteConnectionFixture } from "./browser-db.mjs";

async function expectNoHorizontalOverflow(page){
  const state=await page.evaluate(()=>{
    const viewport=document.documentElement.clientWidth;
    const overflow=document.documentElement.scrollWidth-viewport;
    const offenders=[...document.querySelectorAll("body *")].map(element=>{
      const rect=element.getBoundingClientRect();
      const style=getComputedStyle(element);
      return{
        tag:element.tagName.toLowerCase(),
        id:element.id||"",
        className:typeof element.className==="string"?element.className.slice(0,140):"",
        left:Math.round(rect.left*10)/10,
        right:Math.round(rect.right*10)/10,
        width:Math.round(rect.width*10)/10,
        scrollWidth:element instanceof HTMLElement?element.scrollWidth:0,
        overflowX:style.overflowX,
      };
    }).filter(item=>item.right>viewport+1||item.left<-1).slice(0,20);
    return{viewport,scrollWidth:document.documentElement.scrollWidth,overflow,offenders};
  });
  expect(state.overflow,JSON.stringify(state,null,2)).toBeLessThanOrEqual(1);
}

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

async function expectAuthenticatedRoute(page,heading){
  await expect(page.getByRole("heading",{name:heading,level:1})).toBeVisible();
  await expectNoHorizontalOverflow(page);
}

async function navigateMain(page,label){
  const toggle=page.getByRole("button",{name:"Open navigation"});
  if(await toggle.isVisible())await toggle.click();
  const link=page.getByRole("link",{name:label,exact:true});
  await expect(link).toBeVisible();
  await link.click();
}

async function loginBrowserPilot(page,returnTo){
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email").fill("browser-auth@example.test");
  await page.getByLabel("Password").fill(process.env.FLYTALLY_BROWSER_PASSWORD||"FlyTally-Browser-2026!");
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page).toHaveURL(new RegExp(`${returnTo}(?:\\?|$)`));
}

async function holdPost(page,pattern){
  let releaseRequest=()=>{};
  let posts=0;
  const gate=new Promise(resolve=>{releaseRequest=resolve});
  const handler=async route=>{
    if(route.request().method()==="POST"){
      posts+=1;
      await gate;
    }
    await route.continue();
  };
  await page.route(pattern,handler);
  return{
    count:()=>posts,
    release:releaseRequest,
    cleanup:()=>page.unroute(pattern,handler),
  };
}

test("authenticated pilot can navigate the core product shell",async({page,context})=>{
  test.skip(!authenticatedBrowser,"Authenticated browser smoke requires the isolated CI database.");
  await loginBrowserPilot(page,"/dashboard");

  await expectAuthenticatedRoute(page,"At a glance");
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
  await expect(page.getByRole("row",{name:/OK-E2E/})).toBeVisible();

  await navigateMain(page,"Settings");
  await expect(page).toHaveURL(/\/profile(?:\?|$)/);
  await expectAuthenticatedRoute(page,"Settings");

  await navigateMain(page,"Connections");
  await expect(page).toHaveURL(/\/connections$/);
  await expectAuthenticatedRoute(page,"Connections");
});

test("GPS import never receives manual intelligent profile warnings",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated intelligent-review browser coverage requires the isolated CI database.");
  resetIntelligentReviewFormScopeFixture();
  await loginBrowserPilot(page,"/flights/new");

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track><when>2026-09-23T15:10:00Z</when><when>2026-09-23T15:11:00Z</when><gx:coord>14.1 50.1 300</gx:coord><gx:coord>14.2 50.2 500</gx:coord></gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"scope-check.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await expect(gpsForm.locator('select[name="registration"]')).toBeVisible();
  await gpsForm.locator('select[name="registration"]').selectOption("OK-HST1");

  await expect(gpsForm.locator('select[name="aircraftClass"]')).toHaveValue("SEP");
  await expect(gpsForm.locator('select[name="evidence"]')).toHaveValue("EASA");
  await expect(gpsForm.locator("[data-intelligent-review]")).toHaveCount(0);
  await expect(page.getByText(/OK-HST1 differs from its usual profile/)).toHaveCount(0);

  await page.getByRole("button",{name:"Manual entry"}).click();
  const manualForm=page.locator("#new-flight-manual-form");
  await expect(manualForm).toBeVisible();
  await manualForm.locator('select[name="registration"]').selectOption("OK-HST1");
  await expect(manualForm.locator('select[name="aircraftClass"]')).toHaveValue("SEP");
  await expect(manualForm.locator('select[name="evidence"]')).toHaveValue("EASA");
  await manualForm.locator('select[name="aircraftClass"]').selectOption("ULL");
  await expect(manualForm.locator('[data-intelligent-review="registration_profile_aircraft_class"]')).toContainText("OK-E2E differs from its usual profile");
  await expectNoHorizontalOverflow(page);
});

test("Safety Pilot Actual PIC form keeps manual and connected identity explicit",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated Safety Pilot PIC browser coverage requires the isolated CI database.");
  resetSafetyPilotPicFixture();
  await loginBrowserPilot(page,"/flights/new");

  await expectAuthenticatedRoute(page,"New flight");
  await page.getByLabel("Role").selectOption("SAFETY PILOT");

  const source=page.locator('select[name="actualPicMode"]');
  await expect(source).toHaveValue("manual");
  await expect(page.locator('input[name="commander"]')).toBeVisible();
  await expect(page.getByText("No invitation is sent when this draft is saved.")).toBeVisible();

  await source.selectOption("connected");
  const connected=page.locator('select[name="connectedPicUserId"]');
  await expect(connected).toBeVisible();
  await expect(connected.getByRole("option",{name:"Browser Friend"})).toHaveCount(1);
  await connected.selectOption("9002");
  await expect(page.locator('input[name="commander"]')).toHaveValue("Browser Friend");

  await source.selectOption("manual");
  const manual=page.locator('input[name="commander"]');
  await manual.fill("Manual Captain");
  await expect(page.locator('input[name="connectedPicUserId"]')).toHaveValue("");

  await page.locator('select[name="registration"]').selectOption("OK-SP2E");
  await page.getByRole("button",{name:"Save & review"}).click();
  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  await expect(page.locator('select[name="registration"]')).toHaveValue("OK-SP2E");
  await expect(page.locator('select[name="role"]')).toHaveValue("SAFETY PILOT");
  await expect(page.locator('input[name="commander"]')).toHaveValue("Manual Captain");

  await page.getByRole("button",{name:"Save changes"}).click();
  await expect(page.getByText("Flight changes saved.")).toBeVisible();
  await expect(page.locator('select[name="registration"]')).toHaveValue("OK-SP2E");
  await expect(page.locator('select[name="role"]')).toHaveValue("SAFETY PILOT");
  await expect(page.locator('input[name="commander"]')).toHaveValue("Manual Captain");
  await expectNoHorizontalOverflow(page);
});

test("certified Safety Pilot can invite only the stored connected Actual PIC",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated Safety Pilot PIC invitation coverage requires the isolated CI database.");
  resetSafetyPilotPicInviteFixture();
  await loginBrowserPilot(page,"/flights/9903");

  const panel=page.locator("section.instructor-approval-panel").filter({hasText:"ACTUAL PIC"});
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading",{name:"Browser Friend"})).toBeVisible();
  await expect(panel.getByRole("button",{name:"Invite Actual PIC"})).toBeVisible();

  await panel.getByRole("button",{name:"Invite Actual PIC"}).click();
  await expect(panel.getByText("PIC invitation · pending")).toBeVisible();
  await expect(panel.getByRole("button",{name:"Cancel PIC invitation"})).toBeVisible();

  await page.reload();
  await expect(panel.getByText("PIC invitation · pending")).toBeVisible();

  await panel.getByRole("button",{name:"Cancel PIC invitation"}).click();
  await expect(panel.getByRole("button",{name:"Invite Actual PIC"})).toBeVisible();

  await panel.getByRole("button",{name:"Invite Actual PIC"}).click();
  await expect(panel.getByText("PIC invitation · pending")).toBeVisible();
  await panel.getByRole("button",{name:"Cancel PIC invitation"}).click();
  await expect(panel.getByRole("button",{name:"Invite Actual PIC"})).toBeVisible();

  revokeSafetyPilotPicInviteConnectionFixture();
  await page.reload();
  await expect(panel.getByText(/no longer an accepted Connection/)).toBeVisible();
  await expect(panel.getByRole("button",{name:"Invite Actual PIC"})).toHaveCount(0);
  await expect(panel.getByRole("link",{name:"Review Connections"})).toBeVisible();
  await expectNoHorizontalOverflow(page);
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

test("appearance mutation disables duplicate submit and persists",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated mutation smoke requires the isolated CI database.");
  resetAppearanceFixture();
  await loginBrowserPilot(page,"/profile");

  const appearance=page.getByLabel("Appearance");
  await appearance.selectOption("dark");
  const gate=await holdPost(page,"**/profile*");
  const save=page.getByRole("button",{name:"Save appearance"});
  const clicking=save.click();

  const pending=page.getByRole("button",{name:"Saving…"});
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy","true");
  await expect(pending).toHaveAttribute("data-loading","true");
  await page.evaluate(()=>document.querySelector(".appearance-form button")?.click());
  await page.waitForTimeout(100);
  expect(gate.count()).toBe(1);

  gate.release();
  await clicking;
  await gate.cleanup();
  await expect(page.getByRole("button",{name:"Save appearance"})).toBeEnabled();

  await page.reload();
  await expect(page.getByLabel("Appearance")).toHaveValue("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
});

test("connection acceptance disables duplicate submit and persists",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated mutation smoke requires the isolated CI database.");
  resetConnectionFixture();
  await loginBrowserPilot(page,"/connections");
  await expect(page.getByRole("heading",{name:"Connection requests"})).toBeVisible();
  await expect(page.getByText("Browser Friend",{exact:true}).first()).toBeVisible();

  const gate=await holdPost(page,"**/connections*");
  const accept=page.getByRole("button",{name:"Accept"});
  const clicking=accept.click();

  const pending=page.getByRole("button",{name:"Accepting…"});
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy","true");
  await expect(pending).toHaveAttribute("data-loading","true");
  await page.evaluate(()=>document.querySelector(".connection-inbox .connection-actions form:first-child button")?.click());
  await page.waitForTimeout(100);
  expect(gate.count()).toBe(1);

  gate.release();
  await clicking;
  await gate.cleanup();

  const connected=page.locator("details.connection-manager").filter({hasText:"Browser Friend"});
  await expect(connected).toBeVisible();
  await page.reload();
  await expect(page.locator("details.connection-manager").filter({hasText:"Browser Friend"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Accept"})).toHaveCount(0);
});


test("account settings transaction disables duplicate submit and persists both records",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated transaction smoke requires the isolated CI database.");
  resetAccountSettingsFixture();
  await loginBrowserPilot(page,"/profile");

  await page.getByLabel("Name").fill("Browser Transaction Pilot");
  await page.getByLabel("Home airport").fill("LKPR");
  await page.getByLabel("Currency").selectOption("EUR");
  await page.getByLabel("Default logbook").selectOption("EASA");

  const gate=await holdPost(page,"**/profile*");
  const save=page.getByRole("button",{name:"Save changes"});
  const clicking=save.click();

  const pending=page.getByRole("button",{name:"Saving…"});
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy","true");
  await expect(pending).toHaveAttribute("data-loading","true");
  await page.evaluate(()=>document.querySelector(".account-settings-form button")?.click());
  await page.waitForTimeout(100);
  expect(gate.count()).toBe(1);

  gate.release();
  await clicking;
  await gate.cleanup();
  await expect(page.getByRole("button",{name:"Save changes"})).toBeEnabled();

  await page.reload();
  await expect(page.getByLabel("Name")).toHaveValue("Browser Transaction Pilot");
  await expect(page.getByLabel("Home airport")).toHaveValue("LKPR");
  await expect(page.getByLabel("Currency")).toHaveValue("EUR");
  await expect(page.getByLabel("Default logbook")).toHaveValue("EASA");
});

test("connection access update disables duplicate submit and persists",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated transaction smoke requires the isolated CI database.");
  resetConnectionManagerFixture();
  await loginBrowserPilot(page,"/connections");

  const manager=page.locator("details.connection-manager").filter({hasText:"Browser Friend"});
  await expect(manager).toBeVisible();
  await manager.locator("summary").first().click();
  await manager.getByLabel("Relationship").selectOption("instructor");
  await manager.getByLabel("Allow read-only logbook view").check();

  const gate=await holdPost(page,"**/connections*");
  const save=manager.getByRole("button",{name:"Save access"});
  const clicking=save.click();

  const pending=manager.getByRole("button",{name:"Saving…"});
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy","true");
  await expect(pending).toHaveAttribute("data-loading","true");
  await page.evaluate(()=>document.querySelector("details.connection-manager[open] .connection-editor form button")?.click());
  await page.waitForTimeout(100);
  expect(gate.count()).toBe(1);

  gate.release();
  await clicking;
  await gate.cleanup();

  await page.reload();
  const persisted=page.locator("details.connection-manager").filter({hasText:"Browser Friend"});
  await expect(persisted).toContainText("Instructor");
  await expect(persisted).toContainText("Can view your logbook");
  await persisted.locator("summary").first().click();
  await expect(persisted.getByLabel("Relationship")).toHaveValue("instructor");
  await expect(persisted.getByLabel("Allow read-only logbook view")).toBeChecked();
});
