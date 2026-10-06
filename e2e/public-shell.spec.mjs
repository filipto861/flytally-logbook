import { test,expect } from "@playwright/test";
import { browserSqlScalar,runBrowserSql,resetAppearanceFixture,resetConnectionFixture,resetAccountSettingsFixture,setE13NightDefinitionFixture,resetConnectionManagerFixture,resetIntelligentReviewFormScopeFixture,resetGpsNormalizedImportFixture,resetF41CommonRoleCrewFixture,resetF42WholePartRoleCrewFixture,resetF43GpsSafetyPilotFixture,resetF35SnapshotFixture,resetF35QuickAddFixture,resetF35AuthorityFixtures,mutateF35ProfileAfterRender,resetF24VerificationFixture,resetSafetyPilotPicFixture,renameSafetyPilotPicFixture,revokeSafetyPilotPicConnectionFixture,resetSafetyPilotPicInviteFixture,revokeSafetyPilotPicInviteConnectionFixture,resetE14LegacyTaskFixture,clearE14LegacyTaskFixture } from "./browser-db.mjs";

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
  await expect(page).toHaveURL(new RegExp(`${returnTo}(?:\\?|$)`),{timeout:15000});
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
  const baselineFlightRow=page.locator("tr.flight-list-row").filter({hasText:"18/09/2026"}).filter({hasText:"OK-E2E"});
  await expect(baselineFlightRow).toHaveCount(1);
  await expect(baselineFlightRow).toBeVisible();

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

  // Prove invalid-profile auto-open from a clean closed state rather than racing the
  // controlled <details> onToggle update from the previous ULL interaction.
  await page.reload();
  const invalidForm=page.locator("#new-flight-manual-form");
  const invalidDetails=invalidForm.locator("details.aircraft-context-section");
  await expect(invalidDetails).not.toHaveAttribute("open","");
  await invalidForm.locator('select[name="registration"]').selectOption("OK-BAD1");
  await expect(invalidDetails).toHaveAttribute("open","");
  await expect(invalidDetails.locator("[data-aircraft-context-card]")).toContainText("Needs configuration");
  await expect(invalidForm.getByRole("button",{name:"Aircraft profile"})).toBeVisible();
  const configLink=invalidDetails.getByRole("link",{name:/Open Aircraft/});
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
  await form.getByRole("button",{name:"Save draft"}).click();
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
  await form.getByRole("button",{name:"Save draft"}).click();
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
  await form.getByRole("button",{name:"Save draft"}).click();
  await expect(form.getByRole("alert")).toContainText("Aircraft profile changed or this flight context is no longer available.");
  expect(Number(browserSqlScalar("SELECT COUNT(*) FROM flights WHERE user_id=9001 AND registration='OK-F35O' AND date='2026-10-02'"))).toBe(0);

  await form.evaluate(form=>{form.querySelectorAll('[name="aircraftType"]').forEach(node=>node.remove());const canonical=document.createElement("input");canonical.type="hidden";canonical.name="aircraftType";canonical.value="OTHER";form.appendChild(canonical)});
  await form.getByRole("button",{name:"Save draft"}).click();
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
  await form.getByRole("button",{name:"Save draft"}).click();
  await expect(form.getByRole("alert")).toContainText("Aircraft profile changed or this flight context is no longer available.");
  expect(Number(browserSqlScalar("SELECT COUNT(*) FROM flights WHERE user_id=9001 AND registration='OK-F35B' AND date='2026-10-02'"))).toBe(0);

  await form.evaluate(form=>{form.querySelectorAll('[name="balloonGroup"]').forEach(node=>node.remove());const canonical=document.createElement("input");canonical.type="hidden";canonical.name="balloonGroup";canonical.value="A";form.appendChild(canonical)});
  await form.getByRole("button",{name:"Save draft"}).click();
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
  await form.getByRole("button",{name:"Save draft"}).click();
  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  expect(browserSqlScalar("SELECT evidence||'|'||aircraft_class||'|'||regulatory_category||'|'||aircraft_type FROM flights WHERE user_id=9001 AND registration='OK-F35Q' AND date='2026-10-02' ORDER BY id DESC LIMIT 1")).toBe("ULL|ULL|ULL|F35 Quick");
});

test("3.4.0 Manual explicit Save & certify seals the persisted row while Enter remains draft-only",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated 3.4.0 completion coverage requires the isolated browser database.");
  runBrowserSql("DELETE FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-05' AND off_block IN ('12:00','13:00')");
  await loginBrowserPilot(page,"/flights/new");

  const completeManual=async(offBlock,takeoff,landing,onBlock)=>{
    const form=page.locator("#new-flight-manual-form");
    await form.locator('input[name="date"]').fill("2026-10-05");
    await form.locator('select[name="registration"]').selectOption("OK-E2E");
    await form.locator('input[name="departure"]').fill("LKLT");
    await form.locator('input[name="arrival"]').fill("LKPR");
    await form.locator('input[name="offBlock"]').fill(offBlock);
    await form.locator('input[name="takeoff"]').fill(takeoff);
    await form.locator('input[name="landing"]').fill(landing);
    await form.locator('input[name="onBlock"]').fill(onBlock);
    const experience=form.locator("details.entry-section-experience");
    if(!(await experience.getAttribute("open")))await experience.locator("summary").click();
    await form.locator('input[name="landingsDay"]').fill("1");
    await form.locator('input[name="landingsNight"]').fill("0");
    const context=form.locator("details.aircraft-context-section");
    if(!(await context.getAttribute("open")))await context.locator("summary").click();
    await form.locator('select[name="operationType"]').selectOption("SP");
    await form.locator('select[name="engineType"]').selectOption("SE");
    await expect(form.locator(".entry-certification-summary")).toContainText("EASA");
    return form;
  };

  let form=await completeManual("12:00","12:05","12:55","13:00");
  await expect(form.getByRole("button",{name:"Save draft"})).toBeEnabled();
  await expect(form.getByRole("button",{name:"Save & certify flight"})).toBeEnabled();
  await form.getByRole("button",{name:"Save & certify flight"}).click();
  await expect(page.getByText("Flight saved and certified.")).toBeVisible();
  await expect(page.locator(".flight-lock-badge")).toContainText("CERTIFIED R1");
  expect(browserSqlScalar("SELECT CASE WHEN certified_at IS NOT NULL THEN certification_version::text||'|'||length(certification_hash)::text ELSE 'DRAFT' END FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-05' AND off_block='12:00' ORDER BY id DESC LIMIT 1")).toBe("8|64");

  await page.goto("/flights/new");
  form=await completeManual("13:00","13:05","13:55","14:00");
  await form.locator('input[name="arrival"]').press("Enter");
  await expect(page.getByText("Flight saved as draft.")).toBeVisible();
  expect(browserSqlScalar("SELECT CASE WHEN certified_at IS NULL THEN 'DRAFT' ELSE 'CERTIFIED' END FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-05' AND off_block='13:00' ORDER BY id DESC LIMIT 1")).toBe("DRAFT");
  await expectNoHorizontalOverflow(page);
});

test("3.4.0 single GPS Save & certify seals the imported persisted row",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated 3.4.0 GPS completion coverage requires the isolated browser database.");
  runBrowserSql("DELETE FROM flight_tracks WHERE user_id=9001 AND flight_id IN (SELECT id FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-05' AND off_block='14:00')");
  runBrowserSql("DELETE FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-05' AND off_block='14:00'");
  await loginBrowserPilot(page,"/flights/new");
  await page.getByRole("button",{name:"Import GPS track"}).click();

  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track><when>2026-10-05T14:00:00Z</when><when>2026-10-05T14:01:00Z</when><when>2026-10-05T14:02:00Z</when><when>2026-10-05T14:03:00Z</when><when>2026-10-05T14:04:00Z</when><when>2026-10-05T14:05:00Z</when><gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 450</gx:coord><gx:coord>14.18 50.16 800</gx:coord><gx:coord>14.24 50.20 850</gx:coord><gx:coord>14.29 50.24 500</gx:coord><gx:coord>14.31 50.26 300</gx:coord></gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"v340-direct-certify.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");
  await gpsForm.locator('input[name="part_0_date"]').fill("2026-10-05");
  await gpsForm.locator('input[name="part_0_departure"]').fill("LKLT");
  await gpsForm.locator('input[name="part_0_arrival"]').fill("LKPR");
  await gpsForm.locator('input[name="part_0_offBlock"]').fill("14:00");
  await gpsForm.locator('input[name="part_0_takeoff"]').fill("14:01");
  await gpsForm.locator('input[name="part_0_landing"]').fill("14:04");
  await gpsForm.locator('input[name="part_0_onBlock"]').fill("14:05");
  const starts=gpsForm.locator('input[name="part_0_starts"]');
  const total=(await starts.inputValue())||"1";
  await starts.fill(total);
  await gpsForm.locator('input[name="part_0_landingsDay"]').fill(total);
  await gpsForm.locator('input[name="part_0_landingsNight"]').fill("0");
  await expect(gpsForm.locator('input[name="part_0_reviewed"]')).toHaveCount(0);
  await expect(gpsForm.locator(".gps-certification-summary")).toContainText("EASA");
  await expect(gpsForm.getByRole("button",{name:"Save & certify flight"})).toBeEnabled();
  await gpsForm.getByRole("button",{name:"Save & certify flight"}).click();

  await expect(page.getByText("Flight saved and certified.")).toBeVisible();
  await expect(page.locator(".flight-lock-badge")).toContainText("CERTIFIED R1");
  expect(browserSqlScalar("SELECT CASE WHEN certified_at IS NOT NULL THEN certification_version::text||'|'||length(certification_hash)::text ELSE 'DRAFT' END FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-05' AND off_block='14:00' ORDER BY id DESC LIMIT 1")).toBe("8|64");
  expect(browserSqlScalar("SELECT COUNT(*) FROM flight_tracks WHERE user_id=9001 AND flight_id IN (SELECT id FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-05' AND off_block='14:00')")).toBe("1");
  await expectNoHorizontalOverflow(page);
});

test("3.4.0 GPS quality warning requires one targeted acknowledgement before completion",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated 3.4.0 GPS warning coverage requires the isolated browser database.");
  await loginBrowserPilot(page,"/flights/new");
  await page.getByRole("button",{name:"Import GPS track"}).click();

  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>2026-10-05T15:00:00Z</when><when>2026-10-05T15:00:10Z</when><when>2026-10-05T15:01:00Z</when><when>2026-10-05T15:02:00Z</when><when>2026-10-05T15:03:00Z</when>'+
    '<gx:coord>14.00 50.00 300</gx:coord><gx:coord>15.00 51.00 500</gx:coord><gx:coord>15.01 51.01 800</gx:coord><gx:coord>15.02 51.02 700</gx:coord><gx:coord>15.03 51.03 300</gx:coord>'+
    '</gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"v340-quality-warning.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});

  await expect(gpsForm.getByText("GPS track needs review.")).toBeVisible();
  const trackReview=gpsForm.locator("details.gps-track-review");
  await expect(trackReview).toHaveAttribute("open","");
  const acknowledgement=gpsForm.locator('input[name="gpsWarningReviewed"]');
  await expect(acknowledgement).toBeVisible();
  await expect(acknowledgement).not.toBeChecked();

  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");
  await gpsForm.locator('input[name="part_0_date"]').fill("2026-10-05");
  await gpsForm.locator('input[name="part_0_departure"]').fill("LKLT");
  await gpsForm.locator('input[name="part_0_arrival"]').fill("LKPR");
  await gpsForm.locator('input[name="part_0_offBlock"]').fill("15:00");
  await gpsForm.locator('input[name="part_0_takeoff"]').fill("15:01");
  await gpsForm.locator('input[name="part_0_landing"]').fill("15:02");
  await gpsForm.locator('input[name="part_0_onBlock"]').fill("15:03");
  const starts=gpsForm.locator('input[name="part_0_starts"]');
  const total=(await starts.inputValue())||"1";
  await starts.fill(total);
  await gpsForm.locator('input[name="part_0_landingsDay"]').fill(total);
  await gpsForm.locator('input[name="part_0_landingsNight"]').fill("0");

  await expect(gpsForm.getByText("Review the GPS quality warning.")).toBeVisible();
  await expect(gpsForm.getByRole("button",{name:"Save draft"})).toHaveCount(0);
  await expect(gpsForm.getByRole("button",{name:"Complete flight details"})).toBeVisible();

  await acknowledgement.check();
  await expect(gpsForm.getByRole("button",{name:"Save draft"})).toBeEnabled();
  await expect(gpsForm.getByRole("button",{name:"Save & certify flight"})).toBeEnabled();
  await expect(gpsForm.locator('input[name$="_reviewed"]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("3.4.0 responsive entry shell stays usable across desktop iPad mobile light and dark",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated 3.4.0 responsive coverage requires the isolated browser database.");
  await loginBrowserPilot(page,"/flights/new");

  const releaseViewports=F6_PRESENTATION_VIEWPORTS.filter(viewport=>
    ["desktop-1440","ipad-landscape","ipad-portrait","mobile-390"].includes(viewport.name)
  );
  const manual=page.locator("#new-flight-manual-form");
  await manual.locator('select[name="registration"]').selectOption("OK-E2E");
  for(const viewport of releaseViewports){
    for(const theme of ["light","dark"]){
      await applyF6PresentationState(page,viewport,theme);
      await expect(manual).toBeVisible();
      await expect(manual.getByRole("button",{name:"Save draft"})).toBeVisible();
      await expect(manual.getByRole("button",{name:"Save & certify flight"})).toBeVisible();
    }
  }

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>2026-10-05T16:00:00Z</when><when>2026-10-05T16:01:00Z</when><when>2026-10-05T16:02:00Z</when><when>2026-10-05T16:03:00Z</when>'+
    '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.14 50.13 600</gx:coord><gx:coord>14.20 50.18 650</gx:coord><gx:coord>14.24 50.21 300</gx:coord>'+
    '</gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"v340-responsive.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");
  await expect(gpsForm.locator(".flight-review-card").first()).toBeVisible();

  for(const viewport of releaseViewports){
    for(const theme of ["light","dark"]){
      await applyF6PresentationState(page,viewport,theme);
      await expect(gpsForm).toBeVisible();
      await expect(gpsForm.locator(".flight-review-card").first()).toBeVisible();
      await expect(gpsForm.locator("details.gps-track-review")).toBeVisible();
    }
  }
});

test("GPS import fails closed for invalid profile context and exposes only implemented F4 roles",async({page})=>{
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
  await expect(gpsForm.locator('select[name="role"] option')).toHaveCount(3);
  await expect(gpsForm.locator('select[name="role"] option')).toHaveText(["PIC","DUAL","SAFETY PILOT"]);
  await expect(gpsForm.locator('select[name="role"]')).toHaveValue("PIC");
  await expect(gpsForm.locator('select[name="operationType"]')).toBeVisible();
  await expect(gpsForm.locator('select[name="engineType"]')).toBeVisible();
  await expect(gpsForm.locator('select[name="operationType"]')).toHaveValue("");
  await expect(gpsForm.locator('select[name="engineType"]')).toHaveValue("");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");
  await expect(gpsForm.locator('select[name="operationType"]')).toHaveValue("SP");
  await expect(gpsForm.locator('select[name="engineType"]')).toHaveValue("SE");
  await expect(gpsForm.locator('input[name="part_0_reviewed"]')).toHaveCount(0);
  await gpsForm.locator('input[name="part_0_landingsDay"]').fill("1");
  await gpsForm.locator('input[name="part_0_landingsNight"]').fill("0");
  await expect(gpsForm.locator('input[name="part_0_movementEvidenceRecorded"]')).not.toBeChecked();

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
  await expect(gpsForm.locator('input[name="part_0_movementEvidenceRecorded"]')).toHaveCount(0);

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
  await expect(gpsForm.locator('input[name="part_0_movementEvidenceRecorded"]')).not.toBeChecked();
  await gpsForm.locator('textarea[name="part_0_note"]').fill("F1.4 normalized GPS save");

  await expect(gpsForm.locator('input[name="part_0_reviewed"]')).toHaveCount(0);
  await expect(gpsForm.getByRole("button",{name:"Save draft"})).toBeEnabled();
  await expect(gpsForm.getByRole("button",{name:"Save & certify flight"})).toBeEnabled();
  await gpsForm.getByRole("button",{name:"Save draft"}).click();

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
  await expect(gpsForm.locator('input[name="part_0_movementEvidenceRecorded"]')).not.toBeChecked();
  await gpsForm.locator('textarea[name="part_0_note"]').fill("F4.1 common DUAL browser proof");

  await expect(gpsForm.locator('input[name="part_0_reviewed"]')).toHaveCount(0);

  const role=gpsForm.locator('select[name="role"]');
  await role.selectOption("DUAL");
  const instructor=gpsForm.locator('input[name="instructor"]');
  await expect(instructor).toBeVisible();
  await expect(instructor).toHaveAttribute("required","");
  await expect(gpsForm.getByRole("button",{name:"Save draft"})).toHaveCount(0);
  await expect(gpsForm.getByRole("button",{name:"Complete flight details"})).toBeVisible();
  await instructor.fill("Browser Training Instructor");
  await expect(gpsForm.locator("p.value-origin-note").filter({hasText:"Common Role/Crew"})).toContainText("DUAL · Browser Training Instructor");
  await expect(gpsForm.getByRole("button",{name:"Save draft"})).toBeEnabled();
  await gpsForm.getByRole("button",{name:"Save draft"}).click();

  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  await expect(page.locator('select[name="role"]')).toHaveValue("DUAL");
  await expect(page.locator('input[name="instructor"]')).toHaveValue("Browser Training Instructor");
  expect(browserSqlScalar("SELECT role||'|'||instructor||'|'||COALESCE(commander,'')||'|'||COALESCE(verification_name,'')||'|'||COALESCE(verification_reference,'') FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-02' AND off_block='19:00' ORDER BY id DESC LIMIT 1")).toBe("DUAL|Browser Training Instructor|||");
  await expectNoHorizontalOverflow(page);
  resetF41CommonRoleCrewFixture();
});


test("F4.2 mixed INHERIT and DUAL OVERRIDE persist independently",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F4.2 whole-part RoleCrew coverage requires the isolated browser database.");
  resetF42WholePartRoleCrewFixture();
  await loginBrowserPilot(page,"/flights/new");

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>2026-10-02T20:00:00Z</when><when>2026-10-02T20:01:00Z</when><when>2026-10-02T20:02:00Z</when><when>2026-10-02T20:03:00Z</when><when>2026-10-02T20:04:00Z</when><when>2026-10-02T20:05:00Z</when>'+
    '<when>2026-10-02T20:06:00Z</when><when>2026-10-02T20:07:00Z</when><when>2026-10-02T20:08:00Z</when><when>2026-10-02T20:09:00Z</when><when>2026-10-02T20:10:00Z</when><when>2026-10-02T20:11:00Z</when>'+
    '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 500</gx:coord><gx:coord>14.17 50.15 800</gx:coord><gx:coord>14.21 50.18 850</gx:coord><gx:coord>14.25 50.21 500</gx:coord><gx:coord>14.29 50.24 300</gx:coord>'+
    '<gx:coord>14.33 50.27 300</gx:coord><gx:coord>14.37 50.30 500</gx:coord><gx:coord>14.41 50.33 800</gx:coord><gx:coord>14.45 50.36 850</gx:coord><gx:coord>14.49 50.39 500</gx:coord><gx:coord>14.53 50.42 300</gx:coord>'+
    '</gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"f42-mixed-rolecrew.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gpsForm.getByRole("button",{name:/Add split/}).click();
  await expect(gpsForm.locator('input[name="partCount"]')).toHaveValue("2");
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");

  const completePart=async(index,values)=>{
    await gpsForm.locator('input[name="part_'+index+'_date"]').fill("2026-10-02");
    await gpsForm.locator('input[name="part_'+index+'_offBlock"]').fill(values.offBlock);
    await gpsForm.locator('input[name="part_'+index+'_takeoff"]').fill(values.takeoff);
    await gpsForm.locator('input[name="part_'+index+'_landing"]').fill(values.landing);
    await gpsForm.locator('input[name="part_'+index+'_onBlock"]').fill(values.onBlock);
    const starts=gpsForm.locator('input[name="part_'+index+'_starts"]');
    const total=(await starts.inputValue())||"1";
    await starts.fill(total);
    await gpsForm.locator('input[name="part_'+index+'_landingsDay"]').fill(total);
    await gpsForm.locator('input[name="part_'+index+'_landingsNight"]').fill("0");
    await expect(gpsForm.locator('input[name="part_'+index+'_movementEvidenceRecorded"]')).not.toBeChecked();
    await gpsForm.locator('textarea[name="part_'+index+'_note"]').fill(values.note);
  };
  await completePart(0,{offBlock:"20:00",takeoff:"20:01",landing:"20:04",onBlock:"20:05",note:"F4.2 inherited PIC"});
  await completePart(1,{offBlock:"20:06",takeoff:"20:07",landing:"20:10",onBlock:"20:11",note:"F4.2 overridden DUAL"});

  await expect(gpsForm.locator('input[name$="_reviewed"]')).toHaveCount(0);
  await expect(gpsForm.getByRole("button",{name:"Save 2 flight drafts"})).toBeEnabled();

  const second=gpsForm.locator(".flight-review-card").nth(1);
  await second.getByRole("button",{name:"Override Role/Crew"}).click();
  await second.locator('select[name="part_1_roleCrew_role"]').selectOption("DUAL");
  const overrideInstructor=second.locator('input[name="part_1_roleCrew_instructor"]');
  await expect(overrideInstructor).toHaveAttribute("required","");
  await expect(gpsForm.getByRole("button",{name:"Save 2 flight drafts"})).toHaveCount(0);
  await overrideInstructor.fill("Browser F42 Instructor");
  await expect(gpsForm.getByRole("button",{name:"Save 2 flight drafts"})).toBeEnabled();

  const commonRole=gpsForm.locator('select[name="role"]');
  await commonRole.selectOption("DUAL");
  await expect(gpsForm.getByRole("button",{name:"Save 2 flight drafts"})).toHaveCount(0);
  await commonRole.selectOption("PIC");
  await expect(gpsForm.getByRole("button",{name:"Save 2 flight drafts"})).toBeEnabled();

  await second.getByRole("button",{name:"Reset to common"}).click();
  await expect(second.locator('select[name="part_1_roleCrew_role"]')).toHaveCount(0);
  await expect(second.locator('input[name="part_1_roleCrew_mode"]')).toHaveValue("INHERIT");
  await expect(second.locator("p.value-origin-note").filter({hasText:"Common Role/Crew"})).toContainText("PIC");

  await second.getByRole("button",{name:"Override Role/Crew"}).click();
  await second.locator('select[name="part_1_roleCrew_role"]').selectOption("DUAL");
  await second.locator('input[name="part_1_roleCrew_instructor"]').fill("Browser F42 Instructor");
  await expect(gpsForm.locator('input[name="part_0_roleCrew_mode"]')).toHaveValue("INHERIT");
  await expect(gpsForm.locator('input[name="part_1_roleCrew_mode"]')).toHaveValue("OVERRIDE");
  await expect(gpsForm.getByRole("button",{name:"Save 2 flight drafts"})).toBeEnabled();
  await gpsForm.getByRole("button",{name:"Save 2 flight drafts"}).click();

  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  expect(browserSqlScalar("SELECT string_agg(off_block||'|'||role||'|'||COALESCE(instructor,''), E'\\n' ORDER BY off_block) FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-02' AND off_block IN ('20:00','20:06')")).toBe("20:00|PIC|\n20:06|DUAL|Browser F42 Instructor");
  expect(browserSqlScalar("SELECT COUNT(*) FROM flight_tracks WHERE user_id=9001 AND flight_id IN (SELECT id FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-02' AND off_block IN ('20:00','20:06'))")).toBe("2");
  await expectNoHorizontalOverflow(page);
  resetF42WholePartRoleCrewFixture();
});

test("F4.2 split-boundary change clears RoleCrew overrides with a visible notice",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F4.2 split-reset coverage requires the isolated browser database.");
  resetF42WholePartRoleCrewFixture();
  await loginBrowserPilot(page,"/flights/new");

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>2026-10-02T20:00:00Z</when><when>2026-10-02T20:01:00Z</when><when>2026-10-02T20:02:00Z</when><when>2026-10-02T20:03:00Z</when><when>2026-10-02T20:04:00Z</when><when>2026-10-02T20:05:00Z</when>'+
    '<when>2026-10-02T20:06:00Z</when><when>2026-10-02T20:07:00Z</when><when>2026-10-02T20:08:00Z</when><when>2026-10-02T20:09:00Z</when><when>2026-10-02T20:10:00Z</when><when>2026-10-02T20:11:00Z</when>'+
    '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 500</gx:coord><gx:coord>14.17 50.15 800</gx:coord><gx:coord>14.21 50.18 850</gx:coord><gx:coord>14.25 50.21 500</gx:coord><gx:coord>14.29 50.24 300</gx:coord>'+
    '<gx:coord>14.33 50.27 300</gx:coord><gx:coord>14.37 50.30 500</gx:coord><gx:coord>14.41 50.33 800</gx:coord><gx:coord>14.45 50.36 850</gx:coord><gx:coord>14.49 50.39 500</gx:coord><gx:coord>14.53 50.42 300</gx:coord>'+
    '</gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"f42-split-reset.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gpsForm.getByRole("button",{name:/Add split/}).click();
  await expect(gpsForm.locator('input[name="partCount"]')).toHaveValue("2");
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");

  const second=gpsForm.locator(".flight-review-card").nth(1);
  await second.getByRole("button",{name:"Override Role/Crew"}).click();
  await second.locator('select[name="part_1_roleCrew_role"]').selectOption("DUAL");
  await second.locator('input[name="part_1_roleCrew_instructor"]').fill("Temporary F42 Instructor");
  await expect(gpsForm.locator('input[name="part_1_roleCrew_mode"]')).toHaveValue("OVERRIDE");

  const split=gpsForm.locator('.split-row input[type="range"]').first();
  const before=await split.inputValue();
  await split.focus();
  await split.press("ArrowRight");
  await expect(split).not.toHaveValue(before);
  await expect(gpsForm.locator('p[role="status"]').filter({hasText:"Role/Crew overrides were reset because the flight split changed"})).toBeVisible();
  await expect(gpsForm.locator('input[name="part_0_roleCrew_mode"]')).toHaveValue("INHERIT");
  await expect(gpsForm.locator('input[name="part_1_roleCrew_mode"]')).toHaveValue("INHERIT");
  await expect(gpsForm.locator('select[name$="_roleCrew_role"]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});


async function completeF43GpsPart(gpsForm,index,{offBlock,takeoff,landing,onBlock,note}){
  await gpsForm.locator('input[name="part_'+index+'_date"]').fill("2026-10-03");
  await gpsForm.locator('input[name="part_'+index+'_offBlock"]').fill(offBlock);
  await gpsForm.locator('input[name="part_'+index+'_takeoff"]').fill(takeoff);
  await gpsForm.locator('input[name="part_'+index+'_landing"]').fill(landing);
  await gpsForm.locator('input[name="part_'+index+'_onBlock"]').fill(onBlock);
  const starts=gpsForm.locator('input[name="part_'+index+'_starts"]');
  const total=(await starts.inputValue())||"1";
  await starts.fill(total);
  await gpsForm.locator('input[name="part_'+index+'_landingsDay"]').fill(total);
  await gpsForm.locator('input[name="part_'+index+'_landingsNight"]').fill("0");
  await expect(gpsForm.locator('input[name="part_'+index+'_movementEvidenceRecorded"]')).not.toBeChecked();
  await gpsForm.locator('textarea[name="part_'+index+'_note"]').fill(note);
}

test("F4.3 common Manual Safety Pilot persists explicit Actual PIC without account link",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F4.3 Manual Safety Pilot coverage requires the isolated browser database.");
  resetF43GpsSafetyPilotFixture();
  await loginBrowserPilot(page,"/flights/new");

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>2026-10-03T21:00:00Z</when><when>2026-10-03T21:01:00Z</when><when>2026-10-03T21:02:00Z</when><when>2026-10-03T21:03:00Z</when><when>2026-10-03T21:04:00Z</when><when>2026-10-03T21:05:00Z</when>'+
    '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 500</gx:coord><gx:coord>14.18 50.16 800</gx:coord><gx:coord>14.24 50.20 850</gx:coord><gx:coord>14.29 50.24 500</gx:coord><gx:coord>14.31 50.26 300</gx:coord>'+
    '</gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"f43-common-manual.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");
  await gpsForm.locator('select[name="role"]').selectOption("SAFETY PILOT");
  await gpsForm.locator('select[name="actualPicMode"]').selectOption("manual");
  await gpsForm.locator('input[name="commander"]').fill("Manual GPS Captain");

  await completeF43GpsPart(gpsForm,0,{offBlock:"21:00",takeoff:"21:01",landing:"21:04",onBlock:"21:05",note:"F4.3 common manual Safety Pilot"});
  await expect(gpsForm.locator('input[name="part_0_reviewed"]')).toHaveCount(0);
  await expect(gpsForm.getByRole("button",{name:"Save draft"})).toBeEnabled();
  await gpsForm.getByRole("button",{name:"Save draft"}).click();

  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  expect(browserSqlScalar("SELECT role||'|'||commander FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-03' AND off_block='21:00' ORDER BY id DESC LIMIT 1")).toBe("SAFETY PILOT|Manual GPS Captain");
  expect(browserSqlScalar("SELECT COUNT(*) FROM flight_connected_crew WHERE source_user_id=9001 AND source_flight_id IN (SELECT id FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-03' AND off_block='21:00')")).toBe("0");
  expect(browserSqlScalar("SELECT COUNT(*) FROM flight_tracks WHERE user_id=9001 AND flight_id IN (SELECT id FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-03' AND off_block='21:00')")).toBe("1");
  await expectNoHorizontalOverflow(page);
  resetF43GpsSafetyPilotFixture();
});

test("F4.3 common connected Safety Pilot snapshots server identity and persists one PIC link",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F4.3 connected Safety Pilot coverage requires the isolated browser database.");
  resetF43GpsSafetyPilotFixture();
  await loginBrowserPilot(page,"/flights/new");

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>2026-10-03T21:20:00Z</when><when>2026-10-03T21:21:00Z</when><when>2026-10-03T21:22:00Z</when><when>2026-10-03T21:23:00Z</when><when>2026-10-03T21:24:00Z</when><when>2026-10-03T21:25:00Z</when>'+
    '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 500</gx:coord><gx:coord>14.18 50.16 800</gx:coord><gx:coord>14.24 50.20 850</gx:coord><gx:coord>14.29 50.24 500</gx:coord><gx:coord>14.31 50.26 300</gx:coord>'+
    '</gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"f43-common-connected.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");
  await gpsForm.locator('select[name="role"]').selectOption("SAFETY PILOT");
  await gpsForm.locator('select[name="actualPicMode"]').selectOption("connected");
  await gpsForm.locator('select[name="connectedPicUserId"]').selectOption("9002");

  await completeF43GpsPart(gpsForm,0,{offBlock:"21:20",takeoff:"21:21",landing:"21:24",onBlock:"21:25",note:"F4.3 connected snapshot"});
  await expect(gpsForm.locator('input[name="part_0_reviewed"]')).toHaveCount(0);
  renameSafetyPilotPicFixture("Browser F43 Snapshot");
  await expect(gpsForm.getByRole("button",{name:"Save draft"})).toBeEnabled();
  await gpsForm.getByRole("button",{name:"Save draft"}).click();

  await expect(page).toHaveURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/);
  expect(browserSqlScalar("SELECT role||'|'||commander FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-03' AND off_block='21:20' ORDER BY id DESC LIMIT 1")).toBe("SAFETY PILOT|Browser F43 Snapshot");
  expect(browserSqlScalar("SELECT connected_user_id||'|'||intended_role FROM flight_connected_crew WHERE source_user_id=9001 AND source_flight_id IN (SELECT id FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-03' AND off_block='21:20')")).toBe("9002|PIC");
  expect(browserSqlScalar("SELECT COUNT(*) FROM flight_tracks WHERE user_id=9001 AND flight_id IN (SELECT id FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-03' AND off_block='21:20')")).toBe("1");
  await expectNoHorizontalOverflow(page);
  resetF43GpsSafetyPilotFixture();
});

test("F4.3 revoked per-flight connected Safety Pilot fails closed without partial split persistence",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F4.3 revoked-Connection coverage requires the isolated browser database.");
  resetF43GpsSafetyPilotFixture();
  await loginBrowserPilot(page,"/flights/new");

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>2026-10-03T21:40:00Z</when><when>2026-10-03T21:41:00Z</when><when>2026-10-03T21:42:00Z</when><when>2026-10-03T21:43:00Z</when><when>2026-10-03T21:44:00Z</when><when>2026-10-03T21:45:00Z</when>'+
    '<when>2026-10-03T21:46:00Z</when><when>2026-10-03T21:47:00Z</when><when>2026-10-03T21:48:00Z</when><when>2026-10-03T21:49:00Z</when><when>2026-10-03T21:50:00Z</when><when>2026-10-03T21:51:00Z</when>'+
    '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 500</gx:coord><gx:coord>14.17 50.15 800</gx:coord><gx:coord>14.21 50.18 850</gx:coord><gx:coord>14.25 50.21 500</gx:coord><gx:coord>14.29 50.24 300</gx:coord>'+
    '<gx:coord>14.33 50.27 300</gx:coord><gx:coord>14.37 50.30 500</gx:coord><gx:coord>14.41 50.33 800</gx:coord><gx:coord>14.45 50.36 850</gx:coord><gx:coord>14.49 50.39 500</gx:coord><gx:coord>14.53 50.42 300</gx:coord>'+
    '</gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"f43-override-revoked.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gpsForm.getByRole("button",{name:/Add split/}).click();
  await expect(gpsForm.locator('input[name="partCount"]')).toHaveValue("2");
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");

  await completeF43GpsPart(gpsForm,0,{offBlock:"21:40",takeoff:"21:41",landing:"21:44",onBlock:"21:45",note:"F4.3 inherited PIC"});
  await completeF43GpsPart(gpsForm,1,{offBlock:"21:46",takeoff:"21:47",landing:"21:50",onBlock:"21:51",note:"F4.3 revoked Safety Pilot override"});
  await expect(gpsForm.locator('input[name$="_reviewed"]')).toHaveCount(0);

  const second=gpsForm.locator(".flight-review-card").nth(1);
  await second.getByRole("button",{name:"Override Role/Crew"}).click();
  await second.locator('select[name="part_1_roleCrew_role"]').selectOption("SAFETY PILOT");
  await second.locator('select[name="part_1_roleCrew_actualPicMode"]').selectOption("connected");
  await second.locator('select[name="part_1_roleCrew_connectedPicUserId"]').selectOption("9002");
  await expect(gpsForm.getByRole("button",{name:"Save 2 flight drafts"})).toBeEnabled();

  revokeSafetyPilotPicConnectionFixture();
  await gpsForm.getByRole("button",{name:"Save 2 flight drafts"}).click();
  await expect(gpsForm.locator('[role="alert"]')).toContainText("Selected Actual PIC is no longer an accepted Connection");
  await expect(page).toHaveURL(/\/flights\/new(?:\?|$)/);
  expect(browserSqlScalar("SELECT COUNT(*) FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-03' AND off_block IN ('21:40','21:46')")).toBe("0");
  expect(browserSqlScalar("SELECT COUNT(*) FROM flight_tracks WHERE user_id=9001 AND flight_id IN (SELECT id FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-03' AND off_block IN ('21:40','21:46'))")).toBe("0");
  expect(browserSqlScalar("SELECT COUNT(*) FROM flight_connected_crew WHERE source_user_id=9001 AND source_flight_id IN (SELECT id FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-03' AND off_block IN ('21:40','21:46'))")).toBe("0");
  await expectNoHorizontalOverflow(page);
  resetF43GpsSafetyPilotFixture();
});


test("F4.4 GPS RoleCrew override UX stays responsive across cockpit viewports and themes",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F4.4 responsive override coverage requires the isolated browser database.");
  resetF43GpsSafetyPilotFixture();
  await loginBrowserPilot(page,"/flights/new");

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>2026-10-03T21:40:00Z</when><when>2026-10-03T21:41:00Z</when><when>2026-10-03T21:42:00Z</when><when>2026-10-03T21:43:00Z</when><when>2026-10-03T21:44:00Z</when><when>2026-10-03T21:45:00Z</when>'+
    '<when>2026-10-03T21:46:00Z</when><when>2026-10-03T21:47:00Z</when><when>2026-10-03T21:48:00Z</when><when>2026-10-03T21:49:00Z</when><when>2026-10-03T21:50:00Z</when><when>2026-10-03T21:51:00Z</when>'+
    '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 500</gx:coord><gx:coord>14.17 50.15 800</gx:coord><gx:coord>14.21 50.18 850</gx:coord><gx:coord>14.25 50.21 500</gx:coord><gx:coord>14.29 50.24 300</gx:coord>'+
    '<gx:coord>14.33 50.27 300</gx:coord><gx:coord>14.37 50.30 500</gx:coord><gx:coord>14.41 50.33 800</gx:coord><gx:coord>14.45 50.36 850</gx:coord><gx:coord>14.49 50.39 500</gx:coord><gx:coord>14.53 50.42 300</gx:coord>'+
    '</gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"f44-responsive-overrides.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gpsForm.getByRole("button",{name:/Add split/}).click();
  await expect(gpsForm.locator('input[name="partCount"]')).toHaveValue("2");
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");
  await gpsForm.locator('select[name="role"]').selectOption("DUAL");
  await gpsForm.locator('input[name="instructor"]').fill("Responsive Common Instructor");

  await completeF43GpsPart(gpsForm,0,{offBlock:"21:40",takeoff:"21:41",landing:"21:44",onBlock:"21:45",note:"F4.4 inherited DUAL"});
  await completeF43GpsPart(gpsForm,1,{offBlock:"21:46",takeoff:"21:47",landing:"21:50",onBlock:"21:51",note:"F4.4 Safety Pilot override"});

  const first=gpsForm.locator(".flight-review-card").nth(0);
  const second=gpsForm.locator(".flight-review-card").nth(1);
  await second.getByRole("button",{name:"Override Role/Crew"}).click();
  await second.locator('select[name="part_1_roleCrew_role"]').selectOption("SAFETY PILOT");
  await second.locator('select[name="part_1_roleCrew_actualPicMode"]').selectOption("connected");
  await second.locator('select[name="part_1_roleCrew_connectedPicUserId"]').selectOption("9002");

  await expect(first.getByText("Common Role/Crew")).toBeVisible();
  await expect(first.getByText(/DUAL · Responsive Common Instructor/)).toBeVisible();
  await expect(second.getByText("Flight Role/Crew override")).toBeVisible();
  await expect(second.getByText(/SAFETY PILOT · Browser Friend/)).toBeVisible();

  const states=[
    {name:"desktop",width:1280,height:800},
    {name:"ipad-landscape",width:1024,height:768},
    {name:"ipad-portrait",width:768,height:1024},
    {name:"mobile",width:390,height:844},
    {name:"mobile-320",width:320,height:800},
  ];
  for(const viewport of states){
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    for(const theme of ["light","dark"]){
      await page.evaluate(value=>{document.documentElement.dataset.theme=value},theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
      await expect(gpsForm).toBeVisible();
      await expect(first).toBeVisible();
      await expect(second).toBeVisible();
      await expect(second.locator('select[name="part_1_roleCrew_role"]')).toHaveValue("SAFETY PILOT");
      await expect(second.locator('select[name="part_1_roleCrew_actualPicMode"]')).toHaveValue("connected");
      await expect(second.locator('select[name="part_1_roleCrew_connectedPicUserId"]')).toHaveValue("9002");
      await expect(second.getByRole("button",{name:"Reset to common"})).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  }

  resetF43GpsSafetyPilotFixture();
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

test("E1.1 route assistance stays below aligned Route fields and remains keyboard reachable",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated E1.1 route UX coverage requires the isolated browser database.");
  await loginBrowserPilot(page,"/flights/new");

  const form=page.locator("#new-flight-manual-form");
  await form.locator('select[name="registration"]').selectOption("OK-SP2E");
  const departure=form.locator('input[name="departure"]');
  const arrival=form.locator('input[name="arrival"]');
  const assistance=form.locator("[data-intelligent-route-assistance]");
  const suggestion=assistance.locator('[data-intelligent-review="continuation"]');
  await expect(assistance).toHaveAttribute("aria-live","polite");
  await expect(suggestion).toBeVisible();
  await expect(suggestion).toContainText(/Continue from [A-Z0-9]{3,8}\?/);
  const useButton=suggestion.getByRole("button",{name:/Use [A-Z0-9]{3,8}/});
  await useButton.focus();
  await expect(useButton).toBeFocused();

  for(const viewport of [
    {width:1280,height:800,aligned:true},
    {width:768,height:1024,aligned:true},
    {width:390,height:844,aligned:false},
  ]){
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    const boxes=await Promise.all([departure.boundingBox(),arrival.boundingBox(),assistance.boundingBox()]);
    expect(boxes.every(Boolean)).toBeTruthy();
    const [departureBox,arrivalBox,assistanceBox]=boxes;
    if(viewport.aligned){
      expect(Math.abs(departureBox.y-arrivalBox.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(departureBox.height-arrivalBox.height)).toBeLessThanOrEqual(1);
    }
    expect(assistanceBox.y).toBeGreaterThanOrEqual(Math.max(departureBox.y+departureBox.height,arrivalBox.y+arrivalBox.height)-1);
    await expectNoHorizontalOverflow(page);
  }

  const target=(await useButton.textContent()).replace(/^Use\s+/,"").trim();
  await useButton.click();
  await expect(departure).toHaveValue(target);
});

test("E1.2 aircraft default operation prefills Manual and GPS but remains flight-editable",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated E1.2 operation-default coverage requires the isolated browser database.");
  await loginBrowserPilot(page,"/dashboard");
  runBrowserSql("UPDATE aircraft SET default_operation_type='MP',updated_at=NOW() WHERE user_id=9001 AND registration='OK-E2E';");

  try{
    await page.goto("/flights/new");
    const manual=page.locator("#new-flight-manual-form");
    await manual.locator('select[name="registration"]').selectOption("OK-E2E");
    const context=manual.locator("details.aircraft-context-section");
    if(!(await context.getAttribute("open")))await context.locator("summary").click();
    const manualOperation=manual.locator('select[name="operationType"]');
    await expect(manualOperation).toHaveValue("MP");
    await expect(manualOperation.locator("xpath=following-sibling::small")).toContainText("Aircraft default");
    await manualOperation.selectOption("SP");
    await expect(manualOperation).toHaveValue("SP");

    await page.getByRole("button",{name:"Import GPS track"}).click();
    const gps=page.locator("form.kml-wizard");
    const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
      '<when>2026-10-03T23:00:00Z</when><when>2026-10-03T23:01:00Z</when><when>2026-10-03T23:02:00Z</when><when>2026-10-03T23:03:00Z</when>'+
      '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.15 50.15 700</gx:coord><gx:coord>14.20 50.20 700</gx:coord><gx:coord>14.25 50.25 300</gx:coord>'+
      '</gx:Track></kml>';
    await gps.locator('input[name="kml"]').setInputFiles({name:"e12-default-operation.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
    await gps.locator('select[name="registration"]').selectOption("OK-E2E");
    const gpsOperation=gps.locator('select[name="operationType"]');
    await expect(gpsOperation).toHaveValue("MP");
    await expect(gpsOperation.locator("xpath=following-sibling::small")).toContainText("Aircraft default");
    await gpsOperation.selectOption("SP");
    await expect(gpsOperation).toHaveValue("SP");
    await expectNoHorizontalOverflow(page);
  }finally{
    runBrowserSql("UPDATE aircraft SET default_operation_type=NULL,updated_at=NOW() WHERE user_id=9001 AND registration='OK-E2E';");
  }
});

test("E1.4 certified legacy GPS Task stays raw and annotated in owner and shared read-only views",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated E1.4 legacy Task presentation coverage requires the isolated browser database.");
  resetE14LegacyTaskFixture();
  try{
    await loginBrowserPilot(page,"/flights/9914");
  const ownerPanel=page.getByRole("tabpanel");
  await expect(ownerPanel.locator("small").filter({hasText:/^GPS import/}).first()).toBeVisible();
  await expect(ownerPanel.getByText("LEGACY GPS IMPORT",{exact:true}).first()).toBeVisible();

  await page.getByRole("tab",{name:"Logbook data"}).click();
  const ownerLegacyNote=page.locator(".legacy-task-note");
  await expect(ownerLegacyNote.locator("code")).toHaveText("GPS import");
  await expect(ownerLegacyNote.getByText("LEGACY GPS IMPORT",{exact:true})).toBeVisible();
  await expect(ownerLegacyNote).toContainText("retained exactly as stored evidence from the legacy GPS-import workflow");

  for(const viewport of [
    {width:1280,height:800},
    {width:768,height:1024},
    {width:390,height:844},
  ]){
    await page.setViewportSize(viewport);
    await expect(ownerLegacyNote.locator("code")).toHaveText("GPS import");
    await expect(ownerLegacyNote.getByText("LEGACY GPS IMPORT",{exact:true})).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.goto("/connections/shared/9915");
  const sharedLegacyNote=page.locator(".legacy-task-note");
  await expect(sharedLegacyNote.locator("code")).toHaveText("GPS import");
  await expect(sharedLegacyNote.getByText("LEGACY GPS IMPORT",{exact:true})).toBeVisible();
  await expect(sharedLegacyNote).toContainText("retained exactly as stored evidence from the legacy GPS-import workflow");
  await expect(page.getByRole("button",{name:"Add to my logbook"})).toBeVisible();
  await expectNoHorizontalOverflow(page);

    expect(browserSqlScalar("SELECT task FROM flights WHERE id=9914 AND user_id=9001")).toBe("GPS import");
    expect(browserSqlScalar("SELECT task FROM flights WHERE id=9915 AND user_id=9002")).toBe("GPS import");
  }finally{
    clearE14LegacyTaskFixture();
  }
});

test("E1.3 night definition setting persists explicit MANUAL and SERA applicability",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated E1.3 settings coverage requires the isolated browser database.");
  resetAccountSettingsFixture();
  try{
    await loginBrowserPilot(page,"/profile");
    const nightDefinition=page.getByLabel("Night definition");
    await expect(nightDefinition).toHaveValue("MANUAL");
    await nightDefinition.selectOption("SERA");
    await page.getByRole("button",{name:"Save changes"}).click();
    await page.reload();
    await expect(page.getByLabel("Night definition")).toHaveValue("SERA");
    expect(browserSqlScalar("SELECT COALESCE(preferences_json->>'night_definition','') FROM user_settings WHERE user_id=9001")).toBe("SERA");
  }finally{
    resetAccountSettingsFixture();
  }
});

test("E1.3 MANUAL account applicability leaves GPS Day Night classification explicit",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated E1.3 manual-applicability coverage requires the isolated browser database.");
  resetAccountSettingsFixture();
  setE13NightDefinitionFixture("MANUAL");
  try{
    await loginBrowserPilot(page,"/flights/new");
    await page.getByRole("button",{name:"Import GPS track"}).click();
    const gps=page.locator("form.kml-wizard");
    const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
      '<when>2026-07-19T11:55:00Z</when><when>2026-07-19T11:56:00Z</when><when>2026-07-19T11:57:00Z</when><when>2026-07-19T11:58:00Z</when><when>2026-07-19T11:59:00Z</when><when>2026-07-19T12:00:00Z</when>'+
      '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 450</gx:coord><gx:coord>14.18 50.16 800</gx:coord><gx:coord>14.24 50.20 850</gx:coord><gx:coord>14.29 50.24 500</gx:coord><gx:coord>14.31 50.26 300</gx:coord>'+
      '</gx:Track></kml>';
    await gps.locator('input[name="kml"]').setInputFiles({name:"e13-manual.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
    await gps.locator('select[name="registration"]').selectOption("OK-E2E");
    const day=gps.locator('input[name="part_0_landingsDay"]'),night=gps.locator('input[name="part_0_landingsNight"]');
    await expect(day).toHaveValue("");
    await expect(night).toHaveValue("");
    await expect(day).not.toHaveAttribute("aria-describedby",/part-0-landing-suggestion/);
    await expect(gps.getByText("SERA civil-twilight suggestion")).toHaveCount(0);
  }finally{
    resetAccountSettingsFixture();
  }
});

test("E1.3 SERA GPS suggestion is accessible, invalidates on total change and keeps pilot edits sticky",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated E1.3 SERA suggestion coverage requires the isolated browser database.");
  resetAccountSettingsFixture();
  setE13NightDefinitionFixture("SERA");
  try{
    await loginBrowserPilot(page,"/flights/new");
    await page.getByRole("button",{name:"Import GPS track"}).click();
    const gps=page.locator("form.kml-wizard");
    const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
      '<when>2026-07-19T11:55:00Z</when><when>2026-07-19T11:56:00Z</when><when>2026-07-19T11:57:00Z</when><when>2026-07-19T11:58:00Z</when><when>2026-07-19T11:59:00Z</when><when>2026-07-19T12:00:00Z</when>'+
      '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 450</gx:coord><gx:coord>14.18 50.16 800</gx:coord><gx:coord>14.24 50.20 850</gx:coord><gx:coord>14.29 50.24 500</gx:coord><gx:coord>14.31 50.26 300</gx:coord>'+
      '</gx:Track></kml>';
    await gps.locator('input[name="kml"]').setInputFiles({name:"e13-sera.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
    await gps.locator('select[name="registration"]').selectOption("OK-E2E");

    const total=gps.locator('input[name="part_0_starts"]'),day=gps.locator('input[name="part_0_landingsDay"]'),night=gps.locator('input[name="part_0_landingsNight"]');
    await expect(total).toHaveValue("1");
    await expect(day).toHaveValue("1");
    await expect(night).toHaveValue("0");
    const describedBy=await day.getAttribute("aria-describedby");
    expect(describedBy).toBe("part-0-landing-suggestion");
    await expect(night).toHaveAttribute("aria-describedby","part-0-landing-suggestion");
    const provenance=gps.locator("#part-0-landing-suggestion");
    await expect(provenance).toContainText("SERA civil-twilight suggestion");
    await expect(provenance).toContainText("GPS event time/location");

    await total.fill("2");
    await expect(day).toHaveValue("");
    await expect(night).toHaveValue("");
    await expect(provenance).toContainText("Automatic split cleared");

    await day.fill("1");
    await night.fill("1");
    await expect(provenance).toContainText("Pilot-edited Day/Night split");
    await gps.locator('select[name="operationType"]').selectOption("SP");
    await expect(day).toHaveValue("1");
    await expect(night).toHaveValue("1");
    await expectNoHorizontalOverflow(page);
  }finally{
    resetAccountSettingsFixture();
  }
});

test("3.4.1 sparse GPS Night-time stays manual with an explicit gap reason",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated 3.4.1 Night-time coverage requires the isolated browser database.");
  resetAccountSettingsFixture();
  setE13NightDefinitionFixture("SERA");
  try{
    await loginBrowserPilot(page,"/flights/new");
    await page.getByRole("button",{name:"Import GPS track"}).click();
    const gps=page.locator("form.kml-wizard");
    const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
      '<when>2026-07-19T12:00:00Z</when><when>2026-07-19T12:01:00Z</when><when>2026-07-19T12:02:00Z</when><when>2026-07-19T12:13:00Z</when><when>2026-07-19T12:14:00Z</when><when>2026-07-19T12:15:00Z</when>'+
      '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 450</gx:coord><gx:coord>14.18 50.16 800</gx:coord><gx:coord>14.24 50.20 850</gx:coord><gx:coord>14.29 50.24 500</gx:coord><gx:coord>14.31 50.26 300</gx:coord>'+
      '</gx:Track></kml>';
    await gps.locator('input[name="kml"]').setInputFiles({name:"v341-sparse-night.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
    await gps.locator('select[name="registration"]').selectOption("OK-E2E");

    await expect(gps.locator('input[name="part_0_landingsDay"]')).toHaveValue("1");
    await expect(gps.locator('input[name="part_0_landingsNight"]')).toHaveValue("0");
    const nightTime=gps.locator('input[name="part_0_nightTime"]');
    await expect(nightTime).toHaveValue("");
    await expect(gps.getByText(/GPS Night-time unavailable — 11 minute track gap is too large for an exact civil-twilight result/)).toBeVisible();

    await nightTime.fill("0:04");
    await gps.locator('input[name="part_0_departure"]').fill("LKLT");
    await expect(nightTime).toHaveValue("0:04");
    await expect(gps.getByText(/GPS Night-time unavailable — 11 minute track gap is too large for an exact civil-twilight result/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }finally{
    resetAccountSettingsFixture();
  }
});

test("F5.3 common Manual PIC keeps an explicit minimal control and helper allowlist across focused viewports",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F5 browser coverage requires the isolated browser database.");
  await loginBrowserPilot(page,"/flights/new");

  const form=page.locator("#new-flight-manual-form");
  await form.locator('select[name="registration"]').selectOption("OK-SP2E");
  await expect(form.locator('select[name="role"]')).toHaveValue("PIC");

  await expect(page.locator("header.page-header").getByRole("heading",{name:"New flight"})).toBeVisible();
  await expect(page.locator("header.page-header p.muted")).toHaveCount(0);
  await expect(form.getByText("Aircraft default",{exact:true})).toBeVisible();
  await expect(form.getByRole("link",{name:"Manage aircraft"})).toBeVisible();

  await form.locator('input[name="offBlock"]').fill("10:00");
  await form.locator('input[name="takeoff"]').fill("10:05");
  await form.locator('input[name="landing"]').fill("10:55");
  await form.locator('input[name="onBlock"]').fill("11:00");
  const timeSummary=form.locator(".flight-time-summary");
  await expect(timeSummary).toContainText("BLOCK");
  await expect(timeSummary).toContainText("1:00");
  await expect(timeSummary).toContainText("AIR");
  await expect(timeSummary).toContainText("0:50");
  await expect(timeSummary.locator("small")).toHaveCount(0);

  const essentials=form.locator(".entry-section-primary");
  const persistentHelpers=(await essentials.locator("small:visible:not([data-intelligent-review])").allTextContents()).map(value=>value.trim()).filter(Boolean);
  expect(persistentHelpers).toEqual(["Manage aircraft","Aircraft default","UTC"]);
  const intelligentHelpers=essentials.locator("small[data-intelligent-review]");
  await expect(intelligentHelpers).toHaveCount(1);
  await expect(intelligentHelpers).toContainText(/Continue from [A-Z0-9]{3,8}\?/);
  await expect(intelligentHelpers).toContainText(/Use [A-Z0-9]{3,8}/);

  const controls=await form.locator('input:not([type="hidden"]):visible,select:visible,textarea:visible,button:visible').evaluateAll(nodes=>nodes.filter(node=>!node.closest("[data-intelligent-review]")).map(node=>({
    tag:node.tagName.toLowerCase(),
    name:node.getAttribute("name")||"",
    text:(node.textContent||"").trim(),
  })));
  expect(controls).toEqual([
    {tag:"input",name:"date",text:""},
    {tag:"select",name:"registration",text:controls[1]?.text??""},
    {tag:"select",name:"role",text:controls[2]?.text??""},
    {tag:"input",name:"departure",text:""},
    {tag:"input",name:"arrival",text:""},
    {tag:"input",name:"offBlock",text:""},
    {tag:"input",name:"takeoff",text:""},
    {tag:"input",name:"landing",text:""},
    {tag:"input",name:"onBlock",text:""},
    {tag:"button",name:"intent",text:"Save draft"},
    {tag:"button",name:"intent",text:"Save & certify flight"},
  ]);

  await expect(form.locator(".role-crew-inline-grid")).toHaveCount(0);
  await expect(form.locator("details.entry-section-experience")).not.toHaveAttribute("open","");
  await expect(form.locator("details.entry-section-role-context")).not.toHaveAttribute("open","");
  await expect(form.locator("details.aircraft-context-section")).not.toHaveAttribute("open","");
  await expect(form.locator("details.entry-section-optional")).not.toHaveAttribute("open","");

  for(const viewport of [
    {width:1280,height:800},
    {width:768,height:1024},
    {width:390,height:844},
  ]){
    await page.setViewportSize(viewport);
    await expect(form.getByRole("button",{name:"Save draft"})).toBeVisible();
    await expect(form.locator(".flight-time-summary")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("F5.3 role change keeps required DUAL identity inline and removes the default cue",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F5 contextual-role coverage requires the isolated browser database.");
  await loginBrowserPilot(page,"/flights/new");

  const form=page.locator("#new-flight-manual-form");
  await form.locator('select[name="registration"]').selectOption("OK-SP2E");
  const role=form.locator('select[name="role"]');
  await expect(role).toHaveValue("PIC");
  await expect(form.getByText("Aircraft default",{exact:true})).toBeVisible();

  await role.selectOption("DUAL");
  await expect(form.getByText("Aircraft default",{exact:true})).toHaveCount(0);
  const instructor=form.locator('.role-crew-inline-grid input[name="instructor"]');
  await expect(instructor).toBeVisible();
  await expect(instructor).toHaveAttribute("required","");
  await expect(form.getByRole("button",{name:"Instructor / PIC"})).toBeVisible();

  for(const viewport of [
    {width:1024,height:768},
    {width:390,height:844},
  ]){
    await page.setViewportSize(viewport);
    await expect(instructor).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});


const F6_PRESENTATION_VIEWPORTS=[
  {name:"desktop-1440",width:1440,height:900},
  {name:"ipad-landscape",width:1024,height:768},
  {name:"ipad-portrait",width:768,height:1024},
  {name:"mobile-390",width:390,height:844},
  {name:"mobile-320",width:320,height:800},
  // 1440x900 at 200% browser reflow is represented by a 720x450 CSS viewport.
  {name:"reflow-200-equivalent",width:720,height:450},
];

async function applyF6PresentationState(page,viewport,theme){
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await page.evaluate(value=>{document.documentElement.dataset.theme=value},theme);
  await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
  await expectNoHorizontalOverflow(page);
}

test("F6 Manual RoleCrew matrix covers required roles modes viewports themes and 200 percent reflow",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F6 Manual matrix requires the isolated browser database.");
  resetSafetyPilotPicFixture();
  await loginBrowserPilot(page,"/flights/new");

  const form=page.locator("#new-flight-manual-form");
  await form.locator('select[name="registration"]').selectOption("OK-SP2E");
  await expect(form.locator('input[name="evidence"]')).toHaveValue("EASA");
  const role=form.locator('select[name="role"]');

  const assertState=async state=>{
    if(state==="PIC"){
      await role.selectOption("PIC");
      await expect(form.locator(".role-crew-inline-grid")).toHaveCount(0);
    }else if(state==="DUAL"){
      await role.selectOption("DUAL");
      const instructor=form.locator('.role-crew-inline-grid input[name="instructor"]');
      await expect(instructor).toBeVisible();
      await expect(instructor).toHaveAttribute("required","");
    }else if(state==="SAFETY_MANUAL"){
      await role.selectOption("SAFETY PILOT");
      const source=form.locator('select[name="actualPicMode"]');
      await source.selectOption("manual");
      await expect(source).toHaveValue("manual");
      const commander=form.locator('.role-crew-inline-grid input[name="commander"]');
      await expect(commander).toBeVisible();
      await expect(commander).toHaveAttribute("required","");
    }else if(state==="SAFETY_CONNECTION"){
      await role.selectOption("SAFETY PILOT");
      const source=form.locator('select[name="actualPicMode"]');
      await source.selectOption("connected");
      const connected=form.locator('select[name="connectedPicUserId"]');
      await expect(connected).toBeVisible();
      await expect(connected.getByRole("option",{name:"Browser Friend"})).toHaveCount(1);
      await connected.selectOption("9002");
      await expect(connected).toHaveValue("9002");
    }else if(state==="SPIC"||state==="PICUS"){
      await role.selectOption(state);
      const supervisor=form.locator('.role-crew-inline-grid input[name="verificationName"]');
      const reference=form.locator('.role-crew-inline-grid input[name="verificationReference"]');
      await expect(supervisor).toBeVisible();
      await expect(reference).toBeVisible();
      await expect(supervisor).toHaveAttribute("required","");
      await expect(reference).toHaveAttribute("required","");
    }
    await expect(form.getByRole("button",{name:"Save draft"})).toBeVisible();
    await expectNoHorizontalOverflow(page);
  };

  for(const viewport of F6_PRESENTATION_VIEWPORTS){
    for(const theme of ["light","dark"]){
      await applyF6PresentationState(page,viewport,theme);
      for(const state of ["PIC","DUAL","SAFETY_MANUAL","SAFETY_CONNECTION","SPIC","PICUS"])await assertState(state);
    }
  }
  resetSafetyPilotPicFixture();
});

test("F6 GPS single-flight matrix covers PIC DUAL Safety Pilot viewports themes and reflow",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F6 GPS matrix requires the isolated browser database.");
  resetF43GpsSafetyPilotFixture();
  await loginBrowserPilot(page,"/flights/new");
  await page.getByRole("button",{name:"Import GPS track"}).click();

  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>2026-10-03T22:00:00Z</when><when>2026-10-03T22:01:00Z</when><when>2026-10-03T22:02:00Z</when><when>2026-10-03T22:03:00Z</when><when>2026-10-03T22:04:00Z</when><when>2026-10-03T22:05:00Z</when>'+
    '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 500</gx:coord><gx:coord>14.18 50.16 800</gx:coord><gx:coord>14.24 50.20 850</gx:coord><gx:coord>14.29 50.24 500</gx:coord><gx:coord>14.31 50.26 300</gx:coord>'+
    '</gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"f6-gps-single.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");
  const role=gpsForm.locator('select[name="role"]');
  await expect(role.locator("option")).toHaveText(["PIC","DUAL","SAFETY PILOT"]);

  const assertState=async state=>{
    if(state==="PIC"){
      await role.selectOption("PIC");
      await expect(gpsForm.locator('input[name="instructor"][type="hidden"]')).toHaveCount(1);
    }else if(state==="DUAL"){
      await role.selectOption("DUAL");
      const instructor=gpsForm.locator('input[name="instructor"]:not([type="hidden"])');
      await expect(instructor).toBeVisible();
      await expect(instructor).toHaveAttribute("required","");
    }else if(state==="SAFETY_MANUAL"){
      await role.selectOption("SAFETY PILOT");
      const source=gpsForm.locator('select[name="actualPicMode"]');
      await source.selectOption("manual");
      const commander=gpsForm.locator('input[name="commander"]:not([type="hidden"])');
      await expect(commander).toBeVisible();
      await expect(commander).toHaveAttribute("required","");
    }else if(state==="SAFETY_CONNECTION"){
      await role.selectOption("SAFETY PILOT");
      const source=gpsForm.locator('select[name="actualPicMode"]');
      await source.selectOption("connected");
      const connected=gpsForm.locator('select[name="connectedPicUserId"]');
      await expect(connected).toBeVisible();
      await expect(connected.getByRole("option",{name:"Browser Friend"})).toHaveCount(1);
      await connected.selectOption("9002");
      await expect(connected).toHaveValue("9002");
    }
    await expect(gpsForm.locator(".flight-review-card").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  };

  for(const viewport of F6_PRESENTATION_VIEWPORTS){
    for(const theme of ["light","dark"]){
      await applyF6PresentationState(page,viewport,theme);
      for(const state of ["PIC","DUAL","SAFETY_MANUAL","SAFETY_CONNECTION"])await assertState(state);
    }
  }
  resetF43GpsSafetyPilotFixture();
});

test("F6 GPS multi-part inheritance override matrix stays usable at every required presentation state",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F6 GPS multi-part matrix requires the isolated browser database.");
  resetF43GpsSafetyPilotFixture();
  await loginBrowserPilot(page,"/flights/new");
  await page.getByRole("button",{name:"Import GPS track"}).click();

  const gpsForm=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>2026-10-03T22:20:00Z</when><when>2026-10-03T22:21:00Z</when><when>2026-10-03T22:22:00Z</when><when>2026-10-03T22:23:00Z</when><when>2026-10-03T22:24:00Z</when><when>2026-10-03T22:25:00Z</when>'+
    '<when>2026-10-03T22:26:00Z</when><when>2026-10-03T22:27:00Z</when><when>2026-10-03T22:28:00Z</when><when>2026-10-03T22:29:00Z</when><when>2026-10-03T22:30:00Z</when><when>2026-10-03T22:31:00Z</when>'+
    '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 500</gx:coord><gx:coord>14.17 50.15 800</gx:coord><gx:coord>14.21 50.18 850</gx:coord><gx:coord>14.25 50.21 500</gx:coord><gx:coord>14.29 50.24 300</gx:coord>'+
    '<gx:coord>14.33 50.27 300</gx:coord><gx:coord>14.37 50.30 500</gx:coord><gx:coord>14.41 50.33 800</gx:coord><gx:coord>14.45 50.36 850</gx:coord><gx:coord>14.49 50.39 500</gx:coord><gx:coord>14.53 50.42 300</gx:coord>'+
    '</gx:Track></kml>';
  await gpsForm.locator('input[name="kml"]').setInputFiles({name:"f6-gps-multipart.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gpsForm.getByRole("button",{name:/Add split/}).click();
  await expect(gpsForm.locator('input[name="partCount"]')).toHaveValue("2");
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");
  await gpsForm.locator('select[name="role"]').selectOption("DUAL");
  await gpsForm.locator('input[name="instructor"]').fill("F6 Common Instructor");
  await completeF43GpsPart(gpsForm,0,{offBlock:"22:20",takeoff:"22:21",landing:"22:24",onBlock:"22:25",note:"F6 inherited DUAL"});
  await completeF43GpsPart(gpsForm,1,{offBlock:"22:26",takeoff:"22:27",landing:"22:30",onBlock:"22:31",note:"F6 Safety Pilot override"});

  const first=gpsForm.locator(".flight-review-card").nth(0);
  const second=gpsForm.locator(".flight-review-card").nth(1);
  await second.getByRole("button",{name:"Override Role/Crew"}).click();
  await second.locator('select[name="part_1_roleCrew_role"]').selectOption("SAFETY PILOT");
  await second.locator('select[name="part_1_roleCrew_actualPicMode"]').selectOption("connected");
  await second.locator('select[name="part_1_roleCrew_connectedPicUserId"]').selectOption("9002");

  for(const viewport of F6_PRESENTATION_VIEWPORTS){
    for(const theme of ["light","dark"]){
      await applyF6PresentationState(page,viewport,theme);
      await expect(first.getByText("Common Role/Crew")).toBeVisible();
      await expect(first.getByText(/DUAL · F6 Common Instructor/)).toBeVisible();
      await expect(second.getByText("Flight Role/Crew override")).toBeVisible();
      await expect(second.getByText(/SAFETY PILOT · Browser Friend/)).toBeVisible();
      await expect(second.getByRole("button",{name:"Reset to common"})).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  }
  resetF43GpsSafetyPilotFixture();
});

test("F6 invalid-profile recovery remains explicit in Manual and GPS across the full presentation matrix",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated F6 invalid-profile matrix requires the isolated browser database.");
  await loginBrowserPilot(page,"/flights/new");

  const manual=page.locator("#new-flight-manual-form");
  await manual.locator('select[name="registration"]').selectOption("OK-BAD1");
  const manualContext=manual.locator("details.aircraft-context-section");
  await expect(manualContext).toHaveAttribute("open","");
  await expect(manualContext.locator("[data-aircraft-context-card]")).toContainText("Needs configuration");

  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gps=page.locator("form.kml-wizard");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track><when>2026-10-03T22:40:00Z</when><when>2026-10-03T22:41:00Z</when><gx:coord>14.1 50.1 300</gx:coord><gx:coord>14.2 50.2 500</gx:coord></gx:Track></kml>';
  await gps.locator('input[name="kml"]').setInputFiles({name:"f6-invalid-profile.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await gps.locator('select[name="registration"]').selectOption("OK-BAD1");
  const gpsContext=gps.locator("[data-aircraft-context-card]");
  await expect(gpsContext).toContainText("Needs configuration");

  for(const viewport of F6_PRESENTATION_VIEWPORTS){
    for(const theme of ["light","dark"]){
      await applyF6PresentationState(page,viewport,theme);

      await page.getByRole("button",{name:"Manual entry"}).click();
      await expect(manualContext.locator("[data-aircraft-context-card]")).toContainText("Needs configuration");
      await expect(manualContext.getByRole("link",{name:/Open Aircraft/})).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.getByRole("button",{name:"Import GPS track"}).click();
      await expect(gpsContext).toContainText("Needs configuration");
      await expect(gpsContext.getByRole("link",{name:/Open Aircraft/})).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  }
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
  await page.getByRole("button",{name:"Save draft"}).click();
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
  await form.getByRole("button",{name:"Save draft"}).click();
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

  await rejected.getByRole("button",{name:"Save draft"}).click();
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
