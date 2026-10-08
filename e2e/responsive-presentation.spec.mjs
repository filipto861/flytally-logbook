import { test,expect } from "@playwright/test";
import { expectNoHorizontalOverflow,loginBrowserPilot } from "./browser-actions.mjs";
import { openGpsFlightContext,selectGpsActualPicMode,selectGpsCommonRole,splitGpsIntoTwo,completeF43GpsPart } from "./gps-actions.mjs";
import { resetF43GpsSafetyPilotFixture,resetSafetyPilotPicFixture } from "./browser-db.mjs";

const authenticatedBrowser=process.env.FLYTALLY_AUTH_BROWSER==="1";

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
  await splitGpsIntoTwo(gpsForm);
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");
  await openGpsFlightContext(gpsForm);
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

test("F6 Manual RoleCrew matrix covers required roles modes viewports themes and 200 percent reflow",{tag:"@self-managed-presentation"},async({page})=>{
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

test("F6 GPS single-flight matrix covers PIC DUAL Safety Pilot viewports themes and reflow",{tag:"@self-managed-presentation"},async({page})=>{
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
      await selectGpsCommonRole(gpsForm,"PIC");
      await expect(gpsForm.locator('input[name="instructor"][type="hidden"]')).toHaveCount(1);
    }else if(state==="DUAL"){
      await selectGpsCommonRole(gpsForm,"DUAL");
      const instructor=gpsForm.locator('input[name="instructor"]:not([type="hidden"])');
      await expect(instructor).toBeVisible();
      await expect(instructor).toHaveAttribute("required","");
    }else if(state==="SAFETY_MANUAL"){
      await selectGpsCommonRole(gpsForm,"SAFETY PILOT");
      const source=await selectGpsActualPicMode(gpsForm,"manual");
      await expect(source).toHaveValue("manual");
      const commander=gpsForm.locator('input[name="commander"]:not([type="hidden"])');
      await expect(commander).toBeVisible();
      await expect(commander).toHaveAttribute("required","");
    }else if(state==="SAFETY_CONNECTION"){
      await selectGpsCommonRole(gpsForm,"SAFETY PILOT");
      const source=await selectGpsActualPicMode(gpsForm,"connected");
      await expect(source).toHaveValue("connected");
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

test("F6 GPS multi-part inheritance override matrix stays usable at every required presentation state",{tag:"@self-managed-presentation"},async({page})=>{
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
  await splitGpsIntoTwo(gpsForm);
  await gpsForm.locator('select[name="registration"]').selectOption("OK-E2E");
  await gpsForm.locator('select[name="operationType"]').selectOption("SP");
  await gpsForm.locator('select[name="engineType"]').selectOption("SE");
  await openGpsFlightContext(gpsForm);
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

test("F6 invalid-profile recovery remains explicit in Manual and GPS across the full presentation matrix",{tag:"@self-managed-presentation"},async({page})=>{
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
