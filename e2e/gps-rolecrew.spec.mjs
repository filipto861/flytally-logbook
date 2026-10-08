import { test,expect } from "@playwright/test";
import { expectNoHorizontalOverflow,loginBrowserPilot } from "./browser-actions.mjs";
import { openGpsFlightContext,selectGpsCommonRole,splitGpsIntoTwo,completeF43GpsPart } from "./gps-actions.mjs";
import { browserSqlScalar,runBrowserFlightFixtureCleanup,resetGpsNormalizedImportFixture,resetF41CommonRoleCrewFixture,resetF42WholePartRoleCrewFixture,resetF43GpsSafetyPilotFixture,renameSafetyPilotPicFixture,revokeSafetyPilotPicConnectionFixture } from "./browser-db.mjs";

const authenticatedBrowser=process.env.FLYTALLY_AUTH_BROWSER==="1";

test("3.4.0 single GPS Save & certify seals the imported persisted row",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated 3.4.0 GPS completion coverage requires the isolated browser database.");
  runBrowserFlightFixtureCleanup(`
    DELETE FROM flight_tracks WHERE user_id=9001 AND flight_id IN (SELECT id FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-05' AND off_block='14:00');
    DELETE FROM flights WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-05' AND off_block='14:00';
  `);
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

  await openGpsFlightContext(gpsForm);
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

  await openGpsFlightContext(gpsForm);
  await registration.selectOption("OK-ULL1");
  await expect(gpsForm.locator('input[name="aircraftClass"]')).toHaveValue("ULL");
  await expect(gpsForm.locator('input[name="evidence"]')).toHaveValue("ULL");
  await expect(gpsForm.locator("[data-aircraft-context-card]")).toContainText("ULL · UL");
  await expect(gpsForm.locator('select[name="operationType"]')).toHaveValue("");
  await expect(gpsForm.locator('select[name="engineType"]')).toHaveValue("");
  await expect(gpsForm.locator('input[name="part_0_movementEvidenceRecorded"]')).toHaveCount(0);

  await openGpsFlightContext(gpsForm);
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
  await Promise.all([
    page.waitForURL(/\/flights\/\d+\?tab=logbook(?:&saved=1)?$/,{timeout:15000}),
    gpsForm.getByRole("button",{name:"Save draft"}).click(),
  ]);
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
  await openGpsFlightContext(gpsForm);
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
  await splitGpsIntoTwo(gpsForm);
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

  const commonRole=await selectGpsCommonRole(gpsForm,"DUAL");
  await expect(gpsForm.getByRole("button",{name:"Save 2 flight drafts"})).toHaveCount(0);
  await selectGpsCommonRole(gpsForm,"PIC");
  await expect(commonRole).toHaveValue("PIC");
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
  await splitGpsIntoTwo(gpsForm);
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
  await openGpsFlightContext(gpsForm);
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
  await openGpsFlightContext(gpsForm);
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
  await splitGpsIntoTwo(gpsForm);
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


