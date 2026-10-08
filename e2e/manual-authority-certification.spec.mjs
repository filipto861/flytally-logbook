import { test,expect } from "@playwright/test";
import { expectNoHorizontalOverflow,holdPost,loginBrowserPilot } from "./browser-actions.mjs";
import { browserSqlScalar,runBrowserSql,runBrowserFlightFixtureCleanup,resetIntelligentReviewFormScopeFixture,resetF35SnapshotFixture,resetF35QuickAddFixture,resetF35AuthorityFixtures,mutateF35ProfileAfterRender } from "./browser-db.mjs";

const authenticatedBrowser=process.env.FLYTALLY_AUTH_BROWSER==="1";

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
  await expect(page.locator("#quick-aircraft-dialog")).toBeHidden({timeout:15000});
  await expect(page.getByRole("status")).toContainText(
    "Aircraft added. Select it below to continue with the flight.",
    {timeout:15000},
  );

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
  runBrowserFlightFixtureCleanup("DELETE FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-05' AND off_block IN ('12:00','13:00');");
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

test("3.5.0 certified flight can be voided from active logbook while permanent audit remains",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated 3.5.0 certified-void acceptance requires the isolated browser database.");

  const project=test.info().project.name;
  const offBlock=project.includes("mobile")?"17:00":"16:00";
  const takeoff=project.includes("mobile")?"17:05":"16:05";
  const landing=project.includes("mobile")?"17:55":"16:55";
  const onBlock=project.includes("mobile")?"18:00":"17:00";
  const reason=`3.5.0 browser acceptance ${project}`;
  runBrowserSql("DELETE FROM user_notifications WHERE user_id=9001 AND kind='m5_void_source'");

  await loginBrowserPilot(page,"/flights/new");
  const form=page.locator("#new-flight-manual-form");
  await form.locator('input[name="date"]').fill("2026-10-06");
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
  const aircraftContext=form.locator("details.aircraft-context-section");
  if(!(await aircraftContext.getAttribute("open")))await aircraftContext.locator("summary").click();
  await form.locator('select[name="operationType"]').selectOption("SP");
  await form.locator('select[name="engineType"]').selectOption("SE");

  await form.getByRole("button",{name:"Save & certify flight"}).click();
  await expect(page).toHaveURL(/\/flights\/\d+(?:\?.*)?$/,{timeout:15000});
  await expect(page.locator(".flight-lock-badge")).toContainText("CERTIFIED R1",{timeout:15000});
  const detailUrl=page.url();
  const flightMatch=detailUrl.match(/\/flights\/(\d+)/);
  expect(flightMatch).toBeTruthy();
  const flightId=Number(flightMatch?.[1]||0);
  expect(flightId).toBeGreaterThan(0);
  expect(browserSqlScalar(`SELECT CASE WHEN certified_at IS NOT NULL THEN certification_version::text||'|'||length(certification_hash)::text ELSE 'DRAFT' END FROM flights WHERE id=${flightId} AND user_id=9001`)).toBe("8|64");
  runBrowserSql(`INSERT INTO user_notifications(user_id,kind,title,body,href,dedupe_key)
    VALUES(9001,'m5_void_source','M5 void source notification','Browser acceptance','/flights/${flightId}','m5-void:${flightId}')
    ON CONFLICT(user_id,dedupe_key) DO UPDATE SET href=EXCLUDED.href,created_at=NOW(),read_at=NULL`);

  const more=page.locator("details.flight-detail-more");
  await more.locator("summary").click();
  const launch=more.getByRole("button",{name:"Remove certified flight"});
  await expect(launch).toBeVisible();
  await launch.click();

  const dialog=page.getByRole("dialog",{name:"Remove certified flight?"});
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("It will no longer appear in Flights, totals, statistics, map, exports or recency/compliance calculations.");
  await expect(dialog).toContainText("The original certification, revision history and removal reason stay permanently preserved in the audit record.");
  const reasonField=dialog.getByLabel(/Reason for removal/);
  await reasonField.fill(reason);

  const gate=await holdPost(page,"**/flights/**");
  const remove=dialog.getByRole("button",{name:"Remove certified flight"});
  const clicking=remove.click();
  const pending=dialog.getByRole("button",{name:"Removing…"});
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy","true");
  await page.evaluate(()=>document.querySelector(".certified-void-dialog form button[type='submit']")?.click());
  await page.waitForTimeout(100);
  expect(gate.count()).toBe(1);
  gate.release();
  await clicking;
  await gate.cleanup();

  await expect.poll(async()=>{
    if(/\/flights\?.*voided=1.*audit=\d+/.test(page.url()))return"redirected";
    const alert=page.getByRole("alert").first();
    if(await alert.count()){
      const message=String(await alert.textContent()||"").trim();
      if(message)return`error:${message}`;
    }
    return"pending";
  },{timeout:15000,intervals:[100,250,500]}).toBe("redirected");

  expect(browserSqlScalar(`SELECT COUNT(*) FROM flights WHERE id=${flightId} AND user_id=9001`)).toBe("0");
  const tombstoneId=Number(browserSqlScalar(`SELECT id FROM voided_certified_flights WHERE original_flight_id=${flightId} AND user_id=9001`));
  expect(tombstoneId).toBeGreaterThan(0);

  await expect(page).toHaveURL(/\/flights\?.*voided=1.*audit=\d+/);
  await expect(page.getByRole("status")).toContainText("Certified flight removed from the active logbook.");
  await expect(page.getByRole("status")).toContainText("It no longer contributes to totals, statistics, exports or recency.");

  expect(browserSqlScalar(`SELECT void_reason FROM voided_certified_flights WHERE id=${tombstoneId}`)).toBe(reason);
  expect(browserSqlScalar(`SELECT CASE WHEN length(certification_hash)=64 AND length(flight_snapshot_sha256)=64 THEN 'OK' ELSE 'BAD' END FROM voided_certified_flights WHERE id=${tombstoneId}`)).toBe("OK");
  expect(browserSqlScalar(`SELECT href FROM user_notifications WHERE user_id=9001 AND dedupe_key='m5-void:${flightId}'`)).toBe(`/audit/voided-flights/${tombstoneId}`);
  expect(browserSqlScalar(`SELECT CASE WHEN read_at IS NOT NULL THEN 'READ' ELSE 'UNREAD' END FROM user_notifications WHERE user_id=9001 AND dedupe_key='m5-void:${flightId}'`)).toBe("READ");

  const removedFlightLink=page.locator(`a.flight-route-link[href^="/flights/${flightId}"]`);
  await expect(removedFlightLink).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link",{name:"View permanent audit record"}).click();
  await expect(page).toHaveURL(new RegExp(`/audit/voided-flights/${tombstoneId}$`));
  await expect(page.getByRole("heading",{name:/OK-E2E ·/})).toBeVisible();
  await expect(page.getByText("VOIDED",{exact:true})).toBeVisible();
  await expect(page.getByText("Not active logbook data")).toBeVisible();
  await expect(page.getByText(reason,{exact:true})).toBeVisible();
  await expect(page.getByText("Verified",{exact:true}).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(`/flights/${flightId}/audit`);
  await expect(page).toHaveURL(new RegExp(`/audit/voided-flights/${tombstoneId}$`));

  await page.goto("/notifications");
  const history=page.locator("article.notification-card").filter({hasText:"M5 void source notification"});
  await expect(history).toHaveCount(1);
  await history.getByRole("link",{name:"Open"}).click();
  await expect(page).toHaveURL(new RegExp(`/audit/voided-flights/${tombstoneId}$`));
  await expect(page.getByText("VOIDED",{exact:true})).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
