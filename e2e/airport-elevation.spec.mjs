import { test,expect } from "@playwright/test";
import { expectNoHorizontalOverflow,loginBrowserPilot } from "./browser-actions.mjs";
import { browserSqlScalar,runBrowserSql } from "./browser-db.mjs";

const authenticatedBrowser=process.env.FLYTALLY_AUTH_BROWSER==="1";

function resetElevationFixture(){
  // This helper is only callable in explicitly authenticated localhost browser mode.
  runBrowserSql("DELETE FROM airports WHERE user_id IN (9001,9002) AND ident IN ('ZZAE1','ZZAE2');");
}

function storedElevation(code){
  return browserSqlScalar(`SELECT COALESCE(elevation_ft::text,'NULL') || '|' ||
    name || '|' || municipality || '|' || iso_country || '|' ||
    latitude_deg::text || '|' || longitude_deg::text
    FROM airports WHERE user_id=9001 AND ident='${code}'`);
}

test("Airport elevation add edit and clear preserves nullable persisted MSL values",async({page})=>{
  test.skip(!authenticatedBrowser,"Requires an explicitly isolated authenticated localhost browser database.");
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
    expect(storedElevation("ZZAE1")).toBe(expected+"|"+original);
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
  resetElevationFixture();
  runBrowserSql(`INSERT INTO airports
    (user_id,ident,name,municipality,iso_country,latitude_deg,longitude_deg,elevation_ft,source)
    VALUES (9001,'ZZAE2','Owner Strip','Owner Town','CZ',49.1,15.1,345,'Manual')`);

  await loginBrowserPilot(page,"/database");
  await page.goto("/database?view=airports");
  const row=page.locator(".u31-airport-panel").first()
    .locator("tbody tr").filter({hasText:"ZZAE2"});
  await expect(row).toBeVisible();
  await row.locator("details summary").click();
  const editor=row.locator("form.u31-airport-elevation-form");
  const actionInput=editor.locator('input[name^="$ACTION_ID_"]').first();
  await expect(actionInput).toHaveCount(1);
  const actionName=await actionInput.getAttribute("name");
  const recordId=await editor.locator('input[name="id"]').getAttribute("value");
  expect(actionName).toMatch(new RegExp("^\\$ACTION_ID_"));
  expect(recordId).toMatch(new RegExp("^\\d+$"));

  // The second fixture account is authenticated separately, not granted access to the first.
  const other=await browser.newContext();
  try{
    const otherPage=await other.newPage();
    await otherPage.goto("/login?returnTo=%2Fdatabase");
    await otherPage.getByLabel("Email").fill("browser-friend@example.test");
    await otherPage.getByLabel("Password").fill(process.env.FLYTALLY_BROWSER_PASSWORD||"FlyTally-Browser-2026!");
    await otherPage.getByRole("button",{name:"Sign in"}).click();
    await expect(otherPage).toHaveURL("http://127.0.0.1:3000/database");

    // Deliberately submit the owner's genuine Server Action ID from another session.
    const result=await otherPage.evaluate(async({actionName,recordId})=>{
      const form=new FormData();
      form.set(actionName,"");
      form.set("id",recordId);
      form.set("elevation_ft","777");
      const response=await fetch("/database?view=airports",{
        method:"POST",body:form,credentials:"same-origin",redirect:"follow",
      });
      return {status:response.status,url:response.url};
    },{actionName,recordId});
    expect(result.url).toContain("airportStatus=not-found");
    expect(storedElevation("ZZAE2")).toBe("345|Owner Strip|Owner Town|CZ|49.1|15.1");

    await otherPage.goto("/database?view=airports");
    await expect(otherPage.locator(".u31-airport-panel").first().getByText("ZZAE2")).toHaveCount(0);
  }finally{
    await other.close();
  }
});
