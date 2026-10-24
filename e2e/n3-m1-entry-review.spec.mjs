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
  await expect(form.locator(".entry-section-primary > .section-kicker")).toHaveText("Flight basics");
  await expect(form.locator(".n3-m2-section-intro")).toContainText("Crew details appear here");
  await expect(form.locator(".n3-m2-route-lead")).toContainText("Route & UTC times");
  await expect(form.locator('input[name="departure"]')).toHaveValue("");
  await expect(form.locator('input[name="offBlock"]')).toHaveValue("");
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
    for(const theme of ["light","dark"]){
      await page.evaluate(value=>{document.documentElement.dataset.theme=value},theme);
      await expect(review).toBeVisible();
      await expect(form.locator(".n3-m2-route-lead")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
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
  await expect(source).toHaveCount(1);
  await expect(source).toHaveAttribute("required","");
  await expect(gps.locator(".upload-zone")).toHaveCount(0);
  const initialPicker=page.waitForEvent("filechooser");
  await review.getByRole("button",{name:"Upload a KML, GPX or CSV track"}).click();
  await (await initialPicker).setFiles({name:"invalid.csv",mimeType:"text/csv",buffer:Buffer.from("not,a,gps,track\n")});
  await expect(review).toContainText("Choose a GPS source with usable flight data");
  await expect(review.getByRole("button",{name:"Change GPS track"})).toBeVisible();
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>2026-10-05T16:00:00Z</when><when>2026-10-05T16:01:00Z</when><when>2026-10-05T16:02:00Z</when><when>2026-10-05T16:03:00Z</when>'+
    '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.14 50.13 600</gx:coord><gx:coord>14.20 50.18 650</gx:coord><gx:coord>14.24 50.21 300</gx:coord>'+
    '</gx:Track></kml>';
  const replacementPicker=page.waitForEvent("filechooser");
  await review.getByRole("button",{name:"Change GPS track"}).click();
  await (await replacementPicker).setFiles({name:"n3-m1-valid.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await expect(gps.getByRole("status")).toContainText("n3-m1-valid.kml");
  await expect(review.getByRole("button",{name:"Change GPS track"})).toBeVisible();
  await expect(review.getByRole("button",{name:"Select aircraft"})).toBeVisible();
  await review.getByRole("button",{name:"Select aircraft"}).click();
  await expect(gps.locator('select[name="registration"]')).toBeFocused();

  // A browser file read failure should not leave an apparently ready stale import.
  // Exercise the existing native picker, then recover using that same top action.
  await page.evaluate(()=>{
    const original=File.prototype.text;
    File.prototype.text=function(...args){
      if(this.name==="n3-unreadable.kml")return Promise.reject(new Error("Synthetic read failure"));
      return original.apply(this,args);
    };
  });
  const unreadablePicker=page.waitForEvent("filechooser");
  await review.getByRole("button",{name:"Change GPS track"}).click();
  await (await unreadablePicker).setFiles({name:"n3-unreadable.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await expect(gps.getByRole("alert")).toContainText("Unable to read the selected GPS file");
  await expect(review.getByRole("button",{name:"Upload a KML, GPX or CSV track"})).toBeVisible();
  await expect(gps.getByRole("status")).toHaveCount(0);

  const recoveredPicker=page.waitForEvent("filechooser");
  await review.getByRole("button",{name:"Upload a KML, GPX or CSV track"}).click();
  await (await recoveredPicker).setFiles({name:"n3-recovered.kml",mimeType:"application/vnd.google-earth.kml+xml",buffer:Buffer.from(kml)});
  await expect(gps.getByRole("alert")).toHaveCount(0);
  await expect(gps.getByRole("status")).toContainText("n3-recovered.kml");
  await expect(review.getByRole("button",{name:"Change GPS track"})).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
