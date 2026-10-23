import {test,expect} from "@playwright/test";
import {loginBrowserPilot,expectNoHorizontalOverflow} from "./browser-actions.mjs";

const authenticated=process.env.FLYTALLY_AUTH_BROWSER==="1";

test("N3-M1 Manual shows existing missing details at the top and focuses them",async({page})=>{
  test.skip(!authenticated,"Isolated authenticated browser fixture required.");
  await loginBrowserPilot(page,"/flights/new");
  const form=page.locator("#new-flight-manual-form");
  const review=form.locator(".entry-review-status");
  await expect(review).toBeVisible();
  await expect(review).toContainText("Aircraft");
  await review.getByRole("button",{name:"Aircraft",exact:true}).click();
  await expect(form.locator('select[name="registration"]')).toBeFocused();
  await form.locator('select[name="registration"]').selectOption("OK-E2E");
  await form.locator('select[name="role"]').selectOption("DUAL");
  await expect(review.getByRole("button",{name:"Instructor / PIC"})).toBeVisible();
  await review.getByRole("button",{name:"Instructor / PIC"}).click();
  await expect(form.locator('input[name="instructor"]')).toBeFocused();
  await expect(form.getByRole("button",{name:"Save draft"})).toBeVisible();
  await expect(form.getByRole("button",{name:"Save & certify flight"})).toBeVisible();
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:844});
    await expect(review).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("N3-M1 GPS review starts with source error then links to real aircraft control",async({page})=>{
  test.skip(!authenticated,"Isolated authenticated browser fixture required.");
  await loginBrowserPilot(page,"/flights/new");
  await page.getByRole("button",{name:"Import GPS track"}).click();
  const gps=page.locator("form.kml-wizard");
  const review=gps.locator(".entry-review-status");
  await expect(review).toContainText("Upload a KML, GPX or CSV track");
  const source=gps.locator('input[name="kml"]');
  await source.setInputFiles({name:"invalid.csv",mimeType:"text/csv",buffer:Buffer.from("not,a,gps,track\n")});
  await expect(review).toContainText("Choose a GPS source with usable flight data");
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>2026-10-05T16:00:00Z</when><when>2026-10-05T16:01:00Z</when><when>2026-10-05T16:02:00Z</when><when>2026-10-05T16:03:00Z</when>'+
    '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.14 50.13 600</gx:coord><gx:coord>14.20 50.18 650</gx:coord><gx:coord>14.24 50.21 300</gx:coord>'+
    '</gx:Track></kml>';
  await source.setInputFiles({name:"n3-m1-valid.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await expect(review.getByRole("button",{name:"Select aircraft"})).toBeVisible();
  await review.getByRole("button",{name:"Select aircraft"}).click();
  await expect(gps.locator('select[name="registration"]')).toBeFocused();
  await expectNoHorizontalOverflow(page);
});
