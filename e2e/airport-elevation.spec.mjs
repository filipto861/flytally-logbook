import { test,expect } from "@playwright/test";
import { expectNoHorizontalOverflow,loginBrowserPilot } from "./browser-actions.mjs";
import { browserSqlScalar,runBrowserSql } from "./browser-db.mjs";

const authenticatedBrowser=process.env.FLYTALLY_AUTH_BROWSER==="1";

function resetElevationFixture(){
  // This helper is only callable in explicitly authenticated localhost browser mode.
  runBrowserSql("DELETE FROM airports WHERE user_id IN (9001,9002) AND ident IN ('ZZAE1','ZZAE2','ZZAE3');");
}

function storedElevation(code){
  return browserSqlScalar(`SELECT COALESCE(elevation_ft::text,'NULL') || '|' ||
    name || '|' || municipality || '|' || iso_country || '|' ||
    latitude_deg::text || '|' || longitude_deg::text
    FROM airports WHERE user_id=9001 AND ident='${code}'`);
}

test("Airport elevation add edit and clear preserves nullable persisted MSL values",async({page})=>{
  test.skip(!authenticatedBrowser,"Requires an explicitly isolated authenticated localhost browser database.");
  // This scenario navigates through six real server-action form submissions.
  test.setTimeout(90_000);
  resetElevationFixture();
  await loginBrowserPilot(page,"/database");
  await page.goto("/database?view=airports");
  await expect(page.getByRole("heading",{name:"Airport records"})).toBeVisible();

  const add=page.locator("form.u31-airport-editor");
  await add.locator('input[name="ident"]').fill("ZZAE1");
  await add.locator('input[name="name"]').fill("Elevation Test Strip");
  await add.locator('input[name="municipality"]').fill("Test Town");
  await add.locator('input[name="iso_country"]').fill("CZ");
  await add.locator('input[name="latitude_deg"]').fill("49.5");
  await add.locator('input[name="longitude_deg"]').fill("15.5");
  // Deliberately leave elevation blank: unknown must be persisted as NULL.
  await add.getByRole("button",{name:"Add / update"}).click();
  await expect(page).toHaveURL(/airportStatus=saved/);
  const original="Elevation Test Strip|Test Town|CZ|49.5|15.5";
  expect(storedElevation("ZZAE1")).toBe("NULL|"+original);

  // Submit through the REAL Next.js Server Action form, not an assumed
  // $ACTION_ID_ hidden field (not guaranteed in React/Next production DOM).
  // A modified input type permits a deliberately malformed payload to
  // exercise server-side validation even when the public UI uses type=number.
  await add.locator('input[name="ident"]').fill("ZZAE1");
  await add.locator('input[name="name"]').fill("MUST NOT PERSIST");
  // Keep the DOM mutation and genuine form submission in the SAME
  // browser task: React may re-render and restore type=number between awaits,
  // silently turning our malformed value into an empty (valid NULL) field.
  // Verify both the real HTML FormData and the outgoing POST payload.
  const invalidPost=page.waitForRequest(request=>
    request.method()==="POST" && new URL(request.url()).pathname==="/database");
  await add.evaluate(form=>{
    const input=form.querySelector('input[name="elevation_ft"]');
    const submit=form.querySelector('button[type="submit"]');
    if(!(input instanceof HTMLInputElement)||!(submit instanceof HTMLButtonElement)){
      throw new Error("Missing native airport field or submit button");
    }
    input.type="text";
    input.value="not-a-number";
    if(new FormData(form).get("elevation_ft")!=="not-a-number"){
      throw new Error("Malformed elevation missing from actual form data");
    }
    form.requestSubmit(submit);
  });
  const capturedInvalidPost=await invalidPost;
  expect(capturedInvalidPost.postData(),"Actual server-action request must contain the tested invalid payload")
    .toContain("not-a-number");
  await expect(page).toHaveURL(/airportStatus=invalid-elevation/);
  await expect(page.locator("p.form-error[role='alert']")).toContainText("valid airport elevation");
  expect(storedElevation("ZZAE1")).toBe("NULL|"+original);

  const custom=()=>page.locator(".u31-airport-panel").first()
    .locator("tbody tr").filter({hasText:"ZZAE1"});
  await expect(custom()).toContainText("—");

  async function editElevation(input,expected){
    const row=custom();
    await row.locator("details summary").click();
    const edit=row.locator("form.u31-airport-elevation-form");
    await edit.locator('input[name="elevation_ft"]').fill(input);
    await edit.getByRole("button",{name:"Save",exact:true}).click();
    await expect(page).toHaveURL(/airportStatus=saved/);
    await expect.poll(()=>storedElevation("ZZAE1"),{timeout:10_000})
      .toBe(expected+"|"+original);
    await page.reload();
  }

  await editElevation("0","0");
  await expect(custom()).toContainText("0 ft MSL");
  await editElevation("-120.5","-120.5");
  await expect(custom()).toContainText("-120.5 ft MSL");
  await editElevation("","NULL");
  await expect(custom()).toContainText("—");

  // The pre-existing static CSV remains a reference-only catalogue.
  const catalogue=page.locator(".u31-airport-panel").nth(1);
  await catalogue.locator('input[name="airportSearch"]').fill("LKPR");
  await catalogue.getByRole("button",{name:"Search"}).click();
  await expect(catalogue.locator("tbody tr").filter({hasText:"LKPR"}).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Airport elevation server action refuses a cross-user forged edit",async({page,browser})=>{
  test.skip(!authenticatedBrowser,"Requires an explicitly isolated authenticated localhost browser database.");
  test.setTimeout(60_000);
  resetElevationFixture();
  // Each user owns a real airport record and can see an actual elevation
  // form. No forged/assumed Next.js action ID or manual fetch protocol.
  runBrowserSql(`INSERT INTO airports
    (user_id,ident,name,municipality,iso_country,latitude_deg,longitude_deg,elevation_ft,source)
    VALUES
      (9001,'ZZAE2','Owner Strip','Owner Town','CZ',49.1,15.1,345,'Manual'),
      (9002,'ZZAE3','Other Strip','Other Town','CZ',49.2,15.2,456,'Manual')`);
  const ownerId=browserSqlScalar("SELECT id::text FROM airports WHERE user_id=9001 AND ident='ZZAE2'");
  const otherId=browserSqlScalar("SELECT id::text FROM airports WHERE user_id=9002 AND ident='ZZAE3'");
  expect(ownerId).toMatch(/^[0-9]+$/);
  expect(otherId).toMatch(/^[0-9]+$/);
  expect(ownerId).not.toBe(otherId);

  await loginBrowserPilot(page,"/database");
  await page.goto("/database?view=airports");
  const ownerRow=page.locator(".u31-airport-panel").first()
    .locator("tbody tr").filter({hasText:"ZZAE2"});
  await expect(ownerRow).toBeVisible();
  await expect(ownerRow).toContainText("345 ft MSL");

  // A second authenticated user must not see the first user's airport.
  const other=await browser.newContext({baseURL:"http://127.0.0.1:3000"});
  try{
    const otherPage=await other.newPage();
    await otherPage.goto("/login?returnTo=%2Fdatabase");
    await otherPage.getByLabel("Email").fill("browser-friend@example.test");
    await otherPage.getByLabel("Password").fill(process.env.FLYTALLY_BROWSER_PASSWORD||"FlyTally-Browser-2026!");
    await otherPage.getByRole("button",{name:"Sign in"}).click();
    await expect(otherPage).toHaveURL("http://127.0.0.1:3000/database");
    await otherPage.goto("/database?view=airports");
    const custom=otherPage.locator(".u31-airport-panel").first();
    await expect(custom.locator("tbody tr").filter({hasText:"ZZAE2"})).toHaveCount(0);
    const otherRow=custom.locator("tbody tr").filter({hasText:"ZZAE3"});
    await expect(otherRow).toBeVisible();
    await otherRow.locator("details summary").click();
    const otherEditor=otherRow.locator("form.u31-airport-elevation-form");
    const idInput=otherEditor.locator('input[name="id"]');
    await expect(idInput).toHaveValue(otherId);
    await otherEditor.locator('input[name="elevation_ft"]').fill("777");
    // IDOR attempt: change only the form's record identifier to the first
    // user's ID, preserving the signed-in second user's genuine action.
    await idInput.evaluate((input,value)=>{input.value=value;},ownerId);
    await expect(idInput).toHaveValue(ownerId);
    await otherEditor.getByRole("button",{name:"Save",exact:true}).click();
    await expect(otherPage).toHaveURL(/airportStatus=not-found/);
    await expect(otherPage.locator("p.form-error[role='alert']")).toContainText("not available for editing");

    expect(storedElevation("ZZAE2")).toBe("345|Owner Strip|Owner Town|CZ|49.1|15.1");
    expect(browserSqlScalar("SELECT elevation_ft::text FROM airports WHERE user_id=9002 AND ident='ZZAE3'")).toBe("456");
    await expect(otherPage.locator(".u31-airport-panel").first()
      .locator("tbody tr").filter({hasText:"ZZAE2"})).toHaveCount(0);
  }finally{
    await other.close();
  }
});
