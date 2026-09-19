import { test,expect } from "@playwright/test";

const authenticatedBrowser=process.env.FLYTALLY_AUTH_BROWSER==="1";

async function loginBrowserPilot(page,returnTo){
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("E-mail").fill("browser-auth@example.test");
  await page.getByLabel("Password").fill(process.env.FLYTALLY_BROWSER_PASSWORD||"");
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page).toHaveURL(new RegExp(`${returnTo}(?:\\?|$)`));
}

async function expectNoHorizontalOverflow(page){
  const state=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
  }));
  expect(state.scrollWidth-state.viewport,JSON.stringify(state)).toBeLessThanOrEqual(1);
}

test("U7 audited routes share one page rhythm without desktop or mobile overflow",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated route audit requires the isolated CI database.");
  await loginBrowserPilot(page,"/dashboard");

  const routes=[
    ["/map","Airports and routes"],
    ["/statistics","Your flying over time"],
    ["/flights/new","New flight"],
    ["/actions","Actions"],
    ["/notifications","Notifications"],
  ];

  for(const [href,heading] of routes){
    await page.goto(href);
    await expect(page.getByRole("heading",{name:heading,level:1})).toBeVisible();
    await expect(page.locator(".ui-page-stack").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
