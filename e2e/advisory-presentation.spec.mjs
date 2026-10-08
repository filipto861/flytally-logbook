import { test,expect } from "@playwright/test";
import { expectNoHorizontalOverflow,loginBrowserPilot } from "./browser-actions.mjs";
import { browserSqlScalar,runBrowserSql,resetAccountSettingsFixture,setE13NightDefinitionFixture,resetE14LegacyTaskFixture,clearE14LegacyTaskFixture } from "./browser-db.mjs";

const authenticatedBrowser=process.env.FLYTALLY_AUTH_BROWSER==="1";

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

test("3.5.2 Settings ignores legacy Night definition preference and exposes no account control",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated 3.5.2 Settings coverage requires the isolated browser database.");
  resetAccountSettingsFixture();
  setE13NightDefinitionFixture("MANUAL");
  try{
    await loginBrowserPilot(page,"/profile");
    await expect(page.getByLabel("Night definition")).toHaveCount(0);
    await expect(page.getByLabel("Time zone")).toBeVisible();
    expect(browserSqlScalar("SELECT COALESCE(preferences_json->>'night_definition','') FROM user_settings WHERE user_id=9001")).toBe("MANUAL");
  }finally{
    resetAccountSettingsFixture();
  }
});

test("3.5.2 legacy MANUAL preference does not suppress applicable GPS SERA suggestions",async({page})=>{
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
    await expect(day).toHaveValue("1");
    await expect(night).toHaveValue("0");
    await expect(day).toHaveAttribute("aria-describedby",/part-0-landing-suggestion/);
    await expect(gps.getByText("SERA civil-twilight suggestion")).toHaveCount(1);
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
