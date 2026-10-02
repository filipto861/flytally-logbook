import { test,expect } from "@playwright/test";
import { browserSqlScalar,resetAppearanceFixture,resetConnectionFixture,resetAccountSettingsFixture,resetConnectionManagerFixture,resetIntelligentReviewFormScopeFixture,resetGpsNormalizedImportFixture,resetF41CommonRoleCrewFixture,resetF35SnapshotFixture,resetF35QuickAddFixture,resetF35AuthorityFixtures,mutateF35ProfileAfterRender,resetF24VerificationFixture,resetSafetyPilotPicFixture,renameSafetyPilotPicFixture,revokeSafetyPilotPicConnectionFixture,resetSafetyPilotPicInviteFixture,revokeSafetyPilotPicInviteConnectionFixture } from "./browser-db.mjs";

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

test("GPS and Manual keep profile-owned aircraft context out of generic drift editors",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated aircraft-context browser coverage requires the isolated CI database.");
  resetIntelligentReviewFormScopeFixture();
  await loginBrowserPilot(page,"/flights/new");

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track><when>2026-09-23T15:10:00Z</when><when>2026-09-23T15:11:00Z</when><gx:coord>14.1 50.1 300</gx:coord><gx:coord>14.2 50.2 500</gx:coord></gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"scope-check.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await expect(gpsForm.locator('select[name="registration"]')).toBeVisible();
  await gpsForm.locator('select[name="registration"]').selectOption("OK-HST1");

  await expect(gpsForm.locator('input[name="aircraftClass"]')).toHaveValue("SEP");
  await expect(gpsForm.locator('input[name="evidence"]')).toHaveValue("EASA");
  await expect(gpsForm.locator('select[name="aircraftClass"]')).toHaveCount(0);
  await expect(gpsForm.locator('select[name="evidence"]')).toHaveCount(0);
  await expect(gpsForm.locator("[data-aircraft-context-card]")).toContainText("EASA · Aeroplane · Part-FCL · SEP · B23");
  await expect(gpsForm.locator("[data-intelligent-review]")).toHaveCount(0);
  await expect(page.getByText(/OK-HST1 differs from its usual profile/)).toHaveCount(0);

  await page.getByRole("button",{name:"Manual entry"}).click();
  const manualForm=page.locator("#new-flight-manual-form");
  await expect(manualForm).toBeVisible();
  await manualForm.locator('select[name="registration"]').selectOption("OK-HST1");
  await expect(manualForm.locator('input[name="aircraftClass"]')).toHaveValue("SEP");
  await expect(manualForm.locator('input[name="evidence"]')).toHaveValue("EASA");
  await expect(manualForm.locator('select[name="aircraftClass"]')).toHaveCount(0);
  await expect(manualForm.locator('select[name="evidence"]')).toHaveCount(0);
  const context=manualForm.locator("details.aircraft-context-section");
  await expect(context.locator("summary")).toContainText("EASA · Aeroplane · Part-FCL · SEP · B23");
  await context.locator("summary").click();
  await expect(context.locator("[data-aircraft-context-card]")).toContainText("Profile context");
  await expect(manualForm.locator('[data-intelligent-review="registration_profile_aircraft_class"]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});


test("F3.4 Manual compact context exposes only A+ choice and blocks invalid profiles",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F3.4 Manual browser coverage requires the isolated CI database.");
  await loginBrowserPilot(page,"/flights/new");

  const form=page.locator("#new-flight-manual-form");
  await form.locator('select[name="registration"]').selectOption("OK-TMG1");
  await expect(form.locator('input[name="aircraftClass"]')).toHaveValue("TMG");
  await expect(form.locator('input[name="evidence"]')).toHaveValue("EASA");
  await expect(form.locator('select[name="aircraftClass"]')).toHaveCount(0);
  await expect(form.locator('select[name="evidence"]')).toHaveCount(0);

  const details=form.locator("details.aircraft-context-section");
  await expect(details.locator("summary")).toContainText("EASA · Aeroplane · Part-FCL · TMG");
  await details.locator("summary").click();
  const regulatory=details.locator('select[name="regulatoryCategory"]');
  await expect(regulatory).toBeVisible();
  await expect(regulatory.locator("option")).toHaveCount(2);
  await expect(regulatory).toHaveValue("AEROPLANE");
  await regulatory.selectOption("SAILPLANE");
  await expect(regulatory).toHaveValue("SAILPLANE");
  await expect(details.locator("[data-aircraft-context-card]")).toContainText("Sailplane · Part-SFCL");

  await form.locator('select[name="registration"]').selectOption("OK-ULL1");
  await expect(details.locator("summary")).toContainText("ULL · UL");
  await expect(details.locator('select[name="regulatoryCategory"]')).toHaveCount(0);
  await details.locator("summary").click();
  await expect(details).not.toHaveAttribute("open","");

  await form.locator('select[name="registration"]').selectOption("OK-BAD1");
  await expect(details).toHaveAttribute("open","");
  await expect(details.locator("[data-aircraft-context-card]")).toContainText("Needs configuration");
  await expect(form.getByRole("button",{name:"Aircraft profile"})).toBeVisible();
  const configLink=details.getByRole("link",{name:/Open Aircraft/});
  await expect(configLink).toHaveAttribute("target","_blank");
  await expectNoHorizontalOverflow(page);
});


test("F3.5 same-registration SNAPSHOT survives invalid current profile and rejects crafted drift",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F3.5 SNAPSHOT coverage requires the isolated browser database.");
  resetF35SnapshotFixture();
  await loginBrowserPilot(page,"/flights/9920");
  await page.getByRole("tab",{name:"Logbook data"}).click();

  const form=page.locator("form.flight-form");
  const context=form.locator("details.aircraft-context-section");
  await expect(context.locator("summary")).toContainText("EASA · Aeroplane · Part-FCL · SEP · B23");
  await context.locator("summary").click();
  await expect(context.locator("[data-aircraft-context-card]")).toContainText("Stored flight context");
  await expect(context).toContainText("Current aircraft-profile changes are not applied to this edit.");

  await form.locator('select[name="registration"]').selectOption("OK-E2E");
  await expect(form.locator('input[name="aircraftClass"]')).toHaveValue("SEP");
  await form.locator('select[name="registration"]').selectOption("OK-F35S");
  await expect(context.locator("[data-aircraft-context-card]")).toContainText("Stored flight context");

  await form.getByRole("button",{name:"Save changes"}).click();
  await expect(form.getByText("Flight changes saved.")).toBeVisible();
  expect(browserSqlScalar("SELECT evidence||'|'||aircraft_class||'|'||regulatory_category||'|'||aircraft_type FROM flights WHERE id=9920")).toBe("EASA|SEP|AEROPLANE|B23");

  await form.locator('input[name="aircraftClass"]').evaluate(input=>{input.value="MEP";input.setAttribute("value","MEP")});
  await form.getByRole("button",{name:"Save changes"}).click();
  await expect(form.getByRole("alert")).toContainText("This edit changes the stored aircraft context.");
  expect(browserSqlScalar("SELECT aircraft_class FROM flights WHERE id=9920")).toBe("SEP");

  await page.goto("/flights/9921");
  await page.getByRole("tab",{name:"Logbook data"}).click();
  const legacy=page.locator("form.flight-form");
  const legacyContext=legacy.locator("details.aircraft-context-section");
  await legacyContext.locator("summary").click();
  await expect(legacyContext).toContainText("This legacy record has no stored regulatory-category value");
  await legacy.getByRole("button",{name:"Save changes"}).click();
  await expect(legacy.getByText("Flight changes saved.")).toBeVisible();
  expect(browserSqlScalar("SELECT COALESCE(regulatory_category,'<NULL>') FROM flights WHERE id=9921")).toBe("");
  await expectNoHorizontalOverflow(page);
});

test("F3.5 PROFILE authority re-resolves on submit and persists only allowed TMG context",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F3.5 PROFILE coverage requires the isolated browser database.");
  resetF35AuthorityFixtures();
  await loginBrowserPilot(page,"/flights/new");

  let form=page.locator("#new-flight-manual-form");
  await form.locator('input[name="date"]').fill("2026-10-02");
  await form.locator('select[name="registration"]').selectOption("OK-E2E");
  await expect(form.locator('input[name="aircraftClass"]')).toHaveValue("SEP");

  mutateF35ProfileAfterRender();
  await form.getByRole("button",{name:"Save & review"}).click();
  await expect(form.getByRole("alert")).toContainText("Aircraft profile changed or this flight context is no longer available.");
  expect(Number(browserSqlScalar("SELECT COUNT(*) FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-02'"))).toBe(0);

  resetF35AuthorityFixtures();
  await page.reload();
  form=page.locator("#new-flight-manual-form");
  await form.locator('input[name="date"]').fill("2026-10-02");
  await form.locator('select[name="registration"]').selectOption("OK-TMG1");
  const context=form.locator("details.aircraft-context-section");
  await context.locator("summary").click();
  await context.locator('select[name="regulatoryCategory"]').selectOption("SAILPLANE");
  await form.locator('select[name="operationType"]').selectOption("SP");
  await form.locator('select[name="engineType"]').selectOption("SE");
  await form.getByRole("button",{name:"Save & review"}).click();
  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  expect(browserSqlScalar("SELECT evidence||'|'||aircraft_class||'|'||regulatory_category FROM flights WHERE user_id=9001 AND registration='OK-TMG1' AND date='2026-10-02' ORDER BY id DESC LIMIT 1")).toBe("EASA|TMG|SAILPLANE");
});

test("F3.5 OTHER and Balloon keep profile-owned context separate from flight-specific choices",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F3.5 multi-context coverage requires the isolated browser database.");
  resetF35AuthorityFixtures();
  await loginBrowserPilot(page,"/flights/new");

  let form=page.locator("#new-flight-manual-form");
  await form.locator('input[name="date"]').fill("2026-10-02");
  await form.locator('select[name="registration"]').selectOption("OK-F35O");
  let context=form.locator("details.aircraft-context-section");
  await context.locator("summary").click();
  await context.locator('select[name="regulatoryCategory"]').selectOption("AEROPLANE");
  await form.locator('select[name="operationType"]').selectOption("SP");
  await form.locator('select[name="engineType"]').selectOption("SE");
  await form.evaluate(form=>{form.querySelectorAll('[name="aircraftType"]').forEach(node=>node.remove());const crafted=document.createElement("input");crafted.type="hidden";crafted.name="aircraftType";crafted.value="B23";form.appendChild(crafted)});
  await form.getByRole("button",{name:"Save & review"}).click();
  await expect(form.getByRole("alert")).toContainText("Aircraft profile changed or this flight context is no longer available.");
  expect(Number(browserSqlScalar("SELECT COUNT(*) FROM flights WHERE user_id=9001 AND registration='OK-F35O' AND date='2026-10-02'"))).toBe(0);

  await form.evaluate(form=>{form.querySelectorAll('[name="aircraftType"]').forEach(node=>node.remove());const canonical=document.createElement("input");canonical.type="hidden";canonical.name="aircraftType";canonical.value="OTHER";form.appendChild(canonical)});
  await form.getByRole("button",{name:"Save & review"}).click();
  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  expect(browserSqlScalar("SELECT evidence||'|'||aircraft_class||'|'||regulatory_category FROM flights WHERE user_id=9001 AND registration='OK-F35O' AND date='2026-10-02' ORDER BY id DESC LIMIT 1")).toBe("EASA|OTHER|AEROPLANE");

  await page.goto("/flights/new");
  form=page.locator("#new-flight-manual-form");
  await form.locator('input[name="date"]').fill("2026-10-02");
  await form.locator('select[name="registration"]').selectOption("OK-F35B");
  context=form.locator("details.aircraft-context-section");
  await expect(form.locator('input[name="balloonClass"]')).toHaveValue("HOT_AIR_BALLOON");
  await expect(form.locator('input[name="balloonGroup"]')).toHaveValue("A");
  await form.locator('select[name="balloonOperation"]').selectOption("FREE");
  await form.evaluate(form=>{form.querySelectorAll('[name="balloonGroup"]').forEach(node=>node.remove());const crafted=document.createElement("input");crafted.type="hidden";crafted.name="balloonGroup";crafted.value="B";form.appendChild(crafted)});
  await form.getByRole("button",{name:"Save & review"}).click();
  await expect(form.getByRole("alert")).toContainText("Aircraft profile changed or this flight context is no longer available.");
  expect(Number(browserSqlScalar("SELECT COUNT(*) FROM flights WHERE user_id=9001 AND registration='OK-F35B' AND date='2026-10-02'"))).toBe(0);

  await form.evaluate(form=>{form.querySelectorAll('[name="balloonGroup"]').forEach(node=>node.remove());const canonical=document.createElement("input");canonical.type="hidden";canonical.name="balloonGroup";canonical.value="A";form.appendChild(canonical)});
  await form.getByRole("button",{name:"Save & review"}).click();
  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  expect(browserSqlScalar("SELECT aircraft_class||'|'||regulatory_category||'|'||balloon_class||'|'||balloon_group||'|'||balloon_operation FROM flights WHERE user_id=9001 AND registration='OK-F35B' AND date='2026-10-02' ORDER BY id DESC LIMIT 1")).toBe("BALLOON|BALLOON|HOT_AIR_BALLOON|A|FREE");
});

test("F3.5 Quick Add refreshes aircraft authority before immediate flight Save",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F3.5 Quick Add coverage requires the isolated browser database.");
  resetF35QuickAddFixture();
  await loginBrowserPilot(page,"/flights/new");

  await page.getByRole("button",{name:"Add aircraft"}).click();
  const quick=page.locator("form.quick-aircraft-form");
  await quick.locator('input[name="registration"]').fill("OK-F35Q");
  await quick.locator('input[name="aircraft_model"]').fill("F35 Quick");
  await quick.getByRole("button",{name:"Add aircraft"}).click();
  await expect(page.getByRole("status")).toContainText("Aircraft added. Select it below to continue with the flight.");

  const form=page.locator("#new-flight-manual-form");
  const registration=form.locator('select[name="registration"]');
  await expect(registration.locator('option[value="OK-F35Q"]')).toHaveCount(1);
  await registration.selectOption("OK-F35Q");
  await form.locator('input[name="date"]').fill("2026-10-02");
  await expect(form.locator('input[name="evidence"]')).toHaveValue("ULL");
  await expect(form.locator('input[name="aircraftClass"]')).toHaveValue("ULL");
  await form.getByRole("button",{name:"Save & review"}).click();
  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  expect(browserSqlScalar("SELECT evidence||'|'||aircraft_class||'|'||regulatory_category||'|'||aircraft_type FROM flights WHERE user_id=9001 AND registration='OK-F35Q' AND date='2026-10-02' ORDER BY id DESC LIMIT 1")).toBe("ULL|ULL|ULL|F35 Quick");
});

test("GPS import fails closed for invalid profile context and exposes only F4.1 PIC/DUAL roles",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated GPS integrity browser coverage requires the isolated CI database.");
  await loginBrowserPilot(page,"/flights/new");

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track><when>2026-09-24T12:10:00Z</when><when>2026-09-24T12:11:00Z</when><gx:coord>14.1 50.1 300</gx:coord><gx:coord>14.2 50.2 500</gx:coord></gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"f01-profile-check.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});

  const registration=gpsForm.locator('select[name="registration"]');
  await registration.selectOption("OK-E2E");
  await expect(gpsForm.locator('input[name="aircraftClass"]')).toHaveValue("SEP");
  await expect(gpsForm.locator('input[name="evidence"]')).toHaveValue("EASA");
  await expect(gpsForm.locator("[data-aircraft-context-card]")).toContainText("EASA · Aeroplane · Part-FCL · SEP · B23");
  await expect(gpsForm.locator('select[name="role"] option')).toHaveCount(2);
  await expect(gpsForm.locator('select[name="role"] option')).toHaveText(["PIC","DUAL"]);
  await expect(gpsForm.locator('select[name="role"]')).toHaveValue("PIC");
  await expect(gpsForm.locator('select[name="operationType"]')).toBeVisible();
  await expect(gpsForm.locator('select[name="engineType"]')).toBeVisible();
  await expect(gpsForm.locator('select[name="operationType"]')).toHaveValue("");
  await expect(gpsForm.locator('select[name="engineType"]')).toHaveValue("");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");
  await expect(gpsForm.locator('select[name="operationType"]')).toHaveValue("SP");
  await expect(gpsForm.locator('select[name="engineType"]')).toHaveValue("SE");
  const reviewed=gpsForm.locator('input[name="part_0_reviewed"]');
  await expect(reviewed).toBeDisabled();
  await gpsForm.locator('input[name="part_0_landingsDay"]').fill("1");
  await gpsForm.locator('input[name="part_0_landingsNight"]').fill("0");
  await gpsForm.locator('select[name="part_0_movementEvidenceRecorded"]').selectOption("no");
  await expect(reviewed).toBeEnabled();

  await registration.selectOption("OK-TMG1");
  await expect(gpsForm.locator('input[name="aircraftClass"]')).toHaveValue("TMG");
  await expect(gpsForm.locator('input[name="evidence"]')).toHaveValue("EASA");
  const regulatory=gpsForm.locator('select[name="regulatoryCategory"]');
  await expect(regulatory).toBeVisible();
  await expect(regulatory.locator("option")).toHaveCount(2);
  await expect(regulatory).toHaveValue("AEROPLANE");
  await regulatory.selectOption("SAILPLANE");
  await expect(regulatory).toHaveValue("SAILPLANE");
  await expect(gpsForm.locator("[data-aircraft-context-card]")).toContainText("Sailplane · Part-SFCL");

  await registration.selectOption("OK-ULL1");
  await expect(gpsForm.locator('input[name="aircraftClass"]')).toHaveValue("ULL");
  await expect(gpsForm.locator('input[name="evidence"]')).toHaveValue("ULL");
  await expect(gpsForm.locator("[data-aircraft-context-card]")).toContainText("ULL · UL");
  await expect(gpsForm.locator('select[name="operationType"]')).toHaveValue("");
  await expect(gpsForm.locator('select[name="engineType"]')).toHaveValue("");

  await registration.selectOption("OK-BAD1");
  await expect(gpsForm.locator('input[name="aircraftClass"]')).toHaveValue("");
  await expect(gpsForm.locator('input[name="evidence"]')).toHaveValue("");
  const invalidContext=gpsForm.locator("[data-aircraft-context-card]");
  await expect(invalidContext).toContainText("Needs configuration");
  const configLink=invalidContext.getByRole("link",{name:/Open Aircraft/});
  await expect(configLink).toHaveAttribute("target","_blank");
  await expectNoHorizontalOverflow(page);
});

test("GPS reviewed PIC save persists normalized shared semantics",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated GPS normalized persistence coverage requires the isolated CI database.");
  resetGpsNormalizedImportFixture();
  await loginBrowserPilot(page,"/flights/new");

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track><when>2026-10-01T18:00:00Z</when><when>2026-10-01T18:01:00Z</when><when>2026-10-01T18:02:00Z</when><when>2026-10-01T18:03:00Z</when><when>2026-10-01T18:04:00Z</when><when>2026-10-01T18:05:00Z</when><gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 450</gx:coord><gx:coord>14.18 50.16 800</gx:coord><gx:coord>14.24 50.20 850</gx:coord><gx:coord>14.29 50.24 500</gx:coord><gx:coord>14.31 50.26 300</gx:coord></gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"f14-normalized-save.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");

  await gpsForm.locator('input[name="part_0_date"]').fill("2026-10-01");
  await gpsForm.locator('input[name="part_0_offBlock"]').fill("18:00");
  await gpsForm.locator('input[name="part_0_takeoff"]').fill("18:01");
  await gpsForm.locator('input[name="part_0_landing"]').fill("18:04");
  await gpsForm.locator('input[name="part_0_onBlock"]').fill("18:05");
  const starts=gpsForm.locator('input[name="part_0_starts"]');
  const total=(await starts.inputValue())||"1";
  await starts.fill(total);
  await gpsForm.locator('input[name="part_0_landingsDay"]').fill(total);
  await gpsForm.locator('input[name="part_0_landingsNight"]').fill("0");
  await gpsForm.locator('select[name="part_0_movementEvidenceRecorded"]').selectOption("no");
  await gpsForm.locator('textarea[name="part_0_note"]').fill("F1.4 normalized GPS save");

  const reviewed=gpsForm.locator('input[name="part_0_reviewed"]');
  await expect(reviewed).toBeEnabled();
  await reviewed.check();
  await expect(gpsForm.getByRole("button",{name:"Save reviewed flights"})).toBeEnabled();
  await gpsForm.getByRole("button",{name:"Save reviewed flights"}).click();

  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  await expect(page.locator('select[name="registration"]')).toHaveValue("OK-E2E");
  await expect(page.locator('input[name="evidence"]')).toHaveValue("EASA");
  await expect(page.locator('input[name="aircraftClass"]')).toHaveValue("SEP");
  const storedContext=page.locator("details.aircraft-context-section");
  await expect(storedContext.locator("summary")).toContainText("EASA · Aeroplane · Part-FCL · SEP · B23");
  await storedContext.locator("summary").click();
  await expect(storedContext.locator("[data-aircraft-context-card]")).toContainText("Stored flight context");
  await expect(page.locator('select[name="role"]')).toHaveValue("PIC");
  await expect(page.locator('select[name="operationType"]')).toHaveValue("SP");
  await expect(page.locator('select[name="engineType"]')).toHaveValue("SE");
  await expect(page.locator('input[name="landingsDay"]')).toHaveValue(total);
  await expect(page.locator('input[name="landingsNight"]')).toHaveValue("0");
  await expect(page.locator('input[name="movementEvidenceRecorded"]')).not.toBeChecked();
  await expect(page.locator('textarea[name="note"]')).toContainText("F1.4 normalized GPS save");
  await expectNoHorizontalOverflow(page);
  resetGpsNormalizedImportFixture();
});

test("F4.1 common DUAL invalidates inherited review and persists normalized RoleCrew",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F4.1 common RoleCrew coverage requires the isolated browser database.");
  resetF41CommonRoleCrewFixture();
  await loginBrowserPilot(page,"/flights/new");

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track><when>2026-10-02T19:00:00Z</when><when>2026-10-02T19:01:00Z</when><when>2026-10-02T19:02:00Z</when><when>2026-10-02T19:03:00Z</when><when>2026-10-02T19:04:00Z</when><when>2026-10-02T19:05:00Z</when><gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 450</gx:coord><gx:coord>14.18 50.16 800</gx:coord><gx:coord>14.24 50.20 850</gx:coord><gx:coord>14.29 50.24 500</gx:coord><gx:coord>14.31 50.26 300</gx:coord></gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"f41-common-dual.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");

  await gpsForm.locator('input[name="part_0_date"]').fill("2026-10-02");
  await gpsForm.locator('input[name="part_0_offBlock"]').fill("19:00");
  await gpsForm.locator('input[name="part_0_takeoff"]').fill("19:01");
  await gpsForm.locator('input[name="part_0_landing"]').fill("19:04");
  await gpsForm.locator('input[name="part_0_onBlock"]').fill("19:05");
  const starts=gpsForm.locator('input[name="part_0_starts"]');
  const total=(await starts.inputValue())||"1";
  await starts.fill(total);
  await gpsForm.locator('input[name="part_0_landingsDay"]').fill(total);
  await gpsForm.locator('input[name="part_0_landingsNight"]').fill("0");
  await gpsForm.locator('select[name="part_0_movementEvidenceRecorded"]').selectOption("no");
  await gpsForm.locator('textarea[name="part_0_note"]').fill("F4.1 common DUAL browser proof");

  const reviewed=gpsForm.locator('input[name="part_0_reviewed"]');
  await expect(reviewed).toBeEnabled();
  await reviewed.check();

  const role=gpsForm.locator('select[name="role"]');
  await role.selectOption("DUAL");
  await expect(reviewed).not.toBeChecked();
  const instructor=gpsForm.locator('input[name="instructor"]');
  await expect(instructor).toBeVisible();
  await expect(instructor).toHaveAttribute("required","");
  await expect(gpsForm.getByRole("button",{name:"Save reviewed flights"})).toHaveCount(0);
  await expect(gpsForm.getByRole("button",{name:"Review imported flights"})).toBeVisible();
  await instructor.fill("Browser Training Instructor");
  await reviewed.check();
  await expect(gpsForm.getByText("Common Role/Crew")).toContainText("DUAL · Browser Training Instructor");
  await expect(gpsForm.getByRole("button",{name:"Save reviewed flights"})).toBeEnabled();
  await gpsForm.getByRole("button",{name:"Save reviewed flights"}).click();

  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  await expect(page.locator('select[name="role"]')).toHaveValue("DUAL");
  await expect(page.locator('input[name="instructor"]')).toHaveValue("Browser Training Instructor");
  expect(browserSqlScalar("SELECT role||'|'||instructor||'|'||COALESCE(commander,'')||'|'||COALESCE(verification_name,'')||'|'||COALESCE(verification_reference,'') FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-02' AND off_block='19:00' ORDER BY id DESC LIMIT 1")).toBe("DUAL|Browser Training Instructor|||");
  await expectNoHorizontalOverflow(page);
  resetF41CommonRoleCrewFixture();
});

test("F2.2 Manual RoleCrew identity is inline and survives unsaved role switches",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F2.2 RoleCrew browser coverage requires the isolated CI database.");
  await loginBrowserPilot(page,"/flights/new");

  const form=page.locator("#new-flight-manual-form");
  await form.locator('select[name="registration"]').selectOption("OK-SP2E");
  await expect(form.locator('input[name="evidence"]')).toHaveValue("EASA");

  const role=form.locator('select[name="role"]');
  await role.selectOption("DUAL");
  const dualInstructor=form.locator('.role-crew-inline-grid input[name="instructor"]');
  await expect(dualInstructor).toBeVisible();
  await expect(dualInstructor).toHaveAttribute("required","");
  await dualInstructor.fill("Inline Instructor");

  await role.selectOption("PIC");
  await expect(form.locator(".role-crew-inline-grid")).toHaveCount(0);
  await role.selectOption("DUAL");
  await expect(form.locator('.role-crew-inline-grid input[name="instructor"]')).toHaveValue("Inline Instructor");

  await role.selectOption("SPIC");
  const supervisor=form.locator('.role-crew-inline-grid input[name="verificationName"]');
  const countersign=form.locator('.role-crew-inline-grid input[name="verificationReference"]');
  await expect(supervisor).toBeVisible();
  await expect(countersign).toBeVisible();
  await expect(supervisor).toHaveAttribute("required","");
  await expect(countersign).toHaveAttribute("required","");
  await supervisor.fill("Supervising PIC");
  await countersign.fill("Signed ref F22");

  await role.selectOption("PIC");
  await role.selectOption("SPIC");
  await expect(form.locator('.role-crew-inline-grid input[name="verificationName"]')).toHaveValue("Supervising PIC");
  await expect(form.locator('.role-crew-inline-grid input[name="verificationReference"]')).toHaveValue("Signed ref F22");
  await expectNoHorizontalOverflow(page);
});

test("F2.4C certified verifier evidence stays unbound and exposes both explicit verification paths",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F2.4C verification coverage requires the isolated CI database.");
  resetF24VerificationFixture();
  await loginBrowserPilot(page,"/flights/9904");

  await expect(page.getByLabel("Overview").getByRole("heading",{name:"Certified revision 1"})).toBeVisible();
  expect(Number(browserSqlScalar("SELECT COUNT(*) FROM flight_participations WHERE source_flight_id=9904 AND source_user_id=9001 AND participant_role='INSTRUCTOR' AND status='pending'"))).toBe(0);

  const panel=page.locator("section.instructor-approval-panel").filter({hasText:"CREW VERIFICATION"});
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/Choose a connected FlyTally instructor to send a verification request/)).toBeVisible();
  await expect(panel.getByRole("button",{name:"Request approval from Browser Instructor"})).toBeVisible();
  await expect(panel.getByRole("link",{name:"Instructor without FlyTally · Sign on this device"})).toHaveAttribute("href","/flights/9904/in-person-signature");
  expect(Number(browserSqlScalar("SELECT COUNT(*) FROM flight_participations WHERE source_flight_id=9904 AND source_user_id=9001 AND participant_user_id=9002 AND participant_role='INSTRUCTOR' AND status='pending'"))).toBe(0);
  await expectNoHorizontalOverflow(page);
});

test("F2.5 RoleCrew presentation stays usable on desktop iPad and mobile in light and dark",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F2.5 responsive RoleCrew coverage requires the isolated CI database.");
  resetSafetyPilotPicFixture();
  await loginBrowserPilot(page,"/flights/new");

  const form=page.locator("#new-flight-manual-form");
  await form.locator('select[name="registration"]').selectOption("OK-SP2E");
  await expect(form.locator('input[name="evidence"]')).toHaveValue("EASA");
  const aircraftContext=form.locator("details.aircraft-context-section");
  await expect(aircraftContext.locator("summary")).toContainText("EASA · Aeroplane · Part-FCL · SEP · B23");
  await aircraftContext.locator("summary").click();
  await expect(aircraftContext.locator("[data-aircraft-context-card]")).toContainText("Profile context");
  const role=form.locator('select[name="role"]');

  const assertRoleState=async(value)=>{
    await role.selectOption(value);
    if(value==="PIC"){
      await expect(form.locator(".role-crew-inline-grid")).toHaveCount(0);
    }else if(value==="DUAL"){
      const instructor=form.locator('.role-crew-inline-grid input[name="instructor"]');
      await expect(instructor).toBeVisible();
      await expect(instructor).toHaveAttribute("required","");
      await expect(form.locator("details.entry-section-role-context")).toHaveCount(0);
    }else if(value==="SPIC"||value==="PICUS"){
      await expect(form.locator('.role-crew-inline-grid input[name="verificationName"]')).toBeVisible();
      await expect(form.locator('.role-crew-inline-grid input[name="verificationName"]')).toHaveAttribute("required","");
      await expect(form.locator('.role-crew-inline-grid input[name="verificationReference"]')).toBeVisible();
      await expect(form.locator('.role-crew-inline-grid input[name="verificationReference"]')).toHaveAttribute("required","");
    }else if(value==="CO-PILOT"){
      await expect(form.locator(".role-crew-inline-grid")).toHaveCount(0);
      const details=form.locator("details.entry-section-role-context");
      await expect(details).toBeVisible();
      await expect(details.locator("summary")).toContainText("Optional commander / instructor");
    }else if(value==="SAFETY PILOT"){
      await expect(form.locator('select[name="actualPicMode"]')).toBeVisible();
      await expect(form.locator('select[name="actualPicMode"]')).toHaveValue("manual");
      const actualPic=form.locator('.role-crew-inline-grid input[name="commander"]');
      await expect(actualPic).toBeVisible();
      await expect(actualPic).toHaveAttribute("required","");
      await expect(form.getByText("Manual text remains valid and is not linked to a FlyTally account.")).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
  };

  const viewports=[
    {name:"desktop",width:1280,height:800},
    {name:"ipad-landscape",width:1024,height:768},
    {name:"ipad-portrait",width:768,height:1024},
    {name:"mobile",width:390,height:844},
  ];
  for(const viewport of viewports){
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    for(const theme of ["light","dark"]){
      await page.evaluate(value=>{document.documentElement.dataset.theme=value},theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
      await expect(aircraftContext.locator("[data-aircraft-context-card]")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      for(const state of ["PIC","DUAL","SPIC","PICUS","CO-PILOT","SAFETY PILOT"])await assertRoleState(state);
    }
  }
  resetSafetyPilotPicFixture();
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

test("F2.3 Safety Pilot resolver snapshots server identity and fails closed after Connection revocation",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F2.3 Safety Pilot resolver coverage requires the isolated CI database.");
  resetSafetyPilotPicFixture();
  await loginBrowserPilot(page,"/flights/new");

  const form=page.locator("#new-flight-manual-form");
  await form.locator('select[name="registration"]').selectOption("OK-SP2E");
  await form.locator('select[name="role"]').selectOption("SAFETY PILOT");
  await form.locator('select[name="actualPicMode"]').selectOption("connected");
  await form.locator('select[name="connectedPicUserId"]').selectOption("9002");
  await expect(form.locator('input[name="commander"]')).toHaveValue("Browser Friend");

  renameSafetyPilotPicFixture("Browser Friend Renamed");
  await form.getByRole("button",{name:"Save & review"}).click();
  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  await expect(page.locator('select[name="role"]')).toHaveValue("SAFETY PILOT");
  await expect(page.locator('select[name="actualPicMode"]')).toHaveValue("connected");
  await expect(page.locator('input[name="commander"]')).toHaveValue("Browser Friend Renamed");

  renameSafetyPilotPicFixture("Browser Friend Updated");
  await page.getByRole("button",{name:"Save changes"}).click();
  await expect(page.getByText("Flight changes saved.")).toBeVisible();
  await page.reload();
  await expect(page.locator('input[name="commander"]')).toHaveValue("Browser Friend Updated");

  resetSafetyPilotPicFixture();
  await page.goto("/flights/new");
  const rejected=page.locator("#new-flight-manual-form");
  await rejected.locator('select[name="registration"]').selectOption("OK-SP2E");
  await rejected.locator('select[name="role"]').selectOption("SAFETY PILOT");
  await rejected.locator('select[name="actualPicMode"]').selectOption("connected");
  await rejected.locator('select[name="connectedPicUserId"]').selectOption("9002");
  revokeSafetyPilotPicConnectionFixture();

  await rejected.getByRole("button",{name:"Save & review"}).click();
  await expect(rejected.getByRole("alert")).toContainText("Selected Actual PIC is no longer an accepted Connection.");
  await expect(page).toHaveURL(/\/flights\/new(?:\?.*)?$/);
  await expectNoHorizontalOverflow(page);
  resetSafetyPilotPicFixture();
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
