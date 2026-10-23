import { test,expect } from "@playwright/test";
import { expectNoHorizontalOverflow,loginBrowserPilot } from "./browser-actions.mjs";

const authenticated=process.env.FLYTALLY_AUTH_BROWSER==="1";

test("N2-C period presets and Custom stay on one row across cockpit viewports and themes",{tag:"@self-managed-presentation"},async({page})=>{
  test.skip(!authenticated,"Requires an isolated authenticated browser fixture.");
  await loginBrowserPilot(page,"/statistics");

  const period=page.getByRole("navigation",{name:"Statistics period"});
  const custom=page.locator(".statistics-custom-range > summary");
  for(const viewport of [
    {width:1440,height:900},
    {width:1024,height:768},
    {width:768,height:1024},
    {width:390,height:844},
    {width:320,height:800},
  ]){
    await page.setViewportSize(viewport);
    for(const theme of ["light","dark"]){
      await page.evaluate(value=>{document.documentElement.dataset.theme=value},theme);
      await expect(period).toBeVisible();
      await expect(custom).toBeVisible();
      const presetBounds=await period.boundingBox();
      const customBounds=await custom.boundingBox();
      expect(presetBounds).not.toBeNull();
      expect(customBounds).not.toBeNull();
      expect(Math.abs(presetBounds.y-customBounds.y),"Custom dates should not wrap below the preset period controls").toBeLessThanOrEqual(6);
      await expectNoHorizontalOverflow(page);
    }
  }
});

test("N2-C custom dates require Apply, retain navigation scope and reject reversed deep links",async({page})=>{
  test.skip(!authenticated,"Requires an isolated authenticated browser fixture.");
  await loginBrowserPilot(page,"/statistics");

  const disclosure=page.locator("details.statistics-custom-range");
  await expect(disclosure).not.toHaveAttribute("open","");
  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveAttribute("open","");
  await page.getByLabel("From",{exact:true}).fill("2026-09-18");
  await page.getByLabel("To",{exact:true}).fill("2026-09-18");
  expect(new URL(page.url()).searchParams.get("period")).not.toBe("custom");
  await disclosure.getByRole("button",{name:"Apply"}).click();
  await expect(page).toHaveURL(/period=custom/);
  const selected=new URL(page.url()).searchParams;
  expect(selected.get("from")).toBe("2026-09-18");
  expect(selected.get("to")).toBe("2026-09-18");
  await expect(disclosure).toHaveAttribute("data-selected","true");
  await expect(disclosure).not.toHaveAttribute("open","");
  await expect(page.getByText("2026-09-18 – 2026-09-18")).toBeVisible();
  await expect(page.locator("section.metric-grid")).toBeVisible();

  await page.getByRole("navigation",{name:"Statistics category"}).getByRole("link",{name:"Aeroplane",exact:true}).click();
  let next=new URL(page.url()).searchParams;
  expect(next.get("category")).toBe("AEROPLANE");
  expect(next.get("period")).toBe("custom");
  expect(next.get("from")).toBe("2026-09-18");
  expect(next.get("to")).toBe("2026-09-18");

  await page.getByRole("navigation",{name:"Statistics section"}).getByRole("link",{name:"Experience",exact:true}).click();
  next=new URL(page.url()).searchParams;
  expect(next.get("section")).toBe("experience");
  expect(next.get("period")).toBe("custom");
  expect(next.get("from")).toBe("2026-09-18");

  await page.getByRole("navigation",{name:"Statistics period"}).getByRole("link",{name:"This year"}).click();
  next=new URL(page.url()).searchParams;
  expect(next.get("period")).toBe("year");
  expect(next.has("from")).toBe(false);
  expect(next.has("to")).toBe(false);

  await page.goto("/statistics?period=custom&section=overview&from=2026-09-30&to=2026-09-01");
  await expect(page.getByRole("alert")).toContainText("Start date must not be after end date");
  await expect(page.locator("section.metric-grid")).toHaveCount(0);
  await expect(page.locator("details.statistics-custom-range > summary")).toBeVisible();
});
